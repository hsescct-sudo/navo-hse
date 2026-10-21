/* NAVO · CEO bi-monthly HSSE report and Environmental performance.
   Optional module. Turn it off in Settings → Optional modules, or remove it completely by deleting
   navo-ceo.js and navo-ceo.css and their two lines in index.html. No database change is needed:
   manual figures are stored in hsse_records with kind "ceo" (per project, month and fortnight) and "env" (per project and month).

   Rules
   - Figures NAVO already holds are calculated, never typed: man-hours, incidents by class, days lost, inspections, observations.
   - Blank means not reported; zero means reported zero.
   - Rates use the platform basis (per 1,000,000 man-hours) and the KPI targets in Settings. */
'use strict';
const CEO = { scope: 'Corporation', month: null, entry: null, env: { scope: 'Corporation', year: null, entry: null } };
const CEO_ON = () => !(L.structure && L.structure.modules && L.structure.modules.ceoEnv === false);

/* ---------- Indicators ---------- */
// [key, label, source] source: auto = from NAVO records per fortnight · month = from monthly data (month level) · env = from environmental data · manual
const CEO_SECTIONS = [
  ['Safety', [
    ['manhours', 'Total man-hours worked', 'month'], ['manpower', 'Average manpower', 'month'],
    ['inspections', 'OHS inspections', 'auto'], ['inspFindings', 'OHS inspection findings (at risk)', 'auto'], ['hazards', 'Hazard observations reported', 'auto'],
    ['fat', 'Fatalities', 'auto'], ['si', 'Serious injuries (SI)', 'auto'], ['rlta', 'Lost time accidents > 7 days (RLTA)', 'auto'], ['rlti', 'Lost time injuries 1–7 days (RLTI)', 'auto'],
    ['daysLost', 'Days lost (RLTA + RLTI)', 'auto'], ['rwc', 'Restricted work cases (RWC)', 'auto'], ['mtc', 'Medical treatment cases (MTC)', 'auto'], ['fac', 'First aid cases (FAC)', 'auto'],
    ['odc', 'Occupational disease cases (ODC)', 'auto'], ['imp', 'Injury to member of public (IMP)', 'auto'], ['rtac', 'Road traffic accidents (RTAC)', 'auto'], ['nearMiss', 'Near misses', 'auto'],
    ['ncrMinor', 'NCR minor', 'manual'], ['ncrMajor', 'NCR major', 'manual'], ['ncrOpen', 'NCR open', 'manual'], ['ncrClosed', 'NCR closed', 'manual'], ['contraventions', 'Safety contraventions', 'manual']]],
  ['Environmental', [
    ['wasteGen', 'Waste generated (t)', 'env'], ['wasteDiverted', 'Waste recycled / reused (t)', 'env'], ['wasteDisposed', 'Waste disposed (t)', 'env'], ['water', 'Water consumption (m³)', 'env'],
    ['electricity', 'Electricity consumption (kWh)', 'env'], ['diesel', 'Diesel consumption (L)', 'env'], ['renewable', 'Renewable energy (kWh)', 'env'], ['ghg', 'Total GHG emissions (tCO₂e)', 'env'],
    ['envCompliance', 'Environmental non-compliances', 'manual']]],
  ['Health, medical & camp', [
    ['hospitalized', 'Hospitalised cases', 'manual'], ['unfit', 'Medically unfit', 'manual'], ['referrals', 'Medical emergency referrals', 'manual'], ['screening', 'Health screening', 'manual'],
    ['surveillance', 'Occupational health surveillance', 'manual'], ['nwrFatal', 'Fatality case (non-work related)', 'manual'], ['campIdxInt', 'Camp audit performance index – internal (%)', 'manual'],
    ['campIdxExt', 'Camp audit performance index – external (%)', 'manual'], ['campInsp', 'Camp HSSE inspections', 'manual'], ['campObs', 'Camp HSSE observations', 'manual'],
    ['campIncidents', 'Incidents at camp', 'manual'], ['grievances', 'Complaints / grievances at camp', 'manual'], ['campViolations', 'Camp violations', 'manual'],
    ['disciplinary', 'Disciplinary actions', 'manual'], ['absconding', 'Persons absconding', 'manual'], ['campInductions', 'Camp safety inductions', 'manual'], ['campAttendees', 'Camp induction attendees', 'manual'], ['campDrills', 'Mock drills at camp', 'manual']]],
  ['Training', [
    ['trainHours', 'Training man-hours', 'month'], ['ioshWS', 'IOSH Working Safely completed', 'manual'], ['ioshMS', 'IOSH Managing Safely completed', 'manual'], ['inductions', 'HSE inductions', 'manual']]],
  ['Security', [
    ['patrols', 'Compliance team patrols', 'manual'], ['secInsp', 'Security inspections', 'manual'], ['secIncidents', 'Security incidents', 'manual'], ['escortScrap', 'Escorts to scrap yard', 'manual'], ['escortHospital', 'Escorts to hospital', 'manual']]],
  ['Lifting', [
    ['liftPlans', 'Completed lift plans', 'manual'], ['liftsOk', 'Lifts completed without incident', 'manual'], ['liftsInc', 'Lifts completed with incident', 'manual'], ['liftsUnsafe', 'Lifts with observed unsafe acts', 'manual'], ['liftTraining', 'Lifting trainings completed', 'manual']]],
  ['CCTV monitoring', [
    ['cctvCams', 'CCTV cameras in operation', 'manual'], ['cctvObs', 'CCTV observations', 'manual'], ['cctvDay', 'Observations – day shift', 'manual'], ['cctvNight', 'Observations – night shift', 'manual']]],
];
const CEO_MANUAL = CEO_SECTIONS.flatMap(([, r]) => r.filter(x => x[2] === 'manual').map(x => x[0]));
const ENV_FIELDS = [['electricity', 'Electricity from grid (kWh)'], ['renewable', 'Renewable electricity (kWh)'], ['dieselL', 'Diesel (litres)'], ['waterPotable', 'Potable water (m³)'], ['waterNonPotable', 'Non-potable water (m³)'], ['offset', 'GHG offset (tCO₂e)']];
const ENV_DEF = { elec: 0.630, diesel: 2.68, targets: { elec: 10, water: 10, diesel: 10, diversion: 95 } };
const envCfg = () => { const e = (L.structure && L.structure.env) || {}; return { elec: +e.elec || ENV_DEF.elec, diesel: +e.diesel || ENV_DEF.diesel, targets: { ...ENV_DEF.targets, ...(e.targets || {}) } }; };

