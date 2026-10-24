'use strict';
/* NAVO v2 refinements (loaded last). */

/* ---------- anatomical body map: front and back, heat markers by body part ---------- */
const V2_HALF = 'M0 34L6.5 34C7.5 39 9 42 13 44C22 46 30 47.5 33.5 54C36.5 60 37.5 68 37.5 78C38.5 92 40.5 104 42.5 116C43.5 124 45.5 130 44.5 137C44.5 143 41 147 38 145C36 141 35.2 133 35 127C33.2 115 31 103 29.3 91C28.3 83 27.4 75 26.5 70C25.4 82 25.3 92 24.6 100C23.6 108 26 116 27.2 124C28.4 140 26.6 160 25.5 176C24.6 184 25.2 190 24.4 200C23.4 214 22.4 226 22.2 236C23.8 241 26.4 246 22.4 248.5L7 248.5C6.4 244 7.2 240 7.2 236C6.4 222 5.6 208 6.2 198C6 186 5.2 172 3.4 156C2.6 147 1.4 141 0 138Z';
const V2_SPOTS = { Head: ['f', 0, 9], Eye: ['f', 5.5, 19], Face: ['f', 0, 24], Neck: ['f', 0, 38], Shoulder: ['f', -29, 51], Chest: ['f', 0, 62], Abdomen: ['f', 0, 94], Arm: ['f', 34, 88], Elbow: ['f', -36, 80], Wrist: ['f', 41, 122], Hand: ['f', -40, 134], Finger: ['f', 40, 143], Hip: ['f', 20, 124], Leg: ['f', 14, 168], Knee: ['f', -14, 196], Ankle: ['f', 15, 236], Foot: ['f', 15, 245], Back: ['b', 0, 84], 'Lower back': ['b', 0, 108], Spine: ['b', 0, 72] };
function v2Body(counts) {
  const n = Object.values(counts).reduce((a, b) => a + b, 0), mx = Math.max(1, ...Object.values(counts));
  const fig = (x, id) => `<g transform="translate(${x} 4)"><ellipse cx="0" cy="252" rx="30" ry="4" fill="url(#v2sh)"/><path d="${V2_HALF}" fill="url(#v2g${id})"/><path d="${V2_HALF}" transform="scale(-1 1)" fill="url(#v2g${id})"/><ellipse cx="0" cy="20" rx="12.5" ry="15.5" fill="url(#v2g${id})"/>
    <path d="${V2_HALF}" fill="none" stroke="rgba(255,255,255,.18)" stroke-width=".6"/><path d="${V2_HALF}" transform="scale(-1 1)" fill="none" stroke="rgba(255,255,255,.18)" stroke-width=".6"/>
    ${id === 'f' ? '<path d="M-13 52Q0 58 13 52M-11 70Q0 74 11 70M0 58V118M-8 128Q0 134 8 128M-16 196Q-14 199 -11 196M11 196Q14 199 16 196" fill="none" stroke="rgba(255,255,255,.14)" stroke-width=".8"/>' : '<path d="M0 44V132M-16 60Q-8 70 -4 86M16 60Q8 70 4 86M-14 130Q0 138 14 130" fill="none" stroke="rgba(255,255,255,.14)" stroke-width=".8"/>'}</g>`;
  const spots = Object.entries(counts).filter(([k, v]) => v && V2_SPOTS[k]).sort((a, b) => a[1] - b[1]).map(([k, v]) => {
    const [side, sx, sy] = V2_SPOTS[k], x = (side === 'f' ? 70 : 190) + sx, y = 4 + sy, r = 5 + v / mx * 9, hot = v / mx;
    const c = hot > .66 ? '#ED1C24' : hot > .33 ? '#F7941D' : '#FFD200';
    return `<g class="hot v2-spot" ${typeof hAt === 'function' ? hAt('h', 'body:' + k) : ''}><circle cx="${x}" cy="${y}" r="${r * 1.9}" fill="${c}" opacity=".18"/><circle cx="${x}" cy="${y}" r="${r}" fill="${c}" opacity=".9" stroke="#fff" stroke-width="1"/><text x="${x}" y="${y + 3}" text-anchor="middle" class="v2-n">${v}</text><title>${k}: ${v} injur${v === 1 ? 'y' : 'ies'}</title></g>`; }).join('');
  const unk = counts['Not recorded'] || counts['Other'] || 0;
  return `<div class="v2-body"><svg viewBox="22 0 216 274" role="img" aria-label="Injuries by body part">
   <defs><linearGradient id="v2gf" x1="0" x2="1"><stop offset="0" stop-color="#2d6fa8"/><stop offset=".5" stop-color="#4f97d6"/><stop offset="1" stop-color="#2d6fa8"/></linearGradient>
   <linearGradient id="v2gb" x1="0" x2="1"><stop offset="0" stop-color="#244f78"/><stop offset=".5" stop-color="#3a78ae"/><stop offset="1" stop-color="#244f78"/></linearGradient>
   <radialGradient id="v2sh"><stop offset="0" stop-color="#000" stop-opacity=".35"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs>
   ${fig(70, 'f')}${fig(190, 'b')}<text x="70" y="270" text-anchor="middle" class="v2-cap">FRONT</text><text x="190" y="270" text-anchor="middle" class="v2-cap">BACK</text>${spots}</svg>
   <div class="v2-leg"><span><i style="background:#FFD200"></i>Low</span><span><i style="background:#F7941D"></i>Medium</span><span><i style="background:#ED1C24"></i>High</span>${unk ? `<span class="v2-unk">${unk} not recorded</span>` : ''}</div></div>`;
}
try { hsBody = v2Body; } catch (e) { window.hsBody = v2Body; }

