'use strict';
/* NAVO pilot features:
   1. Access requests: people ask for access at /request; an administrator approves (account + access) or rejects.
   2. QR reporting: a printable poster per project; workers without an account report from their phone at /report.
   3. Serious-event alerts: on-screen alarm with acknowledge, browser notification, escalation if nobody acknowledges.
   4. Dashboard guide: what every dashboard shows, where its data comes from, how it is calculated and how often it updates. */

/* ================= 1. access requests ================= */
const PQ = { reqs: null, loading: false, err: '', pick: {}, tokens: null, tokErr: '' };
async function pqLoadReqs(force) {
  if (PQ.loading || (PQ.reqs && !force)) return; PQ.loading = true;
  try { PQ.reqs = (await accApi({ op: 'requests' })).requests || []; PQ.err = ''; } catch (e) { PQ.err = e.message; PQ.reqs = PQ.reqs || []; }
  PQ.loading = false; if (st.view === 'access') render();
}
function pqReqPanel() {
  pqLoadReqs();
  const R = PQ.reqs || [], pend = R.filter(r => r.status === 'Pending'), done = R.filter(r => r.status !== 'Pending').slice(0, 8);
  const posOpts = cur => POSITIONS.map(p => `<option ${p[0] === cur ? 'selected' : ''}>${esc(p[0])}</option>`).join('');
  const projOpts = cur => `<option value="">Choose project</option>` + (L.projects || []).map(p => `<option value="${esc(p.id)}" ${p.id === cur ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
  const guessPos = r => { const t = (r.position || '').trim().toLowerCase(), low = POSITIONS.find(p => /site worker|reporter/i.test(p[0])) || POSITIONS[POSITIONS.length - 1], hit = t.length > 3 && POSITIONS.find(p => p[1] !== 'admin' && p[2] === 'project' && (p[0].toLowerCase().includes(t) || t.includes(p[0].toLowerCase().split(' /')[0]))); return (hit || low)[0]; };
  return `<div class="panel pq-req"><div class="rg-bar"><h2>Access requests <small>${pend.length} waiting</small></h2><span class="rg-sp"></span><button class="btn" data-pq-reload>Refresh</button><a class="btn" href="/request" target="_blank" rel="noopener">Open the request page</a></div>
   ${PQ.err ? `<p class="mx-muted">${/relation|does not exist|404/i.test(PQ.err) ? 'Run supabase/025_access_requests.sql once in Supabase to switch this on.' : esc(PQ.err)}</p>` : ''}
   <p class="mx-muted">People ask for access at <b>${esc(location.origin)}/request</b> (also linked from the sign-in page). Choose their position and project, then approve: NAVO creates the account, sets the access and shows the password once.</p>
   ${pend.length ? `<div class="rg-tw"><table class="rg-t"><thead><tr><th>Requested</th><th>Person</th><th>Company · position asked</th><th>Reason</th><th>Give position</th><th>Project</th><th></th></tr></thead><tbody>${pend.map(r => { const k = PQ.pick[r.id] || (PQ.pick[r.id] = { pos: guessPos(r), proj: (L.projects || []).some(p => p.id === r.project) ? r.project : '' }); return `<tr><td>${new Date(r.created_at).toLocaleDateString('en-GB')}</td><td><b>${esc(r.name)}</b><br><small>${esc(r.email)}${r.phone ? ' · ' + esc(r.phone) : ''}</small></td><td>${esc(r.company || '—')}<br><small>${esc(r.position || '')}${r.manager ? ' · manager ' + esc(r.manager) : ''}</small></td><td><small>${esc(r.reason || '')}</small></td><td><select class="mx-in" data-pq-pos="${r.id}">${posOpts(k.pos)}</select></td><td><select class="mx-in" data-pq-proj="${r.id}">${projOpts(k.proj)}</select></td><td style="white-space:nowrap"><button class="btn pri" data-pq-ok="${r.id}">Approve</button> <button class="btn" data-pq-no="${r.id}">Reject</button></td></tr>`; }).join('')}</tbody></table></div>` : `<p class="mx-muted">${PQ.loading ? 'Loading…' : 'No requests waiting.'}</p>`}
   ${done.length ? `<details><summary class="mx-muted">Recent decisions</summary><table class="rg-t"><tbody>${done.map(r => `<tr><td>${esc(r.name)}</td><td>${esc(r.email)}</td><td>${esc(r.status)}</td><td>${r.decided_at ? new Date(r.decided_at).toLocaleDateString('en-GB') : ''}</td><td><small>${esc(r.note || '')}</small></td></tr>`).join('')}</tbody></table></details>` : ''}</div>`;
}
if (typeof accountsPage === 'function') { const pqAcc = accountsPage; accountsPage = function () { return pqReqPanel() + pqAcc.apply(this, arguments); }; }
document.addEventListener('change', e => { const t = e.target; if (t.dataset.pqPos) PQ.pick[t.dataset.pqPos].pos = t.value; if (t.dataset.pqProj) PQ.pick[t.dataset.pqProj].proj = t.value; });
document.addEventListener('click', async e => {
  const t = e.target.closest('[data-pq-reload],[data-pq-ok],[data-pq-no],[data-pq-print],[data-pq-copy]'); if (!t) return; e.preventDefault(); e.stopPropagation();
  const D = t.dataset;
  if (D.pqReload != null) { pqLoadReqs(true); return; }
  if (D.pqNo) { const note = prompt('Reason for rejecting (shown in the decisions list)') ; if (note === null) return; try { await accApi({ op: 'request_decide', id: D.pqNo, status: 'Rejected', note }); toast('Request rejected'); } catch (x) { toast(x.message); } pqLoadReqs(true); return; }
  if (D.pqOk) {
    const r = (PQ.reqs || []).find(x => x.id === D.pqOk), k = PQ.pick[D.pqOk]; if (!r) return;
    const pos = POSITIONS.find(p => p[0] === k.pos); if (!pos) return;
    let level = pos[2], value = null, projects = k.proj ? [k.proj] : [];
    const pr = (L.projects || []).find(p => p.id === k.proj);
    if (['platform', 'division', 'cluster'].includes(level)) { value = pr ? pr[level] : null; if (!value) { toast('Choose a project so NAVO knows the ' + level); return; } }
    if (level === 'project' && !projects.length && pos[1] !== 'admin') { toast('Choose the project'); return; }
    t.disabled = true; t.textContent = 'Creating…';
    try {
      const res = (await accApi({ op: 'create', users: [{ email: r.email, name: r.name }] })).results || [];
      const u = res[0]; if (!u || !u.id) throw new Error((u && u.error) || 'The account could not be created');
      const next = { ...L.members, [u.id]: { ...(L.members[u.id] || {}), ...accMember(pos[0], level, value, projects, null) } };
      await liveSave(() => saveMembers(next), null); L.members = next;
      await accApi({ op: 'request_decide', id: r.id, status: 'Approved', note: pos[0] + (pr ? ' · ' + pr.name : '') });
      ACC.results = [{ ...u, name: r.name }]; ACC.users = null; accLoad(true);
      toast('Account created for ' + r.name + '. Share the password shown below.');
    } catch (x) { toast(x.message); }
    pqLoadReqs(true); return;
  }
  if (D.pqPrint) { pqPoster(D.pqPrint === '*' ? null : D.pqPrint); return; }
  if (D.pqCopy) { try { await navigator.clipboard.writeText(D.pqCopy); toast('Link copied'); } catch (x) { prompt('Copy the link', D.pqCopy); } }
});

/* ================= 2. QR reporting for workers without an account ================= */
async function pqTokens() {
  if (PQ.tokens || PQ.tokLoading) return; PQ.tokLoading = true;
  try { PQ.tokens = (await accApi({ op: 'qr_tokens', projects: (L.projects || []).map(p => p.id) })).tokens; PQ.tokErr = ''; } catch (e) { PQ.tokErr = e.message; }
  PQ.tokLoading = false; if (st.view === 'access' || st.view === 'm-qr') render();
}
const pqLink = id => PQ.tokens && PQ.tokens[id] ? `${location.origin}/report?p=${encodeURIComponent(id)}&t=${PQ.tokens[id]}` : '';
function pqQrPage() {
  pqTokens(); if (typeof rgQrLib === 'function' && typeof qrcode !== 'function') rgQrLib().then(() => { if (st.view === 'access' || st.view === 'm-qr') render(); });
  const P = (L.projects || []).slice().sort((a, b) => a.name.localeCompare(b.name));
  const qr = id => typeof qrcode === 'function' && pqLink(id) ? rgQrSvg(pqLink(id), 110) : '<div class="pq-qr-wait"></div>';
  return `<div class="panel"><div class="rg-bar"><h2>QR reporting · workers without email</h2><span class="rg-sp"></span><button class="btn pri" data-pq-print="*">Print posters for all projects</button></div>
   <p class="mx-muted">Print one poster per project and put it at the gate, the canteen and the welfare areas. Workers scan it with any phone camera and report an unsafe condition, unsafe act, near miss, injury, damage or good practice, in English or Arabic, with a photo, without an account. Reports arrive in the project as <b>Open</b> with "Reported by QR code" in the history, and serious ones raise the alarm below.</p>
   ${PQ.tokErr ? `<div class="nvi-alert">${esc(PQ.tokErr)}</div>` : ''}
   <div class="pq-grid">${P.map(p => `<div class="pq-card">${qr(p.id)}<div><b>${esc(p.name)}</b><small>${esc([p.platform, p.division, p.cluster].filter(Boolean).join(' · '))}</small><div class="pq-btns"><button class="btn" data-pq-print="${esc(p.id)}">Print poster</button>${pqLink(p.id) ? `<button class="btn" data-pq-copy="${esc(pqLink(p.id))}">Copy link</button><a class="btn" href="${esc(pqLink(p.id))}" target="_blank" rel="noopener">Test</a>` : ''}</div></div></div>`).join('')}</div></div>`;
}
async function pqPoster(id) {
  if (typeof rgQrLib === 'function') await rgQrLib(); if (!PQ.tokens) { await pqTokens(); }
  const P = (L.projects || []).filter(p => !id || p.id === id);
  const page = p => `<section><h1>SEE IT · REPORT IT</h1><h2>شوفت خطر؟ بلّغ عنه</h2><div class="q">${rgQrSvg(pqLink(p.id), 420)}</div><p class="p">${esc(p.name)}</p><p>Scan with your phone camera · No account needed · You can stay anonymous</p><p dir="rtl">امسح الكود بكاميرا الموبايل · من غير حساب · تقدر متكتبش اسمك</p><p class="s">Unsafe condition · Unsafe act · Near miss · Injury · Damage · Good practice</p><p class="e">EMERGENCY? Stop work and call the site emergency number first.</p></section>`;
  const w = window.open('', '_blank'); if (!w) { toast('Allow pop-ups to print the posters'); return; }
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>NAVO QR posters</title><style>@page{size:A4;margin:14mm}body{font-family:system-ui,Segoe UI,Arial,sans-serif;margin:0;color:#0f1b2d}section{page-break-after:always;text-align:center;padding:10mm 0;border:6px solid #F7941D;border-radius:18px;margin-bottom:8mm}h1{font-size:44px;margin:0;color:#ED1C24;letter-spacing:.04em}h2{font-size:30px;margin:4px 0 14px}.q svg{width:300px;height:300px}.p{font-size:26px;font-weight:800;margin:10px 0}p{font-size:17px;margin:6px 18px}.s{color:#555}.e{margin-top:16px;background:#ED1C24;color:#fff;padding:10px;border-radius:10px;font-weight:700}</style></head><body>${P.map(page).join('')}<script>setTimeout(()=>print(),400)<\/script></body></html>`);
  w.document.close();
}
if (typeof access === 'function') { const pqBase = access; access = function () { const html = pqBase.apply(this, arguments); if (myRole() !== 'admin') return html; const btn = `<button data-org-tab="qr" aria-current="${ORG.tab === 'qr'}">QR reporting</button>`; const withTab = html.replace('<button data-org-tab="projects"', btn + '<button data-org-tab="projects"'); if (ORG.tab !== 'qr') return withTab; const cut = withTab.indexOf('</div>', withTab.indexOf('class="org-tabs"')) + 6; return withTab.slice(0, cut) + pqQrPage(); }; }