/* ---------- Scope & periods ---------- */
function ceoScopes() {
  const P = myProjects(); const plats = [...new Set(P.map(p => p.platform).filter(Boolean))]; const divs = [...new Set(P.map(p => p.division).filter(Boolean))];
  return [['Corporation', 'Corporation (all projects)'], ...plats.map(x => ['plat:' + x, x + ' platform']), ...divs.map(x => ['div:' + x, x + ' division']), ...P.map(p => ['proj:' + p.id, p.name])];
}
function ceoProjects(scope) {
  const P = myProjects(); if (!scope || scope === 'Corporation') return P;
  const [k, v] = [scope.slice(0, scope.indexOf(':')), scope.slice(scope.indexOf(':') + 1)];
  return P.filter(p => k === 'plat' ? p.platform === v : k === 'div' ? p.division === v : p.id === v);
}
const ceoMonthNow = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
const ceoRange = (month, half) => { const [y, m] = month.split('-').map(Number); const a = half === 2 ? new Date(y, m - 1, 15) : new Date(y, m - 1, 1); const b = half === 1 ? new Date(y, m - 1, 15) : new Date(y, m, 1); return [a.getTime(), b.getTime()]; };
const ceoYtd = month => { const [y, m] = month.split('-').map(Number); return [new Date(y, 0, 1).getTime(), new Date(y, m, 1).getTime()]; };
const ceoMonthsTo = month => { const [y, m] = month.split('-').map(Number); return Array.from({ length: m }, (_, i) => y + '-' + String(i + 1).padStart(2, '0')); };
const fmtMonth = m => new Date(m + '-01T00:00:00').toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });

/* ---------- Values ---------- */
function ceoAuto(ids, a, b) {
  const inR = r => { const t = r.eventTs || r.ts; return ids.has(r.project) && t >= a && t < b; };
  const R = L.reports.filter(inR), I = L.inspections.filter(i => ids.has(i.project) && i.ts >= a && i.ts < b);
  const sev = s => R.filter(r => sevOf(r) === s).length, kd = k => R.filter(r => r.kind === k).length;
  return {
    inspections: I.length, inspFindings: I.reduce((n, i) => n + (+i.fails || 0), 0), hazards: R.filter(r => r.rt === 'Hazard').length,
    fat: sev('Fatality'), si: sev('Serious Injury'), rlta: sev('Lost Time (> 7 days)'), rlti: sev('Lost Time'), rwc: sev('Restricted Work'), mtc: sev('Medical Treatment'), fac: sev('First Aid'),
    daysLost: R.filter(r => ['Lost Time (> 7 days)', 'Lost Time'].includes(sevOf(r))).reduce((n, r) => n + (+r.lostDays || 0), 0),
    odc: kd('Occupational Disease'), imp: kd('Injury to Member of Public'), rtac: kd('Road Traffic Accident'), nearMiss: R.filter(r => r.kind === 'Near Miss' || r.kind === 'Dangerous Occurrence').length,
  };
}
function ceoMonthly(ids, months) {
  const M = (L.records || []).filter(r => r.kind === 'monthly' && ids.has(r.project) && months.includes(r.data && r.data.month));
  if (!M.length) return {};
  const s = k => M.reduce((n, r) => n + (+(r.data || {})[k] || 0), 0);
  const heads = months.map(m => M.filter(r => r.data.month === m).reduce((n, r) => n + (+r.data.empHead || 0) + (+r.data.conHead || 0), 0)).filter(Boolean);
  return { manhours: s('empHours') + s('conHours'), manpower: heads.length ? Math.round(heads.reduce((a, b) => a + b, 0) / heads.length) : null, trainHours: s('trainHours') + s('trainHoursExt') };
}
/* Monthly performance data asks for diesel in tonnes. A figure above 20,000 t for one project in one month is not credible
   (that is ~24 million litres); it was entered in litres, so it is used as litres. */
