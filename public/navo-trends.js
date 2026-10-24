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
const TA = { tables: false, months: 12, plat: '', div: '', clu: '', proj: '', lag: null };
const taPl = p => p.platform || 'Construction', taDv = p => p.division || 'Unassigned', taCl = p => p.cluster || '';
function taProjects() { let P = myProjects(); if (TA.plat) P = P.filter(p => taPl(p) === TA.plat); if (TA.div) P = P.filter(p => taDv(p) === TA.div); if (TA.clu) P = P.filter(p => taCl(p) === TA.clu); if (TA.proj) P = P.filter(p => p.id === TA.proj); return P; }
const TA_CLS = { rec: ['All recordable', ['Fatality', 'Serious Injury', 'Lost Time (> 7 days)', 'Lost Time', 'Restricted Work', 'Medical Treatment']], lti: ['LTI (incl. fatality, SI)', ['Fatality', 'Serious Injury', 'Lost Time (> 7 days)', 'Lost Time']], rwc: ['Restricted work', ['Restricted Work']], mtc: ['Medical treatment', ['Medical Treatment']], fac: ['First aid', ['First Aid']] };
/* NCRs come from NAVO's own audit and inspection findings: every non-compliance finding is an NCR.
   Major = Major / Significant severity, the rest Minor. Closed = finding status Closed. */
