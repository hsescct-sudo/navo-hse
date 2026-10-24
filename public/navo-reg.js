/* NAVO registry engine: one consistent way to keep registers (people, equipment, scaffolds, vehicles, products…)
   with forms, documents and expiry dates, QR codes, history, Excel import/export, alerts and dashboards.
   Records live in hsse_records (kind "r:<entity>"), so project access rules and storage rules already apply.
   Each module (training, equipment, scaffolds, food safety, fleet, environment sensors, CCTV) registers itself with regModule(). */
'use strict';
const REG = { mods: {}, ents: {}, tab: {}, open: null, form: null, q: {}, f: {}, sort: {}, busy: false, doc: null, imp: null, libs: {} };
const DAY_MS = 86400000;
const rgEsc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const rgDate = v => v ? new Date(typeof v === 'number' ? v : v + (String(v).length === 10 ? 'T00:00:00' : '')).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const rgToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
const rgTs = v => v ? new Date(String(v).length === 10 ? v + 'T00:00:00' : v).getTime() : null;
const rgDays = v => { const t = rgTs(v); return t == null ? null : Math.round((t - rgToday()) / DAY_MS); };
/* expiry state of a date: expired · due (≤ warn days) · valid · none */
function rgExpiry(v, warn = 30) { const d = rgDays(v); if (d == null) return { k: 'none', d: null }; return d < 0 ? { k: 'expired', d } : d <= warn ? { k: 'due', d } : { k: 'valid', d }; }
const RG_TONE = { ok: ['#1f9d63', 'Valid'], warn: ['#c97c06', 'Due soon'], bad: ['#d23b3f', 'Expired'], info: ['#2f73c9', ''], mute: ['#6b7685', ''] };
const rgPill = (label, tone) => `<span class="rg-pill t-${tone || 'mute'}">${rgEsc(label)}</span>`;
const rgExpPill = (v, warn) => { const e = rgExpiry(v, warn); return e.k === 'none' ? rgPill('No expiry', 'mute') : e.k === 'expired' ? rgPill(`Expired ${-e.d} d ago`, 'bad') : e.k === 'due' ? rgPill(e.d === 0 ? 'Expires today' : `Expires in ${e.d} d`, 'warn') : rgPill('Valid to ' + rgDate(v), 'ok'); };

/* ---------- definitions ---------- */
function regModule(m) {
  REG.mods[m.id] = m; m.view = 'm-' + m.id;
  (m.ents || []).forEach(e => { e.mod = m.id; REG.ents[e.kind] = e; e.fields = e.fields || []; });
  SOON[m.view] = [m.title, m.desc || '', []]; TITLES[m.view] = m.title;
  try { const c = COLS.find(x => x[1] === 'records'); if (c && !c[2].includes(m.view)) c[2].push(m.view); const a = COLS.find(x => x[1] === 'actions'); if (a && !a[2].includes(m.view)) a[2].push(m.view); const r = COLS.find(x => x[1] === 'reports'); if (r && !r[2].includes(m.view)) r[2].push(m.view); } catch (e) {}
}
const rgRecs = kind => (L.records || []).filter(r => r.kind === 'r:' + kind && r.data && !r.data._deleted);
const rgGet = id => (L.records || []).find(r => r.id === id);
const rgMine = kind => { const ids = new Set(myProjects().map(p => p.id)); return rgRecs(kind).filter(r => ids.has(r.project)); };
const rgTitle = r => { const e = REG.ents[(r.kind || '').slice(2)]; return e && e.title ? e.title(r.data, r) : (r.data.name || r.data._no || 'Record'); };
const rgCan = (e, act) => { const role = myRole(); if (role === 'admin' || L.owner) return true; const need = (e.perm || {})[act] || (act === 'view' ? ['admin', 'hse', 'supervisor', 'worker', 'viewer'] : ['admin', 'hse', 'supervisor']); return need.includes(role); };
function rgVal(e, f, d) {
  const v = d[f.k];
  if (v == null || v === '') return '<span class="rg-blank">—</span>';
  if (f.type === 'date') return rgEsc(rgDate(v));
  if (f.type === 'project') return rgEsc(projName(v));
  if (f.type === 'ref') { const r = rgGet(v); return r ? `<a href="#" data-rg-open="${rgEsc(r.id)}">${rgEsc(rgTitle(r))}</a>` : '<span class="rg-blank">removed</span>'; }
  if (f.type === 'refs') return (v || []).map(id => { const r = rgGet(id); return r ? `<a href="#" data-rg-open="${rgEsc(r.id)}">${rgEsc(rgTitle(r))}</a>` : ''; }).filter(Boolean).join(', ') || '<span class="rg-blank">—</span>';
  if (f.type === 'multi') return (v || []).map(x => rgPill(x, 'info')).join(' ');
  if (f.type === 'bool') return v ? 'Yes' : 'No';
  if (f.type === 'num') return rgEsc((+v).toLocaleString('en-GB')) + (f.unit ? ' ' + rgEsc(f.unit) : '');
  if (f.type === 'files') return `${(v || []).length} file${(v || []).length === 1 ? '' : 's'}`;
  if (f.type === 'color') return `<span class="rg-swatch" style="--c:${rgEsc(v)}"></span>${rgEsc(f.optLabel ? f.optLabel(v) : v)}`;
  return rgEsc(v);
}
const rgFieldOn = (f, d) => !f.show || f.show(d || {});
async function rgNextNo(e) {
  const pre = e.prefix || e.kind.toUpperCase(), n = rgRecs(e.kind).reduce((m, r) => { const x = parseInt(String(r.data._no || '').replace(/\D/g, ''), 10); return isNaN(x) ? m : Math.max(m, x); }, 0) + 1;
  return pre + '-' + String(n).padStart(5, '0');
}

/* ---------- saving with history ---------- */
async function rgSave(kind, project, data, prev, what) {
  const isNew = !prev, e = REG.ents[kind], now = Date.now(), who = (L.me && (L.me.name || L.me.email)) || '';
  const hist = [...((prev && prev.data.hist) || [])];
  if (prev) {
    const ch = e.fields.filter(f => f.type !== 'files' && JSON.stringify(prev.data[f.k] ?? '') !== JSON.stringify(data[f.k] ?? '')).map(f => f.l);
    if (prev.project !== project) ch.unshift('Project: ' + projName(prev.project) + ' → ' + projName(project));
    if (what || ch.length) hist.push({ at: now, by: who, what: what || ('Changed: ' + ch.slice(0, 6).join(', ') + (ch.length > 6 ? '…' : '')) });
  } else hist.push({ at: now, by: who, what: what || 'Created' });
  data = { ...data, hist: hist.slice(-200) };
  if (!prev && !data._no) data._no = await rgNextNo(e);
  if (e.derive) data = e.derive(data, prev ? prev.data : null) || data;
  const ok = await liveSave(async () => {
    if (prev) { const up = { data, ts: now }; if (prev.project !== project) up.project = project; await L.db.collection('records').doc(prev.id).update(up); }
    else { const r = await L.db.collection('records').add({ project, kind: 'r:' + kind, ts: now, data, by: L.me && L.me.id }); prev = { id: r.id }; }
  }, null);
  if (ok === false) return null;
  const local = (L.records || []).find(x => x.id === prev.id);
  if (local) { local.data = data; local.project = project; local.ts = now; } else (L.records = L.records || []).push({ id: prev.id, project, kind: 'r:' + kind, ts: now, data });
  if (e.afterSave) try { await e.afterSave((L.records || []).find(x => x.id === prev.id), !isNew); } catch (err) { console.error(err); }
  return prev.id;
}
async function rgAction(project, title, owner, dueDays, priority, note) {
  const due = Date.now() + (dueDays || 7) * DAY_MS;
  if (typeof newAction === 'function') return liveSave(() => newAction({ title, project, owner: owner || '', due, priority: priority || 'Normal', source: note || 'Register' }), null);
  return liveSave(() => L.db.collection('actions').add({ title, project, owner: owner || '', due, priority: priority || 'Normal', ts: Date.now(), by: L.me && L.me.id, source: note || 'Register', status: 'Assigned', closedAt: null }), null);
}

