/* NAVO Training & competence: people register with QR, course catalogue, training records with certificates,
   training matrix by position, plan with target vs actual, and training needs analysis (TNA) built from
   incidents, hazards, inspection findings and matrix gaps. */
'use strict';
const TR_POS = ['Project manager', 'Construction manager', 'Site engineer', 'HSE manager', 'HSE engineer / officer', 'Supervisor / foreman', 'Scaffolder', 'Rigger', 'Crane operator', 'Equipment operator', 'Driver', 'Electrician', 'Welder', 'Fitter', 'Mason', 'Carpenter', 'Labourer', 'Storekeeper', 'Cook / food handler', 'Camp staff', 'Security guard', 'Office staff'];
const TR_CAT = ['Induction', 'HSE mandatory', 'Competency', 'Permit to work', 'Equipment operator', 'Lifting', 'Working at height', 'Driving', 'Food safety', 'First aid & emergency', 'Leadership', 'Other'];
const trPos = () => ((L.structure && L.structure.training && L.structure.training.positions) || TR_POS);
const trPerson = id => rgGet(id), trCourse = id => rgGet(id);
/* latest record per person × course */
function trLatest(personId) { const o = {}; rgRecs('tr').filter(r => r.data.person === personId && r.data.result !== 'Fail').forEach(r => { const c = r.data.course; if (!o[c] || (r.data.date || '') > (o[c].data.date || '')) o[c] = r; }); return o; }
function trRequired(pos) { return rgRecs('tc').filter(c => c.data.mandatory || (c.data.forPos || []).includes(pos)); }
function trCell(personRec, courseRec, latest) {
  const req = courseRec.data.mandatory || (courseRec.data.forPos || []).includes(personRec.data.position);
  const r = (latest || trLatest(personRec.id))[courseRec.id];
  if (!r) return req ? 'miss' : 'na';
  const e = rgExpiry(r.data.expiry, 30); return e.k === 'expired' ? 'exp' : e.k === 'due' ? 'due' : 'ok';
}
function trPersonStatus(p) {
  const L2 = trLatest(p.id), R = trRequired(p.data.position), cells = R.map(c => trCell(p, c, L2));
  const n = k => cells.filter(x => x === k).length;
  return { req: R.length, ok: n('ok') + n('due'), due: n('due'), exp: n('exp'), miss: n('miss'), pct: R.length ? Math.round((n('ok') + n('due')) / R.length * 100) : 100 };
}

