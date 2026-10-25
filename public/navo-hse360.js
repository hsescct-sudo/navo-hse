'use strict';
/* HSE 360° Master Control: one command-centre screen (navy and gold), built from live NASS Safe Link records.
   Scope follows the organisation filter / user's projects (myProjects). */
const H3 = { sc: 'Corporation', site: '' };
const H3C = { gold: '#F2B705', green: '#3ECF5A', lime: '#9BE15D', amber: '#F7941D', red: '#E5383B', blue: '#2F80ED', cyan: '#23C2E6', navy: '#0B1626', panel: '#0E1B2E', line: 'rgba(120,160,210,.18)', text: '#E6EEF8', mute: '#8FA3BC' };
const h3e = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const h3n = v => v >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : v >= 1e4 ? Math.round(v / 1e3) + 'K' : Math.round(v || 0).toLocaleString('en-GB');
const h3pct = (a, b) => b ? Math.round(a / b * 100) : 0;

/* ---------- small SVG kit ---------- */
function h3Ring(val, max, color, big, sub, o = {}) {
  const r = 46, c = 2 * Math.PI * r, f = Math.max(0, Math.min(1, max ? val / max : 0));
  return `<svg viewBox="0 0 120 120" class="h3-ring"><circle cx="60" cy="60" r="${r}" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="${o.w || 9}"/><circle cx="60" cy="60" r="${r}" fill="none" stroke="${color}" stroke-width="${o.w || 9}" stroke-linecap="round" stroke-dasharray="${c * f} ${c}" transform="rotate(-90 60 60)" style="filter:drop-shadow(0 0 6px ${color}88)"/><text x="60" y="${sub ? 60 : 67}" text-anchor="middle" class="h3-rv">${h3e(big)}</text>${sub ? `<text x="60" y="79" text-anchor="middle" class="h3-rs">${h3e(sub)}</text>` : ''}</svg>`;
}
function h3Spark(vals, color, o = {}) {
  const W = o.w || 160, H = o.h || 34, mx = Math.max(1, ...vals), mn = Math.min(0, ...vals), n = Math.max(1, vals.length - 1);
  const pts = vals.map((v, i) => `${(i / n * W).toFixed(1)},${(H - 4 - (v - mn) / (mx - mn || 1) * (H - 8)).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${W} ${H}" class="h3-spark" preserveAspectRatio="none">${o.area ? `<polygon points="0,${H} ${pts} ${W},${H}" fill="${color}" opacity=".18"/>` : ''}<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2"/></svg>`;
}
function h3Gauge(val, color) {
  const f = Math.max(0, Math.min(1, val / 100)), a = Math.PI * (1 - f), x = 60 + 44 * Math.cos(a), y = 62 - 44 * Math.sin(a);
  return `<svg viewBox="0 0 120 74" class="h3-gauge"><path d="M16 62 A44 44 0 0 1 104 62" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="10"/><path d="M16 62 A44 44 0 0 1 104 62" fill="none" stroke="url(#h3gg)" stroke-width="10" stroke-dasharray="${138.2 * f} 200"/><defs><linearGradient id="h3gg"><stop offset="0" stop-color="${H3C.red}"/><stop offset=".5" stop-color="${H3C.gold}"/><stop offset="1" stop-color="${H3C.green}"/></linearGradient></defs><line x1="60" y1="62" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#fff" stroke-width="2.5"/><circle cx="60" cy="62" r="4" fill="#fff"/><text x="60" y="48" text-anchor="middle" class="h3-gv">${val}%</text></svg>`;
}
function h3Radar(vals, labels) {
  const n = vals.length, cx = 70, cy = 66, R = 52, pt = (i, f) => [cx + R * f * Math.sin(2 * Math.PI * i / n), cy - R * f * Math.cos(2 * Math.PI * i / n)];
  const grid = [.25, .5, .75, 1].map(f => `<polygon points="${vals.map((_, i) => pt(i, f).join(',')).join(' ')}" fill="none" stroke="rgba(255,255,255,.12)"/>`).join('');
  const shape = vals.map((v, i) => pt(i, Math.max(.05, v / 100)).join(',')).join(' ');
  return `<svg viewBox="0 0 140 132" class="h3-radar">${grid}<polygon points="${shape}" fill="${H3C.green}" fill-opacity=".35" stroke="${H3C.lime}" stroke-width="1.6"/>${vals.map((v, i) => { const [x, y] = pt(i, 1.18); return `<text x="${x}" y="${y}" text-anchor="middle" class="h3-rl">${h3e(labels[i])}</text>`; }).join('')}</svg>`;
}
function h3Combo(lbl, bars, line) {
  const W = 420, H = 190, pl = 34, pb = 22, n = lbl.length, bw = (W - pl) / n, mx = Math.max(1, ...bars.flat()), ml = Math.max(1, ...line);
  let s = '';
  [0, .25, .5, .75, 1].forEach(f => { const y = H - pb - f * (H - pb - 10); s += `<line x1="${pl}" x2="${W}" y1="${y}" y2="${y}" stroke="rgba(255,255,255,.07)"/><text x="${pl - 4}" y="${y + 3}" text-anchor="end" class="h3-ax">${Math.round(mx * f)}</text>`; });
  lbl.forEach((l, i) => { const x = pl + i * bw; bars.forEach((b, j) => { const h = b[i] / mx * (H - pb - 10); s += `<rect x="${x + bw * .14 + j * bw * .36}" y="${H - pb - h}" width="${bw * .32}" height="${h}" fill="${j ? H3C.lime : H3C.green}" rx="1.5"/>`; }); s += `<text x="${x + bw / 2}" y="${H - 6}" text-anchor="middle" class="h3-ax">${h3e(l)}</text>`; });
  const pts = line.map((v, i) => `${pl + i * bw + bw / 2},${H - pb - v / ml * (H - pb - 18)}`).join(' ');
  s += `<polyline points="${pts}" fill="none" stroke="#C9D6E8" stroke-width="1.6"/>` + line.map((v, i) => `<circle cx="${pl + i * bw + bw / 2}" cy="${H - pb - v / ml * (H - pb - 18)}" r="2.6" fill="#fff"/>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="h3-combo">${s}</svg>`;
}
function h3Donut(parts) {
  const tot = parts.reduce((a, p) => a + p[1], 0) || 1, r = 52, c = 2 * Math.PI * r; let off = 0;
  const seg = parts.map(([l, v, col]) => { const len = v / tot * c, s = `<circle cx="70" cy="70" r="${r}" fill="none" stroke="${col}" stroke-width="22" stroke-dasharray="${len} ${c - len}" stroke-dashoffset="${-off}" transform="rotate(-90 70 70)"><title>${h3e(l)}: ${v}</title></circle>`; off += len; return s; }).join('');
  return `<div class="h3-donut"><svg viewBox="0 0 140 140">${seg}<text x="70" y="68" text-anchor="middle" class="h3-rv">${tot}</text><text x="70" y="84" text-anchor="middle" class="h3-rs">events</text></svg><ul>${parts.map(([l, v, col]) => `<li><i style="background:${col}"></i>${h3e(l)} <b>${h3pct(v, tot)}%</b></li>`).join('')}</ul></div>`;
}

/* ---------- data ---------- */
function h3Data() {
  const P = (typeof myProjects === 'function' ? myProjects() : L.projects || []).filter(p => !H3.site || p.id === H3.site), ids = new Set(P.map(p => p.id));
  const now = Date.now(), y0 = new Date(new Date().getFullYear(), 0, 1).getTime(), DAY = 864e5;
  const R = (L.reports || []).filter(r => ids.has(r.project)), Ry = R.filter(r => (r.eventTs || r.ts) >= y0);
  const sev = r => (typeof sevOf === 'function' ? sevOf(r) : r.severity) || '';
  const LTI = ['Fatality', 'Serious Injury', 'Lost Time (> 7 days)', 'Lost Time'], REC = LTI.concat(['Restricted Work', 'Medical Treatment']);
  const inc = Ry.filter(r => r.rt === 'Incident'), rec = inc.filter(r => REC.includes(sev(r)));
  const Mo = (L.records || []).filter(r => r.kind === 'monthly' && ids.has(r.project) && r.data);
  const hrsOf = list => list.reduce((n, r) => n + (+r.data.empHours || 0) + (+r.data.conHours || 0), 0);
  const ym = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  const yKey = String(new Date().getFullYear()), hrsY = hrsOf(Mo.filter(r => String(r.data.month || '').startsWith(yKey)));
  const lastLti = R.filter(r => r.rt === 'Incident' && LTI.includes(sev(r))).reduce((m, r) => Math.max(m, r.eventTs || r.ts), 0);
  const safeDays = lastLti ? Math.floor((now - lastLti) / DAY) : Math.floor((now - y0) / DAY);
  const safeHrs = hrsOf(Mo.filter(r => !lastLti || (r.data.month || '') >= ym(new Date(lastLti))));
  const mult = (typeof hsKpiCfg === 'function' ? hsKpiCfg().mult : 2e5) || 2e5, trir = hrsY ? rec.length * mult / hrsY : 0;
  const A = (L.actions || []).filter(a => ids.has(a.project)), Ay = A.filter(a => a.ts >= y0), closed = Ay.filter(a => a.closedAt), overdue = A.filter(a => !a.closedAt && a.due && a.due < now);
  const I = (L.inspections || []).filter(i => ids.has(i.project) && i.ts >= y0), items = I.reduce((n, i) => n + (+i.items || 0), 0), fails = I.reduce((n, i) => n + (+i.fails || 0), 0);
  const insp = items ? Math.round((items - fails) / items * 100) : 0;
  const obs = Ry.filter(r => r.rt === 'Hazard' || r.rt === 'Good practice'), obsClosed = obs.filter(r => r.status === 'Closed'), pos = obs.filter(r => r.rt === 'Good practice').length;
  let trainC = 0; try { const ppl = rgRecs('tp').filter(p => ids.has(p.project) && p.data.status !== 'Demobilised'); let req = 0, ok = 0; const T = rgRecs('tr'); ppl.forEach(p => trRequired(p.data.position).forEach(c => { req++; const x = T.filter(t => t.data.person === p.id && t.data.course === c.id && t.data.result !== 'Fail').sort((a, b) => (b.data.date > a.data.date ? 1 : -1))[0]; if (x && (!x.data.expiry || x.data.expiry >= new Date().toISOString().slice(0, 10))) ok++; })); trainC = req ? Math.round(ok / req * 100) : 0; } catch (e) { }
  const ptw = I.filter(i => /permit|ptw|hot work|confined|excavat|isolation|loto/i.test(i.tpl || '')), ptwItems = ptw.reduce((n, i) => n + (+i.items || 0), 0), ptwC = ptwItems ? Math.round((ptwItems - ptw.reduce((n, i) => n + (+i.fails || 0), 0)) / ptwItems * 100) : 0;
  const walks = (L.activities || []).filter(a => ids.has(a.project) && a.ts >= y0 && /walk/i.test((a.type || a.kind || '') + ' ' + (a.title || ''))).length, walkPlan = P.reduce((n, p) => n + (+p.planWalk || 0), 0) * (new Date().getMonth() + 1);
  const nm = inc.filter(r => r.kind === 'Near Miss').length;
  /* months */
  const M = Array.from({ length: 12 }, (_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 11 + i); return d; });
  const inM = (t, d) => { const x = new Date(t); return x.getFullYear() === d.getFullYear() && x.getMonth() === d.getMonth(); };
  const mPos = M.map(d => R.filter(r => r.rt === 'Good practice' && inM(r.eventTs || r.ts, d)).length), mNeg = M.map(d => R.filter(r => r.rt === 'Hazard' && inM(r.eventTs || r.ts, d)).length), mInc = M.map(d => R.filter(r => r.rt === 'Incident' && inM(r.eventTs || r.ts, d)).length);
  const mClose = M.map(d => { const a = A.filter(x => inM(x.ts, d)); return h3pct(a.filter(x => x.closedAt).length, a.length); });
  const mInsp = M.map(d => { const x = (L.inspections || []).filter(i => ids.has(i.project) && inM(i.ts, d)), it = x.reduce((n, i) => n + (+i.items || 0), 0), f = x.reduce((n, i) => n + (+i.fails || 0), 0); return it ? Math.round((it - f) / it * 100) : 0; });
  const mObsC = M.map(d => { const x = R.filter(r => (r.rt === 'Hazard' || r.rt === 'Good practice') && inM(r.eventTs || r.ts, d)); return h3pct(x.filter(r => r.status === 'Closed').length, x.length); });
  /* projects */
  const score = p => { try { const m = ym(new Date()); const c = monthCard(p.id, m); return c && c.total != null ? +c.total : null; } catch (e) { return null; } };
  const projScores = P.map(p => [p, score(p)]).filter(x => x[1] != null).sort((a, b) => b[1] - a[1]);
  const health = projScores.length ? Math.round(projScores.reduce((n, x) => n + x[1], 0) / projScores.length) : 0;
  /* incident profile */
  const kinds = {}; inc.forEach(r => { const k = r.kind || 'Other'; kinds[k] = (kinds[k] || 0) + 1; });
  const pal = [H3C.blue, H3C.gold, H3C.red, '#9AA5B1', H3C.green, H3C.cyan, '#B57BFF'];
  const prof = Object.entries(kinds).sort((a, b) => b[1] - a[1]).slice(0, 7).map(([k, v], i) => [k, v, pal[i]]);
  /* risk heat map: severity (rows) x activity (columns) */
  const topic = r => (typeof v2Topic === 'function' ? v2Topic(r) : r.cat || 'Other');
  const tc = {}; Ry.filter(r => r.rt !== 'Good practice').forEach(r => { const t = topic(r); if (t !== 'Other') tc[t] = (tc[t] || 0) + 1; });
  const cols = Object.entries(tc).sort((a, b) => b[1] - a[1]).slice(0, 6).map(x => x[0]);
  const lvl = r => { const s = sev(r); if (['Fatality', 'Serious Injury'].includes(s)) return 5; if (LTI.includes(s)) return 4; if (['Restricted Work', 'Medical Treatment'].includes(s)) return 3; if (r.rt === 'Incident') return 2; return 1; };
  const heat = [5, 4, 3, 2, 1].map(l => cols.map(c => Ry.filter(r => r.rt !== 'Good practice' && topic(r) === c && lvl(r) === l).length));
  /* watch list */
  const pname = id => ((L.projects || []).find(p => p.id === id) || {}).name || '';
  const watch = overdue.map(a => ({ a, days: Math.floor((now - a.due) / DAY), pr: /high|critical|urgent/i.test(a.priority || '') ? 'High' : 'Normal' })).sort((x, y) => (y.pr === 'High') - (x.pr === 'High') || y.days - x.days).slice(0, 8);
  return { P, inc, rec, hrsY, safeDays, safeHrs, trir, mult, closed, Ay, overdue, insp, obs, obsClosed, pos, trainC, ptwC, walks, walkPlan, nm, M, mPos, mNeg, mInc, mClose, mInsp, mObsC, projScores, health, prof, cols, heat, watch, pname, lastLti };
}

/* ---------- page ---------- */
function h3Page() {
  const D = h3Data(), L12 = D.M.map(d => ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'][d.getMonth()]);
  const actC = h3pct(D.closed.length, D.Ay.length), obsC = h3pct(D.obsClosed.length, D.obs.length), posC = h3pct(D.pos, D.obs.length);
  const delta = a => { const n = a.length, x = a[n - 1] - a[n - 2]; return (x >= 0 ? '▲ +' : '▼ ') + x + '% vs last month'; };
  const heatCol = (v, l) => { if (!v) return 'rgba(255,255,255,.04)'; const r = l * Math.min(5, v); return r >= 15 ? H3C.red : r >= 8 ? H3C.amber : r >= 4 ? H3C.gold : H3C.green; };
  const kpi = (title, ring, foot, trend, to) => `<div class="h3-p h3-kpi h3-go" data-h3-go="${to || 'incm'}" title="Open ${h3e(title)} details"><h4>${title}</h4>${ring}<div class="h3-kf">${foot}</div>${trend || ''}</div>`;
  const card = (cls, ic, title, val, sub, spark, to) => `<div class="h3-card ${cls} h3-go" data-h3-go="${to}" title="Open ${h3e(title)}"><div class="h3-ch">${ic}<span>${title}</span></div><b>${val}%</b><small>${sub}</small>${spark}</div>`;
  const icon = p => `<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  const P = (typeof myProjects === 'function' ? myProjects() : []);
  return `<div class="h3">
  <header class="h3-head"><div class="h3-logo"><div class="h3-org cm-keep"><img src="${h3e(brand().logo||'brand/nass-logo.png')}" alt="${h3e(brand().name)}"></div><div><b>HSE 360°</b><span>MASTER CONTROL</span><small>${h3e(brand().name)}</small></div></div>
   <div class="h3-title"><h1>Safety &amp; Environmental Control</h1><p>Corporate HSE Command Center <i>|</i> Predictive Monitoring <i>|</i> Real-time Decision Support</p></div>
   <div class="h3-badges">${[['Live data & real time', '<path d="M3 12h4l3-8 4 16 3-8h4"/>'], ['Operational control', '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>'], ['Risk reduction', '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>'], ['ESG & environment', '<path d="M5 19c8 0 14-6 14-14-8 0-14 6-14 14z"/><path d="M5 19c3-5 6-8 10-10"/>']].map(([l, p]) => `<div class="h3-badge">${icon(p)}<span>${l}</span></div>`).join('')}</div>
   <div class="h3-slogan">Data Driven<br>Safer Tomorrow</div></header>
  ${P.length ? '' : `<div class="h3-empty"><b>No projects in view yet.</b> This screen reads live records from every project you can access. Add projects in Administration, or load the sample data from Settings to see it working.</div>`}
  <div class="h3-row h3-r1">
   ${kpi('Safe man-hours', h3Ring(Math.min(D.safeHrs, 1e7), 1e7, H3C.green, h3n(D.safeHrs), 'since last LTI'), `<span>${D.lastLti ? 'Last LTI ' + new Date(D.lastLti).toLocaleDateString('en-GB') : 'No LTI on record'}</span>`, h3Spark(D.mPos.map((v, i) => v + D.mNeg[i]), H3C.green))}
   ${kpi('Total incidents', h3Ring(D.inc.length, Math.max(10, D.inc.length * 1.4), H3C.amber, D.inc.length, 'year to date'), `<span>${D.nm} near misses · ${D.rec.length} recordable</span>`, h3Spark(D.mInc, H3C.amber))}
   ${kpi('TRIR', h3Ring(D.trir, 2, D.trir > 1 ? H3C.red : H3C.gold, D.trir.toFixed(2), 'per ' + (D.mult >= 1e6 ? '1M' : '200K') + ' h'), `<span>${h3n(D.hrsY)} man-hours YTD</span>`, h3Spark(D.mInc.map(v => v), D.trir > 1 ? H3C.red : H3C.gold))}
   ${kpi('Safe days', h3Ring(D.safeDays, 365, H3C.green, D.safeDays, 'days without LTI'), `<span>Target 365 days</span>`, `<div class="h3-bar"><i style="width:${Math.min(100, D.safeDays / 3.65)}%"></i></div>`)}
   <div class="h3-p h3-filter"><div class="h3-fh">${icon('<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-4 3-6 6-6s6 2 6 6M15 14c3 0 6 2 6 5"/>')}<div><small>Projects in view</small><b>${P.length}</b></div></div>
    <label>Site<select data-h3="site"><option value="">All sites</option>${P.map(p => `<option value="${h3e(p.id)}" ${H3.site === p.id ? 'selected' : ''}>${h3e(p.name)}</option>`).join('')}</select></label>
    <button class="h3-reset" data-h3-reset>↻ Reset</button>
    <div class="h3-gw"><small>Action closure</small>${h3Gauge(actC, H3C.gold)}</div></div>
   ${card('b', icon('<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>'), 'Observation closure', obsC, delta(D.mObsC), h3Spark(D.mObsC, '#9CC8FF', { area: 1 }), 'casehome')}
   ${card('g', icon('<path d="M5 19c8 0 14-6 14-14-8 0-14 6-14 14z"/>'), 'Inspection compliance', D.insp, delta(D.mInsp), h3Spark(D.mInsp, '#C8F5B0', { area: 1 }), 'inspm')}
   ${card('b', icon('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>'), 'Training compliance', D.trainC, 'Required courses valid', h3Spark(D.mClose, '#9CC8FF', { area: 1 }), 'train')}
  </div>
  <div class="h3-row h3-r2">
   <div class="h3-p"><h4>Enterprise HSE performance</h4><div class="h3-ep">${h3Ring(D.health, 100, H3C.green, D.health + '%', 'site health')}${h3Radar([D.health, actC, D.insp, D.trainC, posC], ['Health', 'Actions', 'Inspect', 'Training', 'Positive'])}${h3Ring(posC, 100, H3C.gold, posC + '%', 'positive obs.')}</div></div>
   <div class="h3-p h3-go" data-h3-go="m-trends" title="Open trend analysis"><h4>Observations & incidents · 12 months</h4>${h3Combo(L12, [D.mNeg, D.mPos], D.mInc)}<div class="h3-leg"><span><i style="background:${H3C.green}"></i>Unsafe</span><span><i style="background:${H3C.lime}"></i>Positive</span><span><i style="background:#C9D6E8"></i>Incidents</span></div></div>
   <div class="h3-p"><h4>Project HSE performance</h4><div class="h3-hb">${D.projScores.slice(0, 6).map(([p, s]) => `<div class="h3-go" data-h3-site="${h3e(p.id)}"><span title="Show only ${h3e(p.name)}">${h3e(p.name)}</span><i><em style="width:${Math.min(100, s)}%"></em></i><b>${s}%</b></div>`).join('') || '<p class="h3-none">No scores this month</p>'}</div><div class="h3-ax2"><span>0</span><span>25</span><span>50</span><span>75</span><span>100%</span></div></div>
   <div class="h3-p h3-go" data-h3-go="incm" title="Open incident management"><h4>Incident & event profile</h4>${D.prof.length ? h3Donut(D.prof) : '<p class="h3-none">No incidents this year</p>'}</div>
  </div>
  <div class="h3-row h3-r3">
   <div class="h3-p"><h4>Enterprise risk heat map</h4><div class="h3-heat"><div class="h3-hy">Severity</div><table>${D.heat.map((row, ri) => `<tr><th>${5 - ri}</th>${row.map(v => `<td style="background:${heatCol(v, 5 - ri)}">${v || ''}</td>`).join('')}</tr>`).join('')}<tr><th></th>${D.cols.map(c => `<th class="h3-hc">${h3e(c)}</th>`).join('')}</tr></table></div></div>
   <div class="h3-p h3-go" data-h3-go="lactions" title="Open action management"><h4>Executive priority watch list</h4><div class="h3-wl"><table><thead><tr><th>#</th><th>Action</th><th>Project</th><th>Owner</th><th>Priority</th><th>Overdue</th></tr></thead><tbody>${D.watch.map((w, i) => `<tr><td>${i + 1}</td><td>${h3e((w.a.title || '').slice(0, 60))}</td><td>${h3e(D.pname(w.a.project))}</td><td>${h3e(w.a.owner || '—')}</td><td><span class="h3-pr ${w.pr === 'High' ? 'hi' : ''}">${w.pr}</span></td><td>${w.days} d</td></tr>`).join('') || '<tr><td colspan="6">Nothing overdue</td></tr>'}</tbody></table></div></div>
   <div class="h3-p"><h4>Control effectiveness</h4><div class="h3-rings">${[[actC, 'Action closure', H3C.cyan], [D.insp, 'Inspection', H3C.cyan], [D.trainC, 'Training', H3C.cyan], [D.ptwC, 'Permit to work', H3C.green], [Math.min(100, h3pct(D.walks, D.walkPlan)), 'Leadership walks', H3C.green], [h3pct(D.nm, Math.max(1, D.inc.length)), 'Near-miss share', H3C.lime]].map(([v, l, c]) => `<div>${h3Ring(v, 100, c, v + '%', '', { w: 8 })}<span>${l}</span></div>`).join('')}</div></div>
  </div>
  <footer class="h3-foot"><span><i style="background:${H3C.green}"></i>On target</span><span><i style="background:${H3C.gold}"></i>Watch</span><span><i style="background:${H3C.amber}"></i>At risk</span><span><i style="background:${H3C.red}"></i>Critical</span><em>Live from NASS Safe Link · ${D.P.length} project${D.P.length === 1 ? '' : 's'} · updated ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</em><strong>Safer People · Stronger Business</strong></footer>
  </div>`;
}
document.addEventListener('change', e => { const t = e.target; if (t.dataset && t.dataset.h3 === 'site') { H3.site = t.value; render(); } });
document.addEventListener('click', e => { if (e.target.closest('[data-h3-reset]')) { H3.site = ''; render(); return; } if (e.target.closest('select,button,a')) return; const s = e.target.closest('[data-h3-site]'); if (s) { H3.site = s.dataset.h3Site; render(); return; } const g = e.target.closest('[data-h3-go]'); if (g && typeof go === 'function') go(g.dataset.h3Go); });
try { regModule({ id: 'hse360', title: 'HSE 360° Master Control', eyebrow: 'Command centre', headline: 'HSE 360°', desc: '', ents: [], tabs: [['all', 'Overview', () => h3Page()]] }); } catch (e) { console.error(e); }
try { rgNav('hse360', 'HSE 360° Master Control', '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/><path d="M3 12h2M19 12h2M12 3v2M12 19v2"/>', [['m-hse360', 'HSE 360° Master Control']], null); const i = NX_GROUPS.findIndex(g => g[0] === 'hse360'); if (i > 0) NX_GROUPS.unshift(NX_GROUPS.splice(i, 1)[0]); } catch (e) { console.error(e); }
try { if (typeof NAV_SECTIONS !== 'undefined') NAV_SECTIONS[0][1].unshift('hse360'); } catch (e) { }
