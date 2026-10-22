// End-to-end check of the app in a real browser: serves public/, replaces the database with an in-memory copy,
// loads the sample data and opens every main page as an admin, a division manager and a site worker.
// Fails on any page error or empty page. Run: node tests/e2e/app.cjs
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(__dirname, '../../public');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(root, u === '/' ? 'index.html' : u);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
const MOCK = () => {
  const store = { docs: {}, cols: {} }, subs = [];
  const snapDoc = p => ({ exists: !!store.docs[p], data: () => store.docs[p], id: p.split('/').pop() });
  const snapCol = c => ({ docs: (store.cols[c] || []).map(r => ({ id: r.id, data: () => r })) });
  const fire = () => subs.forEach(s => s());
  let n = 0;
  const col = (c, filt) => ({
    where: (f, op, v) => col(c, r => r[f] === v),
    onSnapshot: cb => { const s = () => cb({ docs: snapCol(c).docs.filter(d => !filt || filt(d.data())) }); subs.push(s); s(); return () => {}; },
    add: async row => { const id = 'm' + (++n); (store.cols[c] = store.cols[c] || []).push({ ...row, id }); fire(); return { id }; },
    doc: id => doc(c + '/' + id),
    get: async () => snapCol(c),
  });
  const doc = p => ({
    onSnapshot: cb => { const s = () => cb(snapDoc(p)); subs.push(s); s(); return () => {}; },
    set: async v => { store.docs[p] = v; fire(); },
    get: async () => snapDoc(p),
    update: async v => {
      const [c, id] = [p.slice(0, p.lastIndexOf('/')), p.slice(p.lastIndexOf('/') + 1)];
      const r = (store.cols[c] || []).find(x => x.id === id); if (r) Object.assign(r, v); else store.docs[p] = { ...(store.docs[p] || {}), ...v }; fire();
    },
    delete: async () => { delete store.docs[p]; fire(); },
  });
  return { collection: c => col(c), doc, bulkInsert: async (t, rows) => { (store.cols[t] = store.cols[t] || []).push(...rows.map(r => ({ ...r, id: r.id || 'b' + (++n) }))); fire(); }, _store: store };
};
const VIEWS = ['exec', 'casehome', 'incm', 'lactions', 'inspm', 'walk', 'train', 'leaders', 'hdata', 'flows', 'settings', 'access', 'ceo', 'env', 'auto'];
const IGNORE = /createClient|supabase|Failed to fetch|NetworkError|ERR_/i;
(async () => {
  await new Promise(r => server.listen(4319, '127.0.0.1', r));
  const browser = await chromium.launch({ headless: true });
  const problems = [];
  for (const who of ['admin', 'division', 'worker']) {
    for (const w of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width: w, height: 900 } });
      const errors = [];
      page.on('pageerror', e => { if (!IGNORE.test(e.message)) errors.push(e.message.slice(0, 200)); });
      await page.route('**/*', r => r.request().url().startsWith('http://127.0.0.1:4319') ? r.continue() : r.abort());
      await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
      await page.goto('http://127.0.0.1:4319/', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(800);
      await page.evaluate(async ([mockSrc, who]) => {
        const MOCK = eval('(' + mockSrc + ')');
        L.db = MOCK(); L.me = { id: 'u-me', name: 'Test User', email: 't@example.com' }; L.owner = who === 'admin'; L.members = {};
        L.user = { search: async () => [], profiles: async () => ({}) }; L.ai = async () => ({}); L.photoUrl = async () => ''; L.uploadPhoto = async () => '';
        L.ready = true; L.state = 'ok'; L.projects = [];
        try { if (typeof CX !== 'undefined') CX.loaded = true; } catch (e) {}
        await loadDemo();
        L.projects = L.db._store.docs['admin/projects'].list;
        const c = L.db._store.cols;
        L.reports = (c.reports || []).sort((a, b) => b.ts - a.ts); L.actions = c.actions || []; L.inspAll = c.inspections || [];
        L.inspections = L.inspAll.filter(i => i.status !== 'Scheduled'); L.activities = c.activities || []; L.records = c.hsse_records || [];
        L.dataLoads = { reports: 'ready', actions: 'ready', inspections: 'ready', activities: 'ready', records: 'ready' }; L.subKey = '*';
        if (who === 'division') L.members['u-me'] = { role: 'hse', scopeLevel: 'division', scopeValue: L.projects[0].division, projects: [] };
        if (who === 'worker') L.members['u-me'] = { role: 'worker', scopeLevel: 'project', projects: [L.projects[0].id] };
      }, [MOCK.toString(), who]);
      for (const v of (who === 'worker' ? ['casehome', 'lactions'] : VIEWS)) {
        const n = await page.evaluate(v => { st.view = v; render(); return (document.getElementById('view') || document.body).innerText.trim().length; }, v).catch(e => { errors.push(v + ': ' + e.message.slice(0, 160)); return 0; });
        await page.waitForTimeout(1100);
        if (n < 40) problems.push(`${who} ${w}px: page "${v}" is empty`);
        const over = await page.evaluate(() => { window.scrollTo(99999, window.scrollY); const x = window.scrollX; window.scrollTo(0, window.scrollY); return x; });
        if (over > 8) problems.push(`${who} ${w}px: page "${v}" scrolls sideways by ${over}px`);
      }
      if (who === 'admin' && w === 1440) {
        const bands = await page.evaluate(() => { st.view = 'ceo'; CEO.mode = 'dash'; render(); return document.querySelectorAll('.cd-band').length; });
        if (bands !== 5) problems.push(`CEO dashboard shows ${bands} sections, expected 5`);
      }
      if (who === 'division') {
        const ok = await page.evaluate(() => { const d = L.projects[0].division; return myProjects().length > 0 && myProjects().every(p => p.division === d); });
        if (!ok) problems.push('division manager sees projects outside the division');
      }
      errors.forEach(e => problems.push(`${who} ${w}px error: ${e}`));
      await page.close();
    }
  }
  await browser.close(); server.close();
  if (problems.length) { problems.slice(0, 15).forEach(p => console.log('::error::' + p)); process.exit(1); }
  console.log('e2e ok');
})().catch(e => { console.log('::error::' + String((e && e.message) || e).split('\n')[0]); process.exit(1); });