regModule({ id: 'training', title: 'Training & competence', eyebrow: 'Training & competence', headline: 'Who is trained, for what, and what is next', desc: 'People register with a QR for each person, course catalogue, certificates, matrix by position, plan against target, and training needs from your own incidents and findings.',
  ents: [
    { kind: 'tp', name: 'Person', plural: 'People', prefix: 'PER', qr: true, unique: ['empNo'], cols: ['name', 'position', 'company', 'status'], filters: ['position', 'status'],
      title: d => d.name || 'Person', sub: d => [d.position, d.company].filter(Boolean).join(' · '),
      fields: [
        { k: 'name', l: 'Full name', type: 'text', req: true, sec: 'Person' }, { k: 'empNo', l: 'Employee / badge no.', type: 'text' }, { k: 'position', l: 'Position', type: 'select', opts: trPos(), req: true },
        { k: 'company', l: 'Company', type: 'text', ph: 'Own staff or subcontractor name', example: 'Own staff' }, { k: 'discipline', l: 'Discipline', type: 'text' }, { k: 'nationality', l: 'Nationality', type: 'text' },
        { k: 'phone', l: 'Mobile', type: 'text' }, { k: 'start', l: 'Start on project', type: 'date' }, { k: 'status', l: 'Status', type: 'select', opts: ['Active', 'Demobilised'], req: true }, { k: 'photo', l: 'Photo', type: 'photo', noImport: true }],
      defaults: () => ({ status: 'Active' }),
      status: d => d.status === 'Demobilised' ? { label: 'Demobilised', tone: 'mute', rank: 9 } : { label: 'Active', tone: 'ok', rank: 1 },
      chips: (d, r) => { const s = trPersonStatus(r); return [[`${s.pct}% trained`, s.pct >= 90 ? 'ok' : s.pct >= 70 ? 'warn' : 'bad'], ...(s.exp ? [[s.exp + ' expired', 'bad']] : []), ...(s.miss ? [[s.miss + ' missing', 'bad']] : []), ...(s.due ? [[s.due + ' due soon', 'warn']] : [])]; },
      panel: (d, r) => { const L2 = trLatest(r.id), C = rgRecs('tc').filter(c => c.data.mandatory || (c.data.forPos || []).includes(d.position) || L2[c.id]);
        return `<div class="panel"><h3>Training status for ${rgEsc(d.position || 'this position')}</h3><div class="rg-tw"><table class="rg-t"><thead><tr><th>Course</th><th>Required</th><th>Last trained</th><th>Valid to</th><th>Status</th></tr></thead><tbody>${C.map(c => { const k = trCell(r, c, L2), x = L2[c.id]; return `<tr><td><b>${rgEsc(c.data.name)}</b></td><td>${c.data.mandatory || (c.data.forPos || []).includes(d.position) ? 'Yes' : 'No'}</td><td>${x ? rgDate(x.data.date) : '—'}</td><td>${x ? (x.data.expiry ? rgDate(x.data.expiry) : 'No expiry') : '—'}</td><td>${rgPill({ ok: 'Valid', due: 'Due soon', exp: 'Expired', miss: 'Not trained', na: 'Optional' }[k], { ok: 'ok', due: 'warn', exp: 'bad', miss: 'bad', na: 'mute' }[k])}</td></tr>`; }).join('') || '<tr><td colspan="5" class="rg-empty">Add courses and mark which positions need them.</td></tr>'}</tbody></table></div></div>`; },
      related: [{ kind: 'tr', l: 'Training records', addLabel: 'Record training', match: (x, r) => x.data.person === r.id, pre: r => ({ person: r.id }) }],
      alerts: (d, r) => { if (d.status === 'Demobilised') return []; const s = trPersonStatus(r); return s.exp ? [{ sev: 'high', title: `${d.name}: ${s.exp} required training expired` }] : []; } },
    { kind: 'tc', name: 'Course', plural: 'Courses', prefix: 'CRS', cols: ['name', 'category', 'validity', 'hours'], filters: ['category'], unique: ['name'],
      title: d => d.name, sub: d => [d.category, d.validity ? d.validity + ' months' : 'no expiry'].join(' · '),
      fields: [{ k: 'name', l: 'Course name', type: 'text', req: true, sec: 'Course' }, { k: 'code', l: 'Code', type: 'text' }, { k: 'category', l: 'Category', type: 'select', opts: TR_CAT, req: true },
        { k: 'validity', l: 'Valid for', type: 'num', unit: 'months', help: '0 or empty = does not expire' }, { k: 'hours', l: 'Duration', type: 'num', unit: 'hours' }, { k: 'provider', l: 'Delivered by', type: 'select', opts: ['Internal', 'External'] },
        { k: 'mandatory', l: 'Required for everyone', type: 'bool', sec: 'Who needs it' }, { k: 'forPos', l: 'Required for positions', type: 'multi', opts: trPos(), noImport: true }, { k: 'desc', l: 'Description', type: 'textarea' }],
      status: d => d.mandatory ? { label: 'Everyone', tone: 'info' } : { label: (d.forPos || []).length + ' positions', tone: 'mute' },
      related: [{ kind: 'tr', l: 'People trained', match: (x, r) => x.data.course === r.id, pre: r => ({ course: r.id }), addLabel: 'Record training' }] },
    { kind: 'tr', name: 'Training record', plural: 'Training records', prefix: 'TRN', cols: ['course', 'person', 'date', 'expiry'], filters: ['result'],
      title: d => { const c = trCourse(d.course), p = trPerson(d.person); return (c ? c.data.name : 'Course') + ' — ' + (p ? p.data.name : 'Person'); }, sub: d => rgDate(d.date),
      fields: [{ k: 'person', l: 'Person', type: 'ref', ref: 'tp', req: true, sec: 'Training' }, { k: 'course', l: 'Course', type: 'ref', ref: 'tc', req: true }, { k: 'plan', l: 'From plan', type: 'ref', ref: 'tpl', noImport: true },
        { k: 'date', l: 'Date attended', type: 'date', req: true }, { k: 'expiry', l: 'Valid to', type: 'date', help: 'Left empty, it is set from the course validity' }, { k: 'result', l: 'Result', type: 'select', opts: ['Pass', 'Attended', 'Fail'], req: true },
        { k: 'trainer', l: 'Trainer / provider', type: 'text' }, { k: 'hours', l: 'Hours', type: 'num' }, { k: 'certNo', l: 'Certificate no.', type: 'text' }, { k: 'files', l: 'Certificate files', type: 'files' }],
      defaults: () => ({ result: 'Pass', date: new Date().toISOString().slice(0, 10) }),
      derive: d => { const c = trCourse(d.course); if (!d.expiry && c && +c.data.validity > 0 && d.date) { const t = new Date(d.date + 'T00:00:00'); t.setMonth(t.getMonth() + +c.data.validity); d.expiry = t.toISOString().slice(0, 10); } if (!d.hours && c && c.data.hours) d.hours = c.data.hours; return d; },
      status: d => d.result === 'Fail' ? { label: 'Failed', tone: 'bad', rank: 0 } : !d.expiry ? { label: 'No expiry', tone: 'ok', rank: 5 } : (e => e.k === 'expired' ? { label: 'Expired', tone: 'bad', rank: 1 } : e.k === 'due' ? { label: `Expires in ${e.d} d`, tone: 'warn', rank: 2 } : { label: 'Valid', tone: 'ok', rank: 4 })(rgExpiry(d.expiry, 30)),
      alerts: d => { const p = trPerson(d.person); if (!d.expiry || (p && p.data.status === 'Demobilised')) return []; const dd = rgDays(d.expiry); return dd >= 0 && dd <= 30 ? [{ sev: dd <= 7 ? 'high' : 'info', title: `Training expires in ${dd} d`, detail: rgTitle({ data: d, kind: 'r:tr' }) }] : []; } },
    { kind: 'tpl', name: 'Planned session', plural: 'Training plan', prefix: 'PLN', cols: ['course', 'date', 'target', 'status'], filters: ['status'], addLabel: 'Plan a session',
      title: d => { const c = trCourse(d.course); return (c ? c.data.name : 'Session') + ' · ' + rgDate(d.date); }, sub: d => `target ${d.target || 0}`,
      fields: [{ k: 'course', l: 'Course', type: 'ref', ref: 'tc', req: true, sec: 'Session' }, { k: 'date', l: 'Planned date', type: 'date', req: true }, { k: 'target', l: 'Target attendees', type: 'num', req: true },
        { k: 'trainer', l: 'Trainer', type: 'text' }, { k: 'location', l: 'Location', type: 'text' }, { k: 'reason', l: 'Why (training need)', type: 'textarea' }, { k: 'status', l: 'Status', type: 'select', opts: ['Planned', 'Delivered', 'Cancelled'], req: true }],
      defaults: () => ({ status: 'Planned' }),
      status: (d, r) => { const a = trPlanActual(r); return d.status === 'Cancelled' ? { label: 'Cancelled', tone: 'mute' } : { label: `${a} / ${d.target || 0} attended`, tone: a >= (+d.target || 0) && a ? 'ok' : rgDays(d.date) < 0 ? 'bad' : 'info' }; },
      related: [{ kind: 'tr', l: 'Attendance', match: (x, r) => x.data.plan === r.id, pre: r => ({ plan: r.id, course: r.data.course, date: r.data.date }), addLabel: 'Add attendee' }] }],
  tabs: [['dash', 'Dashboard', () => trDash()], ['people', 'People', () => rgList(REG.ents.tp)], ['matrix', 'Training matrix', () => trMatrix()], ['records', 'Training records', () => rgList(REG.ents.tr)],
    ['plan', 'Plan · target vs actual', () => trPlanTab()], ['tna', 'Training needs (TNA)', () => trTna()], ['courses', 'Courses', () => rgList(REG.ents.tc)]] });
