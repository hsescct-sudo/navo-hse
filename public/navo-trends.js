/* Client review changes (executive dashboard):
   1. Trend analysis: one dashboard with safety observations, PTW inspections, NCRs, incidents, lagging indicators
      (by division) and training, month by month; the lagging trend sits directly under the observations trend.
   2. Site health colour code: one configurable set of score bands used by the Site Health Indicator and Site Dashboard,
      with coloured score cells and status pills.
   3. Executive overview: manpower, man-hours, safe hours and safe days in one box, measures across the top,
      Corporation / Construction / Nonconstruction down the left. */
'use strict';

/* ---------- 2. site health colour code ---------- */
const HB_DEF = [{ min: 80, color: '#00A651', label: 'Good' }, { min: 60, color: '#FFD200', label: 'Monitor' }, { min: 40, color: '#F7941D', label: 'Review' }, { min: 0, color: '#ED1C24', label: 'Intervention' }];
const hbBands = () => { const b = L.structure && L.structure.health && L.structure.health.bands; return (Array.isArray(b) && b.length ? b : HB_DEF).slice().sort((a, b2) => b2.min - a.min); };
const hbFor = s => s == null ? null : hbBands().find(b => s >= b.min) || hbBands()[hbBands().length - 1];
const hbInk = c => { const n = parseInt(String(c).slice(1), 16); return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 > 150 ? '#111' : '#fff'; };
hsBand = function (s) { const b = hbFor(s); return b ? b.color : '#ddd'; };
try { hcol = function (s) { const b = hbFor(s); return b ? b.color : 'var(--muted)'; }; } catch (e) { /* older pages keep their own colours */ }
/* status words are the band words, so the colour and the word always agree */
statusFor = function (cur) { const b = hbFor(cur); return b ? b.label : null; };
const HB_SYM = ['▲', '●', '◆', '■', '■'];
function hbApply() { try { Object.keys(HSTAT).forEach(k => delete HSTAT[k]); hbBands().forEach((b, i) => HSTAT[b.label] = [HB_SYM[i] || '■', b.color]); } catch (e) {} }
hbApply();
function hbSettings() {
  const B = hbBands();
  return `<div class="panel" id="hb-settings"><h2>Site health colour code <small>Site Health Indicator and Site Dashboard</small></h2><p class="mx-muted">Score bands from highest to lowest. Set the colours and words your company uses.</p>
   <div class="rg-tw"><table class="rg-t"><thead><tr><th>From score</th><th>Colour</th><th>Word</th><th>Preview</th></tr></thead><tbody>${B.map((b, i) => `<tr><td><input class="mx-in" type="number" min="0" max="100" data-hb="${i}|min" value="${b.min}" style="max-width:90px"></td><td><input type="color" data-hb="${i}|color" value="${b.color}"></td><td><input class="mx-in" data-hb="${i}|label" value="${rgEsc(b.label)}"></td><td><span class="hb-cell" style="background:${b.color};color:${hbInk(b.color)}">${b.min}+ · ${rgEsc(b.label)}</span></td></tr>`).join('')}</tbody></table></div>
   <div class="filters" style="margin-top:10px"><button class="btn pri" data-hb-save>Save colour code</button><button class="btn" data-hb-reset>Use default</button></div></div>`;
}
const hbBaseSettings = settings;
settings = function () { const h = hbBaseSettings(); return myRole() === 'admin' ? h + hbSettings() : h; };
document.addEventListener('click', async e => {
  const t = e.target.closest('[data-hb-save],[data-hb-reset]'); if (!t) return; e.preventDefault();
  let bands = HB_DEF;
  if (t.hasAttribute('data-hb-save')) { bands = hbBands().map(b => ({ ...b })); document.querySelectorAll('[data-hb]').forEach(x => { const [i, k] = x.dataset.hb.split('|'); bands[+i][k] = k === 'min' ? +x.value : x.value; }); }
  const s = { ...(L.structure || {}), health: { ...((L.structure || {}).health || {}), bands } };
  if (await liveSave(() => L.db.doc('admin/structure').set(s), 'Colour code saved') !== false) { L.structure = s; hbApply(); render(); }
});
/* status pills in the score card: whole cell coloured like the score */
const hbBaseRender = render;
render = function () {
  const r = hbBaseRender.apply(this, arguments);
  try { if (!L._hbApplied && L.structure) { L._hbApplied = 1; hbApply(); } const labels = Object.keys(HSTAT); document.querySelectorAll('.hs-health td, .hs table td').forEach(td => { if (td.dataset.hb) return; const t = td.textContent.trim().replace(/^[^A-Za-z]+/, ''); if (!labels.includes(t)) return; const c = HSTAT[t][1]; td.dataset.hb = '1'; td.innerHTML = `<span class="hb-cell" style="background:${c};color:${hbInk(c)}">${rgEsc(t)}</span>`; }); } catch (e) {}
  return r;
};

