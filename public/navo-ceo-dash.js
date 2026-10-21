/* NAVO CEO bi-monthly HSSE dashboard — the same panels as the corporate Excel dashboard:
   Safety · Environment · Health & medical · Camp · Training · Security · CCTV observations · Lifting.
   Figures come from NAVO records, the fortnight entry form, or the client's own workbook uploaded as is. */
'use strict';

/* ---------- extra fields from the workbook ---------- */
(function () {
  const add = (sec, rows) => { const s = CEO_SECTIONS.find(x => x[0] === sec); rows.forEach(r => { if (!s[1].some(x => x[0] === r[0])) { s[1].push(r); if (r[2] === 'manual') CEO_MANUAL.push(r[0]); } }); };
  add('Environmental', [['wasteRecovered', 'Waste recovered (t)', 'manual'], ['fuelL', 'Fuel consumption (L)', 'manual'], ['offsetGhg', 'Emissions offset (solar & recycling)', 'manual'],
    ['envAudits', 'Environmental audits / inspections', 'manual'], ['envAuditsTarget', 'Environmental audits – target', 'manual'], ['envNcrOpen', 'Environmental NCRs open', 'manual'], ['envNcrClosed', 'Environmental NCRs closed', 'manual'],
    ['envObsOpen', 'Environmental observations open', 'manual'], ['envObsClosed', 'Environmental observations closed', 'manual'], ['envTrain', 'Environmental trainings', 'manual'], ['envTrainTarget', 'Environmental trainings – target', 'manual']]);
  add('Health, medical & camp', [['medicalCases', 'Summary of medical cases', 'manual']]);
  add('Training', [['ioshWSTarget', 'IOSH Working Safely – target', 'manual'], ['ioshMSTarget', 'IOSH Managing Safely – target', 'manual']]);
  add('CCTV monitoring', [['cctvClosed', 'CCTV observations closed', 'manual']]);
})();
const CD_AVG = new Set(['manpower', 'campIdxInt', 'campIdxExt']);
const CD_TARGET = new Set(['ioshWSTarget', 'ioshMSTarget', 'envAuditsTarget', 'envTrainTarget']);

/* ---------- values: any field can be reported; the opening year-to-date from the workbook is respected ---------- */
const cdRecs = ids => (L.records || []).filter(r => r.kind === 'ceo' && ids.has(r.project) && r.data);
ceoManual = function (ids, month, half) {
  const C = cdRecs(ids).filter(r => !r.data.opening && !r.data.tables && r.data.month === month && (!half || r.data.half === half));
  const out = {}, cnt = {};
  C.forEach(r => Object.entries(r.data.v || {}).forEach(([k, v]) => { if (v === '' || v == null || isNaN(+v)) return; out[k] = (out[k] || 0) + +v; cnt[k] = (cnt[k] || 0) + 1; }));
  Object.keys(out).forEach(k => { if (CD_AVG.has(k) || CD_TARGET.has(k)) out[k] = Math.round(out[k] / cnt[k] * 100) / 100; });
  return out;
};
/* For each figure, the latest workbook year-to-date total that reports it (same year, not after the month shown) */
function cdOpening(ids, month) {
  const y = month.slice(0, 4), O = cdRecs(ids).filter(r => r.data.opening && r.data.month.slice(0, 4) === y && r.data.month <= month).sort((a, b) => a.data.month < b.data.month ? 1 : -1);
  if (!O.length) return null;
  const at = {}, v = {};
  O.forEach(r => Object.entries(r.data.v || {}).forEach(([k, x]) => { if (x == null || x === '' || (at[k] && at[k] !== r.data.month)) return; at[k] = r.data.month; v[k] = CD_AVG.has(k) || CD_TARGET.has(k) ? +x : (v[k] || 0) + +x; }));
  return { month: O[0].data.month, at, v };
}
const cdBaseColumns = ceoColumns;
ceoColumns = function (scope, month) {
  const C = cdBaseColumns(scope, month), op = cdOpening(C.ids, month);
  if (!op) return C;
  // year-to-date = workbook total up to its month + everything reported after that month
  const MV = {}; ceoMonthsTo(month).filter(m => m > Object.values(op.at).sort()[0]).forEach(m => MV[m] = cdMonthVals(C.ids, m));
  const ytd = { ...C.ytd };
  Object.entries(op.v).forEach(([k, x]) => {
    const after = Object.keys(MV).filter(m => m > op.at[k]).map(m => MV[m][k]).filter(v => v != null && !isNaN(+v));
    ytd[k] = CD_AVG.has(k) || CD_TARGET.has(k) ? (after.length ? +after[after.length - 1] : x) : x + after.reduce((a, b) => a + +b, 0);
  });
  return { ...C, ytd, opening: op.month };
};
function cdMonthVals(ids, m) {
  const [a, b] = [new Date(+m.slice(0, 4), +m.slice(5) - 1, 1).getTime(), new Date(+m.slice(0, 4), +m.slice(5), 1).getTime()];
  return { ...ceoAuto(ids, a, b), ...ceoMonthly(ids, [m]), ...(envValues(ids, [m]) || {}), ...ceoManual(ids, m) };
}
function cdTables(ids, month) {
  const T = cdRecs(ids).filter(r => r.data.tables && r.data.month <= month).sort((a, b) => a.data.month < b.data.month ? 1 : -1);
  const out = {}; T.forEach(r => Object.entries(r.data.tables).forEach(([k, v]) => { if (!out[k]) out[k] = v; })); return out;
}