const trPlanActual = r => rgRecs('tr').filter(x => x.data.plan === r.id).length;

/* ---------- matrix ---------- */
function trMatrix() {
  const f = REG.f.tpm || {}; let P = rgMine('tp').filter(p => p.data.status !== 'Demobilised');
  if (f.project) P = P.filter(p => p.project === f.project); if (f.position) P = P.filter(p => p.data.position === f.position);
  const pos = new Set(P.map(p => p.data.position)), C = rgRecs('tc').filter(c => c.data.mandatory || (c.data.forPos || []).some(x => pos.has(x)));
  const cell = { ok: ['ok', '✓'], due: ['due', '!'], exp: ['exp', '✕'], miss: ['miss', '–'], na: ['na', ''] };
  return `<div class="panel"><div class="rg-bar"><h2>Training matrix <small>${P.length} people · ${C.length} courses</small></h2><span class="rg-sp"></span>
   <select class="mx-in" data-rg-filt="tpm|project"><option value="">All projects</option>${myProjects().map(p => `<option value="${rgEsc(p.id)}" ${f.project === p.id ? 'selected' : ''}>${rgEsc(p.name)}</option>`).join('')}</select>
   <select class="mx-in" data-rg-filt="tpm|position"><option value="">All positions</option>${trPos().map(o => `<option ${f.position === o ? 'selected' : ''}>${rgEsc(o)}</option>`).join('')}</select></div>
   <p class="rg-note"><span class="rg-cell ok">✓</span> valid · <span class="rg-cell due">!</span> expires within 30 days · <span class="rg-cell exp">✕</span> expired · <span class="rg-cell miss">–</span> required, not trained · blank = not required</p>
   <div class="rg-tw"><table class="rg-t rg-matrix"><thead><tr><th>Person</th><th>Position</th>${C.map(c => `<th title="${rgEsc(c.data.name)}">${rgEsc((c.data.code || c.data.name).slice(0, 14))}</th>`).join('')}<th>%</th></tr></thead><tbody>
   ${P.slice(0, 400).map(p => { const L2 = trLatest(p.id), s = trPersonStatus(p); return `<tr data-rg-open="${rgEsc(p.id)}" tabindex="0"><td><b>${rgEsc(p.data.name)}</b><br><small class="rg-id">${rgEsc(p.data._no)}</small></td><td>${rgEsc(p.data.position || '')}</td>${C.map(c => { const k = trCell(p, c, L2); return `<td><span class="rg-cell ${cell[k][0]}">${cell[k][1]}</span></td>`; }).join('')}<td><b>${s.pct}%</b></td></tr>`; }).join('') || `<tr><td colspan="${C.length + 3}" class="rg-empty">Add people and courses to see the matrix.</td></tr>`}</tbody></table></div></div>`;
}