/* ---------- files ---------- */
async function rgUpload(project, files) {
  const out = [];
  for (const f of files) {
    if (f.size > 20e6) { toast(f.name + ' is larger than 20 MB'); continue; }
    try { const path = L.db.uploadFile ? await L.db.uploadFile(project, f) : await L.db.uploadPhoto(project, f); out.push({ path, name: f.name, type: f.type, size: f.size, at: Date.now(), by: (L.me && L.me.name) || '' }); }
    catch (e) { toast('Could not upload ' + f.name); }
  }
  return out;
}
async function rgOpenFile(path, name) {
  try { const url = await L.photoUrl(path); const a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener'; if (name) a.download = name; document.body.appendChild(a); a.click(); a.remove(); } catch (e) { toast('Could not open the file'); }
}

/* ---------- libraries (QR, Excel) loaded when first needed ---------- */
function rgLib(name, url, test) {
  if (test()) return Promise.resolve();
  return REG.libs[name] || (REG.libs[name] = new Promise((res, rej) => { const s = document.createElement('script'); s.src = url; s.onload = res; s.onerror = () => { REG.libs[name] = null; rej(new Error('Could not load ' + name)); }; document.head.appendChild(s); }));
}
const rgQrLib = () => rgLib('qr', 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js', () => typeof qrcode === 'function');
const rgXlsxLib = () => rgLib('xlsx', 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js', () => typeof XLSX === 'object');
const rgQrUrl = r => location.origin + '/#q=' + encodeURIComponent(r.id);
function rgQrSvg(text, size = 120) { try { const q = qrcode(0, 'M'); q.addData(text); q.make(); return q.createSvgTag({ cellSize: Math.max(2, Math.floor(size / (q.getModuleCount() + 8))), margin: 4, scalable: true }); } catch (e) { return ''; } }
async function rgFillQr() { const els = document.querySelectorAll('[data-rg-qr]'); if (!els.length) return; try { await rgQrLib(); els.forEach(el => { if (!el.dataset.done) { el.innerHTML = rgQrSvg(el.dataset.rgQr); el.dataset.done = '1'; } }); } catch (e) { els.forEach(el => el.textContent = 'QR unavailable offline'); } }
async function rgPrintLabels(ids) {
  await rgQrLib();
  const R = ids.map(rgGet).filter(Boolean); if (!R.length) return;
  const brand = (L.structure && L.structure.brand && L.structure.brand.name) || 'NAVO';
  const w = window.open('', '_blank'); if (!w) { toast('Allow pop-ups to print labels'); return; }
  w.document.write(`<!doctype html><title>QR labels</title><style>body{font-family:Arial,sans-serif;margin:10mm}.g{display:grid;grid-template-columns:repeat(3,1fr);gap:6mm}.l{border:1px solid #222;border-radius:3mm;padding:3mm;display:grid;grid-template-columns:32mm 1fr;gap:3mm;align-items:center;break-inside:avoid}.l svg{width:32mm;height:32mm}.b{font:700 9pt Arial;letter-spacing:.1em;color:#14325c}.n{font:700 12pt Arial;margin:1mm 0}.i{font:700 14pt monospace}.s{font:9pt Arial;color:#444}@media print{body{margin:6mm}}</style>
  <div class="g">${R.map(r => { const e = REG.ents[r.kind.slice(2)]; return `<div class="l">${rgQrSvg(rgQrUrl(r))}<div><div class="b">${rgEsc(brand.toUpperCase())} · ${rgEsc(e.name.toUpperCase())}</div><div class="i">${rgEsc(r.data._no || '')}</div><div class="n">${rgEsc(rgTitle(r))}</div><div class="s">${rgEsc(projName(r.project))}</div><div class="s">Scan to check status</div></div></div>`; }).join('')}</div><script>setTimeout(()=>print(),300)<\/script>`);
  w.document.close();
}

/* ---------- export / import ---------- */
async function rgExport(e, rows) {
  await rgXlsxLib();
  const F = e.fields.filter(f => f.type !== 'files');
  const data = [['ID', 'Project', ...F.map(f => f.l), ...(e.status ? ['Status'] : [])]].concat(rows.map(r => [r.data._no || '', projName(r.project), ...F.map(f => { const v = r.data[f.k]; return f.type === 'project' ? projName(v) : f.type === 'ref' ? (rgGet(v) ? rgTitle(rgGet(v)) : '') : Array.isArray(v) ? v.map(x => f.type === 'refs' ? (rgGet(x) ? rgTitle(rgGet(x)) : '') : x).join(', ') : (v ?? ''); }), ...(e.status ? [e.status(r.data, r).label] : [])]));
  const ws = XLSX.utils.aoa_to_sheet(data); ws['!cols'] = data[0].map(h => ({ wch: Math.max(12, String(h).length + 2) }));
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, e.plural.slice(0, 30)); XLSX.writeFile(wb, 'NAVO ' + e.plural + '.xlsx');
}
async function rgTemplate(e) {
  await rgXlsxLib();
  const F = e.fields.filter(f => !['files', 'refs'].includes(f.type) && !f.noImport);
  const head = ['Project code', ...F.map(f => f.l + (f.req ? ' *' : ''))];
  const ex = [myProjects()[0] ? myProjects()[0].id : 'P-001', ...F.map(f => f.example ?? (f.type === 'select' ? f.opts[0] : f.type === 'date' ? '2026-12-31' : f.type === 'num' ? 1 : ''))];
  const ws = XLSX.utils.aoa_to_sheet([head, ex]); ws['!cols'] = head.map(h => ({ wch: Math.max(14, h.length + 2) }));
  const lists = XLSX.utils.aoa_to_sheet([['Field', 'Allowed values'], ...F.filter(f => f.type === 'select').map(f => [f.l, f.opts.join(' | ')]), ['Project code', myProjects().map(p => p.id + ' = ' + p.name).join(' | ')]]);
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Import'); XLSX.utils.book_append_sheet(wb, lists, 'Allowed values'); XLSX.writeFile(wb, 'NAVO ' + e.plural + ' import template.xlsx');
}
async function rgReadImport(e, file) {
  await rgXlsxLib();
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
  const F = e.fields.filter(f => !['files', 'refs'].includes(f.type) && !f.noImport), P = myProjects();
  const norm = s => String(s).replace(/\s*\*$/, '').trim().toLowerCase();
  const out = rows.map((row, i) => {
    const keys = Object.keys(row), get = l => { const k = keys.find(k => norm(k) === l.toLowerCase()); return k ? row[k] : ''; };
    const errs = [], d = {};
    const pc = String(get('Project code')).trim(), p = P.find(x => x.id.toLowerCase() === pc.toLowerCase() || (x.name || '').toLowerCase() === pc.toLowerCase());
    if (!p) errs.push('project');
    F.forEach(f => {
      let v = get(f.l); if (v instanceof Date) v = v.toISOString().slice(0, 10); v = typeof v === 'string' ? v.trim() : v;
      if (v === '' || v == null) { if (f.req) errs.push(f.l); return; }
      if (f.type === 'num') { if (isNaN(+v)) errs.push(f.l + ' not a number'); else d[f.k] = +v; }
      else if (f.type === 'date') { const t = new Date(v); if (isNaN(t)) errs.push(f.l + ' date'); else d[f.k] = t.toISOString().slice(0, 10); }
      else if (f.type === 'select') { const o = f.opts.find(o => o.toLowerCase() === String(v).toLowerCase()); if (!o) errs.push(f.l + ' value'); else d[f.k] = o; }
      else if (f.type === 'bool') d[f.k] = /^(y|yes|true|1)$/i.test(String(v));
      else if (f.type === 'project') { const q = P.find(x => x.id.toLowerCase() === String(v).toLowerCase()); if (q) d[f.k] = q.id; }
      else if (f.type === 'ref') { const t = rgRecs(f.ref).find(r => (r.data._no || '').toLowerCase() === String(v).toLowerCase() || rgTitle(r).toLowerCase() === String(v).toLowerCase()); if (t) d[f.k] = t.id; else errs.push(f.l + ' not found'); }
      else d[f.k] = v;
    });
    const dup = (e.unique || []).map(k => d[k] && rgRecs(e.kind).find(r => String(r.data[k] || '').toLowerCase() === String(d[k]).toLowerCase())).find(Boolean);
    return { i: i + 2, project: p && p.id, d, errs, dup: dup ? dup.data._no : null };
  });
  const seen = {}; out.forEach(r => (e.unique || []).forEach(k => { const v = String(r.d[k] || '').toLowerCase(); if (!v) return; if (seen[k + v]) r.errs.push('repeated ' + k); seen[k + v] = 1; }));
  return out;
}

/* ---------- documents attached to a record (certificates, licences…) ---------- */
const RG_DOC_ST = ['Pending review', 'Verified', 'Rejected'];
function rgDocState(doc, warn) {
  if (doc.status === 'Rejected') return { k: 'rejected', label: 'Rejected', tone: 'bad' };
  const e = doc.noExpiry ? { k: 'none' } : doc.expiry ? rgExpiry(doc.expiry, warn) : { k: 'missing' };
  if (e.k === 'expired') return { k: 'expired', label: 'Expired', tone: 'bad' };
  if (doc.status !== 'Verified') return { k: 'pending', label: 'Pending review', tone: 'info' };
  if (e.k === 'missing') return { k: 'noexp', label: 'Expiry date missing', tone: 'warn' };
  if (e.k === 'due') return { k: 'due', label: 'Expiring soon', tone: 'warn' };
  return { k: 'ok', label: e.k === 'none' ? 'Verified · no expiry' : 'Verified', tone: 'ok' };
}
/* required documents per category: e.docReq(d) returns doc type names */
function rgDocSummary(e, d) {
  const docs = d.docs || [], req = e.docReq ? e.docReq(d) : [], latest = {};
  docs.forEach(x => { if (!latest[x.type] || (x.ver || 1) > (latest[x.type].ver || 1)) latest[x.type] = x; });
  const st = Object.values(latest).map(x => rgDocState(x, e.warn));
  const missing = req.filter(t => !latest[t] || latest[t].status === 'Rejected');
  return { latest, missing, expired: st.filter(s => s.k === 'expired').length, due: st.filter(s => s.k === 'due').length, pending: st.filter(s => s.k === 'pending' || s.k === 'noexp').length };
}

/* ---------- pages ---------- */
function rgKpi(label, v, tone, click) { return `<button class="rg-kpi t-${tone || 'info'}" ${click ? `data-rg-kf="${rgEsc(click)}"` : 'disabled'}><span>${rgEsc(label)}</span><b>${v}</b></button>`; }
function rgListRows(e) {
  const q = (REG.q[e.kind] || '').toLowerCase(), f = REG.f[e.kind] || {};
  let R = rgMine(e.kind);
  if (f.project) R = R.filter(r => r.project === f.project);
  Object.entries(f).forEach(([k, v]) => { if (!v || k === 'project' || k === '_kpi') return; R = R.filter(r => String(r.data[k] ?? '') === v); });
  if (f._kpi && e.kpis) { const k = e.kpis(rgMine(e.kind)).find(x => x.id === f._kpi); if (k && k.test) R = R.filter(k.test); }
  if (q) R = R.filter(r => (r.data._no + ' ' + rgTitle(r) + ' ' + e.fields.filter(x => ['text', 'select', 'textarea'].includes(x.type)).map(x => r.data[x.k] || '').join(' ') + ' ' + projName(r.project)).toLowerCase().includes(q));
  const s = REG.sort[e.kind] || { k: '_no', dir: -1 };
  const val = r => s.k === '_no' ? (r.data._no || '') : s.k === '_status' ? (e.status ? e.status(r.data, r).rank ?? e.status(r.data, r).label : '') : s.k === 'project' ? projName(r.project) : (r.data[s.k] ?? '');
  return R.sort((a, b) => { const x = val(a), y = val(b); return (x > y ? 1 : x < y ? -1 : 0) * s.dir; });
}
function rgList(e, opts = {}) {
  const all = rgMine(e.kind), R = rgListRows(e), f = REG.f[e.kind] || {}, cols = e.cols || e.fields.slice(0, 5).map(x => x.k);
  const FC = (e.filters || []).map(k => e.fields.find(x => x.k === k)).filter(Boolean);
  const can = rgCan(e, 'edit'), sort = REG.sort[e.kind] || { k: '_no', dir: -1 };
  const th = (k, l) => `<th><button class="rg-sort" data-rg-sort="${e.kind}|${k}">${rgEsc(l)}${sort.k === k ? (sort.dir > 0 ? ' ▲' : ' ▼') : ''}</button></th>`;
  const kp = e.kpis ? e.kpis(all) : null;
  return `${kp ? `<div class="rg-kpis">${kp.map(k => rgKpi(k.l, k.v, k.tone, k.test ? e.kind + '|' + k.id : '')).join('')}</div>` : ''}
  <div class="panel rg-list"><div class="rg-bar">
    <h2>${rgEsc(e.plural)} <small>${R.length}${R.length !== all.length ? ' of ' + all.length : ''}</small></h2>
    <input class="mx-in rg-search" data-rg-q="${e.kind}" placeholder="Search" value="${rgEsc(REG.q[e.kind] || '')}" aria-label="Search ${rgEsc(e.plural)}">
    <select class="mx-in" data-rg-filt="${e.kind}|project" aria-label="Project"><option value="">All projects</option>${myProjects().map(p => `<option value="${rgEsc(p.id)}" ${f.project === p.id ? 'selected' : ''}>${rgEsc(p.name)}</option>`).join('')}</select>
    ${FC.map(x => `<select class="mx-in" data-rg-filt="${e.kind}|${x.k}" aria-label="${rgEsc(x.l)}"><option value="">${rgEsc(x.l)}: all</option>${(x.opts || []).map(o => `<option ${f[x.k] === o ? 'selected' : ''}>${rgEsc(o)}</option>`).join('')}</select>`).join('')}
    ${f._kpi ? `<button class="btn" data-rg-kf="${e.kind}|">Clear: ${rgEsc((kp.find(k => k.id === f._kpi) || {}).l || '')} ✕</button>` : ''}
    <span class="rg-sp"></span>
    ${can && !opts.noAdd ? `<button class="btn pri" data-rg-new="${e.kind}">+ ${rgEsc(e.addLabel || 'Add ' + e.name.toLowerCase())}</button>` : ''}
    <details class="rg-more"><summary class="btn">More</summary><div>
      <button class="btn" data-rg-export="${e.kind}">Export to Excel</button>
      ${can && !e.noImport ? `<button class="btn" data-rg-tpl="${e.kind}">Import template</button><label class="btn">Import from Excel<input type="file" accept=".xlsx,.xls,.csv" hidden data-rg-import="${e.kind}"></label>` : ''}
      ${e.qr ? `<button class="btn" data-rg-labels="${e.kind}">Print QR labels (${R.length})</button>` : ''}
    </div></details>
  </div>
  ${REG.imp && REG.imp.kind === e.kind ? rgImportPanel(e) : ''}
  <div class="rg-tw"><table class="rg-t"><thead><tr>${th('_no', 'ID')}${th(cols[0], (e.fields.find(x => x.k === cols[0]) || {}).l || '')}${th('project', 'Project')}${cols.slice(1).map(k => th(k, (e.fields.find(x => x.k === k) || {}).l || k)).join('')}${e.status ? th('_status', 'Status') : ''}</tr></thead><tbody>
  ${R.slice(0, 500).map(r => { const st = e.status ? e.status(r.data, r) : null; return `<tr data-rg-open="${rgEsc(r.id)}" tabindex="0"><td class="rg-id">${rgEsc(r.data._no || '')}</td><td><b>${rgVal(e, e.fields.find(x => x.k === cols[0]) || { k: cols[0] }, r.data)}</b></td><td>${rgEsc(projName(r.project))}</td>${cols.slice(1).map(k => `<td>${rgVal(e, e.fields.find(x => x.k === k) || { k }, r.data)}</td>`).join('')}${st ? `<td>${rgPill(st.label, st.tone)}</td>` : ''}</tr>`; }).join('') || `<tr><td colspan="9" class="rg-empty">${all.length ? 'Nothing matches these filters.' : `No ${rgEsc(e.plural.toLowerCase())} yet.${can ? ' Add the first one, or import them from Excel.' : ''}`}</td></tr>`}
  </tbody></table>${R.length > 500 ? '<p class="mx-muted">Showing the first 500. Narrow the filters to see more.</p>' : ''}</div></div>`;
}
function rgImportPanel(e) {
  const I = REG.imp, good = I.rows.filter(r => !r.errs.length);
  return `<div class="rg-imp"><b>Import check · ${I.rows.length} rows</b> <span class="mx-muted">${good.length} ready${I.rows.length - good.length ? `, <b style="color:#d23b3f">${I.rows.length - good.length} need fixing</b>` : ''}${good.filter(r => r.dup).length ? ` · ${good.filter(r => r.dup).length} may already exist (skipped)` : ''}</span>
   <div class="rg-tw"><table class="rg-t"><thead><tr><th>Row</th><th>Project</th><th>${rgEsc(e.fields[0].l)}</th><th>Check</th></tr></thead><tbody>${I.rows.slice(0, 200).map(r => `<tr class="${r.errs.length ? 'bad' : r.dup ? 'dup' : ''}"><td>${r.i}</td><td>${rgEsc(r.project ? projName(r.project) : '—')}</td><td>${rgEsc(r.d[e.fields[0].k] || '')}</td><td>${r.errs.length ? 'Fix: ' + rgEsc(r.errs.join(', ')) : r.dup ? 'Possible duplicate of ' + rgEsc(r.dup) : 'Ready'}</td></tr>`).join('')}</tbody></table></div>
   <div class="filters"><button class="btn pri" data-rg-impgo ${good.filter(r => !r.dup).length && !REG.busy ? '' : 'disabled'}>${REG.busy ? 'Importing…' : `Import ${good.filter(r => !r.dup).length}`}</button><button class="btn" data-rg-impx>Cancel</button></div></div>`;
}
function rgDetail(r) {
  const e = REG.ents[r.kind.slice(2)], d = r.data, can = rgCan(e, 'edit'), st = e.status ? e.status(d, r) : null;
  const secs = []; let cur = null;
  e.fields.forEach(f => { if (f.sec) { cur = { t: f.sec, f: [] }; secs.push(cur); } if (!cur) { cur = { t: 'Details', f: [] }; secs.push(cur); } if (rgFieldOn(f, d) && f.type !== 'files' && f.type !== 'photo') cur.f.push(f); });
  const photo = e.fields.find(f => f.type === 'photo');
  const ds = e.docs ? rgDocSummary(e, d) : null;
  return `<div class="rg-det">
   <div class="rg-dh"><button class="btn" data-rg-back>← ${rgEsc(e.plural)}</button><span class="rg-sp"></span>
    ${(e.actions || []).filter(a => !a.show || a.show(d, r)).filter(a => !a.perm || rgCan(e, a.perm)).map((a, i) => `<button class="btn ${a.tone || ''}" data-rg-act="${i}">${rgEsc(a.l)}</button>`).join('')}
    ${e.qr ? `<button class="btn" data-rg-labels-one="${rgEsc(r.id)}">Print label</button>` : ''}
    ${can ? `<button class="btn pri" data-rg-edit="${rgEsc(r.id)}">Edit</button>` : ''}</div>
   <div class="panel rg-hero">
    ${photo && d[photo.k] ? `<img class="rg-photo" data-rg-img="${rgEsc(d[photo.k])}" alt="">` : ''}
    <div class="rg-hd"><span class="rg-id">${rgEsc(d._no || '')}</span><h2>${rgEsc(rgTitle(r))}</h2><p>${rgEsc(projName(r.project))}${e.sub ? ' · ' + rgEsc(e.sub(d, r)) : ''}</p>
     <div class="rg-chips">${st ? rgPill(st.label, st.tone) : ''}${(e.chips ? e.chips(d, r) : []).map(c => rgPill(c[0], c[1])).join('')}</div></div>
    ${e.qr ? `<div class="rg-qr"><div data-rg-qr="${rgEsc(rgQrUrl(r))}"></div><small>Scan to open</small></div>` : ''}
   </div>
   ${e.panel ? e.panel(d, r) : ''}
   <div class="rg-secs">${secs.filter(s => s.f.length).map(s => `<div class="panel rg-sec"><h3>${rgEsc(s.t)}</h3><dl>${s.f.map(f => `<dt>${rgEsc(f.l)}</dt><dd>${rgVal(e, f, d)}</dd>`).join('')}</dl></div>`).join('')}</div>
   ${e.docs ? rgDocsPanel(e, r, ds) : ''}
   ${e.fields.filter(f => f.type === 'files' && (d[f.k] || []).length).map(f => `<div class="panel"><h3>${rgEsc(f.l)}</h3><div class="rg-files">${(d[f.k] || []).map(x => `<button class="rg-file" data-rg-file="${rgEsc(x.path)}" data-name="${rgEsc(x.name)}">📎 ${rgEsc(x.name)}</button>`).join('')}</div></div>`).join('')}
   ${(e.related || []).map(rel => { const R = rgRecs(rel.kind).filter(x => rel.match(x, r)).sort((a, b) => b.ts - a.ts); const re = REG.ents[rel.kind]; return `<div class="panel"><div class="rg-bar"><h3>${rgEsc(rel.l)} <small>${R.length}</small></h3><span class="rg-sp"></span>${rgCan(re, 'edit') && rel.add !== false ? `<button class="btn" data-rg-new="${rel.kind}" data-rg-pre="${rgEsc(JSON.stringify(rel.pre ? rel.pre(r) : {}))}" data-rg-proj="${rgEsc(r.project)}">+ ${rgEsc(rel.addLabel || 'Add')}</button>` : ''}</div>${R.length ? `<div class="rg-tw"><table class="rg-t"><tbody>${R.slice(0, 50).map(x => { const s2 = re.status ? re.status(x.data, x) : null; return `<tr data-rg-open="${rgEsc(x.id)}" tabindex="0"><td class="rg-id">${rgEsc(x.data._no || '')}</td><td>${rgEsc(rgTitle(x))}</td><td>${rgEsc(re.sub ? re.sub(x.data, x) : '')}</td><td>${s2 ? rgPill(s2.label, s2.tone) : ''}</td></tr>`; }).join('')}</tbody></table></div>` : '<p class="mx-muted">None yet.</p>'}</div>`; }).join('')}
   <div class="panel"><h3>History</h3><ol class="rg-hist">${[...(d.hist || [])].reverse().slice(0, 60).map(h => `<li><b>${rgEsc(h.what)}</b><small>${new Date(h.at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} · ${rgEsc(h.by || '')}</small></li>`).join('') || '<li class="mx-muted">No changes recorded.</li>'}</ol></div>
  </div>`;
}
function rgDocsPanel(e, r, ds) {
  const d = r.data, can = rgCan(e, 'edit'), canRev = rgCan(e, 'review'), types = e.docTypes ? e.docTypes(d) : [];
  const docs = (d.docs || []).slice().sort((a, b) => (a.type > b.type ? 1 : -1) || (b.ver || 1) - (a.ver || 1));
  const reqRow = ds.missing.length ? `<div class="rg-miss">Missing required: ${ds.missing.map(t => rgPill(t, 'bad')).join(' ')}</div>` : (e.docReq ? '<div class="rg-miss ok">All required documents uploaded.</div>' : '');
  return `<div class="panel rg-docs"><div class="rg-bar"><h3>Documents <small>${docs.length}</small></h3><span class="rg-sp"></span>${can ? `<button class="btn" data-rg-doc-new="${rgEsc(r.id)}">+ Add document</button>` : ''}</div>${reqRow}
   ${REG.doc && REG.doc.id === r.id ? rgDocForm(e, r, types) : ''}
   <div class="rg-tw"><table class="rg-t"><thead><tr><th>Type</th><th>Number</th><th>Issued by</th><th>Issue</th><th>Expiry</th><th>Files</th><th>Status</th><th></th></tr></thead><tbody>
   ${docs.map(x => { const s = rgDocState(x, e.warn), cur = ds.latest[x.type] === x; return `<tr class="${cur ? '' : 'old'}"><td><b>${rgEsc(x.type)}</b>${cur ? '' : ' <small>(older version)</small>'}</td><td>${rgEsc(x.no || '—')}</td><td>${rgEsc(x.auth || '—')}</td><td>${rgDate(x.issue)}</td><td>${x.noExpiry ? 'No expiry' : x.expiry ? rgExpPill(x.expiry, e.warn) : rgPill('Missing date', 'warn')}</td><td>${(x.files || []).map(f => `<button class="rg-file" data-rg-file="${rgEsc(f.path)}" data-name="${rgEsc(f.name)}">📎 ${rgEsc(f.name)}</button>`).join(' ') || '—'}</td><td>${rgPill(s.label, s.tone)}${x.reviewer ? `<br><small>${rgEsc(x.reviewer)}${x.comment ? ': ' + rgEsc(x.comment) : ''}</small>` : ''}</td>
     <td class="rg-acts">${cur && canRev && x.status !== 'Verified' ? `<button class="btn" data-rg-doc-rev="${rgEsc(r.id)}|${rgEsc(x.id)}|Verified">Verify</button><button class="btn danger" data-rg-doc-rev="${rgEsc(r.id)}|${rgEsc(x.id)}|Rejected">Reject</button>` : ''}${cur && can ? `<button class="btn" data-rg-doc-rep="${rgEsc(r.id)}|${rgEsc(x.type)}">Replace</button>` : ''}</td></tr>`; }).join('') || '<tr><td colspan="8" class="rg-empty">No documents yet.</td></tr>'}
   </tbody></table></div></div>`;
}
function rgDocForm(e, r, types) {
  const D = REG.doc;
  return `<div class="rg-docf"><div class="rg-grid">
   <div class="fld"><label for="rgd-type">Document type</label><select id="rgd-type" class="mx-in">${[...new Set([...types, D.type].filter(Boolean))].map(t => `<option ${D.type === t ? 'selected' : ''}>${rgEsc(t)}</option>`).join('')}<option value="__other">Other…</option></select></div>
   <div class="fld" id="rgd-other-w" ${D.type && !types.includes(D.type) && D.type !== '__other' ? '' : 'hidden'}><label for="rgd-other">Other type</label><input id="rgd-other" class="mx-in"></div>
   <div class="fld"><label for="rgd-no">Document number</label><input id="rgd-no" class="mx-in"></div>
   <div class="fld"><label for="rgd-auth">Issuing authority</label><input id="rgd-auth" class="mx-in"></div>
   <div class="fld"><label for="rgd-issue">Issue date</label><input id="rgd-issue" type="date" class="mx-in"></div>
   <div class="fld"><label for="rgd-exp">Expiry date</label><input id="rgd-exp" type="date" class="mx-in"></div>
   <div class="fld rg-chk"><label><input type="checkbox" id="rgd-noexp"> This document has no expiry</label></div>
   <div class="fld"><label for="rgd-files">Files (PDF or photo)</label><input id="rgd-files" type="file" multiple class="mx-in" accept=".pdf,image/*,.doc,.docx,.xls,.xlsx"></div></div>
   <p class="mx-muted">${D.replace ? 'This uploads a new version. It stays pending until a reviewer verifies it; the old version is kept in history.' : 'New documents stay pending until a reviewer verifies them.'}</p>
   <div class="filters"><button class="btn pri" data-rg-doc-save="${rgEsc(r.id)}" ${REG.busy ? 'disabled' : ''}>${REG.busy ? 'Saving…' : 'Save document'}</button><button class="btn" data-rg-doc-x>Cancel</button></div></div>`;
}

/* ---------- form ---------- */
function rgFormHtml() {
  const F = REG.form, e = REG.ents[F.kind], d = F.d, P = myProjects();
  const sec = []; let cur = null;
  e.fields.forEach(f => { if (f.sec) { cur = { t: f.sec, f: [] }; sec.push(cur); } if (!cur) { cur = { t: '', f: [] }; sec.push(cur); } cur.f.push(f); });
  const inp = f => {
    if (!rgFieldOn(f, d) || f.auto) return '';
    const id = 'rgf-' + f.k, v = d[f.k], req = f.req ? ' *' : '', lab = `<label for="${id}">${rgEsc(f.l)}${req}${f.unit ? ` <small>(${rgEsc(f.unit)})</small>` : ''}</label>`, help = f.help ? `<small class="mx-muted">${rgEsc(f.help)}</small>` : '';
    if (f.type === 'select') return `<div class="fld">${lab}<select id="${id}" class="mx-in" data-rgf="${f.k}"><option value=""></option>${f.opts.map(o => `<option ${v === o ? 'selected' : ''}>${rgEsc(o)}</option>`).join('')}</select>${help}</div>`;
    if (f.type === 'multi') return `<div class="fld rg-wide">${lab}<div class="acc-chips">${f.opts.map(o => `<button type="button" class="${(v || []).includes(o) ? 'on' : ''}" data-rgf-multi="${f.k}|${rgEsc(o)}">${rgEsc(o)}</button>`).join('')}</div>${help}</div>`;
    if (f.type === 'textarea') return `<div class="fld rg-wide">${lab}<textarea id="${id}" class="mx-in" rows="3" data-rgf="${f.k}">${rgEsc(v || '')}</textarea>${help}</div>`;
    if (f.type === 'bool') return `<div class="fld rg-chk"><label><input type="checkbox" id="${id}" data-rgf="${f.k}" ${v ? 'checked' : ''}> ${rgEsc(f.l)}</label>${help}</div>`;
    if (f.type === 'project') return `<div class="fld">${lab}<select id="${id}" class="mx-in" data-rgf="${f.k}"><option value=""></option>${P.map(p => `<option value="${rgEsc(p.id)}" ${v === p.id ? 'selected' : ''}>${rgEsc(p.name)}</option>`).join('')}</select></div>`;
    if (f.type === 'ref') { const R = rgMine(f.ref).filter(x => !f.where || f.where(x, d)); return `<div class="fld">${lab}<select id="${id}" class="mx-in" data-rgf="${f.k}"><option value=""></option>${R.map(x => `<option value="${rgEsc(x.id)}" ${v === x.id ? 'selected' : ''}>${rgEsc((x.data._no ? x.data._no + ' · ' : '') + rgTitle(x))}</option>`).join('')}</select>${help}</div>`; }
    if (f.type === 'refs') { const R = rgMine(f.ref); return `<div class="fld rg-wide">${lab}<div class="acc-chips">${R.slice(0, 120).map(x => `<button type="button" class="${(v || []).includes(x.id) ? 'on' : ''}" data-rgf-multi="${f.k}|${rgEsc(x.id)}">${rgEsc(rgTitle(x))}</button>`).join('') || '<span class="mx-muted">None registered yet.</span>'}</div></div>`; }
    if (f.type === 'files' || f.type === 'photo') return `<div class="fld">${lab}<input id="${id}" type="file" class="mx-in" ${f.type === 'files' ? 'multiple' : 'accept="image/*"'} data-rgf-file="${f.k}">${(f.type === 'files' ? (v || []).length : v) ? `<small class="mx-muted">${f.type === 'files' ? (v || []).length + ' saved; new files are added' : 'Photo saved; choose another to replace it'}</small>` : ''}</div>`;
    if (f.type === 'color') return `<div class="fld">${lab}<div class="rg-colors">${f.opts.map(o => `<button type="button" class="${v === o ? 'on' : ''}" style="--c:${o}" data-rgf-set="${f.k}|${o}" title="${rgEsc(f.optLabel ? f.optLabel(o) : o)}">${rgEsc(f.optLabel ? f.optLabel(o) : '')}</button>`).join('')}</div></div>`;
    return `<div class="fld">${lab}<input id="${id}" class="mx-in" data-rgf="${f.k}" type="${f.type === 'num' ? 'number' : f.type === 'date' ? 'date' : f.type === 'time' ? 'datetime-local' : 'text'}" ${f.type === 'num' ? 'step="any"' : ''} value="${rgEsc(v ?? '')}" ${f.ph ? `placeholder="${rgEsc(f.ph)}"` : ''}>${help}</div>`;
  };
  return `<div class="acc-modal rg-modal" role="dialog" aria-modal="true" aria-label="${rgEsc(e.name)}"><div class="acc-sheet rg-sheet">
   <div class="acc-sheet-h"><h2>${F.id ? 'Edit' : 'New'} ${rgEsc(e.name.toLowerCase())}${d._no ? ' · ' + rgEsc(d._no) : ''}</h2><button class="btn" data-rg-fx aria-label="Close">✕</button></div>
   <div class="fld"><label for="rgf-_project">Project *</label><select id="rgf-_project" class="mx-in" data-rgf="_project">${P.map(p => `<option value="${rgEsc(p.id)}" ${F.project === p.id ? 'selected' : ''}>${rgEsc(p.name)}</option>`).join('')}</select></div>
   ${sec.map(s => { const body = s.f.map(inp).join(''); return body ? `${s.t ? `<h3 class="rg-fsec">${rgEsc(s.t)}</h3>` : ''}<div class="rg-grid">${body}</div>` : ''; }).join('')}
   <div class="filters acc-foot"><button class="btn pri" data-rg-fsave ${REG.busy ? 'disabled' : ''}>${REG.busy ? 'Saving…' : 'Save'}</button><button class="btn" data-rg-fx>Cancel</button>${F.id && rgCan(e, 'delete') ? `<button class="btn danger" data-rg-fdel>Delete</button>` : ''}</div>
  </div></div>`;
}
async function rgFormSave() {
  const F = REG.form, e = REG.ents[F.kind];
  const miss = e.fields.filter(f => f.req && rgFieldOn(f, F.d) && !f.auto && (F.d[f.k] == null || F.d[f.k] === '' || (Array.isArray(F.d[f.k]) && !F.d[f.k].length)));
  if (miss.length) { toast('Please fill: ' + miss.map(f => f.l).join(', ')); return; }
  if (e.validate) { const m = e.validate(F.d, F); if (m) { toast(m); return; } }
  REG.busy = true; render();
  try {
    const d = { ...F.d };
    for (const [k, files] of Object.entries(F.files || {})) {
      const f = e.fields.find(x => x.k === k), up = await rgUpload(F.project, files);
      if (f.type === 'photo') { if (up[0]) d[k] = up[0].path; } else d[k] = [...(d[k] || []), ...up];
    }
    const prev = F.id ? rgGet(F.id) : null;
    const id = await rgSave(F.kind, F.project, d, prev);
    if (id) { toast('Saved'); REG.form = null; if (!prev && F.openAfter !== false) REG.open = id; }
  } catch (err) { toast('Could not save. ' + (err.message || '')); }
  REG.busy = false; render();
}

/* ---------- module page ---------- */
function rgPage(m) {
  const tabs = m.tabs || [], cur = REG.tab[m.id] || (tabs[0] && tabs[0][0]);
  const open = REG.open && rgGet(REG.open), openE = open && REG.ents[open.kind.slice(2)];
  const body = open && openE && openE.mod === m.id ? rgDetail(open) : (() => { const t = tabs.find(x => x[0] === cur); return t ? t[2]() : ''; })();
  return `<div class="nvr-hero rg-head"><div><span class="nvi-eyebrow">${rgEsc(m.eyebrow || m.title)}</span><h2>${rgEsc(m.headline || m.title)}</h2><p>${rgEsc(m.desc || '')}</p></div>${m.heroRight ? m.heroRight() : ''}</div>
   ${tabs.length > 1 ? `<div class="org-tabs rg-tabs" role="tablist">${tabs.map(t => `<button role="tab" data-rg-tab="${m.id}|${t[0]}" aria-current="${cur === t[0] && !(open && openE && openE.mod === m.id)}">${rgEsc(t[1])}</button>`).join('')}</div>` : ''}
   ${body}${REG.form && REG.ents[REG.form.kind].mod === m.id ? rgFormHtml() : ''}`;
}
const rgBaseSoon = soon;
soon = function () { if (st.view && st.view.startsWith('m-') && REG.mods[st.view.slice(2)]) { const g = typeof liveGate === 'function' && liveGate(); return g || rgPage(REG.mods[st.view.slice(2)]); } return rgBaseSoon(); };
const rgBaseRender = render;
render = function () {
  document.querySelectorAll('body > .rg-modal').forEach(n => { try { if (n.parentNode) n.parentNode.removeChild(n); } catch (e) {} });
  const r = rgBaseRender.apply(this, arguments);
  const m = document.querySelector('#view .rg-modal'); if (m) document.body.appendChild(m);
  rgFillQr();
  document.querySelectorAll('[data-rg-img]').forEach(async img => { if (img.dataset.done) return; img.dataset.done = '1'; try { img.src = await L.photoUrl(img.dataset.rgImg); } catch (e) {} });
  return r;
};

/* ---------- events ---------- */
document.addEventListener('click', async e => {
  const t = e.target.closest('[data-rg-tab],[data-rg-open],[data-rg-back],[data-rg-new],[data-rg-edit],[data-rg-fx],[data-rg-fsave],[data-rg-fdel],[data-rgf-multi],[data-rgf-set],[data-rg-sort],[data-rg-kf],[data-rg-export],[data-rg-tpl],[data-rg-labels],[data-rg-labels-one],[data-rg-file],[data-rg-act],[data-rg-doc-new],[data-rg-doc-rep],[data-rg-doc-x],[data-rg-doc-save],[data-rg-doc-rev],[data-rg-impgo],[data-rg-impx],[data-rg-go]');
  if (!t) { if (e.target.classList && e.target.classList.contains('rg-modal')) { REG.form = null; render(); } return; }
  if (t.tagName === 'SUMMARY') return;
  e.preventDefault(); const D = t.dataset;
  if (D.rgTab) { const [m, tb] = D.rgTab.split('|'); REG.tab[m] = tb; REG.open = null; REG.doc = null; }
  else if (D.rgGo) { if (D.rgKf) { const [k, id] = D.rgKf.split('|'); REG.f[k] = { ...(REG.f[k] || {}), _kpi: id || '' }; } const [v, tb] = D.rgGo.split('|'); if (tb) REG.tab[v.slice(2)] = tb; REG.open = null; go(v); return; }
  else if (D.rgOpen) { const r = rgGet(D.rgOpen); if (!r) return; const en = REG.ents[r.kind.slice(2)]; REG.open = r.id; REG.doc = null; if (st.view !== 'm-' + en.mod) { go('m-' + en.mod); return; } window.scrollTo(0, 0); }
  else if (t.hasAttribute('data-rg-back')) { REG.open = null; REG.doc = null; }
  else if (D.rgNew) { const en = REG.ents[D.rgNew], pre = D.rgPre ? JSON.parse(D.rgPre) : {}; REG.form = { kind: D.rgNew, id: null, project: D.rgProj || (REG.f[D.rgNew] || {}).project || (myProjects()[0] || {}).id, d: { ...(en.defaults ? en.defaults() : {}), ...pre }, files: {} }; if (st.view !== 'm-' + en.mod) { go('m-' + en.mod); return; } }
  else if (D.rgEdit) { const r = rgGet(D.rgEdit); REG.form = { kind: r.kind.slice(2), id: r.id, project: r.project, d: JSON.parse(JSON.stringify(r.data)), files: {} }; }
  else if (t.hasAttribute('data-rg-fx')) REG.form = null;
  else if (t.hasAttribute('data-rg-fsave')) return rgFormSave();
  else if (t.hasAttribute('data-rg-fdel')) { if (t.dataset.armed !== '1') { t.dataset.armed = '1'; t.textContent = 'Click again to delete'; return; } const r = rgGet(REG.form.id); await rgSave(r.kind.slice(2), r.project, { ...r.data, _deleted: true }, r, 'Deleted'); REG.form = null; REG.open = null; }
  else if (D.rgfMulti) { const [k, v] = D.rgfMulti.split('|'); const s = new Set(REG.form.d[k] || []); s.has(v) ? s.delete(v) : s.add(v); REG.form.d[k] = [...s]; }
  else if (D.rgfSet) { const [k, v] = D.rgfSet.split('|'); REG.form.d[k] = v; }
  else if (D.rgSort) { const [k, f] = D.rgSort.split('|'), s = REG.sort[k] || { k: '_no', dir: -1 }; REG.sort[k] = { k: f, dir: s.k === f ? -s.dir : 1 }; }
  else if (D.rgKf != null) { const [k, id] = D.rgKf.split('|'); REG.f[k] = { ...(REG.f[k] || {}), _kpi: id || '' }; }
  else if (D.rgExport) { try { await rgExport(REG.ents[D.rgExport], rgListRows(REG.ents[D.rgExport])); } catch (err) { toast(err.message); } return; }
  else if (D.rgTpl) { try { await rgTemplate(REG.ents[D.rgTpl]); } catch (err) { toast(err.message); } return; }
  else if (D.rgLabels) { rgPrintLabels(rgListRows(REG.ents[D.rgLabels]).map(r => r.id)); return; }
  else if (D.rgLabelsOne) { rgPrintLabels([D.rgLabelsOne]); return; }
  else if (D.rgFile) { rgOpenFile(D.rgFile, D.name); return; }
  else if (D.rgAct != null) { const r = rgGet(REG.open), en = REG.ents[r.kind.slice(2)]; const a = (en.actions || []).filter(a => !a.show || a.show(r.data, r)).filter(a => !a.perm || rgCan(en, a.perm))[+D.rgAct]; if (a) { REG.busy = true; try { await a.run(r); } catch (err) { toast(err.message || 'Failed'); } REG.busy = false; } }
  else if (D.rgDocNew) REG.doc = { id: D.rgDocNew };
  else if (D.rgDocRep) { const [id, type] = D.rgDocRep.split('|'); REG.doc = { id, type, replace: true }; }
  else if (t.hasAttribute('data-rg-doc-x')) REG.doc = null;
  else if (D.rgDocSave) {
    const r = rgGet(D.rgDocSave), en = REG.ents[r.kind.slice(2)], g = id => document.getElementById(id);
    let type = g('rgd-type').value; if (type === '__other') type = g('rgd-other').value.trim(); if (!type) { toast('Choose the document type'); return; }
    const noExp = g('rgd-noexp').checked, exp = g('rgd-exp').value, files = [...g('rgd-files').files];
    if (!files.length) { toast('Attach the document file'); return; }
    REG.busy = true; render();
    const up = await rgUpload(r.project, files);
    const prevSame = (r.data.docs || []).filter(x => x.type === type);
    const doc = { id: 'd' + Date.now().toString(36), type, no: g('rgd-no') ? g('rgd-no').value.trim() : '', auth: '', issue: '', expiry: noExp ? '' : exp, noExpiry: noExp, files: up, status: 'Pending review', ver: prevSame.length + 1, at: Date.now(), by: (L.me && L.me.name) || '' };
    const auth = document.getElementById('rgd-auth'), issue = document.getElementById('rgd-issue'); if (auth) doc.auth = auth.value.trim(); if (issue) doc.issue = issue.value;
    await rgSave(en.kind, r.project, { ...r.data, docs: [...(r.data.docs || []), doc] }, r, (prevSame.length ? 'Replaced ' : 'Added ') + type + (prevSame.length ? ' (version ' + doc.ver + ', pending review)' : ''));
    REG.busy = false; REG.doc = null;
  }
  else if (D.rgDocRev) {
    const [id, did, stt] = D.rgDocRev.split('|'), r = rgGet(id), en = REG.ents[r.kind.slice(2)];
    const comment = stt === 'Rejected' ? (prompt('Reason for rejection') || '') : '';
    if (stt === 'Rejected' && !comment) { toast('Add a reason to reject'); return; }
    const docs = (r.data.docs || []).map(x => x.id === did ? { ...x, status: stt, reviewer: (L.me && L.me.name) || '', reviewedAt: Date.now(), comment } : x);
    const x = docs.find(x => x.id === did);
    await rgSave(en.kind, r.project, { ...r.data, docs }, r, `${stt} ${x.type}${comment ? ': ' + comment : ''}`);
  }
  else if (t.hasAttribute('data-rg-impx')) REG.imp = null;
  else if (t.hasAttribute('data-rg-impgo')) {
    const I = REG.imp, en = REG.ents[I.kind], ok = I.rows.filter(r => !r.errs.length && !r.dup); REG.busy = true; render(); let n = 0;
    for (const row of ok) { if (await rgSave(en.kind, row.project, { ...(en.defaults ? en.defaults() : {}), ...row.d }, null, 'Imported from Excel')) n++; }
    REG.busy = false; REG.imp = null; toast(n + ' imported');
  }
  render();
}, true);
document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset && t.dataset.rgQ) { REG.q[t.dataset.rgQ] = t.value; clearTimeout(REG.qt); REG.qt = setTimeout(() => { const pos = t.selectionStart; render(); const n = document.querySelector(`[data-rg-q="${t.dataset.rgQ}"]`); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (x) {} } }, 220); return; }
  if (t.dataset && t.dataset.rgf && REG.form && t.type !== 'checkbox' && t.tagName !== 'SELECT') { const f = REG.ents[REG.form.kind].fields.find(x => x.k === t.dataset.rgf); REG.form.d[t.dataset.rgf] = f && f.type === 'num' ? (t.value === '' ? '' : +t.value) : t.value; }
});
document.addEventListener('change', async e => {
  const t = e.target;
  if (t.dataset && t.dataset.rgFilt) { const [k, f] = t.dataset.rgFilt.split('|'); REG.f[k] = { ...(REG.f[k] || {}), [f]: t.value }; render(); return; }
  if (t.dataset && t.dataset.rgImport) { const f = t.files[0]; if (!f) return; try { REG.imp = { kind: t.dataset.rgImport, rows: await rgReadImport(REG.ents[t.dataset.rgImport], f) }; } catch (err) { toast('Could not read the file. ' + err.message); } t.value = ''; render(); return; }
  if (t.dataset && t.dataset.rgfFile && REG.form) { REG.form.files[t.dataset.rgfFile] = [...t.files]; return; }
  if (t.id === 'rgd-type') { const w = document.getElementById('rgd-other-w'); if (w) w.hidden = t.value !== '__other'; return; }
  if (t.dataset && t.dataset.rgf && REG.form) {
    if (t.dataset.rgf === '_project') REG.form.project = t.value;
    else REG.form.d[t.dataset.rgf] = t.type === 'checkbox' ? t.checked : t.value;
    const e2 = REG.ents[REG.form.kind], fd = e2.fields.find(f => f.k === t.dataset.rgf); if (t.tagName === 'SELECT' || t.type === 'checkbox' || (fd && fd.live)) { const y = document.querySelector('.rg-sheet') && document.querySelector('.rg-sheet').scrollTop; render(); const s = document.querySelector('.rg-sheet'); if (s && y) s.scrollTop = y; }
  }
});
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches && e.target.matches('tr[data-rg-open]')) e.target.click(); });