/* ---------- small SVG chart kit (3D bars, bars, lines, donuts) ---------- */
const CD_PAL = { safety: ['#f28c38', '#e2671f', '#f6b27a', '#c4501a', '#f9cfa6', '#a8431a'], env: ['#2f9e5b', '#5fbf7f', '#1f7a43', '#9ad7ac', '#16603a'], health: ['#f2b705', '#f5cd4d', '#d99a00', '#ffe08a', '#b07c00'],
  camp: ['#3b7dd8', '#7aa7e6', '#2a5fae', '#a9c6ef', '#1d4683'], grey: ['#6b7280', '#9ca3af', '#4b5563', '#c7ccd3', '#374151'], train: ['#3b5fc4', '#8fa6e6'], lift: ['#f2a07b', '#e0662e', '#c4501a'] };
const cdF = v => v == null ? '—' : Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M' : Math.abs(v) >= 1e4 ? Math.round(v / 1e3) + 'k' : (Math.round(v * 100) / 100).toLocaleString('en-GB');
const cdFull = v => v == null ? '—' : (Math.round(v * 100) / 100).toLocaleString('en-GB');
const cdShade = (hex, f) => { const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map(x => Math.max(0, Math.min(255, Math.round(f < 0 ? x * (1 + f) : x + (255 - x) * f)))); return '#' + c.map(x => x.toString(16).padStart(2, '0')).join(''); };
const cdEsc = s => esc(String(s));
let cdId = 0;
/* grouped vertical bars, optional 3D. cats: labels on the x axis; series: [{name, vals, color}] */
function cdBars(cats, series, o = {}) {
  const W = o.w || 360, H = o.h || 200, pad = { l: 8, r: 8, t: 18, b: o.rot ? 54 : 30 }, d3 = o.flat ? 0 : 7;
  const max = Math.max(1, ...series.flatMap(s => s.vals.map(v => +v || 0)));
  const gw = (W - pad.l - pad.r) / Math.max(1, cats.length), bw = Math.min(34, (gw * 0.72) / series.length), ih = H - pad.t - pad.b - d3;
  let s = '';
  cats.forEach((c, ci) => {
    const x0 = pad.l + ci * gw + (gw - bw * series.length) / 2;
    series.forEach((se, si) => {
      const v = se.vals[ci]; if (v == null) return; const h = Math.max(v > 0 ? 2 : 0, (v / max) * ih), x = x0 + si * bw, y = pad.t + d3 + ih - h, col = se.color;
      s += `<g class="cd-bar" style="--d:${(ci * series.length + si) * 40}ms"><title>${cdEsc(se.name ? se.name + ' · ' : '')}${cdEsc(c)}: ${cdFull(v)}</title>`;
      if (d3) s += `<path d="M${x} ${y}l${d3} ${-d3}h${bw - 2}l${-d3} ${d3}z" fill="${cdShade(col, .35)}"/><path d="M${x + bw - 2} ${y}l${d3} ${-d3}v${h}l${-d3} ${d3}z" fill="${cdShade(col, -.28)}"/>`;
      s += `<rect x="${x}" y="${y}" width="${bw - 2}" height="${h}" fill="${col}" rx="${d3 ? 0 : 3}"/>`;
      s += `<text x="${x + bw / 2 + d3 / 2}" y="${y - d3 - 4}" class="cd-v">${cdF(v)}</text></g>`;
    });
    const lx = pad.l + ci * gw + gw / 2, ly = H - pad.b + 14;
    s += o.rot ? `<text class="cd-x" transform="translate(${lx},${ly}) rotate(-32)" text-anchor="end">${cdEsc(c)}</text>` : `<text class="cd-x" x="${lx}" y="${ly}">${cdEsc(c)}</text>`;
  });
  s += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${H - pad.b}" y2="${H - pad.b}" class="cd-axis"/>`;
  return `<svg viewBox="0 0 ${W} ${H}" class="cd-svg" role="img">${s}</svg>${series.length > 1 || o.legend ? cdLegend(series) : ''}`;
}
/* horizontal bars: items [{l, v, c}] */
function cdHbars(items, o = {}) {
  const W = o.w || 300, rh = o.rh || 22, lw = o.lw || 120, H = items.length * rh + 6, max = Math.max(1, ...items.map(i => Math.abs(+i.v || 0)));
  let s = '';
  items.forEach((it, i) => {
    const y = 3 + i * rh, w = it.v == null ? 0 : Math.max(it.v ? 2 : 0, Math.abs(it.v) / max * (W - lw - 58));
    s += `<g class="cd-hbar" style="--d:${i * 40}ms"><title>${cdEsc(it.l)}: ${cdFull(it.v)}</title><text x="${lw - 6}" y="${y + rh / 2 + 4}" class="cd-l">${cdEsc(it.l)}</text>
      <rect x="${lw}" y="${y + 4}" width="${w}" height="${rh - 8}" rx="3" fill="${it.c}"/><text x="${lw + w + 5}" y="${y + rh / 2 + 4}" class="cd-hv">${cdF(it.v)}</text></g>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" class="cd-svg" role="img">${s}</svg>`;
}
function cdLine(cats, vals, color, o = {}) {
  const W = o.w || 360, H = o.h || 170, pad = { l: 10, r: 14, t: 22, b: 26 };
  const pts = vals.map((v, i) => v == null ? null : [pad.l + i * (W - pad.l - pad.r) / Math.max(1, cats.length - 1), 0, v]);
  const max = Math.max(1, ...vals.filter(v => v != null)); pts.forEach(p => { if (p) p[1] = pad.t + (1 - p[2] / max) * (H - pad.t - pad.b); });
  const P = pts.filter(Boolean), id = 'cdl' + (++cdId);
  return `<svg viewBox="0 0 ${W} ${H}" class="cd-svg" role="img"><defs><linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" style="stop-color:${color};stop-opacity:.35"/><stop offset="1" style="stop-color:${color};stop-opacity:0"/></linearGradient></defs>
   ${P.length > 1 ? `<path d="M${P[0][0]} ${H - pad.b}L${P.map(p => p[0] + ' ' + p[1]).join('L')}L${P[P.length - 1][0]} ${H - pad.b}z" fill="url(#${id})"/><path class="cd-path" d="M${P.map(p => p[0] + ' ' + p[1]).join('L')}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round"/>` : ''}
   ${P.map(p => `<g><title>${cdFull(p[2])}</title><circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="#fff" stroke="${color}" stroke-width="2"/><text x="${p[0]}" y="${p[1] - 8}" class="cd-v">${cdF(p[2])}</text></g>`).join('')}
   ${cats.map((c, i) => `<text class="cd-x" x="${pad.l + i * (W - pad.l - pad.r) / Math.max(1, cats.length - 1)}" y="${H - 8}">${cdEsc(c)}</text>`).join('')}</svg>`;
}
function cdDonut(items, o = {}) {
  const R = 62, r = o.pie ? 0 : 36, tot = items.reduce((a, i) => a + (+i.v || 0), 0) || 1; let a0 = -Math.PI / 2, s = '';
  items.forEach((it, i) => {
    const a1 = a0 + (Math.max(0, +it.v || 0) / tot) * Math.PI * 2, big = a1 - a0 > Math.PI ? 1 : 0, p = (a, rr) => [80 + rr * Math.cos(a), 80 + rr * Math.sin(a)];
    const [x0, y0] = p(a0, R), [x1, y1] = p(a1 - 1e-4, R), [x2, y2] = p(a1 - 1e-4, r), [x3, y3] = p(a0, r);
    if ((+it.v || 0) > 0) s += `<path class="cd-seg" style="--d:${i * 80}ms" d="M${x0} ${y0}A${R} ${R} 0 ${big} 1 ${x1} ${y1}${r ? `L${x2} ${y2}A${r} ${r} 0 ${big} 0 ${x3} ${y3}` : 'L80 80'}z" fill="${it.c}"><title>${cdEsc(it.l)}: ${cdFull(it.v)}</title></path>`;
    const m = (a0 + a1) / 2, [tx, ty] = p(m, r ? (R + r) / 2 : R * .6); if ((+it.v || 0) / tot > .06) s += `<text x="${tx}" y="${ty + 4}" class="cd-dl">${o.pct ? cdFull(it.v) + '%' : cdF(it.v)}</text>`;
    a0 = a1;
  });
  return `<div class="cd-donut"><svg viewBox="0 0 160 ${o.pie ? 172 : 160}" class="cd-svg${o.pie ? ' cd-pie' : ''}" role="img">${o.pie ? '<ellipse cx="80" cy="92" rx="62" ry="62" fill="rgba(0,0,0,.12)"/>' : ''}${s}</svg>${cdLegend(items.map(i => ({ name: i.l, color: i.c })))}</div>`;
}
const cdLegend = S => `<div class="cd-leg">${S.map(s => `<span><i style="background:${s.color}"></i>${cdEsc(s.name)}</span>`).join('')}</div>`;
const cdTile = (v, label, color) => `<div class="cd-tile" style="--c:${color}"><b data-count="${v == null ? '' : v}">${v == null ? '—' : Math.round(v).toLocaleString('en-GB')}</b><span>${cdEsc(label)}</span></div>`;
const cdCard = (title, body, cls = '') => `<div class="cd-card ${cls}"><h4>${title}</h4>${body}</div>`;
const cdEmpty = '<p class="cd-none">Not reported yet</p>';
const cdHas = (...v) => v.some(x => x != null && x !== 0);

/* ---------- the dashboard ---------- */
function ceoDashboard() {
  const C = ceoColumns(CEO.scope, CEO.month), ids = C.ids, Y = C.ytd, A = C.w1, B = C.w2, T = cdTables(ids, CEO.month);
  const mon = fmtMonth(CEO.month), months = ceoMonthsTo(CEO.month), MV = Object.fromEntries(months.map(m => [m, cdMonthVals(ids, m)]));
  const last4 = Array.from({ length: 4 }, (_, i) => { const d = new Date(+CEO.month.slice(0, 4), +CEO.month.slice(5) - 1 - (3 - i), 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); });
  const ml = m => new Date(m + '-01T00:00:00').toLocaleDateString('en-GB', { month: 'short' }), my = m => new Date(m + '-01T00:00:00').toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
  const s = CD_PAL.safety, e = CD_PAL.env, h = CD_PAL.health, c = CD_PAL.camp, g = CD_PAL.grey;
  const W12 = ['Weeks 1–2', 'Weeks 3–4'];
  const P = ceoProjects(CEO.scope), divs = [...new Set(P.map(p => p.division).filter(Boolean))];

  /* SAFETY */
  const inj = [['SI', 'si'], ['ODC', 'odc'], ['Fatalities', 'fat'], ['Days lost (RLTA + RLTI)', 'daysLost'], ['RLTI (1–7 days)', 'rlti'], ['RLTA (> 7 days)', 'rlta'], ['IMP', 'imp'], ['RWC', 'rwc'], ['MTC', 'mtc'], ['RTAC', 'rtac']];
  const rtacRows = T.rtacEntity ? Object.entries(T.rtacEntity).map(([k, v]) => ({ l: k, v: v.count, c: s[0] })) : divs.map(d => { const di = new Set(P.filter(p => p.division === d).map(p => p.id)); const [a, b] = ceoYtd(CEO.month); return { l: d, v: ceoAuto(di, a, b).rtac, c: s[0] }; });
  const injB = [['RTAC', 'rtac'], ['MTC', 'mtc'], ['RWC', 'rwc'], ['IMP', 'imp'], ['RLTA', 'rlta'], ['RLTI', 'rlti'], ['Days lost', 'daysLost'], ['Fatalities', 'fat'], ['ODC', 'odc'], ['SI', 'si']];
  const safety = `<section class="cd-band cd-safety"><header><span>Safety</span><small>OHS performance · ${mon}</small></header><div class="cd-grid">
   ${cdCard('Manpower / man-hours<br><small>Year to date</small>', `<div class="cd-stack">${cdTile(Y.manpower, 'Average manpower', s[0])}${cdTile(Y.manhours, 'Total man-hours worked', s[1])}</div>`, 'cd-narrow')}
   ${cdCard('OHS injuries · year to date', cdHbars(inj.map(([l, k], i) => ({ l, v: Y[k], c: s[i % s.length] })), { lw: 150 }))}
   ${cdCard('Road traffic accidents · year to date', rtacRows.length ? cdHbars(rtacRows, { lw: 90, rh: Math.max(14, Math.min(22, 300 / rtacRows.length)) }) : cdEmpty)}
   ${cdCard(`OHS injuries · bi-monthly ${mon}`, cdBars(injB.map(x => x[0]), [{ name: W12[0], vals: injB.map(x => A[x[1]]), color: s[0] }, { name: W12[1], vals: injB.map(x => B[x[1]]), color: s[2] }], { rot: 1, w: 420 }), 'cd-wide')}
   ${cdCard(`OHS NCRs · bi-monthly ${mon}`, cdBars(['YTD', ...W12], [['NCR minor', 'ncrMinor'], ['NCR major', 'ncrMajor'], ['NCR open', 'ncrOpen'], ['NCR closed', 'ncrClosed']].map(([n, k], i) => ({ name: n, vals: [Y[k], A[k], B[k]], color: s[i + 1] }))))}
  </div></section>`;

  /* ENVIRONMENT */
  const ser = k => months.map(m => MV[m][k] != null && MV[m][k] !== 0 ? MV[m][k] : null);
  const elec = ser('electricity'), water = ser('water'), fuel = months.map(m => MV[m].fuelL ?? (MV[m].diesel || null));
  const ghg = Y.ghg, off = Y.offsetGhg, net = ghg != null ? ghg + (off || 0) : null;
  const bullet = (t, a, lt = 'Target', la = 'Actual') => t == null && a == null ? cdEmpty : `<div class="cd-bul">${[[lt, t, e[2]], [la, a, e[0]]].map(([l, v, col]) => `<div><span>${l}</span><i style="--w:${Math.min(100, (v || 0) / Math.max(t || 0, a || 0, 1) * 100)}%;--c:${col}"></i><b>${cdF(v)}</b></div>`).join('')}</div>`;
  const env = `<section class="cd-band cd-env"><header><span>Environment</span><small>Resources, waste & emissions · ${CEO.month.slice(0, 4)}</small></header><div class="cd-grid">
   ${cdCard('Electricity consumption (kWh) · YTD ' + cdF(Y.electricity), elec.some(v => v != null) ? cdBars(months.map(ml), [{ name: 'kWh', vals: elec, color: e[0] }], { flat: 1, w: 380 }) : cdEmpty, 'cd-wide')}
   ${cdCard('Water consumption (m³) · YTD ' + cdF(Y.water), water.some(v => v != null) ? cdLine(months.map(ml), water, e[2], { w: 380 }) : cdEmpty, 'cd-wide')}
   ${cdCard('GHG emissions (CO₂e) · YTD', cdHas(ghg, off) ? cdHbars([{ l: 'Total GHG emission', v: ghg, c: e[0] }, { l: 'Offset (solar & recycling)', v: off, c: e[3] }, { l: 'Total less offset', v: net, c: e[2] }], { lw: 160 }) : cdEmpty)}
   ${cdCard('Fuel consumption (L) · YTD ' + cdF(Y.fuelL ?? Y.diesel), fuel.some(v => v) ? cdHbars(months.map((m, i) => ({ l: ml(m), v: fuel[i], c: e[1] })), { lw: 46, rh: 17 }) : cdEmpty)}
   ${cdCard('Waste (tonnes) · YTD', cdHas(Y.wasteGen, Y.wasteDiverted, Y.wasteDisposed, Y.wasteRecovered) ? cdHbars([{ l: 'Recovered', v: Y.wasteRecovered, c: e[4] }, { l: 'Disposed', v: Y.wasteDisposed, c: e[2] }, { l: 'Recycled', v: Y.wasteDiverted, c: e[1] }, { l: 'Generated', v: Y.wasteGen, c: e[3] }], { lw: 90 }) : cdEmpty)}
   ${cdCard('Environmental audits / inspections · YTD', bullet(Y.envAuditsTarget, Y.envAudits))}
   ${cdCard('Environmental observations · YTD', bullet(cdSum(Y.envObsOpen, Y.envObsClosed), Y.envObsClosed, 'Total', 'Closed') + (Y.envObsOpen != null ? `<p class="cd-sub">${cdF(Y.envObsOpen)} open</p>` : ''))}
   ${cdCard("Environmental NCRs · YTD", bullet(cdSum(Y.envNcrOpen, Y.envNcrClosed), Y.envNcrClosed, 'Total', 'Closed') + (Y.envNcrOpen != null ? `<p class="cd-sub">${cdF(Y.envNcrOpen)} open</p>` : ''))}
   ${cdCard('Environmental training · YTD', bullet(Y.envTrainTarget, Y.envTrain))}
  </div></section>`;

  /* HEALTH & MEDICAL */
  const med = [['Fatality case (NWR)', 'nwrFatal'], ['Occ. health surveillance', 'surveillance'], ['Health screening', 'screening'], ['Medical emergency referrals', 'referrals'], ['Medically unfit', 'unfit'], ['Hospitalised cases', 'hospitalized']];
  const health = `<section class="cd-band cd-health"><header><span>Health & medical</span><small>Clinic, screening and surveillance</small></header><div class="cd-grid">
   ${cdCard('Summary of medical cases · YTD', cdTile(Y.medicalCases, 'medical cases ' + CEO.month.slice(0, 4), h[0]), 'cd-narrow')}
   ${cdCard('Medical & health · year to date', cdHbars(med.map(([l, k], i) => ({ l, v: Y[k], c: h[i % h.length] })), { lw: 170, w: 560 }), 'cd-wide')}
   ${cdCard(`Medical & health · bi-monthly ${mon}`, cdBars(med.map(x => x[0].replace(' cases', '')), [{ name: W12[0], vals: med.map(x => A[x[1]]), color: h[0] }, { name: W12[1], vals: med.map(x => B[x[1]]), color: h[2] }], { rot: 1, w: 420 }), 'cd-wide')}
   ${cdCard(`Medical cases · bi-monthly ${mon}`, cdHas(Y.medicalCases, A.medicalCases, B.medicalCases) ? cdDonut([{ l: 'Year to date', v: Y.medicalCases, c: h[2] }, { l: W12[0], v: A.medicalCases, c: h[1] }, { l: W12[1], v: B.medicalCases, c: h[3] }]) : cdEmpty)}
  </div></section>`;

  /* CAMP */
  const campYtd = [['Incidents at camp', 'campIncidents'], ['Complaints / grievances', 'grievances'], ['Camp violations', 'campViolations'], ['Disciplinary actions', 'disciplinary'], ['Persons absconding', 'absconding']];
  const camp = `<section class="cd-band cd-camp"><header><span>Camp</span><small>Accommodation welfare & compliance</small></header><div class="cd-grid">
   ${cdCard('Inspections / observations at camp · YTD', cdBars(['HSSE inspections', 'HSSE observations'], [{ name: 'YTD', vals: [Y.campInsp, Y.campObs], color: c[0] }]))}
   ${cdCard('Camp incidents & discipline · YTD', cdBars(campYtd.map(x => x[0]), [{ name: 'YTD', vals: campYtd.map(x => Y[x[1]]), color: c[0] }], { rot: 1, flat: 1 }))}
   ${cdCard('Camp safety inductions · YTD', cdBars(['Inductions (new employees)', 'Induction attendees'], [{ name: 'YTD', vals: [Y.campInductions, Y.campAttendees], color: c[2] }], { flat: 1 }))}
   ${cdCard(`Safety induction · bi-monthly ${mon}`, cdHas(A.campInductions, B.campInductions, A.campAttendees, B.campAttendees) ? cdDonut([{ l: 'Inductions', v: cdSum(A.campInductions, B.campInductions), c: c[0] }, { l: 'Attendees', v: cdSum(A.campAttendees, B.campAttendees), c: c[3] }]) : cdEmpty)}
   ${cdCard(`Inspections / observations · bi-monthly ${mon}`, cdBars(['YTD', ...W12], [{ name: 'HSSE inspections', vals: [Y.campInsp, A.campInsp, B.campInsp], color: c[3] }, { name: 'HSSE observations', vals: [Y.campObs, A.campObs, B.campObs], color: c[0] }], { flat: 1 }))}
   ${cdCard('Camp audit performance index', cdHas(Y.campIdxInt, Y.campIdxExt) ? cdDonut([{ l: 'Internal', v: Y.campIdxInt, c: c[0] }, { l: 'External', v: Y.campIdxExt, c: c[3] }], { pie: 1, pct: 1 }) : cdEmpty)}
   ${cdCard('Mock drills conducted', cdBars(['YTD', ...W12], [{ name: 'Drills', vals: [Y.campDrills, A.campDrills, B.campDrills], color: c[2] }]))}
  </div></section>`;

  /* TRAINING · SECURITY · CCTV · LIFTING */
  const sec = [['Compliance team patrols', 'patrols'], ['Security inspection', 'secInsp'], ['Security incidents', 'secIncidents'], ['Escort to scrap yard', 'escortScrap'], ['Escort to hospital', 'escortHospital']];
  const sm = last4.filter(m => MV[m] ? sec.some(([, k]) => MV[m][k] != null) : false).slice(-3);
  const secVals = m => MV[m] || ceoManual(ids, m);
  const tab = (t, rows) => t ? Object.entries(t) : rows;
  const obsDiv = T.obsDivision ? Object.entries(T.obsDivision) : null, obsM = obsDiv ? [...new Set(obsDiv.flatMap(([, v]) => Object.keys(v)))].sort() : last4;
  const autoObs = (fn) => last4.map(m => { const [a, b] = [new Date(+m.slice(0, 4), +m.slice(5) - 1, 1).getTime(), new Date(+m.slice(0, 4), +m.slice(5), 1).getTime()]; return L.reports.filter(r => r.rt === 'Hazard' && ids.has(r.project) && (r.eventTs || r.ts) >= a && (r.eventTs || r.ts) < b).filter(fn).length; });
  const divSeries = obsDiv ? obsDiv.map(([d, v], i) => ({ name: d, vals: obsM.map(m => v[m] ?? null), color: cdGreyScale(i, obsDiv.length) }))
    : divs.map((d, i) => ({ name: d, vals: autoObs(r => (P.find(p => p.id === r.project) || {}).division === d), color: cdGreyScale(i, divs.length) }));
  const shiftT = T.obsShift, shM = shiftT ? [...new Set(Object.values(shiftT).flatMap(v => Object.keys(v)))].sort() : last4;
  const hr = r => new Date(r.eventTs || r.ts).getHours();
  const shiftS = shiftT ? Object.entries(shiftT).map(([n, v], i) => ({ name: n, vals: shM.map(m => v[m] ?? null), color: [g[2], g[1]][i % 2] }))
    : [{ name: 'Day', vals: autoObs(r => hr(r) >= 6 && hr(r) < 18), color: g[2] }, { name: 'Night', vals: autoObs(r => hr(r) < 6 || hr(r) >= 18), color: g[1] }];
  const stT = T.obsStatus, stM = stT ? [...new Set(Object.values(stT).flatMap(v => Object.keys(v)))].sort() : last4;
  const stS = stT ? Object.entries(stT).map(([n, v], i) => ({ name: n.replace(/^Number of |^Total Number of /i, '').replace(/^Observations? /i, ''), vals: stM.map(m => v[m] ?? null), color: [g[1], g[3], g[2]][i % 3] }))
    : [{ name: 'Total', vals: autoObs(() => true), color: g[1] }, { name: 'Closed', vals: autoObs(r => r.status === 'Closed'), color: g[3] }, { name: 'Open', vals: autoObs(r => r.status !== 'Closed'), color: g[2] }];
  const cams = T.cctvCams ? Object.entries(T.cctvCams).map(([d, v]) => ({ l: d, v: v.count, c: g[2] })) : divs.map(d => ({ l: d, v: P.filter(p => p.division === d).reduce((n, p) => n + (ceoManual(new Set([p.id]), CEO.month).cctvCams || 0), 0) || null, c: g[2] })).filter(x => x.v);
  const lift = [['Completed lift plans', 'liftPlans'], ['Lifts without incident', 'liftsOk'], ['Lifts with incident', 'liftsInc'], ['Lifts with unsafe acts', 'liftsUnsafe'], ['Lifting trainings', 'liftTraining']];
  const other = `<section class="cd-band cd-other"><header><span>Training · Security · Observations · Lifting</span><small>${mon}</small></header><div class="cd-grid">
   ${cdCard('IOSH training · year to date', cdBars(['IOSH Working Safely', 'IOSH Managing Safely'], [{ name: 'Target', vals: [Y.ioshWSTarget, Y.ioshMSTarget], color: CD_PAL.train[0] }, { name: 'Completed', vals: [Y.ioshWS, Y.ioshMS], color: CD_PAL.train[1] }], { flat: 1 }))}
   ${cdCard('Security performance for the month', sm.length ? cdBars(sec.map(x => x[0]), sm.map((m, i) => ({ name: my(m), vals: sec.map(x => secVals(m)[x[1]] ?? null), color: [g[2], g[1], g[3]][i] })), { rot: 1, w: 420 }) : cdEmpty, 'cd-wide')}
   ${cdCard('Observations per division', divSeries.length && divSeries.some(x => x.vals.some(v => v)) ? cdBars((obsDiv ? obsM : last4).map(my), divSeries, { w: 440, h: 230 }) : cdEmpty, 'cd-wide')}
   ${cdCard('Observations per shift', shiftS.some(x => x.vals.some(v => v)) ? cdBars(shM.map(my), shiftS) : cdEmpty)}
   ${cdCard('Observation status', stS.some(x => x.vals.some(v => v)) ? cdBars(stM.map(my), stS, { flat: 1 }) : cdEmpty)}
   ${cams.length ? cdCard('CCTV cameras in operation', cdHbars(cams, { lw: 140, rh: 18 })) : ''}
   ${cdCard('Lifting activities ' + CEO.month.slice(0, 4), cdBars(lift.map(x => x[0]), [{ name: 'YTD', vals: lift.map(x => Y[x[1]]), color: CD_PAL.lift[0] }, { name: W12[0], vals: lift.map(x => A[x[1]]), color: CD_PAL.lift[1] }, { name: W12[1], vals: lift.map(x => B[x[1]]), color: CD_PAL.lift[2] }], { rot: 1, w: 420 }), 'cd-wide')}
  </div></section>`;
  return `<div class="cd">${C.opening ? `<p class="cd-src">Year to date includes the uploaded workbook total up to ${fmtMonth(C.opening)}, plus everything reported after it.</p>` : ''}${safety}${env}${health}${camp}${other}</div>`;
}
const cdSum = (...v) => v.every(x => x == null) ? null : v.reduce((a, x) => a + (+x || 0), 0);
const cdGreyScale = (i, n) => { const t = n <= 1 ? 0 : i / (n - 1); return cdShade('#3b4452', t * 0.75); };

/* ---------- page: Dashboard | Table, plus "Upload workbook" ---------- */
CEO.mode = CEO.mode || 'dash';
const cdBasePage = ceoPage;
ceoPage = function () {
  let html = cdBasePage();
  if (!CEO_ON()) return html;
  const toggle = `<div class="cd-mode" role="tablist"><button data-cdmode="dash" aria-selected="${CEO.mode === 'dash'}">Dashboard</button><button data-cdmode="table" aria-selected="${CEO.mode === 'table'}">Table</button></div>`;
  html = html.replace('<div class="ceo-btns">', '<div class="ceo-btns">' + toggle + (isStaff() ? '<label class="btn cd-up">Upload CEO workbook<input type="file" id="cd-file" accept=".xlsx" hidden></label>' : ''));
  const imp = CDI.imp ? cdImportPanel() : '';
  if (CEO.mode === 'table') return html.replace('<div class="ceo-rates">', imp + '<div class="ceo-rates">');
  const a = html.indexOf('<div class="kpis ceo-tiles">'), b = html.indexOf('<p class="mx-muted ceo-note">');
  if (a < 0 || b < 0) return html;
  const entry = CEO.entry ? ceoEntryForm() : '';
  return html.slice(0, a).replace('<div class="ceo-rates">', imp + '<div class="ceo-rates">') + entry + ceoDashboard() + html.slice(b);
};

/* ---------- import the client's workbook ---------- */
const CDI = { imp: null, busy: false };
function cdImportPanel() {
  const d = CDI.imp, P = myProjects(), per = Object.entries(d.periods || {}).sort();
  const cnt = o => Object.keys(o || {}).length;
  return `<div class="panel cd-imp"><div class="nvi-head"><div><span class="nvi-eyebrow">Upload CEO workbook</span><h2>${cdEsc(d.name)}</h2><p>${d.fields.length} indicators found. Check the periods below, choose where to file them, then save.</p></div><button class="btn" data-cdimp-close>Close</button></div>
   <div class="tbl"><table><thead><tr><th>Period</th><th class="r">Year-to-date figures</th><th class="r">Weeks 1–2</th><th class="r">Weeks 3–4</th><th class="r">Monthly figures</th></tr></thead><tbody>
   ${[...new Set([...per.map(p => p[0]), ...Object.keys(d.monthly || {})])].sort().map(m => { const p = (d.periods || {})[m] || {}; return `<tr><td>${fmtMonth(m)}</td><td class="r">${cnt(p.opening) ? cnt(p.opening) + ' (total up to end of month)' : '—'}</td><td class="r">${cnt(p.h1) || '—'}</td><td class="r">${cnt(p.h2) || '—'}</td><td class="r">${cnt((d.monthly || {})[m]) || '—'}</td></tr>`; }).join('')}
   </tbody></table></div>
   <p class="mx-muted">${Object.keys(d.tables || {}).length ? 'Division tables: ' + Object.keys(d.tables).map(k => ({ cctvCams: 'CCTV cameras', obsDivision: 'observations per division', obsShift: 'observations per shift', obsStatus: 'observation status', rtacEntity: 'road traffic accidents per company' })[k] || k).join(', ') + '. ' : ''}${Object.keys(d.targets || {}).length ? 'Targets and year-to-date totals for training, environmental audits, NCRs and observations.' : ''}</p>
   <div class="mx-grid"><div class="fld"><label for="cd-proj">File these corporate figures under</label><select id="cd-proj" class="mx-in">${P.map(p => `<option value="${cdEsc(p.id)}" ${p.id === CDI.proj ? 'selected' : ''}>${cdEsc(p.name)}</option>`).join('')}</select><small class="mx-muted">They count in every scope that includes this project. Uploading again replaces the same periods.</small></div></div>
   <div class="nvi-foot"><div></div><button class="btn pri" data-cdimp-save ${CDI.busy ? 'disabled' : ''}>${CDI.busy ? 'Saving…' : 'Save to dashboard'}</button></div></div>`;
}
async function cdImportSave() {
  const d = CDI.imp, proj = document.getElementById('cd-proj')?.value || CDI.proj; if (!proj) { toast('Add a project first.'); return; }
  const wanted = [];
  Object.entries(d.periods || {}).forEach(([m, p]) => { if (Object.keys(p.opening || {}).length) wanted.push({ month: m, half: 0, opening: true, v: p.opening }); if (Object.keys(p.h1 || {}).length) wanted.push({ month: m, half: 1, v: p.h1 }); if (Object.keys(p.h2 || {}).length) wanted.push({ month: m, half: 2, v: p.h2 }); });
  Object.entries(d.monthly || {}).forEach(([m, v]) => wanted.push({ month: m, half: 0, v }));
  const lastOpen = Object.entries(d.periods || {}).filter(([, p]) => Object.keys(p.opening || {}).length).map(([m]) => m).sort().pop();
  if (Object.keys(d.targets || {}).length && lastOpen) { const o = wanted.find(w => w.opening && w.month === lastOpen); o.v = { ...o.v, ...d.targets }; }
  const tm = lastOpen || Object.keys(d.periods || {}).sort().pop() || CEO.month;
  if (Object.keys(d.tables || {}).length) wanted.push({ month: tm, half: 0, tables: d.tables, v: {} });
  CDI.busy = true; render();
  const same = (r, w) => r.kind === 'ceo' && r.project === proj && r.data && r.data.month === w.month && (r.data.half || 0) === w.half && !!r.data.opening === !!w.opening && !!r.data.tables === !!w.tables && !!r.data.imported;
  let ok = true;
  for (const w of wanted) {
    const data = { month: w.month, half: w.half, v: w.v, imported: true, by: L.me?.name || '', ...(w.opening ? { opening: true } : {}), ...(w.tables ? { tables: w.tables } : {}) };
    const rec = (L.records || []).find(r => same(r, w));
    const r = await liveSave(() => rec ? L.db.collection('records').doc(rec.id).update({ data, ts: Date.now() }) : L.db.collection('records').add({ project: proj, kind: 'ceo', ts: Date.now(), data, by: L.me.id }), null);
    if (r === false) { ok = false; break; }
    if (rec) rec.data = data; else if (!(L.records || []).some(x => same(x, w))) (L.records = L.records || []).push({ id: 'tmp' + Math.random(), project: proj, kind: 'ceo', ts: Date.now(), data });
  }
  CDI.busy = false;
  if (ok) { const ms = Object.entries(d.periods || {}).filter(([, p]) => Object.keys(p.h1 || {}).length || Object.keys(p.h2 || {}).length).map(([m]) => m).sort(); CEO.month = ms.pop() || tm; CDI.imp = null; CEO.mode = 'dash'; toast('Workbook saved to the dashboard'); }
  render();
}
document.addEventListener('change', async e => {
  if (e.target.id !== 'cd-file') return;
  const f = e.target.files[0]; if (!f) return;
  if (f.size > 1e7) { toast('The file must be smaller than 10 MB.'); return; }
  const b64 = await new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(f); });
  toast('Reading ' + f.name + '…');
  try {
    const token = L.db && L.db.token ? await L.db.token() : null;
    const r = await fetch('/api/ceoimport', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify({ file: b64 }) });
    const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'The file could not be read.');
    CDI.imp = { ...d, name: f.name }; CDI.proj = CDI.proj || (ceoProjects(CEO.scope)[0] || myProjects()[0] || {}).id;
  } catch (err) { toast(err.message); }
  e.target.value = ''; render();
});
document.addEventListener('click', e => {
  const t = e.target.closest('[data-cdmode],[data-cdimp-close],[data-cdimp-save]'); if (!t) return;
  e.preventDefault();
  if (t.dataset.cdmode) CEO.mode = t.dataset.cdmode;
  if (t.hasAttribute('data-cdimp-close')) CDI.imp = null;
  if (t.hasAttribute('data-cdimp-save')) return cdImportSave();
  render();
});