/* ---------- plan: target vs actual ---------- */
function trPlanTab() {
  const M = rgMonths(12), Pl = rgMine('tpl').filter(p => p.data.status !== 'Cancelled');
  const tgt = M.map(m => Pl.filter(p => (p.data.date || '').startsWith(m)).reduce((n, p) => n + (+p.data.target || 0), 0));
  const act = M.map(m => rgMine('tr').filter(r => (r.data.date || '').startsWith(m) && r.data.result !== 'Fail').length);
  const by = {}; Pl.forEach(p => { const c = trCourse(p.data.course), k = c ? c.data.name : '—'; by[k] = by[k] || [0, 0]; by[k][0] += +p.data.target || 0; by[k][1] += trPlanActual(p); });
  return `<div class="rg-dash">
   ${rgCard('Target vs actual attendees · last 12 months', cdBars(M.map(rgMonLbl), [{ name: 'Target (planned)', vals: tgt, color: '#8fa6e6' }, { name: 'Actual (trained)', vals: act, color: '#2f73c9' }], { flat: 1, w: 640 }), 'cd-wide')}
   ${rgCard('By course · target vs attended', Object.keys(by).length ? cdBars(Object.keys(by).slice(0, 8), [{ name: 'Target', vals: Object.values(by).map(x => x[0]), color: '#8fa6e6' }, { name: 'Attended', vals: Object.values(by).map(x => x[1]), color: '#2f73c9' }], { flat: 1, rot: 1 }) : '<p class="cd-none">No planned sessions</p>')}</div>
   ${rgList(REG.ents.tpl)}`;
}

/* ---------- training needs analysis ---------- */
const TR_TNA = [['Working at height', /height|fall|scaffold|ladder|edge|harness/i], ['Lifting & rigging', /lift|crane|rigg|sling|load|hoist/i], ['Electrical safety', /electr|cable|shock|loto|isolation/i], ['Defensive driving & traffic', /vehicle|traffic|driv|revers|road|forklift|collision/i],
  ['Heat stress', /heat|dehydrat|sun/i], ['Hot work & fire', /hot work|fire|weld|burn|spark/i], ['Confined space', /confined|tank|manhole/i], ['Chemicals (COSHH)', /chemic|cement|dermat|spill|fume|coshh/i], ['Excavation', /excavat|trench|collapse/i],
  ['Manual handling', /manual|back|strain|sprain|lifting by hand/i], ['Hand safety & PPE', /hand|finger|cut|lacerat|glove|ppe|eye/i], ['Housekeeping', /housekeep|trip|slip|debris|walkway/i], ['Permit to work', /permit|ptw/i], ['Food hygiene', /food|kitchen|hygien|temperature/i]];