const taIsNcr = f => f.data && !f.data._deleted && (f.data.ftype === 'Non-compliance' || /^(major|minor|moderate|significant)$/i.test(f.data.sev || '') && !/observation|opportunity/i.test(f.data.ftype || ''));
const taMajor = f => /major|significant|critical/i.test(f.data.sev || '');
function taTree(P, val) {
  /* platform > division > sub-division > project, with a value per node */
  const T = {};
  P.forEach(p => { const a = taPl(p), b = taDv(p), c = taCl(p) || '—'; ((((T[a] = T[a] || {})[b] = T[a][b] || {})[c] = T[a][b][c] || [])).push(p); });
  const sum = a => a.reduce((x, y) => x + (y || 0), 0);
  let h = '';
  Object.keys(T).sort().forEach(a => {
    const pa = Object.values(T[a]).flatMap(x => Object.values(x).flat());
    h += `<tr class="ta-l0"><th>${esc(a)} platform</th>${val(pa).map(v => `<td>${v || ''}</td>`).join('')}<td><b>${sum(val(pa))}</b></td></tr>`;
    Object.keys(T[a]).sort().forEach(b => {
      const pb = Object.values(T[a][b]).flat();
      h += `<tr class="ta-l1"><th>${esc(b)}</th>${val(pb).map(v => `<td class="${v ? 'ta-hot' : ''}" style="${v ? `background:rgba(237,28,36,${Math.min(.85, .15 + v * .2)});color:#fff` : ''}">${v || ''}</td>`).join('')}<td><b>${sum(val(pb))}</b></td></tr>`;
      Object.keys(T[a][b]).sort().forEach(c => {
        const pc = T[a][b][c];
        if (c !== '—') h += `<tr class="ta-l2"><th>${esc(c)}</th>${val(pc).map(v => `<td>${v || ''}</td>`).join('')}<td>${sum(val(pc))}</td></tr>`;
        pc.forEach(p => { const v = val([p]); if (sum(v)) h += `<tr class="ta-l3"><th>${esc(p.name)}</th>${v.map(x => `<td>${x || ''}</td>`).join('')}<td>${sum(v)}</td></tr>`; });
      });
    });
  });
  return h;
}
function taLagDrill(P, R, M, lbl, inM) {
  if (!TA.lag) return '';
  const [name, list] = TA_CLS[TA.lag.cls] || TA_CLS.rec, Ms = TA.lag.m ? [TA.lag.m] : M;
  const cases = R.filter(r => r.rt === 'Incident' && list.includes(sevOf(r)) && Ms.some(m => inM(r.eventTs || r.ts, m)));
  const cnt = f => { const o = {}; cases.forEach(r => { const k = f(r) || 'Not classified'; o[k] = (o[k] || 0) + 1; }); return Object.entries(o).sort((x, y) => y[1] - x[1]); };
  const pm = new Map(P.map(p => [p.id, p])), pr = r => pm.get(r.project) || {};
  const bars = rows => rows.length ? cdHbars(rows.slice(0, 10).map(([k, v]) => ({ l: k.length > 26 ? k.slice(0, 25) + '…' : k, v, c: '#ED1C24' })), { w: 760, lw: 230 }) : '<p class="cd-none">No cases</p>';
  const when = TA.lag.m ? lbl[M.indexOf(TA.lag.m)] : 'the period';
  return `<div class="ta-ov"><div class="panel ta-drill" id="ta-drill"><div class="ta-drill-h"><h2>${esc(name)} · ${esc(when)} · ${cases.length} case${cases.length === 1 ? '' : 's'}</h2><button class="btn" data-ta-lag="close">Close</button></div>
   <div class="ta-grid">${rgCard('By case type', bars(cnt(r => sevOf(r))), 'cd-wide')}${rgCard('By cause / category', bars(cnt(r => (typeof incCat === 'function' ? incCat(r) : '') || r.cat)), 'cd-wide')}${rgCard('By division', bars(cnt(r => taDv(pr(r)) + (taCl(pr(r)) ? ' · ' + taCl(pr(r)) : ''))), 'cd-wide')}${rgCard('By project', bars(cnt(r => pr(r).name)), 'cd-wide')}</div>
   <div class="rg-tw"><table class="rg-t"><thead><tr><th>Case</th><th>Date</th><th>Platform</th><th>Division</th><th>Project</th><th>Class</th><th>Description</th></tr></thead><tbody>${cases.slice(0, 200).map(r => `<tr><td>${esc(r.caseNo || r.id.slice(0, 8))}</td><td>${new Date(r.eventTs || r.ts).toLocaleDateString('en-GB')}</td><td>${esc(taPl(pr(r)))}</td><td>${esc(taDv(pr(r)))}${taCl(pr(r)) ? ' · ' + esc(taCl(pr(r))) : ''}</td><td>${esc(pr(r).name || '')}</td><td>${esc(sevOf(r))}</td><td>${esc((r.desc || r.kind || '').slice(0, 90))}</td></tr>`).join('') || '<tr><td colspan="7">No cases</td></tr>'}</tbody></table></div></div></div>`;
}
function taPage() {
  const P = taProjects(), ids = new Set(P.map(p => p.id)), M = rgMonths(TA.months), lbl = M.map(rgMonLbl), inM = (t, m) => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') === m; };
  const R = (L.reports || []).filter(r => ids.has(r.project)), I = (L.inspections || []).filter(i => ids.has(i.project)), Mo = (L.records || []).filter(r => r.kind === 'monthly' && ids.has(r.project));
  const sumM = (m, k) => Mo.filter(r => r.data && r.data.month === m).reduce((n, r) => n + (+r.data[k] || 0), 0);
  const pos = M.map(m => R.filter(r => (r.rt === 'Good practice' || r.kind === 'Positive') && inM(r.eventTs || r.ts, m)).length);
  const neg = M.map(m => R.filter(r => r.rt === 'Hazard' && r.kind !== 'Positive' && inM(r.eventTs || r.ts, m)).length);
  const sev = (m, list) => R.filter(r => r.rt === 'Incident' && inM(r.eventTs || r.ts, m) && list.includes(sevOf(r))).length;
  const lti = M.map(m => sev(m, TA_CLS.lti[1])), rwc = M.map(m => sev(m, TA_CLS.rwc[1])), mtc = M.map(m => sev(m, TA_CLS.mtc[1])), fac = M.map(m => sev(m, TA_CLS.fac[1]));
  const hrs = M.map(m => sumM(m, 'empHours') + sumM(m, 'conHours')), mult = (typeof hsKpiCfg === 'function' ? hsKpiCfg().mult : 1e6);
  const trcf = M.map((m, i) => hrs[i] ? +((lti[i] + rwc[i] + mtc[i]) * mult / hrs[i]).toFixed(2) : null), ltifr = M.map((m, i) => hrs[i] ? +(lti[i] * mult / hrs[i]).toFixed(2) : null);
  const inc = M.map(m => R.filter(r => r.rt === 'Incident' && inM(r.eventTs || r.ts, m)));
  const nm = inc.map(x => x.filter(r => r.kind === 'Near Miss').length), dmg = inc.map(x => x.filter(r => r.kind === 'Property Damage').length), inj = inc.map(x => x.filter(r => r.kind === 'Injury').length), oth = inc.map((x, i) => x.length - nm[i] - dmg[i] - inj[i]);
  const ptwI = I.filter(i => /permit|ptw|hot work|confined|excavat|isolation|loto/i.test(i.tpl || ''));
  const ptwDone = M.map(m => ptwI.filter(i => inM(i.ts, m)).length), ptwFail = M.map(m => ptwI.filter(i => inM(i.ts, m)).reduce((n, i) => n + (+i.fails || 0), 0));
  const ptwRev = M.map(m => sumM(m, 'ptwReviewed')), ptwNC = M.map(m => sumM(m, 'ptwNC'));
  /* NCRs from NAVO's own findings register */
  const F = (L.records || []).filter(r => r.kind === 'finding' && ids.has(r.project) && taIsNcr(r));
  const fM = (m, f) => F.filter(r => inM(r.ts, m) && f(r)).length;
  const ncrMaj = M.map(m => fM(m, taMajor)), ncrMin = M.map(m => fM(m, r => !taMajor(r))), ncrCl = M.map(m => F.filter(r => r.data.status === 'Closed' && inM(r.data.closedAt || r.data.closed || r.ts, m)).length);
  const ncrOpen = F.filter(r => r.data.status !== 'Closed').length;
  const trH = M.map(m => sumM(m, 'trainHours') + sumM(m, 'trainHoursExt')), trN = M.map(m => rgRecs('tr').filter(r => ids.has(r.project) && (r.data.date || '').startsWith(m)).length);
  const recIdx = TA_CLS.rec[1];
  const recVal = PP => { const s = new Set(PP.map(p => p.id)); return M.map(m => R.filter(r => s.has(r.project) && r.rt === 'Incident' && inM(r.eventTs || r.ts, m) && recIdx.includes(sevOf(r))).length); };
  const ncrVal = PP => { const s = new Set(PP.map(p => p.id)); return M.map(m => F.filter(r => s.has(r.project) && inM(r.ts, m)).length); };
  const sum = a => a.reduce((x, y) => x + (y || 0), 0);
  const all = myProjects(), uniq = a => [...new Set(a)].filter(Boolean).sort();
  const plats = uniq(all.map(taPl)), divs = uniq(all.filter(p => !TA.plat || taPl(p) === TA.plat).map(taDv)), clus = uniq(all.filter(p => (!TA.plat || taPl(p) === TA.plat) && (!TA.div || taDv(p) === TA.div)).map(taCl));
  const sel = (k, label, opts, allLbl) => `<label>${label}<select class="mx-in" data-ta="${k}"><option value="">${allLbl}</option>${opts.map(o => { const [v, t] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${TA[k] === v ? 'selected' : ''}>${esc(t)}</option>`; }).join('')}</select></label>`;
  const lagChips = `<div class="ta-chips"><span>Drill down:</span>${Object.entries(TA_CLS).map(([k, [n]]) => `<button class="ta-chip ${TA.lag && TA.lag.cls === k && !TA.lag.m ? 'on' : ''}" data-ta-lag="${k}">${esc(n)}</button>`).join('')}</div><div class="ta-chips ta-mon"><span>Month:</span>${M.map((m, i) => { const n = lti[i] + rwc[i] + mtc[i] + fac[i]; return `<button class="ta-chip ${TA.lag && TA.lag.m === m ? 'on' : ''}" data-ta-lag="${TA.lag ? TA.lag.cls : 'rec'}" data-ta-m="${m}" ${n ? '' : 'disabled'}>${lbl[i]}${n ? ` <b>${n}</b>` : ''}</button>`; }).join('')}</div>`;
  return `<div class="ta-filters"><label>Period<select class="mx-in" data-ta="months">${[6, 12, 24].map(n => `<option value="${n}" ${TA.months === n ? 'selected' : ''}>Last ${n} months</option>`).join('')}</select></label>
    ${sel('plat', 'Platform', plats.map(p => [p, p + ' platform']), 'Corporation (all)')}${sel('div', 'Division', divs, 'All divisions')}${clus.length ? sel('clu', 'Sub-division', clus, 'All sub-divisions') : ''}
    ${sel('proj', 'Project', all.filter(p => (!TA.plat || taPl(p) === TA.plat) && (!TA.div || taDv(p) === TA.div) && (!TA.clu || taCl(p) === TA.clu)).map(p => [p.id, p.name]), 'All projects')}</div>
   <div class="rg-kpis">${rgKpi('Observations', sum(pos) + sum(neg), 'info')}${rgKpi('Positive share', sum(pos) + sum(neg) ? Math.round(sum(pos) / (sum(pos) + sum(neg)) * 100) + '%' : '—', 'ok')}${rgKpi('Recordable injuries', sum(lti) + sum(rwc) + sum(mtc), sum(lti) ? 'bad' : 'warn')}${rgKpi('Lost-time injuries', sum(lti), sum(lti) ? 'bad' : 'ok')}${rgKpi('PTW inspections', sum(ptwDone), 'info')}${rgKpi('NCRs raised', sum(ncrMin) + sum(ncrMaj), 'warn')}${rgKpi('NCRs open', ncrOpen, ncrOpen ? 'warn' : 'ok')}${rgKpi('Training hours', Math.round(sum(trH)).toLocaleString('en-GB'), 'info')}</div>
   <div class="ta-grid ta-board">
    ${rgCard('Safety observations', cdBars(lbl, [{ name: 'Positive', vals: pos, color: '#00A651' }, { name: 'Unsafe', vals: neg, color: '#F7941D' }], { flat: 1, w: 460, h: 230 }), 'cd-wide')}
    ${rgCard('Lagging indicators · click to drill down', `<div class="ta-lagc" data-ta-lagchart>${cdBars(lbl, [{ name: 'LTI (incl. fatality, SI)', vals: lti, color: '#ED1C24' }, { name: 'Restricted work', vals: rwc, color: '#9b7bff' }, { name: 'Medical treatment', vals: mtc, color: '#F7941D' }, { name: 'First aid', vals: fac, color: '#8a96a8' }], { flat: 1, w: 460, h: 230 })}</div>${lagChips}`, 'cd-wide')}

    ${rgCard(`Frequency rates per ${mult >= 1e6 ? '1,000,000' : '200,000'} man-hours`, hrs.some(Boolean) ? cdLine(lbl, trcf, '#ED1C24', { w: 460, h: 230 }) + `<p class="rg-note">TRCF (red). LTIFR: ${ltifr.map(v => v == null ? '—' : v).join(' · ')}</p>` : '<p class="cd-none">Enter monthly man-hours to see rates</p>', 'cd-wide')}
    ${rgCard('Incidents by type', cdBars(lbl, [{ name: 'Near miss', vals: nm, color: '#2f73c9' }, { name: 'Injury', vals: inj, color: '#ED1C24' }, { name: 'Property damage', vals: dmg, color: '#F7941D' }, { name: 'Other', vals: oth, color: '#8a96a8' }], { flat: 1, w: 460, h: 230 }), 'cd-wide')}
    ${rgCard('Permit to work', cdBars(lbl, [{ name: 'PTW inspections', vals: ptwDone, color: '#2f73c9' }, { name: 'Items at risk', vals: ptwFail, color: '#ED1C24' }, { name: 'Permits field-reviewed', vals: ptwRev, color: '#7aa9ff' }, { name: 'Permit non-compliances', vals: ptwNC, color: '#F7941D' }], { flat: 1, w: 460, h: 230 }), 'cd-wide')}
    ${rgCard('NCRs raised and closed', F.length ? cdBars(lbl, [{ name: 'Minor', vals: ncrMin, color: '#FFD200' }, { name: 'Major', vals: ncrMaj, color: '#ED1C24' }, { name: 'Closed', vals: ncrCl, color: '#00A651' }], { flat: 1, w: 460, h: 230 }) : '<p class="cd-none">No non-compliance findings recorded for this selection</p>', 'cd-wide')}
    ${rgCard('Training trend', cdBars(lbl, [{ name: 'Training man-hours', vals: trH, color: '#2f73c9' }], { flat: 1, w: 460, h: 230 }) + `<p class="rg-note">People trained (records): ${trN.join(' · ')}</p>`, 'cd-wide')}
    ${rgCard('Recordable injuries by division', (() => { const o = {}; P.forEach(p => { const n = sum(recVal([p])); if (n) o[taDv(p)] = (o[taDv(p)] || 0) + n; }); const rows = Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 8); return rows.length ? cdHbars(rows.map(([k, v]) => ({ l: k.length > 22 ? k.slice(0, 21) + '…' : k, v, c: '#ED1C24' })), { w: 420, lw: 150, rh: 26 }) : '<p class="cd-none">No recordable injuries</p>'; })(), 'cd-wide')}
   </div>
   <div class="ta-more"><button class="btn" data-ta-tables>${TA.tables ? 'Hide' : 'Show'} breakdown by platform › division › sub-division › project</button></div>
   ${taLagDrill(P, R, M, lbl, inM)}
   ${TA.tables ? `<div class="panel"><h2>Recordable injuries · platform › division › sub-division › project</h2><div class="rg-tw"><table class="rg-t ta-div"><thead><tr><th>Organisation</th>${lbl.map(l => `<th>${l}</th>`).join('')}<th>Total</th></tr></thead><tbody>${taTree(P, recVal)}</tbody></table></div><p class="rg-note">Recordable = LTI, restricted work and medical treatment cases. Projects show only when they have cases.</p></div>
   <div class="panel"><h2>NCRs raised · platform › division › sub-division › project</h2><div class="rg-tw"><table class="rg-t ta-div"><thead><tr><th>Organisation</th>${lbl.map(l => `<th>${l}</th>`).join('')}<th>Total</th></tr></thead><tbody>${taTree(P, ncrVal)}</tbody></table></div></div>` : ''}`;
}
document.addEventListener('change', e => { const t = e.target; if (!t.dataset || !t.dataset.ta) return; const k = t.dataset.ta; TA[k] = k === 'months' ? (+t.value || 12) : t.value; if (k === 'plat') TA.div = TA.clu = TA.proj = ''; if (k === 'div') TA.clu = TA.proj = ''; if (k === 'clu') TA.proj = ''; render(); });
document.addEventListener('click', e => {
  if (e.target.closest('[data-ta-tables]')) { TA.tables = !TA.tables; render(); return; }
  if (e.target.classList && e.target.classList.contains('ta-ov')) { TA.lag = null; render(); return; }
  const b = e.target.closest('[data-ta-lag]');
  if (b) { const c = b.dataset.taLag; TA.lag = c === 'close' ? null : { cls: c, m: b.dataset.taM || '' }; render(); return; }
  const ch = e.target.closest('[data-ta-lagchart] svg');
  if (ch) { const r = ch.getBoundingClientRect(), M = rgMonths(TA.months), i = Math.max(0, Math.min(M.length - 1, Math.floor((e.clientX - r.left) / r.width * M.length))); TA.lag = { cls: (TA.lag && TA.lag.cls) || 'rec', m: M[i] }; render(); }
});
regModule({ id: 'trends', title: 'Trend analysis', eyebrow: 'Trend analysis', headline: 'Where every indicator is heading', desc: 'Observations, lagging indicators, incidents, permits, NCRs and training month by month, for any division or project.', ents: [], tabs: [['all', 'Trends', () => taPage()]] });
rgNav('trends', 'Trend analysis', '<path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/>', [['m-trends', 'Trend analysis']], 'overview');