/* open a record from a scanned QR: navo-hse.vercel.app/#q=<record id> */
function rgHash() {
  const m = (location.hash || '').match(/^#q=(.+)$/); if (!m) return;
  const id = decodeURIComponent(m[1]); const tryOpen = n => { const r = rgGet(id); if (r) { const en = REG.ents[r.kind.slice(2)]; if (en) { REG.open = r.id; history.replaceState(null, '', location.pathname); go('m-' + en.mod); return; } } if (n < 40) setTimeout(() => tryOpen(n + 1), 500); else toast('This record is not in your projects, or you need to sign in with an account that can see it.'); };
  tryOpen(0);
}
window.addEventListener('hashchange', rgHash); setTimeout(rgHash, 800);

/* alerts from every register (expiries, overdue checks) go to the bell */
const rgBaseAlerts = typeof auAlerts === 'function' ? auAlerts : () => [];
auAlerts = function () {
  const A = rgBaseAlerts();
  try { Object.values(REG.ents).forEach(en => { if (!en.alerts) return; rgMine(en.kind).forEach(r => (en.alerts(r.data, r) || []).forEach(a => A.push({ rule: 'reg-' + en.kind, sev: a.sev, title: a.title, detail: a.detail || (rgTitle(r) + ' · ' + projName(r.project)), project: r.project, go: { view: 'm-' + en.mod, rgOpen: r.id } }))); }); } catch (e) { console.error(e); }
  const rank = { critical: 0, high: 1, medium: 2, info: 3 }; return A.sort((a, b) => (rank[a.sev] ?? 4) - (rank[b.sev] ?? 4));
};
if (typeof auGo === 'function') { const rgBaseGo = auGo; auGo = function (a) { if (a && a.go && a.go.rgOpen) REG.open = a.go.rgOpen; return rgBaseGo(a); }; }
/* standard document alerts: 30 / 15 / 7 days, expiry day, expired */
function rgDocAlerts(e, d) {
  const out = [], ds = rgDocSummary(e, d);
  Object.values(ds.latest).forEach(x => { if (x.noExpiry || !x.expiry || x.status === 'Rejected') return; const dd = rgDays(x.expiry); if (dd == null) return;
    if (dd < 0) out.push({ sev: 'critical', title: `${x.type} expired ${-dd} d ago` }); else if (dd === 0) out.push({ sev: 'high', title: `${x.type} expires today` }); else if (dd <= 7) out.push({ sev: 'high', title: `${x.type} expires in ${dd} d` }); else if (dd <= 15) out.push({ sev: 'medium', title: `${x.type} expires in ${dd} d` }); else if (dd <= 30) out.push({ sev: 'info', title: `${x.type} expires in ${dd} d` }); });
  ds.missing.forEach(t => out.push({ sev: 'medium', title: `Missing ${t}` }));
  return out;
}

/* nav group helper */
function rgNav(groupId, label, icon, items, after) {
  if (typeof NV_IC !== 'undefined' && icon) NV_IC[groupId] = icon;
  const g = [groupId, label, items[0][0], 'dash', items];
  const i = NX_GROUPS.findIndex(x => x[0] === groupId); if (i >= 0) NX_GROUPS.splice(i, 1);
  const at = after ? NX_GROUPS.findIndex(x => x[0] === after) : -1;
  NX_GROUPS.splice(at >= 0 ? at + 1 : NX_GROUPS.length - 1, 0, g);
}
/* small chart helpers built on the CEO dashboard kit */
const rgCount = (R, fn) => { const o = {}; R.forEach(r => { const k = fn(r); if (k == null || k === '') return; (Array.isArray(k) ? k : [k]).forEach(x => o[x] = (o[x] || 0) + 1); }); return o; };
function rgBarsFrom(obj, color, o = {}) { const E = Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, o.max || 10); return E.length ? cdHbars(E.map(([l, v]) => ({ l, v, c: color })), { lw: o.lw || 140 }) : '<p class="cd-none">No data yet</p>'; }
const rgMonths = n => Array.from({ length: n }, (_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (n - 1 - i)); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); });
const rgMonLbl = m => new Date(m + '-01T00:00:00').toLocaleDateString('en-GB', { month: 'short' });
const rgCard = (title, body, cls = '') => `<div class="cd-card ${cls}"><h4>${title}</h4>${body}</div>`;