function trTnaData() {
  const ids = new Set(myProjects().map(p => p.id)), since = Date.now() - 365 * DAY_MS, T = {};
  const add = (topic, k, n = 1) => { T[topic] = T[topic] || { inc: 0, haz: 0, insp: 0, gap: 0, people: new Set() }; T[topic][k] += n; };
  (L.reports || []).filter(r => ids.has(r.project) && (r.eventTs || r.ts) > since).forEach(r => { const txt = [r.kind, r.cat, r.desc, r.description, r.investigation && r.investigation.root, r.investigation && r.investigation.immediate].join(' '); TR_TNA.forEach(([t, re]) => { if (re.test(txt)) add(t, r.rt === 'Incident' ? 'inc' : 'haz'); }); });
  (L.inspections || []).filter(i => ids.has(i.project) && i.ts > since && +i.fails > 0).forEach(i => TR_TNA.forEach(([t, re]) => { if (re.test(i.tpl || '')) add(t, 'insp', +i.fails); }));
  rgMine('tp').filter(p => p.data.status !== 'Demobilised').forEach(p => { const L2 = trLatest(p.id); trRequired(p.data.position).forEach(c => { const k = trCell(p, c, L2); if (k === 'miss' || k === 'exp') { const t = (TR_TNA.find(([, re]) => re.test(c.data.name)) || [c.data.name])[0]; add(t, 'gap'); T[t].people.add(p.id); } }); });
  return Object.entries(T).map(([t, v]) => ({ t, ...v, score: v.inc * 5 + v.haz * 2 + v.insp + v.gap * 3, course: rgRecs('tc').find(c => (TR_TNA.find(([x]) => x === t) || [, new RegExp(t, 'i')])[1].test(c.data.name)) })).sort((a, b) => b.score - a.score);
}
function trTna() {
  const D = trTnaData(), max = Math.max(1, ...D.map(x => x.score));
  return `<div class="panel"><div class="rg-bar"><h2>Training needs analysis</h2><span class="rg-sp"></span><span class="mx-muted">Last 12 months · your projects</span></div>
   <p class="rg-note">Built from what is happening on your sites: incidents (×5), hazard reports (×2), inspection items at risk (×1) and people missing required training (×3). Each topic links to a course; add it to the plan in one click.</p>
   <div class="rg-tw"><table class="rg-t"><thead><tr><th>Training topic</th><th>Priority</th><th>Incidents</th><th>Hazards</th><th>Inspection findings</th><th>People missing it</th><th>Course</th><th></th></tr></thead><tbody>
   ${D.map(x => `<tr><td><b>${rgEsc(x.t)}</b></td><td><div class="rg-bar" style="margin:0"><span style="display:inline-block;height:10px;border-radius:5px;width:${Math.round(x.score / max * 120)}px;background:${x.score / max > .66 ? '#d23b3f' : x.score / max > .33 ? '#e0a106' : '#2f73c9'}"></span> <small>${x.score}</small></div></td><td>${x.inc}</td><td>${x.haz}</td><td>${x.insp}</td><td>${x.gap}</td><td>${x.course ? `<a href="#" data-rg-open="${rgEsc(x.course.id)}">${rgEsc(x.course.data.name)}</a>` : '<span class="rg-blank">No course yet</span>'}</td>
    <td>${rgCan(REG.ents.tpl, 'edit') ? (x.course ? `<button class="btn" data-rg-new="tpl" data-rg-pre="${rgEsc(JSON.stringify({ course: x.course.id, target: Math.max(x.people.size, 10), reason: `TNA: ${x.inc} incidents, ${x.haz} hazards, ${x.insp} findings, ${x.gap} people missing` }))}">Add to plan</button>` : `<button class="btn" data-rg-new="tc" data-rg-pre="${rgEsc(JSON.stringify({ name: x.t, category: 'HSE mandatory' }))}">Create course</button>`) : ''}</td></tr>`).join('') || '<tr><td colspan="8" class="rg-empty">No incidents, findings or gaps found in the last 12 months.</td></tr>'}</tbody></table></div></div>`;
}