const cdDieselL = t => t > 20000 ? t : t * 1190;
function envValues(ids, months) {
  const cfg = envCfg();
  const M = (L.records || []).filter(r => r.kind === 'monthly' && ids.has(r.project) && months.includes(r.data && r.data.month));
  const E = (L.records || []).filter(r => r.kind === 'env' && ids.has(r.project) && months.includes(r.data && r.data.month));
  if (!M.length && !E.length) return null;
  const sm = k => M.reduce((n, r) => n + (+(r.data || {})[k] || 0), 0), se = k => E.reduce((n, r) => n + (+(r.data || {})[k] || 0), 0);
  const diverted = sm('nhRecycled') + sm('nhReused') + sm('hzRecycled') + sm('faRecycled');
  const disposed = sm('nhDisposed') + sm('hzDisposed') + sm('hzIncinerated') + sm('faDisposed');
  // Per project and month: the environmental entry wins; otherwise the monthly performance figure is used (diesel tonnes × 1,190 L/t).
  const keys = new Set([...M, ...E].map(r => r.project + '|' + r.data.month)); let dieselL = 0, water = 0;
  keys.forEach(k => { const [p, m] = k.split('|'); const e = E.find(r => r.project === p && r.data.month === m), mo = M.find(r => r.project === p && r.data.month === m);
    const ok = v => v != null && v !== '';
    dieselL += e && ok(e.data.dieselL) ? +e.data.dieselL : mo ? cdDieselL(+mo.data.diesel || 0) : 0;
    water += e && (ok(e.data.waterPotable) || ok(e.data.waterNonPotable)) ? (+e.data.waterPotable || 0) + (+e.data.waterNonPotable || 0) : mo ? (+mo.data.water || 0) : 0; });
  const has = k => E.some(r => r.data[k] != null && r.data[k] !== '');
  const electricity = has('electricity') ? se('electricity') : null, renewable = has('renewable') ? se('renewable') : null;
  const scope1 = dieselL * cfg.diesel / 1000, scope2 = (electricity || 0) * cfg.elec / 1000;
  return { wasteGen: diverted + disposed, wasteDiverted: diverted, wasteDisposed: disposed, diversion: diverted + disposed ? diverted / (diverted + disposed) * 100 : null,
    water, waterPotable: se('waterPotable'), waterNonPotable: se('waterNonPotable'), electricity, renewable, diesel: dieselL, scope1, scope2, ghg: scope1 + scope2, offset: se('offset'), hours: sm('empHours') + sm('conHours') };
}
function ceoManual(ids, month, half) {
  const C = (L.records || []).filter(r => r.kind === 'ceo' && ids.has(r.project) && r.data && r.data.month === month && (!half || r.data.half === half));
  const out = {}; CEO_MANUAL.forEach(k => { const vals = C.map(r => (r.data.v || {})[k]).filter(v => v !== '' && v != null); if (vals.length) out[k] = vals.reduce((a, b) => a + +b, 0); });
  if (out.campIdxInt != null) out.campIdxInt = Math.round(out.campIdxInt / C.filter(r => (r.data.v || {}).campIdxInt !== '' && (r.data.v || {}).campIdxInt != null).length);
  if (out.campIdxExt != null) out.campIdxExt = Math.round(out.campIdxExt / C.filter(r => (r.data.v || {}).campIdxExt !== '' && (r.data.v || {}).campIdxExt != null).length);
  return out;
}
function ceoColumns(scope, month) {
  const ids = new Set(ceoProjects(scope).map(p => p.id));
  const months = ceoMonthsTo(month);
  const col = (a, b, mon, manual, env) => ({ ...ceoAuto(ids, a, b), ...(mon ? ceoMonthly(ids, mon) : {}), ...manual, ...(env ? Object.fromEntries(Object.entries(env).map(([k, v]) => [k, v])) : {}) });
  const [a1, b1] = ceoRange(month, 1), [a2, b2] = ceoRange(month, 2), [ay, by] = ceoYtd(month);
  const ytdManual = {}; months.forEach(m => { const v = ceoManual(ids, m); Object.entries(v).forEach(([k, x]) => ytdManual[k] = (ytdManual[k] || 0) + x); });
  return { ids, w1: col(a1, b1, null, ceoManual(ids, month, 1)), w2: col(a2, b2, null, ceoManual(ids, month, 2)), mon: col(a1, b2, [month], ceoManual(ids, month), envValues(ids, [month])), ytd: col(ay, by, months, ytdManual, envValues(ids, months)) };
}
function ceoRates(c) {
  const cfg = hsKpiCfg(), h = c.manhours; if (!h) return null;
  const lti = (c.fat || 0) + (c.si || 0) + (c.rlta || 0) + (c.rlti || 0), rec = lti + (c.rwc || 0) + (c.mtc || 0);
  const days = (c.daysLost || 0) + (c.fat || 0) * 6000;
  return { ltifr: lti * cfg.mult / h, trcf: rec * cfg.mult / h, ltisr: days * cfg.mult / h, lti, rec };
}