/* ================= 3. serious-event alerts: acknowledge and escalate ================= */
const AL_SEV = ['Fatality', 'Serious Injury', 'Lost Time (> 7 days)', 'Lost Time', 'Restricted Work', 'Medical Treatment'];
const AL = { seen: null, open: [], muted: false, timer: null };
const alCfg = () => ({ ack: 15, esc2: 60, ...((L.structure && L.structure.alerts) || {}) });
function alLevel(r) {
  const s = (typeof sevOf === 'function' ? sevOf(r) : r.severity) || '';
  if (r.rt === 'Incident' && ['Fatality', 'Serious Injury'].includes(s)) return 'critical';
  if (r.rt === 'Incident' && (AL_SEV.includes(s) || r.kind === 'Injury' || r.hipo || r.highPotential)) return 'high';
  if (r.rt === 'Incident' && /environment|fire|spill/i.test((r.kind || '') + ' ' + (r.cat || ''))) return 'high';
  return null;
}
const alAcked = r => (r.history || []).some(h => /^Alert acknowledged/.test(h.what || ''));
const alStaff = () => typeof myRole === 'function' && ['admin', 'hse'].includes(myRole());
function alScan() {
  if (!alStaff() || !L.reports) return;
  const now = Date.now(), cfg = alCfg();
  const ids = new Set(myProjects().map(p => p.id)), live = L.reports.filter(r => ids.has(r.project) && alLevel(r) && !alAcked(r) && now - (r.ts || 0) < 3 * DAY_MS);
  if (AL.seen === null) { AL.seen = new Set(L.reports.map(r => r.id)); AL.open = live.filter(r => now - r.ts < cfg.esc2 * 60000).map(r => r.id); }
  const fresh = live.filter(r => !AL.seen.has(r.id));
  fresh.forEach(r => { AL.seen.add(r.id); if (!AL.open.includes(r.id)) AL.open.unshift(r.id); alNotify(r); });
  L.reports.forEach(r => AL.seen.add(r.id));
  AL.open = AL.open.filter(id => { const r = L.reports.find(x => x.id === id); return r && !alAcked(r); });
  alDraw();
}
function alNotify(r) {
  try { if (!AL.muted) { const c = new (window.AudioContext || window.webkitAudioContext)(), o = c.createOscillator(), g = c.createGain(); o.type = 'square'; o.frequency.value = 880; g.gain.value = .06; o.connect(g); g.connect(c.destination); o.start(); [0, .25, .5, .75].forEach((t, i) => o.frequency.setValueAtTime(i % 2 ? 660 : 880, c.currentTime + t)); o.stop(c.currentTime + 1); } } catch (e) { }
  try { if ('Notification' in window && Notification.permission === 'granted') { const n = new Notification('NAVO · ' + (alLevel(r) === 'critical' ? 'CRITICAL' : 'Serious') + ' event · ' + projName(r.project), { body: (r.kind || r.rt) + ': ' + (r.desc || '').slice(0, 140), tag: r.id, requireInteraction: true }); n.onclick = () => { window.focus(); alOpen(r.id); }; } } catch (e) { }
}
function alEsc(r) { const m = (Date.now() - r.ts) / 60000, c = alCfg(); return m >= c.esc2 ? ['Escalated to division director and corporate HSE', 2] : m >= c.ack ? ['Escalated to project manager', 1] : ['Waiting for HSE acknowledgement', 0]; }
function alDraw() {
  let box = document.getElementById('al-box');
  const R = AL.open.map(id => (L.reports || []).find(r => r.id === id)).filter(Boolean);
  if (!R.length) { if (box) box.remove(); return; }
  if (!box) { box = document.createElement('div'); box.id = 'al-box'; document.body.appendChild(box); }
  const r = R[0], lv = alLevel(r), [escTxt, escLv] = alEsc(r), mins = Math.round((Date.now() - r.ts) / 60000);
  box.className = 'al-box al-' + lv + (escLv ? ' al-esc' : '');
  box.innerHTML = `<div class="al-in" role="alertdialog" aria-label="Serious event alert"><div class="al-h"><span class="al-dot"></span><b>${lv === 'critical' ? 'CRITICAL EVENT' : 'SERIOUS EVENT'}</b><span class="al-n">${R.length > 1 ? R.length + ' waiting' : ''}</span></div>
   <h3>${esc(r.kind || r.rt)}${(typeof sevOf === 'function' && sevOf(r)) ? ' · ' + esc(sevOf(r)) : ''}</h3><p class="al-p">${esc(projName(r.project))}${r.loc ? ' · ' + esc(r.loc) : ''} · ${mins < 1 ? 'just now' : mins + ' min ago'}</p>
   <p>${esc((r.desc || '').slice(0, 220))}</p><p class="al-e">${escLv ? '⬆ ' : '⏱ '}${esc(escTxt)}</p>
   <div class="al-b"><button class="btn pri" data-al-ack="${r.id}">Acknowledge — I am on it</button><button class="btn" data-al-view="${r.id}">Open record</button>${'Notification' in window && Notification.permission === 'default' ? '<button class="btn" data-al-perm>Enable phone / desktop alerts</button>' : ''}<button class="btn" data-al-later="${r.id}">Later</button></div></div>`;
}
function alOpen(id) { const r = (L.reports || []).find(x => x.id === id); if (!r) return; try { if (typeof openCase === 'function') return openCase(id); } catch (e) { } st.view = 'incm'; render(); }
document.addEventListener('click', async e => {
  const t = e.target.closest('[data-al-ack],[data-al-view],[data-al-perm],[data-al-later]'); if (!t) return; e.preventDefault();
  const D = t.dataset;
  if (D.alPerm != null) { try { await Notification.requestPermission(); } catch (x) { } alDraw(); return; }
  if (D.alLater) { AL.open = AL.open.filter(x => x !== D.alLater).concat(D.alLater); setTimeout(alDraw, 10); if (AL.open.length === 1) { const b = document.getElementById('al-box'); if (b) b.remove(); setTimeout(alDraw, 5 * 60000); } return; }
  if (D.alView) { alOpen(D.alView); return; }
  if (D.alAck) {
    const r = (L.reports || []).find(x => x.id === D.alAck); if (!r) return;
    const mins = Math.round((Date.now() - r.ts) / 60000), h = [...(r.history || []), { ts: Date.now(), by: (L.me && L.me.name) || '', what: `Alert acknowledged after ${mins} min by ${(L.me && L.me.name) || 'HSE'}` }];
    t.disabled = true; await liveSave(() => L.db.collection('reports').doc(r.id).update({ history: h }), 'Acknowledged'); r.history = h;
    AL.open = AL.open.filter(x => x !== r.id); alDraw();
  }
});
setInterval(() => { try { alScan(); } catch (e) { } }, 20000);
onAfterRender(function () { alScan(); });
/* unacknowledged serious events also show in the bell */
if (typeof auAlerts === 'function') { const alAu = auAlerts; auAlerts = function () { const out = alAu.apply(this, arguments) || []; try { const ids = new Set(myProjects().map(p => p.id)); (L.reports || []).filter(r => ids.has(r.project) && alLevel(r) && !alAcked(r) && Date.now() - r.ts < 7 * DAY_MS).forEach(r => { const [txt, lv] = alEsc(r); out.unshift({ rule: 'serious', sev: lv >= 2 || alLevel(r) === 'critical' ? 'critical' : 'high', title: 'Not acknowledged: ' + (r.kind || r.rt) + ' · ' + projName(r.project), detail: txt, project: r.project, go: { view: 'incm' } }); }); } catch (e) { } return out; }; }