/* ---------- Trend analysis: period summary, top-3 boards, training by topic, remedial actions ---------- */
const V2P = [['week', 'Last week', 7], ['month', 'Monthly', 30], ['bimonth', 'Bi-monthly', 61], ['quarter', 'Quarterly', 92], ['year', 'Yearly', 365], ['all', 'All', 0]];
if (typeof TA !== 'undefined' && !TA.per) TA.per = 'month';
const V2_TOPICS = [['Hot work', /hot work|weld|grind|cutting|torch|spark/i], ['Electrical', /electric|cable|power board|db |live wire|energi[sz]ed|loto|isolation/i], ['Work at height', /height|scaffold|ladder|harness|fall|open edge|roof|mewp/i], ['Lifting', /lift|crane|sling|rigging|load/i], ['Excavation', /excavat|trench|digging/i], ['Traffic', /traffic|vehicle|forklift|reversing|driving|banksman|speed/i], ['Confined space', /confined/i], ['Housekeeping', /housekeep|slip|trip|blocked|material/i], ['PPE', /ppe|helmet|glove|goggle|vest/i], ['Hazardous substances', /chemical|substance|spill|diesel|fuel/i], ['Dropped objects', /dropped|falling object/i]];
const V2_WHEEL = { 'Work at Height': 'Work at height', 'Lifting Operations': 'Lifting', 'Excavation': 'Excavation', 'Confined Space': 'Confined space', 'Moving Equipment': 'Traffic', 'Energized Systems': 'Electrical', 'Stored Energy': 'Electrical', 'Hazardous Substances': 'Hazardous substances' };
function v2Topic(r) { if (r.cat && V2_WHEEL[r.cat]) return V2_WHEEL[r.cat]; if (r.cat) return r.cat; const t = (r.desc || '') + ' ' + (r.kind || ''); const m = V2_TOPICS.find(([, re]) => re.test(t)); return m ? m[0] : 'Other'; }
const v2Pfpi = r => (r.rt === 'Incident' || r.kind === 'Near Miss') && (r.hipo || r.highPotential === 'Yes' || r.pfpi || r.kind === 'Dangerous Occurrence' || ['Fatality', 'Serious Injury'].includes(typeof sevOf === 'function' ? sevOf(r) : '') || !!V2_WHEEL[r.cat]);
const v2Swa = r => /stop work/i.test((r.kind || '') + ' ' + (r.desc || '')) || r.stopWork === true || r.stopWork === 'Yes';
const V2_REMEDY = { 'Electrical': 'Inspect electrical tools and power boards and apply cable management on site.', 'Work at height': 'Enforce 100% tie-off, inspected harnesses and tagged scaffolds for all work at height.', 'Hot work': 'Verify hot work permits, fire watch and removal of combustibles before every task.', 'Lifting': 'Check lift plans, certified rigging and exclusion zones before every lift.', 'Excavation': 'Confirm excavation permits, shoring or battering and edge protection daily.', 'Traffic': 'Separate people from plant, use banksmen and enforce site speed limits.', 'Confined space': 'Confirm gas testing, standby man and rescue plan before entry.', 'Housekeeping': 'Daily housekeeping inspections; keep walkways and exits clear.', 'PPE': 'Supervisors to stop and correct missing PPE; replace damaged PPE the same day.', 'Hazardous substances': 'Check SDS, labelling, spill kits and secondary containment.', 'Dropped objects': 'Tool tethering, toe boards and exclusion zones below work at height.' };
function v2Cyl(rows, o = {}) {
  if (!rows.length) return '<p class="cd-none">No records in this period</p>';
  const W = o.w || 300, H = o.h || 150, n = rows.length, bw = Math.min(46, W / n * .55), mx = Math.max(1, ...rows.map(r => r[1])), base = H - 28;
  let s = `<defs><linearGradient id="v2cy" x1="0" x2="1"><stop offset="0" stop-color="#0d2a66"/><stop offset=".45" stop-color="#2b5fb8"/><stop offset="1" stop-color="#0d2a66"/></linearGradient><linearGradient id="v2cg" x1="0" x2="1"><stop offset="0" stop-color="#0c6b3a"/><stop offset=".45" stop-color="#2fbf71"/><stop offset="1" stop-color="#0c6b3a"/></linearGradient></defs>`;
  rows.forEach(([lab, v, hi], i) => { const cx = (i + .5) * W / n, h = Math.max(4, v / mx * (base - 30)), y = base - h, f = hi ? 'url(#v2cg)' : 'url(#v2cy)';
    s += `<g><title>${esc(lab)}: ${v}</title><rect x="${cx - bw / 2}" y="${y}" width="${bw}" height="${h}" fill="${f}"/><ellipse cx="${cx}" cy="${base}" rx="${bw / 2}" ry="${bw / 7}" fill="${hi ? '#0c6b3a' : '#0d2a66'}"/><ellipse cx="${cx}" cy="${y}" rx="${bw / 2}" ry="${bw / 7}" fill="${hi ? '#5fe09a' : '#5d8fe0'}"/><text x="${cx}" y="${y - bw / 7 - 5}" text-anchor="middle" class="v2-cv">${v}</text>`;
    s += o.rot ? `<text transform="translate(${cx + 3} ${base + 10}) rotate(-45)" text-anchor="end" class="v2-cl">${esc(lab.length > 22 ? lab.slice(0, 21) + '…' : lab)}</text></g>` : `<text x="${cx}" y="${base + 16}" text-anchor="middle" class="v2-cl">${esc(lab.length > 18 ? lab.slice(0, 17) + '…' : lab)}</text></g>`; });
  return `<svg viewBox="${o.rot ? -30 : 0} 0 ${W + (o.rot ? 30 : 0)} ${H + (o.rot ? 60 : 0)}" class="v2-cyl">${s}</svg>`;
}
function v2TrendSummary() {
  const P = taProjects(), ids = new Set(P.map(p => p.id)), per = V2P.find(p => p[0] === TA.per) || V2P[1], from = per[2] ? Date.now() - per[2] * 864e5 : 0, inP = t => (t || 0) >= from;
  const R = (L.reports || []).filter(r => ids.has(r.project) && inP(r.eventTs || r.ts));
  const F = (L.records || []).filter(r => r.kind === 'finding' && ids.has(r.project) && taIsNcr(r) && inP(r.ts)), Fo = F.filter(r => r.data.status !== 'Closed').length;
  const pf = R.filter(v2Pfpi), nm = R.filter(r => r.kind === 'Near Miss'), sw = R.filter(v2Swa);
  const top = (arr, k = 3) => { const o = {}; arr.forEach(r => { const t = v2Topic(r); if (t !== 'Other') o[t] = (o[t] || 0) + 1; }); return Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, k); };
  const obs = top(R.filter(r => r.rt === 'Hazard' && !v2Swa(r))), vio = top(R.filter(r => r.kind === 'Unsafe Act')), swt = top(sw);
  const I = (L.inspAll || L.inspections || []).filter(i => ids.has(i.project) && inP(i.ts)), cc = {}; I.forEach(i => { if (+i.fails) cc[i.tpl || 'Checklist'] = (cc[i.tpl || 'Checklist'] || 0) + +i.fails; });
  const ccc = Object.entries(cc).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const TR = (typeof rgRecs === 'function' ? rgRecs('tr') : []).filter(r => ids.has(r.project) && inP(Date.parse(r.data.date || 0))), tc = {};
  TR.forEach(r => { const c = rgGet(r.data.course); const n = c ? c.data.name : 'Other'; tc[n] = (tc[n] || 0) + 1; });
  const tct = Object.entries(tc).sort((a, b) => b[1] - a[1]).slice(0, 22), mand = new Set((typeof rgRecs === 'function' ? rgRecs('tc') : []).filter(c => c.data.mandatory).map(c => c.data.name));
  const rem = [...new Set([...vio, ...obs, ...swt].map(x => x[0]))].filter(t => V2_REMEDY[t]).slice(0, 4);
  const tile = (lab, big, sub, tone) => `<div class="v2-k t-${tone}"><span>${lab}</span><b>${big}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;
  return `<div class="v2-per">${V2P.map(([k, l]) => `<button class="ta-chip ${TA.per === k ? 'on' : ''}" data-v2per="${k}">${l}</button>`).join('')}</div>
   <div class="v2-kpis">${tile('Total NCRs', F.length, `<em class="o">${Fo} open</em> · <em class="c">${F.length - Fo} closed</em>`, 'warn')}${tile('Total PFPI', pf.length, 'cases · ' + per[1].toLowerCase(), pf.length ? 'bad' : 'ok')}${tile('Total near miss', nm.length, per[1].toLowerCase(), 'info')}${tile('Stop work authority', sw.length, 'times work was stopped', 'ok')}${tile('Observations', R.filter(r => r.rt === 'Hazard' || r.rt === 'Good practice').length, 'positive and unsafe', 'info')}</div>
   <div class="v2-top">${rgCard('Top 3 observations', v2Cyl(obs))}${rgCard('Top 3 HSE violations', v2Cyl(vio))}${rgCard('Top 3 stop work authority', v2Cyl(swt))}${rgCard('Top CCCs at risk', v2Cyl(ccc.map(([k, v]) => [k.replace(/ inspection| checklist/i, ''), v])))}</div>
   <div class="v2-tr">${rgCard('Training trend · records by course', v2Cyl(tct.map(([k, v]) => [k, v, mand.has(k)]), { w: 760, h: 190, rot: 1 }) + '<p class="rg-note">Green = mandatory course</p>')}<div class="panel v2-rem"><h3>Remedial actions</h3>${rem.length ? '<ul>' + rem.map(t => `<li><b>${esc(t)}:</b> ${esc(V2_REMEDY[t])}</li>`).join('') + '</ul>' : '<p class="mx-muted">No repeated issue in this period.</p>'}<p class="rg-note">Generated from the top observations, violations and stop-work topics in the selected period.</p></div></div>`;
}
if (typeof taPage === 'function') { const v2TaBase = taPage; taPage = function () { const h = v2TaBase.apply(this, arguments); const cut = h.indexOf('<div class="rg-kpis">'); return cut < 0 ? v2TrendSummary() + h : h.slice(0, cut) + v2TrendSummary() + '<h3 class="v2-h">Monthly trends</h3>' + h.slice(cut); }; try { REG.mods.trends.tabs[0][2] = () => taPage(); } catch (e) { } }
document.addEventListener('click', e => { const b = e.target.closest('[data-v2per]'); if (!b) return; TA.per = b.dataset.v2per; render(); });

/* ---------- Accident & audit analysis: decomposition tree with free choice of the next level ---------- */
const V2A = { acc: { path: [], next: 'platform', type: '', per: 'year', plat: '', div: '', clu: '', proj: '' }, aud: { path: [], next: 'platform', type: '', per: 'year', plat: '', div: '', clu: '', proj: '' } };
const V2M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function v2Dims(which) {
  const pr = id => (L.projects || []).find(p => p.id === id) || {}, pj = r => pr(r.project);
  const common = [['country', 'Country', r => pj(r).country], ['platform', 'Platform', r => (pj(r).platform || 'Construction') + ' platform'], ['division', 'Division', r => pj(r).division || 'Unassigned'], ['cluster', 'Sub-division', r => pj(r).cluster || '—'], ['project', 'Project', r => pj(r).name]];
  if (which === 'acc') return common.concat([['type', 'Incident type', r => r.kind], ['category', 'Category', r => (typeof incCat === 'function' && incCat(r)) || 'Other'], ['severity', 'Severity', r => (typeof sevOf === 'function' && sevOf(r)) || 'Not injury'], ['cause', 'High-energy hazard', r => r.cat || 'Not classified'], ['topic', 'Activity', r => v2Topic(r)], ['body', 'Body part', r => r.bodyPart || '—'], ['contractor', 'Contractor', r => r.contractor || 'Own workforce'], ['month', 'Month', r => { const d = new Date(r.eventTs || r.ts); return d.getFullYear() + ' ' + V2M[d.getMonth()]; }]]);
  return common.concat([['audit', 'Audit', r => r.data.audit], ['element', 'Element', r => r.data.element], ['ftype', 'Finding type', r => r.data.ftype], ['severity', 'Severity', r => r.data.sev], ['status', 'Status', r => r.data.status], ['month', 'Month', r => { const d = new Date(r.ts); return d.getFullYear() + ' ' + V2M[d.getMonth()]; }]]);
}
function v2Tree(P0, which) {
  const S = V2A[which], dims = v2Dims(which), D = Object.fromEntries(dims.map(d => [d[0], d]));
  const per = V2P.find(p => p[0] === S.per) || V2P[4], from = per[2] ? Date.now() - per[2] * 864e5 : 0;
  let P = P0; if (S.plat) P = P.filter(p => (p.platform || 'Construction') === S.plat); if (S.div) P = P.filter(p => (p.division || 'Unassigned') === S.div); if (S.clu) P = P.filter(p => (p.cluster || '') === S.clu); if (S.proj) P = P.filter(p => p.id === S.proj);
  const ids = new Set(P.map(p => p.id));
  let items = which === 'acc' ? (L.reports || []).filter(r => r.rt === 'Incident' && ids.has(r.project) && (r.eventTs || r.ts) >= from) : (L.records || []).filter(r => r.kind === 'finding' && ids.has(r.project) && r.ts >= from && !(r.data && r.data._deleted));
  if (S.type) items = items.filter(r => which === 'acc' ? (S.type === 'Injury' ? r.kind === 'Injury' || (typeof sevOf === 'function' && sevOf(r)) : S.type === 'PFPI' ? v2Pfpi(r) : r.kind === S.type) : r.data.ftype === S.type);
  const all0 = myProjects(), uq = a => [...new Set(a)].filter(Boolean).sort();
  const sel = (k, lab, opts, allL) => `<label>${lab}<select class="mx-in" data-v2a="${which}|${k}"><option value="">${allL}</option>${opts.map(o => { const [v, t] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${S[k] === v ? 'selected' : ''}>${esc(t)}</option>`; }).join('')}</select></label>`;
  const fP = all0.filter(p => (!S.plat || (p.platform || 'Construction') === S.plat) && (!S.div || (p.division || 'Unassigned') === S.div) && (!S.clu || (p.cluster || '') === S.clu));
  const types = which === 'acc' ? ['Injury', 'PFPI', 'Near Miss', 'Property Damage', 'Environmental', 'Fire', 'Road Traffic Accident', 'Dangerous Occurrence'] : ['Non-compliance', 'Observation', 'Opportunity for improvement'];
  const filters = `<div class="ta-filters v2-af">${sel('plat', 'Platform', uq(all0.map(p => p.platform || 'Construction')).map(x => [x, x + ' platform']), 'Corporation (all)')}${sel('div', 'Division', uq(all0.filter(p => !S.plat || (p.platform || 'Construction') === S.plat).map(p => p.division || 'Unassigned')), 'All divisions')}${sel('clu', 'Sub-division', uq(all0.filter(p => (!S.plat || (p.platform || 'Construction') === S.plat) && (!S.div || (p.division || 'Unassigned') === S.div)).map(p => p.cluster)), 'All sub-divisions')}${sel('proj', 'Project', fP.map(p => [p.id, p.name]), 'All projects')}${sel('type', which === 'acc' ? 'Incident type' : 'Finding type', types, which === 'acc' ? 'All incidents' : 'All findings')}</div>
   <div class="v2-per">${V2P.map(([k, l]) => `<button class="ta-chip ${S.per === k ? 'on' : ''}" data-v2aper="${which}|${k}">${l}</button>`).join('')}</div>`;
  /* walk the path */
  let cur = items; const cols = [];
  const tot0 = items.length || 1;
  cols.push(`<div class="v2t-col"><div class="v2t-h">${which === 'acc' ? 'Total incidents' : 'Total findings'}</div><button class="v2t-n on" data-v2t="${which}|-1"><span>All</span><b>${items.length}</b><i style="width:100%"></i></button></div>`);
  S.path.forEach(([dim, val], i) => {
    const f = D[dim][2], g = {}; cur.forEach(r => { const k = f(r) || '—'; g[k] = (g[k] || 0) + 1; });
    const ent = Object.entries(g).sort((a, b) => b[1] - a[1]), t = cur.length || 1;
    cols.push(`<div class="v2t-col"><div class="v2t-h">${esc(D[dim][1])}<button class="v2t-x" data-v2tx="${which}|${i}" title="Remove this level">×</button></div>${ent.map(([k, v]) => `<button class="v2t-n ${val === k ? 'on' : ''}" data-v2tv="${which}|${i}|${esc(k)}"><span>${esc(k)}</span><b>${v}<small> · ${(v / t * 100).toFixed(1)}%</small></b><i style="width:${v / t * 100}%"></i></button>`).join('')}</div>`);
    if (val != null) cur = cur.filter(r => (f(r) || '—') === val);
  });
  const last = S.path[S.path.length - 1], open = !last || last[1] != null;
  const used = new Set(S.path.map(p => p[0]));
  if (open) cols.push(`<div class="v2t-col v2t-add"><div class="v2t-h">Break down by</div>${dims.filter(d => !used.has(d[0])).map(d => `<button class="v2t-d" data-v2td="${which}|${d[0]}">+ ${esc(d[1])}</button>`).join('')}</div>`);
  /* summary of the current selection */
  const sevC = which === 'acc' ? ['Fatality', 'Serious Injury', 'Lost Time (> 7 days)', 'Lost Time', 'Restricted Work', 'Medical Treatment', 'First Aid'].map(s => [s, cur.filter(r => sevOf(r) === s).length]) : [];
  const kp = which === 'acc' ? [['Selected incidents', cur.length, 'info'], ['Injuries', cur.filter(r => sevOf(r)).length, 'warn'], ['Recordable', cur.filter(r => ['Fatality', 'Serious Injury', 'Lost Time (> 7 days)', 'Lost Time', 'Restricted Work', 'Medical Treatment'].includes(sevOf(r))).length, 'bad'], ['PFPI', cur.filter(v2Pfpi).length, 'bad'], ['Near misses', cur.filter(r => r.kind === 'Near Miss').length, 'info'], ['Open', cur.filter(r => r.status !== 'Closed').length, 'warn']]
    : [['Selected findings', cur.length, 'info'], ['Non-compliances', cur.filter(r => r.data.ftype === 'Non-compliance').length, 'warn'], ['Major', cur.filter(r => /major|significant/i.test(r.data.sev || '')).length, 'bad'], ['Open', cur.filter(r => r.data.status !== 'Closed').length, 'warn'], ['Closed', cur.filter(r => r.data.status === 'Closed').length, 'ok'], ['Closure rate', cur.length ? Math.round(cur.filter(r => r.data.status === 'Closed').length / cur.length * 100) + '%' : '—', 'ok']];
  const crumbs = S.path.filter(p => p[1] != null).map(([d, v]) => `${D[d][1]}: <b>${esc(v)}</b>`).join(' › ') || 'All';
  const list = cur.slice().sort((a, b) => (b.eventTs || b.ts) - (a.eventTs || a.ts)).slice(0, 60);
  const pn = id => ((L.projects || []).find(p => p.id === id) || {}).name || '';
  const listH = which === 'acc' ? `<table class="rg-t"><thead><tr><th>Date</th><th>Project</th><th>Type</th><th>Severity</th><th>Description</th><th>Status</th></tr></thead><tbody>${list.map(r => `<tr><td>${new Date(r.eventTs || r.ts).toLocaleDateString('en-GB')}</td><td>${esc(pn(r.project))}</td><td>${esc(r.kind || '')}</td><td>${esc(sevOf(r) || '—')}</td><td>${esc((r.desc || '').slice(0, 90))}</td><td>${esc(r.status || '')}</td></tr>`).join('')}</tbody></table>`
    : `<table class="rg-t"><thead><tr><th>Date</th><th>Project</th><th>Audit</th><th>Element</th><th>Type</th><th>Severity</th><th>Status</th></tr></thead><tbody>${list.map(r => `<tr><td>${new Date(r.ts).toLocaleDateString('en-GB')}</td><td>${esc(pn(r.project))}</td><td>${esc(r.data.audit || '')}</td><td>${esc(r.data.element || '')}</td><td>${esc(r.data.ftype || '')}</td><td>${esc(r.data.sev || '')}</td><td>${esc(r.data.status || '')}</td></tr>`).join('')}</tbody></table>`;
  return `<div class="v2-an">${filters}
   <div class="v2-kpis v2-kpis6">${kp.map(([l, v, t]) => `<div class="v2-k t-${t}"><span>${l}</span><b>${v}</b></div>`).join('')}</div>
   <div class="panel v2t-panel"><div class="v2t-top"><h3>${which === 'acc' ? 'Accident analysis' : 'Audit analysis'} · decomposition tree</h3><span class="v2t-crumb">${crumbs}</span><button class="btn" data-v2treset="${which}">Reset</button></div>
    <p class="mx-muted v2t-help">Choose what to break down by, then click a bar to drill into it. Each column can be removed with ×.</p>
    <div class="v2t">${cols.join('')}</div></div>
   ${which === 'acc' ? `<div class="v2-top v2-top2">${rgCard('Injury severity · selection', cdHbars(sevC.map(([l, v]) => ({ l, v, c: /Fatal|Serious|Lost/.test(l) ? '#ED1C24' : /Restricted|Medical/.test(l) ? '#F7941D' : '#8a96a8' })), { w: 420, lw: 150 }))}${rgCard('Top activities · selection', v2Cyl((() => { const o = {}; cur.forEach(r => { const t = v2Topic(r); if (t !== 'Other') o[t] = (o[t] || 0) + 1; }); return Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 5); })()))}</div>` : ''}
   <div class="panel"><h3>Records in this selection <small>${cur.length}${cur.length > 60 ? ' · latest 60 shown' : ''}</small></h3><div class="rg-tw">${listH}</div></div></div>`;
}
if (typeof hsTree === 'function') { hsTree = function (P, which) { return v2Tree(P, which === 'aud' ? 'aud' : 'acc'); }; }
document.addEventListener('change', e => { const t = e.target; if (!t.dataset || !t.dataset.v2a) return; const [w, k] = t.dataset.v2a.split('|'), S = V2A[w]; S[k] = t.value; if (k === 'plat') S.div = S.clu = S.proj = ''; if (k === 'div') S.clu = S.proj = ''; if (k === 'clu') S.proj = ''; render(); });
document.addEventListener('click', e => {
  const t = e.target.closest('[data-v2aper],[data-v2t],[data-v2tv],[data-v2tx],[data-v2td],[data-v2treset]'); if (!t) return; e.preventDefault(); e.stopPropagation(); const D = t.dataset;
  if (D.v2aper) { const [w, k] = D.v2aper.split('|'); V2A[w].per = k; }
  if (D.v2t) { const [w] = D.v2t.split('|'); V2A[w].path = []; }
  if (D.v2tv) { const [w, i, ...v] = D.v2tv.split('|'), S = V2A[w]; S.path = S.path.slice(0, +i + 1); S.path[+i] = [S.path[+i][0], v.join('|')]; }
  if (D.v2tx) { const [w, i] = D.v2tx.split('|'); V2A[w].path = V2A[w].path.slice(0, +i); }
  if (D.v2td) { const [w, d] = D.v2td.split('|'); V2A[w].path.push([d, null]); }
  if (D.v2treset) V2A[D.v2treset].path = [];
  render();
}, true);

/* ---------- every project picker in NAVO grouped by the organisation: platform › division › sub-division ---------- */
function v2GroupSelect(sel) {
  if (sel.dataset.v2g || sel.multiple || !L.projects || !L.projects.length) return;
  const pm = new Map(L.projects.map(p => [String(p.id), p])), opts = [...sel.options];
  const proj = opts.filter(o => pm.has(o.value));
  if (proj.length < 3 || sel.querySelector('optgroup')) { sel.dataset.v2g = '1'; return; }
  const cur = sel.value, head = opts.filter(o => !pm.has(o.value));
  const key = p => `${p.platform || 'Construction'} › ${p.division || 'Unassigned'}${p.cluster ? ' › ' + p.cluster : ''}`;
  const g = {}; proj.forEach(o => { const k = key(pm.get(o.value)); (g[k] = g[k] || []).push(o); });
  const order = Object.keys(g).sort((a, b) => a.localeCompare(b));
  sel.innerHTML = ''; head.forEach(o => sel.appendChild(o));
  order.forEach(k => { const og = document.createElement('optgroup'); og.label = k; g[k].sort((a, b) => a.text.localeCompare(b.text)).forEach(o => og.appendChild(o)); sel.appendChild(og); });
  sel.value = cur; sel.dataset.v2g = '1';
}
let v2gT = null;
function v2GroupAll() { clearTimeout(v2gT); v2gT = setTimeout(() => document.querySelectorAll('select:not([data-v2g])').forEach(v2GroupSelect), 30); }
try { new MutationObserver(v2GroupAll).observe(document.body, { childList: true, subtree: true }); } catch (e) { }

/* ---------- involved persons on every report ---------- */
const V2_ROLES = ['Injured person', 'Involved worker', 'Witness', 'Supervisor', 'First aider', 'Driver / operator', 'Third party'];
function v2InvBlock() {
  const w = st.w || {}; w.involved = w.involved || [];
  const rows = w.involved.length ? w.involved : [{}];
  return `<div class="fld v2-inv" id="v2-inv"><label>Involved persons <small>(optional · name, ID, company, role)</small></label>${rows.map((x, i) => `<div class="v2-inv-r"><input data-v2inv="${i}|name" placeholder="Full name" value="${esc(x.name || '')}"><input data-v2inv="${i}|id" placeholder="Employee / ID no." value="${esc(x.id || '')}"><input data-v2inv="${i}|company" placeholder="Company" value="${esc(x.company || '')}"><select data-v2inv="${i}|role">${V2_ROLES.map(r => `<option ${x.role === r ? 'selected' : ''}>${r}</option>`).join('')}</select>${rows.length > 1 ? `<button type="button" class="btn" data-v2invdel="${i}">×</button>` : ''}</div>`).join('')}<button type="button" class="btn" data-v2invadd>+ Add person</button></div>`;
}
function v2InvInject() {
  if (st.view !== 'report' || !st.w || st.w.step !== 3 || document.getElementById('v2-inv')) return;
  const anchor = document.getElementById('wlang'); const fld = anchor && anchor.closest('.fld'); if (!fld) return;
  fld.insertAdjacentHTML('beforebegin', v2InvBlock());
}
function v2InvShow() {
  if (st.view !== 'caseedit' || typeof CX === 'undefined' || !CX.row || document.getElementById('v2-inv-show')) return;
  const r = (L.reports || []).find(x => x.id === CX.row.id), inv = r && r.riskAssessment && r.riskAssessment.involved;
  if (!inv || !inv.length) return;
  const main = document.querySelector('main .cx-case, main .cx-edit, main') ; if (!main) return;
  main.insertAdjacentHTML('beforeend', `<div class="panel" id="v2-inv-show"><h3>Involved persons</h3><table class="rg-t"><thead><tr><th>Name</th><th>ID</th><th>Company</th><th>Role</th></tr></thead><tbody>${inv.map(x => `<tr><td>${esc(x.name)}</td><td>${esc(x.id || '')}</td><td>${esc(x.company || '')}</td><td>${esc(x.role || '')}</td></tr>`).join('')}</tbody></table></div>`);
}
if (typeof render === 'function') { const v2R = render; render = function () { const o = v2R.apply(this, arguments); try { v2InvInject(); v2InvShow(); } catch (e) { } return o; }; }
document.addEventListener('input', e => { const t = e.target; if (!t.dataset || !t.dataset.v2inv) return; const [i, k] = t.dataset.v2inv.split('|'); st.w.involved = st.w.involved || []; st.w.involved[+i] = { ...(st.w.involved[+i] || { role: V2_ROLES[0] }), [k]: t.value }; });
document.addEventListener('change', e => { const t = e.target; if (!t.dataset || !t.dataset.v2inv) return; const [i, k] = t.dataset.v2inv.split('|'); st.w.involved = st.w.involved || []; st.w.involved[+i] = { ...(st.w.involved[+i] || {}), [k]: t.value }; });
document.addEventListener('click', e => { const a = e.target.closest('[data-v2invadd],[data-v2invdel]'); if (!a) return; e.preventDefault(); st.w.involved = st.w.involved || []; if (a.dataset.v2invdel != null) st.w.involved.splice(+a.dataset.v2invdel, 1); else { if (!st.w.involved.length) st.w.involved.push({ role: V2_ROLES[0] }); st.w.involved.push({ role: V2_ROLES[0] }); } const b = document.getElementById('v2-inv'); if (b) b.outerHTML = v2InvBlock(); });

/* horizontal bars: label column sized to the longest label so names are not cut */
if (typeof cdHbars === 'function') { const v2Hb = cdHbars; cdHbars = function (items, o = {}) { if (items && items.length) { const m = Math.max(...items.map(i => String(i.l || '').length)), need = Math.min(240, Math.max(90, m * 6.6)), lw = Math.max(o.lw || 0, need), w0 = o.w || 300; o = { ...o, lw, w: Math.max(w0 + (lw - (o.lw || 120)), lw + 170) }; } return v2Hb(items, o); }; }

/* navigation wording: one clear name per section */
try { const g = NX_GROUPS.find(x => x[0] === 'records'); if (g) { g[1] = 'Observations & records'; g[4] = g[4].map(([v, l]) => [v, v === 'casehome' ? 'Search all records' : v === 'live' ? 'Observations (field reports)' : l]); const lv = g[4].findIndex(x => x[0] === 'live'); if (lv > 0) g[4].unshift(g[4].splice(lv, 1)[0]); g[2] = g[4][0][0]; } if (typeof TITLES !== 'undefined') TITLES.casehome = 'Search all records'; } catch (e) { }