/* ---------- CEO page ---------- */
const ceoNum = (v, k) => v == null || v === '' ? '<span class="ceo-blank">—</span>' : (k === 'ghg' || /^waste/.test(k) ? (+v).toLocaleString('en-GB', { maximumFractionDigits: 1 }) : Math.round(+v).toLocaleString('en-GB'));
function ceoPage() {
  if (!CEO_ON()) return '<div class="panel"><h2>This module is turned off</h2><p class="mx-muted">An HSE Admin can turn it on in Settings → Optional modules.</p></div>';
  CEO.month = CEO.month || ceoMonthNow();
  const scopes = ceoScopes(); if (!scopes.find(s => s[0] === CEO.scope)) CEO.scope = 'Corporation';
  const C = ceoColumns(CEO.scope, CEO.month), tg = hsKpiCfg().targets[CEO.scope.startsWith('plat:') ? CEO.scope.slice(5) : 'Corporation'] || hsKpiCfg().targets.Corporation;
  const rm = ceoRates(C.mon), ry = ceoRates(C.ytd);
  const rate = (lbl, k, t) => { const y = ry ? ry[k] : null; const ok = y == null ? '' : y <= t ? 'ok' : 'bad'; return `<div class="ceo-rate ${ok}"><span>${lbl}</span><b>${y == null ? '—' : y.toFixed(2)}</b><small>YTD · target ${t.toFixed(2)}${rm ? ` · month ${rm[k].toFixed(2)}` : ''}</small></div>`; };
  const tiles = [['Man-hours YTD', C.ytd.manhours], ['Fatalities YTD', C.ytd.fat], ['Recordable cases YTD', ry ? ry.rec : null], ['Lost time injuries YTD', ry ? ry.lti : null], ['Days lost YTD', C.ytd.daysLost], ['Road traffic accidents YTD', C.ytd.rtac]];
  const srcTag = s => s === 'manual' ? '' : `<i class="ceo-src ${s}" title="${s === 'auto' ? 'Calculated from NAVO records' : s === 'month' ? 'From monthly performance data' : 'From environmental data'}">${s === 'auto' ? 'auto' : s === 'month' ? 'monthly' : 'env'}</i>`;
  const cell = (col, k, s) => (s === 'month' || s === 'env') && (col === C.w1 || col === C.w2) ? '<span class="ceo-na">month</span>' : ceoNum(col[k], k);
  const staff = isStaff();
  return `<div class="ceo">
   <div class="nvr-hero ceo-hero"><div><span class="nvi-eyebrow">CEO bi-monthly HSSE report</span><h2>${esc(scopes.find(s => s[0] === CEO.scope)[1])} · ${fmtMonth(CEO.month)}</h2><p>Safety, environment, health & camp, training, security, lifting and CCTV. Figures NAVO already holds are calculated automatically; the rest is entered per project and fortnight.</p></div>
    <div class="ceo-ctrl"><label>Scope<select data-ceo="scope">${scopes.map(([v, l]) => `<option value="${esc(v)}" ${v === CEO.scope ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label><label>Month<input type="month" data-ceo="month" value="${CEO.month}"></label>
     <div class="ceo-btns">${staff ? '<button class="btn pri" data-ceoentry>Enter fortnight data</button>' : ''}</div></div>
    <div class="ceo-report"><span>Download report</span><button class="btn" data-ceorep="pptx">PowerPoint</button><button class="btn" data-ceorep="docx">Word</button><button class="btn" data-ceorep="xlsx">Excel</button><button class="btn" data-ceocsv>CSV</button><button class="btn" data-ceoprint>Print / PDF</button></div></div>
   <div class="ceo-rates">${rate('LTIFR', 'ltifr', tg.ltifr)}${rate('TRCF', 'trcf', tg.trcf)}${rate('LTISR', 'ltisr', tg.ltisr)}</div>
   <div class="kpis ceo-tiles">${tiles.map(([l, v]) => `<div class="kpi"><div class="l">${l}</div><div class="v">${v == null ? '—' : v >= 1e5 ? hsN(v) : Math.round(v).toLocaleString('en-GB')}</div></div>`).join('')}</div>
   ${!C.ytd.manhours ? '<div class="nvi-alert">No man-hours recorded for this scope and year. Frequency rates cannot be calculated; enter monthly man-hours in Administration → Performance data.</div>' : ''}
   ${CEO.entry ? ceoEntryForm() : ''}
   ${CEO_SECTIONS.map(([sec, rows]) => `<section class="ceo-sec"><h3>${sec}</h3><div class="tbl"><table><thead><tr><th>Indicator</th><th class="r">Weeks 1–2</th><th class="r">Weeks 3–4</th><th class="r">${fmtMonth(CEO.month)}</th><th class="r">YTD</th></tr></thead><tbody>
     ${rows.map(([k, l, s]) => `<tr><td>${esc(l)} ${srcTag(s)}</td><td class="r">${cell(C.w1, k, s)}</td><td class="r">${cell(C.w2, k, s)}</td><td class="r">${ceoNum(C.mon[k], k)}</td><td class="r"><b>${ceoNum(C.ytd[k], k)}</b></td></tr>`).join('')}</tbody></table></div></section>`).join('')}
   <p class="mx-muted ceo-note">Blank (—) means not reported; zero means reported zero. Rates per ${hsN(hsKpiCfg().mult)} man-hours: LTIFR = (fatalities + SI + RLTA + RLTI) × basis ÷ man-hours; TRCF adds RWC and MTC; LTISR = (days lost + 6,000 per fatality) × basis ÷ man-hours. Weeks 1–2 = days 1–14, weeks 3–4 = day 15 to month end, by event date.</p>
  </div>`;
}
function ceoEntryForm() {
  const e = CEO.entry, P = myProjects(); if (!e.project) e.project = (ceoProjects(CEO.scope)[0] || P[0] || {}).id;
  const rec = (L.records || []).find(r => r.kind === 'ceo' && r.project === e.project && r.data && r.data.month === CEO.month && r.data.half === e.half);
  if (!e.loaded || e.key !== e.project + CEO.month + e.half) { e.v = { ...((rec && rec.data.v) || {}) }; e.loaded = true; e.key = e.project + CEO.month + e.half; }
  return `<div class="panel ceo-entry"><div class="nvi-head"><div><span class="nvi-eyebrow">Fortnight data entry</span><h2>${fmtMonth(CEO.month)} · ${e.half === 1 ? 'weeks 1–2' : 'weeks 3–4'}</h2><p>Only figures NAVO cannot calculate. Leave blank if not reported.</p></div><button class="btn" data-ceoclose>Close</button></div>
   <div class="mx-grid"><div class="fld"><label>Project</label><select data-ceoe="project">${P.map(p => `<option value="${esc(p.id)}" ${p.id === e.project ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>
    <div class="fld"><label>Fortnight</label><select data-ceoe="half"><option value="1" ${e.half === 1 ? 'selected' : ''}>Weeks 1–2 (days 1–14)</option><option value="2" ${e.half === 2 ? 'selected' : ''}>Weeks 3–4 (day 15 to end)</option></select></div></div>
   ${CEO_SECTIONS.map(([sec, rows]) => { const m = rows.filter(r => r[2] === 'manual'); return m.length ? `<h3 class="ceo-eh">${sec}</h3><div class="ceo-grid">${m.map(([k, l]) => `<div class="fld"><label>${esc(l)}</label><input class="mx-in" type="number" min="0" step="any" data-ceov="${k}" value="${e.v[k] ?? ''}"></div>`).join('')}</div>` : ''; }).join('')}
   <div class="nvi-foot"><div>${rec ? 'Updating the saved figures for this project and fortnight.' : 'New entry for this project and fortnight.'}</div><button class="btn pri" data-ceosave>Save figures</button></div></div>`;
}
async function ceoSave() {
  const e = CEO.entry; const v = {}; Object.entries(e.v).forEach(([k, x]) => { if (x !== '' && x != null && !isNaN(+x)) v[k] = +x; });
  const rec = (L.records || []).find(r => r.kind === 'ceo' && r.project === e.project && r.data && r.data.month === CEO.month && r.data.half === e.half);
  const data = { month: CEO.month, half: e.half, v, by: L.me?.name || '' };
  const ok = await liveSave(() => rec ? L.db.collection('records').doc(rec.id).update({ data, ts: Date.now() }) : L.db.collection('records').add({ project: e.project, kind: 'ceo', ts: Date.now(), data, by: L.me.id }), 'Figures saved');
  if (ok !== false) { if (rec) rec.data = data; CEO.entry = null; render(); }
}
function ceoCsv() {
  const C = ceoColumns(CEO.scope, CEO.month); const rows = [['Section', 'Indicator', 'Weeks 1-2', 'Weeks 3-4', CEO.month, 'YTD']];
  CEO_SECTIONS.forEach(([sec, r]) => r.forEach(([k, l, s]) => rows.push([sec, l, ...[C.w1, C.w2].map(c => (s === 'month' || s === 'env') ? '' : c[k] ?? ''), C.mon[k] ?? '', C.ytd[k] ?? ''])));
  const ry = ceoRates(C.ytd); if (ry) rows.push(['Rates', 'LTIFR YTD', '', '', '', ry.ltifr.toFixed(2)], ['Rates', 'TRCF YTD', '', '', '', ry.trcf.toFixed(2)], ['Rates', 'LTISR YTD', '', '', '', ry.ltisr.toFixed(2)]);
  const csv = rows.map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `NAVO CEO HSSE ${CEO.month}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ---------- Environmental performance ---------- */
function envPage() {
  if (!CEO_ON()) return '<div class="panel"><h2>This module is turned off</h2><p class="mx-muted">An HSE Admin can turn it on in Settings → Optional modules.</p></div>';
  const E = CEO.env; E.year = E.year || new Date().getFullYear();
  const scopes = ceoScopes(); if (!scopes.find(s => s[0] === E.scope)) E.scope = 'Corporation';
  const ids = new Set(ceoProjects(E.scope).map(p => p.id)), cfg = envCfg();
  const mons = Array.from({ length: 12 }, (_, i) => E.year + '-' + String(i + 1).padStart(2, '0')), prev = mons.map(m => (E.year - 1) + m.slice(4));
  const per = mons.map(m => envValues(ids, [m])), perPrev = prev.map(m => envValues(ids, [m]));
  const upto = per.reduce((n, v, i) => v ? i + 1 : n, 0);
  const ytd = envValues(ids, mons.slice(0, Math.max(upto, 1))), ly = envValues(ids, prev.slice(0, Math.max(upto, 1)));
  const chg = k => ytd && ly && ly[k] ? (ytd[k] - ly[k]) / ly[k] * 100 : null;
  const tile = (l, v, unit, k, target, lowerBetter = true) => {
    const c = k ? chg(k) : null; const good = c == null ? '' : lowerBetter ? (c <= -target ? 'ok' : 'bad') : '';
    return `<div class="kpi env-tile ${good}"><div class="l">${l}</div><div class="v">${v == null ? '—' : v >= 1e5 ? hsN(v) : v.toLocaleString('en-GB', { maximumFractionDigits: 1 })}<small> ${unit}</small></div>${c != null ? `<div class="env-chg ${c <= 0 ? 'down' : 'up'}">${c > 0 ? '▲' : '▼'} ${Math.abs(c).toFixed(1)}% vs ${E.year - 1}${target ? ` · target −${target}%` : ''}</div>` : `<div class="env-chg">No ${E.year - 1} baseline</div>`}</div>`;
  };
  const inten = ytd && ytd.hours ? ytd.ghg / ytd.hours * 1e6 : null;
  const L12 = mons.map(m => m.slice(5)).map(x => ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+x - 1]);
  const ser = (k, c) => [{ n: String(E.year - 1), v: perPrev.map(v => v ? +(v[k] || 0).toFixed(1) : 0), c: '#c3cfe0' }, { n: String(E.year), v: per.map(v => v ? +(v[k] || 0).toFixed(1) : 0), c }];
  const staff = isStaff();
  return `<div class="ceo env">
   <div class="nvr-hero ceo-hero env-hero"><div><span class="nvi-eyebrow">Environmental performance</span><h2>${esc(scopes.find(s => s[0] === E.scope)[1])} · ${E.year}</h2><p>Energy, emissions, water and waste against last year and the reduction targets. Scope 1 = diesel, scope 2 = grid electricity.</p></div>
    <div class="ceo-ctrl"><label>Scope<select data-env="scope">${scopes.map(([v, l]) => `<option value="${esc(v)}" ${v === E.scope ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label><label>Year<select data-env="year">${[0, 1, 2].map(i => new Date().getFullYear() - i).map(y => `<option ${y === E.year ? 'selected' : ''}>${y}</option>`).join('')}</select></label>
     <div class="ceo-btns">${staff ? '<button class="btn pri" data-enventry>Enter monthly data</button>' : ''}</div></div>
    <div class="ceo-report"><span>Download report</span><select id="env-freq" aria-label="Report frequency"><option value="monthly">Monthly</option><option value="bimonthly">Every two months</option><option value="quarterly">Quarterly</option><option value="annual">Annual</option></select><button class="btn" data-envrep="pptx">PowerPoint</button><button class="btn" data-envrep="docx">Word</button><button class="btn" data-envrep="xlsx">Excel</button></div></div>
   ${!ytd ? `<div class="nvi-alert">No environmental data for ${E.year} in this scope yet. ${staff ? 'Use “Enter monthly data” for energy and water; waste comes from Administration → Performance data.' : ''}</div>` : ''}
   ${E.entry ? envEntryForm() : ''}
   <div class="kpis env-tiles">
    ${tile('Electricity (grid)', ytd && ytd.electricity, 'kWh', 'electricity', cfg.targets.elec)}${tile('Diesel', ytd && ytd.diesel, 'L', 'diesel', cfg.targets.diesel)}${tile('Water', ytd && ytd.water, 'm³', 'water', cfg.targets.water)}
    ${tile('GHG emissions', ytd && ytd.ghg, 'tCO₂e', 'ghg', 0)}
    <div class="kpi env-tile ${ytd && ytd.diversion != null ? (ytd.diversion >= cfg.targets.diversion ? 'ok' : 'bad') : ''}"><div class="l">Waste diversion</div><div class="v">${ytd && ytd.diversion != null ? ytd.diversion.toFixed(1) : '—'}<small> %</small></div><div class="env-chg">target ${cfg.targets.diversion}%</div></div>
    <div class="kpi env-tile"><div class="l">Carbon intensity</div><div class="v">${inten == null ? '—' : inten >= 1e4 ? hsN(inten) : inten.toFixed(1)}<small> tCO₂e / 1M h</small></div><div class="env-chg">${ytd && ytd.renewable ? `Renewable ${ytd.renewable.toLocaleString('en-GB')} kWh` : 'per million man-hours'}</div></div>
   </div>
   <div class="hs-2">${hCard('Electricity (kWh)', hVbars(L12, ser('electricity', '#1f9d63'), { legend: 1, h: 150 }))}${hCard('Diesel (litres)', hVbars(L12, ser('diesel', '#d97706'), { legend: 1, h: 150 }))}</div>
   <div class="hs-2">${hCard('GHG emissions (tCO₂e)', hVbars(L12, [{ n: 'Scope 1 – diesel', v: per.map(v => v ? +v.scope1.toFixed(1) : 0), c: '#d97706' }, { n: 'Scope 2 – electricity', v: per.map(v => v ? +v.scope2.toFixed(1) : 0), c: '#2f6fd8' }], { legend: 1, h: 150, stack: 1 }))}${hCard('Water (m³)', hVbars(L12, ser('water', '#0284c7'), { legend: 1, h: 150 }))}</div>
   <div class="hs-2">${hCard('Waste (t)', hVbars(L12, [{ n: 'Recycled / reused', v: per.map(v => v ? +v.wasteDiverted.toFixed(1) : 0), c: '#1f9d63' }, { n: 'Disposed', v: per.map(v => v ? +v.wasteDisposed.toFixed(1) : 0), c: '#94a3b8' }], { legend: 1, h: 150, stack: 1 }))}
    ${hCard('Emission factors', `<dl class="rci-dl"><dt>Grid electricity</dt><dd>${cfg.elec} kg CO₂ / kWh</dd><dt>Diesel</dt><dd>${cfg.diesel} kg CO₂ / L</dd><dt>Diesel in tonnes</dt><dd>converted at 1,190 L / t</dd></dl><p class="mx-muted">Factors and reduction targets are set by the HSE Admin in Settings → Optional modules. Confirm the grid factor for each country with the client's environmental lead.</p>`)}</div>
  </div>`;
}
function envEntryForm() {
  const e = CEO.env.entry, P = myProjects(); if (!e.project) e.project = (ceoProjects(CEO.env.scope)[0] || P[0] || {}).id; e.month = e.month || ceoMonthNow();
  const rec = (L.records || []).find(r => r.kind === 'env' && r.project === e.project && r.data && r.data.month === e.month);
  if (e.key !== e.project + e.month) { e.v = { ...((rec && rec.data) || {}) }; delete e.v.month; delete e.v.by; e.key = e.project + e.month; }
  return `<div class="panel ceo-entry"><div class="nvi-head"><div><span class="nvi-eyebrow">Monthly environmental data</span><h2>${fmtMonth(e.month)}</h2><p>Waste is entered with the monthly performance data. Leave blank if not measured.</p></div><button class="btn" data-envclose>Close</button></div>
   <div class="mx-grid"><div class="fld"><label>Project</label><select data-enve="project">${P.map(p => `<option value="${esc(p.id)}" ${p.id === e.project ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div><div class="fld"><label>Month</label><input type="month" data-enve="month" value="${e.month}"></div></div>
   <div class="ceo-grid">${ENV_FIELDS.map(([k, l]) => `<div class="fld"><label>${l}</label><input class="mx-in" type="number" min="0" step="any" data-envv="${k}" value="${e.v[k] ?? ''}"></div>`).join('')}</div>
   <div class="nvi-foot"><div>${rec ? 'Updating saved figures.' : 'New monthly entry.'}</div><button class="btn pri" data-envsave>Save figures</button></div></div>`;
}
async function envSave() {
  const e = CEO.env.entry; const data = { month: e.month, by: L.me?.name || '' }; Object.entries(e.v).forEach(([k, x]) => { if (x !== '' && x != null && !isNaN(+x)) data[k] = +x; });
  const rec = (L.records || []).find(r => r.kind === 'env' && r.project === e.project && r.data && r.data.month === e.month);
  const ok = await liveSave(() => rec ? L.db.collection('records').doc(rec.id).update({ data, ts: Date.now() }) : L.db.collection('records').add({ project: e.project, kind: 'env', ts: Date.now(), data, by: L.me.id }), 'Environmental data saved');
  if (ok !== false) { if (rec) rec.data = data; CEO.env.entry = null; render(); }
}

/* ---------- Settings: switch the module and set factors ---------- */
function ceoSettingsPanel() {
  const on = CEO_ON(), cfg = envCfg();
  return `<div class="panel" id="ceo-settings"><h2>Optional modules <small>CEO bi-monthly report and environmental performance</small></h2>
   <div class="filters"><button class="btn ${on ? '' : 'pri'}" data-ceotoggle="${on ? 'off' : 'on'}">${on ? 'Turn the module off' : 'Turn the module on'}</button><span class="mx-muted">${on ? 'The module is on for everyone.' : 'The module is off. Saved figures are kept.'}</span></div>
   <div class="ceo-grid"><div class="fld"><label>Grid electricity factor (kg CO₂/kWh)</label><input class="mx-in" type="number" step="0.001" id="env-f-elec" value="${cfg.elec}"></div><div class="fld"><label>Diesel factor (kg CO₂/L)</label><input class="mx-in" type="number" step="0.01" id="env-f-diesel" value="${cfg.diesel}"></div>
    <div class="fld"><label>Electricity reduction target (%)</label><input class="mx-in" type="number" id="env-t-elec" value="${cfg.targets.elec}"></div><div class="fld"><label>Diesel reduction target (%)</label><input class="mx-in" type="number" id="env-t-diesel" value="${cfg.targets.diesel}"></div>
    <div class="fld"><label>Water reduction target (%)</label><input class="mx-in" type="number" id="env-t-water" value="${cfg.targets.water}"></div><div class="fld"><label>Waste diversion target (%)</label><input class="mx-in" type="number" id="env-t-div" value="${cfg.targets.diversion}"></div></div>
   <div class="filters"><button class="btn pri" data-envcfgsave>Save factors and targets</button></div></div>`;
}
async function ceoStructSave(patch, msg) { const s = { ...(L.structure || DEFAULT_STRUCT), ...patch }; const ok = await liveSave(() => L.db.doc('admin/structure').set(s), msg); if (ok !== false) { L.structure = s; render(); } }

/* ---------- Wiring ---------- */
SOON.ceo = ['CEO bi-monthly report', '', []]; SOON.env = ['Environmental performance', '', []];
Object.assign(TITLES, { ceo: 'CEO bi-monthly report', env: 'Environmental performance' });
const ceoBaseSoon = soon;
soon = function () { if (st.view === 'ceo') return ceoPage(); if (st.view === 'env') return envPage(); return ceoBaseSoon(); };
const ceoBaseSettings = settings;
settings = function () { const html = ceoBaseSettings(); return myRole() === 'admin' ? html + ceoSettingsPanel() : html; };
const ceoGroup = ['reporting', 'CEO & environment', 'ceo', 'dash', [['ceo', 'CEO bi-monthly report'], ['env', 'Environmental performance']]];
function ceoNavSync() {
  if (typeof NV_IC !== 'undefined' && !NV_IC.reporting) NV_IC.reporting = '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'; const i = NX_GROUPS.findIndex(g => g[0] === 'reporting'); if (CEO_ON() && i < 0) NX_GROUPS.splice(1, 0, ceoGroup); if (!CEO_ON() && i >= 0) NX_GROUPS.splice(i, 1); }
const ceoBaseRender = render;
render = function () { ceoNavSync(); if (!CEO_ON() && ['ceo', 'env'].includes(st.view)) st.view = 'exec'; return ceoBaseRender(); };

document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.ceo) { CEO[t.dataset.ceo] = t.value || CEO[t.dataset.ceo]; CEO.entry = null; render(); }
  if (t.dataset.env) { CEO.env[t.dataset.env] = t.dataset.env === 'year' ? +t.value : t.value; CEO.env.entry = null; render(); }
  if (t.dataset.ceoe) { CEO.entry[t.dataset.ceoe] = t.dataset.ceoe === 'half' ? +t.value : t.value; render(); }
  if (t.dataset.enve) { CEO.env.entry[t.dataset.enve] = t.value; render(); }
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.ceov && CEO.entry) CEO.entry.v[t.dataset.ceov] = t.value;
  if (t.dataset.envv && CEO.env.entry) CEO.env.entry.v[t.dataset.envv] = t.value;
});
document.addEventListener('click', async e => {
  const t = e.target.closest('[data-ceoentry],[data-ceoclose],[data-ceosave],[data-ceocsv],[data-ceoprint],[data-enventry],[data-envclose],[data-envsave],[data-ceotoggle],[data-envcfgsave]'); if (!t) return;
  e.preventDefault();
  if (t.hasAttribute('data-ceoentry')) { CEO.entry = { half: new Date().getDate() < 15 ? 1 : 2 }; render(); return; }
  if (t.hasAttribute('data-ceoclose')) { CEO.entry = null; render(); return; }
  if (t.hasAttribute('data-ceosave')) return ceoSave();
  if (t.hasAttribute('data-ceocsv')) return ceoCsv();
  if (t.hasAttribute('data-ceoprint')) return window.print();
  if (t.hasAttribute('data-enventry')) { CEO.env.entry = {}; render(); return; }
  if (t.hasAttribute('data-envclose')) { CEO.env.entry = null; render(); return; }
  if (t.hasAttribute('data-envsave')) return envSave();
  if (t.dataset.ceotoggle) return ceoStructSave({ modules: { ...((L.structure || {}).modules || {}), ceoEnv: t.dataset.ceotoggle === 'on' } }, t.dataset.ceotoggle === 'on' ? 'Module turned on' : 'Module turned off');
  if (t.hasAttribute('data-envcfgsave')) { const g = id => +document.getElementById(id).value; return ceoStructSave({ env: { elec: g('env-f-elec'), diesel: g('env-f-diesel'), targets: { elec: g('env-t-elec'), diesel: g('env-t-diesel'), water: g('env-t-water'), diversion: g('env-t-div') } } }, 'Factors and targets saved'); }
});

/* ---------- Reports: PowerPoint, Word and Excel built by /api/report ---------- */
const ceoScopeLabel = sc => (ceoScopes().find(s => s[0] === sc) || [sc, sc])[1];
function ceoPayload() {
  const C = ceoColumns(CEO.scope, CEO.month), cfgT = hsKpiCfg().targets[CEO.scope.startsWith('plat:') ? CEO.scope.slice(5) : 'Corporation'] || hsKpiCfg().targets.Corporation;
  const ry = ceoRates(C.ytd), rm = ceoRates(C.mon);
  const attention = [];
  if (ry) [['LTIFR', 'ltifr'], ['TRCF', 'trcf'], ['LTISR', 'ltisr']].forEach(([l, k]) => { if (ry[k] > cfgT[k]) attention.push(`${l} year to date is ${ry[k].toFixed(2)}, above the target of ${cfgT[k].toFixed(2)}.`); });
  if (C.ytd.fat) attention.push(`${C.ytd.fat} fatalit${C.ytd.fat > 1 ? 'ies' : 'y'} recorded this year.`);
  if (C.mon.rtac) attention.push(`${C.mon.rtac} road traffic accident${C.mon.rtac > 1 ? 's' : ''} this month (${C.ytd.rtac} year to date): review journey management and driver controls.`);
  if (C.mon.rlta || C.mon.rlti) attention.push(`${(C.mon.rlta || 0) + (C.mon.rlti || 0)} lost time injur${(C.mon.rlta || 0) + (C.mon.rlti || 0) > 1 ? 'ies' : 'y'} this month.`);
  if (!C.ytd.manhours) attention.push('No man-hours recorded: frequency rates cannot be calculated.');
  const blankSec = CEO_SECTIONS.filter(([, rows]) => rows.filter(r => r[2] === 'manual').length && rows.filter(r => r[2] === 'manual').every(r => C.mon[r[0]] == null)).map(s => s[0]);
  if (blankSec.length) attention.push(`Figures still to be entered for this month: ${blankSec.join(', ')}.`);
  const y = CEO.month.slice(0, 4), ids = C.ids, mons = Array.from({ length: 12 }, (_, i) => y + '-' + String(i + 1).padStart(2, '0')).filter(m => m <= CEO.month);
  const ev = mons.map(m => envValues(ids, [m]));
  return {
    kind: 'ceo', title: 'CEO HSSE report', month: CEO.month, monthLabel: fmtMonth(CEO.month), scopeLabel: ceoScopeLabel(CEO.scope), sample: typeof hsIsSample === 'function' && hsIsSample(),
    generated: new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    rates: { ytd: ry, month: rm, targets: cfgT },
    tiles: [['Man-hours YTD', C.ytd.manhours], ['Fatalities YTD', C.ytd.fat], ['Recordable cases YTD', ry ? ry.rec : null], ['Lost time injuries YTD', ry ? ry.lti : null], ['Days lost YTD', C.ytd.daysLost], ['Road traffic accidents YTD', C.ytd.rtac]],
    attention, sections: CEO_SECTIONS.map(([title, rows]) => ({ title, rows: rows.map(([k, label, src]) => ({ label, src, w1: C.w1[k] ?? null, w2: C.w2[k] ?? null, mon: C.mon[k] ?? null, ytd: C.ytd[k] ?? null })) })),
    env: { year: y, months: mons.map(m => fmtMonth(m).slice(0, 3)), scope1: ev.map(v => v ? +v.scope1.toFixed(1) : null), scope2: ev.map(v => v ? +v.scope2.toFixed(1) : null), diverted: ev.map(v => v ? +v.wasteDiverted.toFixed(1) : null), disposed: ev.map(v => v ? +v.wasteDisposed.toFixed(1) : null) },
    notes: ['Figures already in NAVO are calculated from records: man-hours and manpower from monthly performance data; incidents, days lost, inspections and observations from reports and inspections by event date.',
      'Weeks 1–2 = days 1–14; weeks 3–4 = day 15 to month end. Man-hours and environmental figures are monthly and appear in the month and YTD columns only.',
      `Rates per ${hsN(hsKpiCfg().mult)} man-hours. LTIFR = (fatalities + SI + RLTA + RLTI) × basis ÷ man-hours; TRCF adds RWC and MTC; LTISR = (days lost + 6,000 per fatality) × basis ÷ man-hours.`,
      'Blank (—) means not reported; zero means reported zero.', 'Health, camp, training, security, lifting and CCTV figures are entered per project and fortnight by HSE staff.'],
  };
}
function envPayload(freq) {
  const E = CEO.env, ids = new Set(ceoProjects(E.scope).map(p => p.id)), cfg = envCfg(), n = freq === 'annual' ? 12 : freq === 'quarterly' ? 3 : freq === 'bimonthly' ? 2 : 1;
  const mons = Array.from({ length: 12 }, (_, i) => E.year + '-' + String(i + 1).padStart(2, '0'));
  const now = ceoMonthNow(), upto = mons.filter(m => m <= now);
  const groups = Array.from({ length: 12 / n }, (_, i) => mons.slice(i * n, i * n + n)).filter(g => g[0] <= now);
  const label = g => n === 12 ? String(E.year) : n === 3 ? `Q${Math.floor((+g[0].slice(5) - 1) / 3) + 1} ${E.year}` : n === 2 ? `${fmtMonth(g[0]).slice(0, 3)}–${fmtMonth(g[1]).slice(0, 3)} ${E.year}` : fmtMonth(g[0]);
  const cov = g => { const have = new Set((L.records || []).filter(r => (r.kind === 'env' || r.kind === 'monthly') && ids.has(r.project) && g.includes(r.data && r.data.month)).map(r => r.project + r.data.month)); return `${have.size}/${ids.size * g.length}`; };
  const periods = groups.map(g => { const v = envValues(ids, g); return { label: label(g), coverage: cov(g), ...(v || {}), intensity: v && v.hours ? v.ghg / v.hours * 1e6 : null }; });
  const ytd = envValues(ids, upto), prev = envValues(ids, upto.map(m => (E.year - 1) + m.slice(4)));
  const source = (L.records || []).filter(r => r.kind === 'env' && ids.has(r.project) && String(r.data && r.data.month).startsWith(E.year)).map(r => ({ project: projName(r.project), ...r.data })).sort((a, b) => (a.month + a.project).localeCompare(b.month + b.project));
  return { kind: 'env', title: 'Environmental report', month: String(E.year), year: E.year, scopeLabel: ceoScopeLabel(E.scope), frequencyLabel: { monthly: 'Monthly', bimonthly: 'Every two months', quarterly: 'Quarterly', annual: 'Annual' }[freq],
    sample: typeof hsIsSample === 'function' && hsIsSample(), generated: new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    factors: { elec: cfg.elec, diesel: cfg.diesel }, targets: cfg.targets, periods, ytd: ytd ? { ...ytd, intensity: ytd.hours ? ytd.ghg / ytd.hours * 1e6 : null } : {}, prev: prev || {}, source };
}
async function ceoDownload(payload, fmt, btn) {
  const lbl = btn.textContent; btn.disabled = true; btn.textContent = 'Preparing…';
  try {
    const r = await fetch('/api/report?fmt=' + fmt, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!r.ok) throw new Error((await r.text()).slice(0, 200));
    const b = await r.blob(), a = document.createElement('a'); a.href = URL.createObjectURL(b);
    a.download = `NAVO ${({ ceo: 'CEO HSSE report', env: 'Environmental report', template: 'data import template' })[payload.kind] || 'report'} ${payload.kind === 'template' ? '' : payload.scopeLabel + ' '}${payload.month}.${fmt}`.replace(/[^\w .()-]+/g, '-');
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast('Report downloaded');
  } catch (e) { toast('The report could not be created. ' + (e.message || '')); }
  finally { btn.disabled = false; btn.textContent = lbl; }
}
document.addEventListener('click', e => {
  const t = e.target.closest('[data-ceorep],[data-envrep]'); if (!t) return; e.preventDefault();
  if (t.dataset.ceorep) return ceoDownload(ceoPayload(), t.dataset.ceorep, t);
  return ceoDownload(envPayload((document.getElementById('env-freq') || {}).value || 'monthly'), t.dataset.envrep, t);
});