/* ================= 4. dashboard guide ================= */
const DG = [
  ['Executive dashboard', 'Dashboards › Executive', 'Leadership summary for Corporation, Construction and Non-Construction: manpower, man-hours, safe hours, frequency rates, risk profile, map and project ranking.', 'Incident and observation reports, monthly manpower and man-hours entered per project, actions, inspections.', 'TRCF = (LTI + restricted work + medical treatment) × 1,000,000 ÷ man-hours. LTIFR = LTI × 1,000,000 ÷ man-hours. Safe man-hours count from the last LTI.', 'Live; monthly figures change when the project enters its monthly return.'],
  ['Site health / division score card', 'Dashboards › Site health', 'One score per project and division with the colour band (Good · Monitor · Review · Intervention).', 'Reporting rate, timely reporting, open incidents, action closure, overdue actions, inspections against plan, failed items, walkthroughs.', 'Each indicator is scored against its target and weighted; the bands are set in Settings › Site health colour code.', 'Live, month to date.'],
  ['Trend analysis', 'Trend analysis', 'Month-by-month trends: observations, lagging indicators (click to drill down), frequency rates, incidents by type, permit to work, NCRs, training; breakdown by platform › division › sub-division › project.', 'Reports, inspections (PTW templates), monthly returns, audit and inspection findings (NCRs), training records.', 'Counts per calendar month of the event date. NCR = non-compliance finding; Major = Major / Significant.', 'Live.'],
  ['CEO bi-monthly dashboard', 'CEO & environment', 'The CEO HSSE report in the client\'s Excel layout: YTD, fortnight periods, targets, environment and training charts.', 'Figures entered per fortnight or imported from the CEO workbook; rates from NAVO records.', 'YTD = opening balance + the months after it.', 'Twice a month (1st and 15th), plus any import.'],
  ['Incidents & investigations', 'Incidents & investigations', 'Incident register, investigation progress, root causes and lessons.', 'Incident reports and their investigations.', 'Recordable = LTI + restricted work + medical treatment.', 'Live.'],
  ['Inspections & audits', 'Inspections & audits', 'Inspections against plan, failed items, audit findings and closure.', 'Checklist inspections and audit findings.', 'Compliance = items passed ÷ items checked.', 'Live.'],
  ['Leadership engagement', 'Leadership', 'Score card per leader: walks against target, inspections, actions raised and owned, approvals, own training.', 'Walkthroughs, inspections, actions, approvals and training records by person.', 'Score = weighted completion of each target.', 'Live, month to date.'],
  ['Training & competence', 'Training & competence', 'People with QR, training matrix, plan target vs actual, training needs from incidents and findings.', 'People register, course catalogue, training records and plans; incidents and findings for TNA.', 'Compliance = valid required courses ÷ required courses (by position).', 'Live.'],
  ['Equipment, scaffolds, food safety', 'Equipment & operations', 'Registers with documents and expiry, inspections, holds, tags, HACCP readings.', 'Each module\'s own register, inspections and logs.', 'Compliant = all required documents present, verified and in date.', 'Live; expiry alerts at 30, 15 and 7 days.'],
  ['Live monitoring', 'Live monitoring', 'Fleet telematics, environmental sensors and CCTV analytics.', 'Devices that send data with a NAVO device key.', 'Driver score, exceedances against limits, detections by rule.', 'As the devices send data (near real time).'],
];
function dgPage() {
  return `<div class="panel"><h2>How the dashboards work</h2><p class="mx-muted">Every number in NAVO comes from records entered or imported in NAVO. Nothing is typed into a dashboard. This page explains where each dashboard gets its data, how the main figures are calculated and how often they change.</p>
   <div class="rg-tw"><table class="rg-t dg-t"><thead><tr><th>Dashboard</th><th>Where in the menu</th><th>What it shows</th><th>Data source</th><th>How it is calculated</th><th>Updates</th></tr></thead><tbody>${DG.map(r => `<tr>${r.map((c, i) => `<td>${i ? esc(c) : `<b>${esc(c)}</b>`}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
   <h3>Who sees what</h3><p class="mx-muted">Access follows the organisation: corporate users see everything, platform users their platform, division users their division, cluster users their sub-division and project users their projects. Administrators set this in Administration › Organisation & access.</p>
   <h3>Serious events</h3><p class="mx-muted">An injury, fatality, serious injury, lost-time, restricted-work, medical-treatment, high-potential or environmental incident raises an on-screen alarm for HSE staff of that project. If nobody acknowledges it within ${alCfg().ack} minutes it is escalated to the project manager, and after ${alCfg().esc2} minutes to the division director and corporate HSE. Every acknowledgement is written to the record history.</p></div>`;
}
try { regModule({ id: 'dguide', title: 'How the dashboards work', eyebrow: 'Dashboard guide', headline: 'Where every number comes from', desc: 'Data source, calculation and update frequency for every dashboard.', ents: [], tabs: [['all', 'Guide', () => dgPage()]] }); } catch (e) { console.error(e); }
try { if (typeof NX_GROUPS !== 'undefined') { const g = NX_GROUPS.find(x => x[0] === 'overview' || /dashboard/i.test(x[1])); if (g && !g[4].some(v => v[0] === 'm-dguide')) g[4].push(['m-dguide', 'How the dashboards work']); } } catch (e) { }

try { regModule({ id: 'qr', title: 'QR reporting', eyebrow: 'Workers without email', headline: 'Scan, report, done', desc: 'Print a QR poster for each project. Workers report from their phone without an account, in English or Arabic.', ents: [], tabs: [['all', 'QR posters', () => myRole() === 'admin' ? pqQrPage() : '<div class="panel"><p class="mx-muted">Only administrators can print QR posters.</p></div>']] }); } catch (e) { console.error(e); }
try { const hz = NX_GROUPS.find(g => /hazard/i.test(g[1])); if (hz && !hz[4].some(v => v[0] === 'm-qr')) hz[4].push(['m-qr', 'QR reporting (workers)']); } catch (e) { }