/* ---------- 3. one exposure box ---------- */
if (typeof coExposure === 'function') coExposure = function (P) {
  const rows = coWorkforce(P), geo = Object.entries(hsGroup(P, 'country')).map(([name, ps]) => ({ name, ...coWorkRow(ps) }));
  const m = v => v >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : v >= 1e4 ? (v / 1e3).toFixed(0) + 'K' : Math.round(v || 0).toLocaleString('en-GB');
  const cols = [['Employees', r => m(r.employees)], ['Contractors', r => m(r.contractors)], ['Total manpower', r => m((r.employees || 0) + (r.contractors || 0))], ['Employee man-hours', r => m(r.employeeHours)], ['Contractor man-hours', r => m(r.contractorHours)], ['Total man-hours', r => m((r.employeeHours || 0) + (r.contractorHours || 0))], ['Safe man-hours', r => m(r.safeHours)], ['Safe days', r => m(r.safeDays)]];
  const tbl = (R, first) => `<table class="co-one-t"><thead><tr><th>${first}</th>${cols.map(c => `<th>${c[0]}</th>`).join('')}</tr></thead><tbody>${R.map(r => `<tr><th>${esc(first === 'Country' ? r.name : coPlatformLabel(r.name))}</th>${cols.map(c => `<td>${c[1](r)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  return `<section class="co-exposure co-one" aria-label="Manpower and exposure overview"><section><div class="co-one-h"><h3>Manpower & exposure</h3><button class="co-one-geo" data-co-geo aria-expanded="${!!CO.geoOpen}">${CO.geoOpen ? 'Hide' : 'Show'} by country</button></div><div class="co-one-w">${tbl(rows, 'Company')}${CO.geoOpen ? tbl(geo, 'Country') : ''}</div></section></section>`;
};
document.addEventListener('click', e => { const t = e.target.closest('[data-co-geo]'); if (!t) return; e.preventDefault(); CO.geoOpen = !CO.geoOpen; render(); });

/* ---------- 1. trend analysis ---------- */
const TA = { months: 12, div: '', proj: '' };
function taProjects() { let P = myProjects(); if (TA.div) P = P.filter(p => (p.division || 'Unassigned') === TA.div); if (TA.proj) P = P.filter(p => p.id === TA.proj); return P; }
function taPage() {
  const P = taProjects(), ids = new Set(P.map(p => p.id)), M = rgMonths(TA.months), lbl = M.map(rgMonLbl), inM = (t, m) => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') === m; };
  const R = (L.reports || []).filter(r => ids.has(r.project)), I = (L.inspections || []).filter(i => ids.has(i.project)), Mo = (L.records || []).filter(r => r.kind === 'monthly' && ids.has(r.project));
  const sumM = (m, k) => Mo.filter(r => r.data && r.data.month === m).reduce((n, r) => n + (+r.data[k] || 0), 0);
  /* observations */
  const pos = M.map(m => R.filter(r => (r.rt === 'Good practice' || r.kind === 'Positive') && inM(r.eventTs || r.ts, m)).length);
  const neg = M.map(m => R.filter(r => r.rt === 'Hazard' && r.kind !== 'Positive' && inM(r.eventTs || r.ts, m)).length);
  /* lagging */
  const sev = (m, list) => R.filter(r => r.rt === 'Incident' && inM(r.eventTs || r.ts, m) && list.includes(sevOf(r))).length;
  const lti = M.map(m => sev(m, ['Fatality', 'Serious Injury', 'Lost Time (> 7 days)', 'Lost Time'])), rwc = M.map(m => sev(m, ['Restricted Work'])), mtc = M.map(m => sev(m, ['Medical Treatment'])), fac = M.map(m => sev(m, ['First Aid']));
  const hrs = M.map(m => sumM(m, 'empHours') + sumM(m, 'conHours')), mult = (typeof hsKpiCfg === 'function' ? hsKpiCfg().mult : 1e6);
  const trcf = M.map((m, i) => hrs[i] ? +((lti[i] + rwc[i] + mtc[i]) * mult / hrs[i]).toFixed(2) : null), ltifr = M.map((m, i) => hrs[i] ? +(lti[i] * mult / hrs[i]).toFixed(2) : null);
  /* incidents by type */
  const inc = M.map(m => R.filter(r => r.rt === 'Incident' && inM(r.eventTs || r.ts, m)));
  const nm = inc.map(x => x.filter(r => r.kind === 'Near Miss').length), dmg = inc.map(x => x.filter(r => r.kind === 'Property Damage').length), inj = inc.map(x => x.filter(r => r.kind === 'Injury').length), oth = inc.map((x, i) => x.length - nm[i] - dmg[i] - inj[i]);
  /* PTW */
  const ptwI = I.filter(i => /permit|ptw|hot work|confined|excavat|isolation|loto/i.test(i.tpl || ''));
  const ptwDone = M.map(m => ptwI.filter(i => inM(i.ts, m)).length), ptwFail = M.map(m => ptwI.filter(i => inM(i.ts, m)).reduce((n, i) => n + (+i.fails || 0), 0));
  const ptwRev = M.map(m => sumM(m, 'ptwReviewed')), ptwNC = M.map(m => sumM(m, 'ptwNC'));
  /* NCR (CEO fortnight figures) */
  const ncrMin = M.map(m => (typeof ceoManual === 'function' ? ceoManual(ids, m).ncrMinor : 0) || 0), ncrMaj = M.map(m => (typeof ceoManual === 'function' ? ceoManual(ids, m).ncrMajor : 0) || 0), ncrCl = M.map(m => (typeof ceoManual === 'function' ? ceoManual(ids, m).ncrClosed : 0) || 0);
  /* training */
  const trH = M.map(m => sumM(m, 'trainHours') + sumM(m, 'trainHoursExt')), trN = M.map(m => rgRecs('tr').filter(r => ids.has(r.project) && (r.data.date || '').startsWith(m)).length);
  /* lagging by division */
  const divs = [...new Set(P.map(p => p.division || 'Unassigned'))].sort();
  const divRow = d => { const di = new Set(P.filter(p => (p.division || 'Unassigned') === d).map(p => p.id)); return M.map(m => R.filter(r => di.has(r.project) && r.rt === 'Incident' && inM(r.eventTs || r.ts, m) && ['Fatality', 'Serious Injury', 'Lost Time (> 7 days)', 'Lost Time', 'Restricted Work', 'Medical Treatment'].includes(sevOf(r))).length); };
  const sum = a => a.reduce((x, y) => x + (y || 0), 0);
  const allDivs = [...new Set(myProjects().map(p => p.division || 'Unassigned'))].sort();
  return `<div class="ta-filters"><label>Period<select class="mx-in" data-ta="months">${[6, 12, 24].map(n => `<option value="${n}" ${TA.months === n ? 'selected' : ''}>Last ${n} months</option>`).join('')}</select></label>
    <label>Division<select class="mx-in" data-ta="div"><option value="">All divisions</option>${allDivs.map(d => `<option ${TA.div === d ? 'selected' : ''}>${esc(d)}</option>`).join('')}</select></label>
    <label>Project<select class="mx-in" data-ta="proj"><option value="">All projects</option>${myProjects().filter(p => !TA.div || (p.division || 'Unassigned') === TA.div).map(p => `<option value="${esc(p.id)}" ${TA.proj === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label></div>
   <div class="rg-kpis">${rgKpi('Observations', sum(pos) + sum(neg), 'info')}${rgKpi('Positive share', sum(pos) + sum(neg) ? Math.round(sum(pos) / (sum(pos) + sum(neg)) * 100) + '%' : '—', 'ok')}${rgKpi('Recordable injuries', sum(lti) + sum(rwc) + sum(mtc), sum(lti) ? 'bad' : 'warn')}${rgKpi('Lost-time injuries', sum(lti), sum(lti) ? 'bad' : 'ok')}${rgKpi('PTW inspections', sum(ptwDone), 'info')}${rgKpi('NCRs raised', sum(ncrMin) + sum(ncrMaj), 'warn')}${rgKpi('Training hours', Math.round(sum(trH)).toLocaleString('en-GB'), 'info')}</div>
   <div class="ta-grid">
    ${rgCard('Safety observations · positive vs unsafe', cdBars(lbl, [{ name: 'Positive', vals: pos, color: '#00A651' }, { name: 'Unsafe acts / conditions', vals: neg, color: '#F7941D' }], { flat: 1, w: 760, h: 220 }), 'cd-wide ta-full')}
    ${rgCard('Lagging indicators · injuries by class', cdBars(lbl, [{ name: 'LTI (incl. fatality, SI)', vals: lti, color: '#ED1C24' }, { name: 'Restricted work', vals: rwc, color: '#9b7bff' }, { name: 'Medical treatment', vals: mtc, color: '#F7941D' }, { name: 'First aid', vals: fac, color: '#8a96a8' }], { flat: 1, w: 760, h: 220 }), 'cd-wide ta-full')}
    ${rgCard(`Frequency rates per ${mult >= 1e6 ? '1,000,000' : '200,000'} man-hours`, hrs.some(Boolean) ? cdLine(lbl, trcf, '#ED1C24', { w: 520 }) + `<p class="rg-note">TRCF (red). LTIFR: ${ltifr.map(v => v == null ? '—' : v).join(' · ')}</p>` : '<p class="cd-none">Enter monthly man-hours to see rates</p>', 'cd-wide')}
    ${rgCard('Incidents by type', cdBars(lbl, [{ name: 'Near miss', vals: nm, color: '#2f73c9' }, { name: 'Injury', vals: inj, color: '#ED1C24' }, { name: 'Property damage', vals: dmg, color: '#F7941D' }, { name: 'Other', vals: oth, color: '#8a96a8' }], { flat: 1, w: 520 }), 'cd-wide')}
    ${rgCard('Permit to work · inspections and findings', cdBars(lbl, [{ name: 'PTW inspections', vals: ptwDone, color: '#2f73c9' }, { name: 'Items at risk', vals: ptwFail, color: '#ED1C24' }, { name: 'Permits field-reviewed', vals: ptwRev, color: '#7aa9ff' }, { name: 'Permit non-compliances', vals: ptwNC, color: '#F7941D' }], { flat: 1, w: 520 }), 'cd-wide')}
    ${rgCard('NCRs raised and closed', cdBars(lbl, [{ name: 'Minor', vals: ncrMin, color: '#FFD200' }, { name: 'Major', vals: ncrMaj, color: '#ED1C24' }, { name: 'Closed', vals: ncrCl, color: '#00A651' }], { flat: 1, w: 520 }), 'cd-wide')}
    ${rgCard('Training trend', cdBars(lbl, [{ name: 'Training man-hours', vals: trH, color: '#2f73c9' }], { flat: 1, w: 520 }) + `<p class="rg-note">People trained (records): ${trN.join(' · ')}</p>`, 'cd-wide')}
   </div>
   <div class="panel"><h2>Recordable injuries by division</h2><div class="rg-tw"><table class="rg-t ta-div"><thead><tr><th>Division</th>${lbl.map(l => `<th>${l}</th>`).join('')}<th>Total</th></tr></thead><tbody>${divs.map(d => { const r = divRow(d); return `<tr><th>${esc(d)}</th>${r.map(v => `<td class="${v ? 'ta-hot' : ''}" style="${v ? `background:rgba(237,28,36,${Math.min(.85, .15 + v * .2)});color:#fff` : ''}">${v || ''}</td>`).join('')}<td><b>${sum(r)}</b></td></tr>`; }).join('')}</tbody></table></div><p class="rg-note">Recordable = LTI, restricted work and medical treatment cases. Darker red = more cases in the month.</p></div>`;
}
document.addEventListener('change', e => { const t = e.target; if (!t.dataset || !t.dataset.ta) return; TA[t.dataset.ta] = t.dataset.ta === 'months' ? +t.value : t.value; if (t.dataset.ta === 'div') TA.proj = ''; render(); });
regModule({ id: 'trends', title: 'Trend analysis', eyebrow: 'Trend analysis', headline: 'Where every indicator is heading', desc: 'Observations, lagging indicators, incidents, permits, NCRs and training month by month, for any division or project.', ents: [], tabs: [['all', 'Trends', () => taPage()]] });
rgNav('trends', 'Trend analysis', '<path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/>', [['m-trends', 'Trend analysis']], 'overview');