/* ---------- dashboard ---------- */
function trDash() {
  const P = rgMine('tp').filter(p => p.data.status !== 'Demobilised'), S = P.map(p => ({ p, s: trPersonStatus(p) }));
  const req = S.reduce((n, x) => n + x.s.req, 0), ok = S.reduce((n, x) => n + x.s.ok, 0), exp = S.reduce((n, x) => n + x.s.exp, 0), miss = S.reduce((n, x) => n + x.s.miss, 0), due = S.reduce((n, x) => n + x.s.due, 0);
  const R = rgMine('tr'), y = String(new Date().getFullYear()), hrs = R.filter(r => (r.data.date || '').startsWith(y)).reduce((n, r) => n + (+r.data.hours || 0), 0);
  const m = new Date().toISOString().slice(0, 7), pl = rgMine('tpl').filter(p => (p.data.date || '').startsWith(m) && p.data.status !== 'Cancelled');
  const byProj = {}; S.forEach(x => { const k = projName(x.p.project); byProj[k] = byProj[k] || [0, 0]; byProj[k][0] += x.s.ok; byProj[k][1] += x.s.req; });
  const soon = R.filter(r => r.data.expiry && rgDays(r.data.expiry) >= 0 && rgDays(r.data.expiry) <= 60 && (trPerson(r.data.person) || { data: {} }).data.status !== 'Demobilised').sort((a, b) => (a.data.expiry > b.data.expiry ? 1 : -1));
  const tna = trTnaData().slice(0, 8);
  return `<div class="rg-kpis">${rgKpi('People active', P.length, 'info')}${rgKpi('Training compliance', req ? Math.round(ok / req * 100) + '%' : '—', req && ok / req >= .9 ? 'ok' : 'warn')}${rgKpi('Expired', exp, exp ? 'bad' : 'ok')}${rgKpi('Not trained (required)', miss, miss ? 'bad' : 'ok')}${rgKpi('Expiring in 30 days', due, due ? 'warn' : 'ok')}${rgKpi('Training hours ' + y, Math.round(hrs).toLocaleString('en-GB'), 'info')}${rgKpi('This month: planned / trained', pl.reduce((n, p) => n + (+p.data.target || 0), 0) + ' / ' + R.filter(r => (r.data.date || '').startsWith(m)).length, 'info')}</div>
   <div class="rg-dash">
    ${rgCard('Compliance by project', Object.keys(byProj).length ? cdHbars(Object.entries(byProj).map(([k, v]) => ({ l: k, v: v[1] ? Math.round(v[0] / v[1] * 100) : 100, c: v[1] && v[0] / v[1] < .7 ? '#d23b3f' : v[1] && v[0] / v[1] < .9 ? '#e0a106' : '#1f9d63' })), { lw: 150 }) : '<p class="cd-none">Add people to see compliance</p>')}
    ${rgCard('Top training needs (TNA)', tna.length ? cdHbars(tna.map(x => ({ l: x.t, v: x.score, c: '#2f73c9' })), { lw: 150 }) : '<p class="cd-none">No needs found yet</p>')}
    ${rgCard('Trained per month', cdBars(rgMonths(12).map(rgMonLbl), [{ name: 'Trained', vals: rgMonths(12).map(m2 => R.filter(r => (r.data.date || '').startsWith(m2)).length), color: '#2f73c9' }], { flat: 1, w: 520 }), '')}
    ${rgCard('Expiring in the next 60 days', soon.length ? `<div class="rg-tw"><table class="rg-t"><tbody>${soon.slice(0, 12).map(r => `<tr data-rg-open="${rgEsc(r.data.person)}" tabindex="0"><td>${rgEsc((trPerson(r.data.person) || { data: {} }).data.name || '')}</td><td>${rgEsc((trCourse(r.data.course) || { data: {} }).data.name || '')}</td><td>${rgExpPill(r.data.expiry, 30)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="cd-none">Nothing expiring</p>', 'cd-wide')}
   </div>`;
}
/* replace the old training menu */
rgNav('training', 'Training & competence', null, [['m-training', 'Training & competence'], ['train', 'Training sessions (monthly)']], 'leadership');
