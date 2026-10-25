/* NASS Safe Link investigation studio.
   Four root cause methods with the same rhythm: pick on a visual, record evidence, read the result.
   Systems Wheel · 5 Whys · Fishbone · TapRooT®-style analysis.
   The result (root causes, contributing factors, actions) is saved on the incident and actions are created on request. */
'use strict';
const RCA = { by: {} };

/* ---------- Method definitions ---------- */
const RCA_METHODS_UI = [
  ['wheel', 'Systems Wheel', 'Energy, error-producing conditions and system factors'],
  ['whys', '5 Whys', 'Ask why until the system cause appears'],
  ['fish', 'Fishbone', 'Causes grouped by people, equipment, method and more'],
  ['tap', 'TapRooT®-style', 'Sequence of events, causal factors, root cause categories'],
];
const RCA_WHEEL = [
  { ring: 'Energy', items: ['Gravity', 'Motion', 'Mechanical', 'Electrical', 'Pressure', 'Temperature', 'Chemical', 'Biological', 'Radiation', 'Sound'].map(l => [l, 'Energy']) },
  { ring: 'Error-producing conditions', items: [
    ...['Information', 'Equipment', 'Complexity', 'Routine or unusual', 'Divided attention', 'Procedures', 'Unprepared', 'Time', 'Tools', 'Communication', 'Environment'].map(l => [l, 'Job']),
    ...['Physical capability', 'Fatigue', 'Stress', 'Workload', 'Training', 'Dilemmas'].map(l => [l, 'Person']),
    ...['Trade-offs', 'Supervision', 'Staffing levels', 'Unclear roles'].map(l => [l, 'Organisation'])] },
  { ring: 'System factors', items: ['Financial resources', 'Safety & risk management', 'Leadership & culture', 'Targets & objectives', 'Performance monitoring', 'Competence management', 'Organisational learning', 'Engineering design', 'Contractor management', 'Operations management', 'Maintenance management', 'HR management'].map(l => [l, 'System']) },
];
const RCA_FACTORS = RCA_WHEEL.flatMap((r, ri) => r.items.map(([label, group], i) => ({ id: ri + '-' + i, label, group, ring: ri })));
const RCA_COL = { Energy: ['#c9252d', '#a11b22'], Job: ['#17a34a', '#0f7f3a'], Person: ['#b27b4f', '#94613a'], Organisation: ['#d9a514', '#b68708'], System: ['#0b7cc6', '#0a5d9f'] };
const RCA_QUESTIONS = ['What source of energy was present?', 'How did the expected critical controls perform?', 'What challenging or difficult conditions were present?', 'How were those conditions created?', 'Considering that people make mistakes, are the critical controls enough?', 'What immediate actions close the critical control gaps?', 'What do we need to do differently or better?', 'Who needs to work together to drive the improvements?', 'How will we verify that the improvements work in practice?', 'Which other sites or activities should apply the learning?'];
const RCA_BONES = [['People', 'Competence, behaviour, fatigue, supervision'], ['Equipment', 'Plant, tools, guards, maintenance'], ['Method', 'Procedures, permits, sequence, planning'], ['Material', 'Substances, components, quality'], ['Environment', 'Weather, heat, lighting, layout'], ['Management', 'Leadership, resources, contractor control']];
const RCA_TAP = [['Procedures', 'Not used, wrong, confusing or missing'], ['Training', 'No training, inadequate or not understood'], ['Quality control', 'No inspection or inadequate verification'], ['Communications', 'Misunderstood, late, no handover'], ['Management system', 'Standards, policies, corrective action'], ['Human engineering', 'Workplace layout, environment, complexity'], ['Work direction', 'Preparation, selection, supervision']];
const RCA_TAP_FIX = { 'Procedures': 'Rewrite the procedure for the task, validate it with the crew and brief it before work resumes', 'Training': 'Deliver task-specific training with practical assessment and record competence', 'Quality control': 'Add an inspection / hold point that verifies the control before the next step', 'Communications': 'Introduce a structured handover and pre-task briefing with read-back', 'Management system': 'Update the management standard and assign ownership for compliance checks', 'Human engineering': 'Redesign the workplace or equipment to remove the error trap', 'Work direction': 'Strengthen job planning, crew selection and supervisor presence for the task' };

/* ---------- State ---------- */
function rcaState(r) {
  if (!RCA.by[r.id]) {
    const s = (r.investigation && r.investigation.studio) || {};
    RCA.by[r.id] = { method: s.method || 'wheel', problem: s.problem || r.desc || '', wheel: s.wheel || { a: {}, q: {}, sel: null }, whys: s.whys || [{ w: '', e: '' }, { w: '', e: '' }, { w: '', e: '' }], whyRoot: s.whyRoot ?? null, fish: s.fish || { sel: 'People', c: {} }, tap: s.tap || { ev: [{ t: '', e: '', cf: false, cat: [] }] }, own: s.own || {}, done: s.done || {} };
  }
  const W = RCA.by[r.id].wheel; if (!Array.isArray(W.picked)) W.picked = Object.keys(W.a || {}).filter(k => W.a[k] && W.a[k].status && W.a[k].status !== 'Not relevant');
  return RCA.by[r.id];
}
function rcaSet(obj, path, v) { const p = path.split('.'); let o = obj; p.slice(0, -1).forEach(k => { if (o[k] == null) o[k] = /^\d+$/.test(k) ? [] : {}; o = o[k]; }); o[p.at(-1)] = v; }

/* ---------- Result ---------- */
function rcaResult(S) {
  const res = { root: [], contrib: [], energy: [], actions: [] };
  const act = (type, title, days) => res.actions.push({ type, title, days });
  if (S.method === 'wheel') {
    RCA_FACTORS.forEach(f => {
      const a = S.wheel.a[f.id]; if (!a || !a.status || a.status === 'Not relevant') return;
      const line = f.label + (a.evidence ? ' — ' + a.evidence : '');
      if (f.ring === 0) res.energy.push(line);
      else if (f.ring === 2 && a.status === 'Gap identified') res.root.push(line);
      else res.contrib.push(line);
      if (a.status === 'Gap identified' && f.ring > 0) {
        act('Corrective', (S.wheel.q[5] || 'Restore and verify ' + (a.control || 'the failed control')) + ' (' + f.label + ')', 3);
        act('Preventative', (S.wheel.q[6] || 'Review the ' + f.label.toLowerCase() + ' arrangements and update controls, roles and checks') + ' (' + f.label + ')', 30);
      }
    });
    if (res.root.length) act('Preventative', S.wheel.q[9] || 'Share the learning and check similar activities on other sites for the same gaps', 30);
  }
  if (S.method === 'whys') {
    const W = S.whys.filter(x => x.w.trim()); const ri = S.whyRoot != null && W[S.whyRoot] ? S.whyRoot : W.length - 1;
    W.forEach((x, i) => (i === ri ? res.root : res.contrib).push(`Why ${i + 1}: ${x.w}${x.e ? ' (evidence: ' + x.e + ')' : ''}`));
    if (W[0]) act('Corrective', 'Remove the immediate cause: ' + W[0].w, 3);
    if (W[ri]) act('Preventative', 'Address the root cause: ' + W[ri].w, 30);
  }
  if (S.method === 'fish') {
    RCA_BONES.forEach(([b]) => (S.fish.c[b] || []).filter(c => c.t.trim()).forEach(c => (c.root ? res.root : res.contrib).push(b + ': ' + c.t)));
    RCA_BONES.forEach(([b]) => (S.fish.c[b] || []).filter(c => c.t.trim() && c.root).forEach(c => act('Preventative', `Eliminate the ${b.toLowerCase()} root cause: ${c.t}`, 30)));
    const firstContrib = RCA_BONES.flatMap(([b]) => (S.fish.c[b] || []).filter(c => c.t.trim() && !c.root).map(c => [b, c]))[0];
    if (firstContrib) act('Corrective', `Control the contributing ${firstContrib[0].toLowerCase()} factor: ${firstContrib[1].t}`, 7);
  }
  if (S.method === 'tap') {
    S.tap.ev.filter(e => e.t.trim()).forEach(e => {
      if (!e.cf) return; res.contrib.push('Causal factor: ' + e.t);
      (e.cat || []).forEach(c => { res.root.push(c + ' — ' + e.t); act('Preventative', RCA_TAP_FIX[c] + ' (' + e.t + ')', 30); });
    });
    const cf = S.tap.ev.find(e => e.cf && e.t.trim()); if (cf) act('Corrective', 'Make the activity safe before restart: ' + cf.t, 3);
  }
  return res;
}

/* ---------- Visuals ---------- */
function rcaArc(cx, cy, r0, r1, a0, a1) {
  const p = (r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)]; const L = a1 - a0 > Math.PI ? 1 : 0;
  const [x0, y0] = p(r1, a0), [x1, y1] = p(r1, a1), [x2, y2] = p(r0, a1), [x3, y3] = p(r0, a0);
  return `M${x0.toFixed(1)} ${y0.toFixed(1)}A${r1} ${r1} 0 ${L} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}A${r0} ${r0} 0 ${L} 0 ${x3.toFixed(1)} ${y3.toFixed(1)}Z`;
}
function rcaWheelSvg(S) {
  const C = 260, R = [[64, 132], [138, 196], [202, 254]]; let out = '';
  RCA_WHEEL.forEach((ring, ri) => {
    const n = ring.items.length, step = 2 * Math.PI / n, off = -Math.PI / 2;
    ring.items.forEach(([label, group], i) => {
      const id = ri + '-' + i, a0 = off + i * step, a1 = a0 + step, mid = (a0 + a1) / 2, st = S.wheel.a[id]?.status, sel = S.wheel.picked.includes(id);
      const col = RCA_COL[group][i % 2], lift = sel ? 7 : 0, dx = Math.cos(mid) * lift, dy = Math.sin(mid) * lift;
      const rm = (R[ri][0] + R[ri][1]) / 2, tx = C + Math.cos(mid) * rm, ty = C + Math.sin(mid) * rm;
      const words = label.split(' '); const lines = ri === 1 ? [label.length > 13 ? words.slice(0, Math.ceil(words.length / 2)).join(' ') : label, label.length > 13 ? words.slice(Math.ceil(words.length / 2)).join(' ') : ''].filter(Boolean) : words.length > 1 && label.length > 10 ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')] : [label];
      const deg = mid * 180 / Math.PI, rot = ri === 1 ? (Math.cos(mid) < 0 ? deg + 180 : deg) : 0, fs = ri === 1 ? 7.4 : ri === 0 ? 9 : 8.6;
      const mark = st === 'Gap identified' ? '#ff4d4f' : st === 'Contributed' ? '#ffb020' : '';
      out += `<g class="rcw-seg ${sel ? 'is-sel' : ''} ${st && st !== 'Not relevant' ? 'is-set' : ''}" data-rcw="${id}" transform="translate(${dx.toFixed(1)} ${dy.toFixed(1)})" role="button" tabindex="0" aria-label="${esc(label)}${st ? ', ' + esc(st) : ''}">
        <path d="${rcaArc(C, C, R[ri][0], R[ri][1], a0, a1)}" fill="${col}" stroke="#fff" stroke-width="${sel ? 3 : 1.2}"/>
        <text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" transform="rotate(${rot.toFixed(1)} ${tx.toFixed(1)} ${ty.toFixed(1)})" font-size="${fs}" fill="#fff" text-anchor="middle" font-weight="600">${lines.map((l, k) => `<tspan x="${tx.toFixed(1)}" dy="${k ? fs + 1.5 : -(lines.length - 1) * (fs + 1.5) / 2 + fs / 3}">${esc(l)}</tspan>`).join('')}</text>
        ${mark ? `<circle cx="${(C + Math.cos(mid) * (R[ri][1] - 9)).toFixed(1)}" cy="${(C + Math.sin(mid) * (R[ri][1] - 9)).toFixed(1)}" r="5" fill="${mark}" stroke="#fff" stroke-width="1.5"/>` : ''}
      </g>`;
    });
  });
  return `<svg class="rca-wheel" viewBox="0 0 520 520" aria-label="Systems wheel"><defs><radialGradient id="rcwc"><stop offset="0" stop-color="#d6343b"/><stop offset="1" stop-color="#7d1418"/></radialGradient></defs>${out}<circle cx="${C}" cy="${C}" r="58" fill="url(#rcwc)" stroke="#fff" stroke-width="2"/><text x="${C}" y="${C + 5}" text-anchor="middle" fill="#fff" font-size="15" font-weight="800">Energy</text></svg>`;
}
function rcaFishSvg(S) {
  const bones = RCA_BONES.map(([b], i) => { const top = i < 3, x = 120 + (i % 3) * 170; return { b, x, top }; });
  return `<svg class="rca-fish" viewBox="0 0 720 330" aria-label="Fishbone diagram">
    <defs><linearGradient id="fsp" x1="0" x2="1"><stop offset="0" stop-color="#1c3f6e"/><stop offset="1" stop-color="#0c1f3c"/></linearGradient></defs>
    <path d="M30 165H610" stroke="url(#fsp)" stroke-width="7" stroke-linecap="round"/>
    <path d="M610 120L700 165L610 210Z" fill="#0c1f3c"/><text x="645" y="170" fill="#fff" font-size="11" font-weight="700" text-anchor="middle">Event</text>
    ${bones.map(({ b, x, top }) => { const y = top ? 40 : 290, sel = S.fish.sel === b, n = (S.fish.c[b] || []).filter(c => c.t.trim()).length, roots = (S.fish.c[b] || []).filter(c => c.t.trim() && c.root).length;
      return `<g class="rcf-bone ${sel ? 'is-sel' : ''}" data-rcfish="${b}" role="button" tabindex="0"><path d="M${x} ${y}L${x + 80} 165" stroke="transparent" stroke-width="30"/><path d="M${x} ${y}L${x + 80} 165" style="stroke:${sel ? 'var(--ac)' : '#3a5f8f'}" stroke-width="${sel ? 6 : 4}" stroke-linecap="round"/>
       <rect x="${x - 58}" y="${top ? y - 30 : y}" width="116" height="30" rx="9" style="fill:${sel ? 'var(--ac)' : '#fff'};stroke:${sel ? 'var(--ac-2)' : '#c9d6e6'}"/><text x="${x}" y="${top ? y - 10 : y + 20}" text-anchor="middle" font-size="12" font-weight="700" style="fill:${sel ? 'var(--ac-ink)' : '#122033'}">${b}${n ? ` · ${n}` : ''}</text>
       ${roots ? `<circle cx="${x + 54}" cy="${top ? y - 30 : y}" r="9" fill="#e5484d"/><text x="${x + 54}" y="${(top ? y - 30 : y) + 4}" text-anchor="middle" font-size="10" fill="#fff" font-weight="800">${roots}</text>` : ''}
       ${(S.fish.c[b] || []).filter(c => c.t.trim()).slice(0, 3).map((c, k) => { const t = (k + 1) / 4, px = x + 80 * t, py = y + (165 - y) * t; return `<text x="${(px + 6).toFixed(0)}" y="${(py + 4).toFixed(0)}" font-size="9.5" fill="${c.root ? '#c42b30' : '#3c4f66'}" font-weight="${c.root ? 700 : 500}">${esc(c.t.length > 24 ? c.t.slice(0, 23) + '…' : c.t)}</text>`; }).join('')}</g>`; }).join('')}
  </svg>`;
}

/* ---------- Panels ---------- */
function rcaWheelPanel(S, rid) {
  const picked = RCA_FACTORS.filter(f => S.wheel.picked.includes(f.id));
  const ringName = f => f.ring === 0 ? 'Energy source' : f.ring === 2 ? 'System factor' : f.group + ' factor';
  return `<div class="rca-grid"><div class="rca-visual">${rcaWheelSvg(S)}<div class="rca-legend"><span><i style="background:#c9252d"></i>Energy</span><span><i style="background:#17a34a"></i>Job</span><span><i style="background:#b27b4f"></i>Person</span><span><i style="background:#d9a514"></i>Organisation</span><span><i style="background:#0b7cc6"></i>System</span><span><i class="dot r"></i>Gap</span><span><i class="dot a"></i>Contributed</span></div>
    <p class="rca-tip">Tap every segment that played a part. Tap again to remove it.</p></div>
   <div class="rca-side"><div class="rca-picked-h"><b>${picked.length} selected</b>${picked.length ? `<button class="rca-clear" data-rcclear>Clear all</button>` : ''}</div>
    ${picked.length ? picked.map(f => { const a = S.wheel.a[f.id] = S.wheel.a[f.id] || { status: 'Contributed' }; return `<div class="rca-card rca-pick r${f.ring}"><div class="rca-pick-h"><span class="rca-kicker">${esc(ringName(f))}</span><button class="rca-x" data-rcw="${f.id}" aria-label="Remove ${esc(f.label)}">×</button></div><h4>${esc(f.label)}</h4>
      <div class="rca-seg two">${['Contributed', 'Gap identified'].map(v => `<button data-rcset="wheel.a.${f.id}.status" data-v="${v}" aria-pressed="${a.status === v}">${v}</button>`).join('')}</div>
      <div class="fld"><label>Evidence</label><textarea class="mx-in" rows="2" data-rcf="wheel.a.${f.id}.evidence" data-rid="${rid}" placeholder="What did the investigation find?">${esc(a.evidence || '')}</textarea></div>
      <div class="fld"><label>${f.ring === 0 ? 'Critical control that should stop this energy' : 'Expected control or condition'}</label><input class="mx-in" data-rcf="wheel.a.${f.id}.control" data-rid="${rid}" value="${esc(a.control || '')}"></div></div>`; }).join('')
    : `<div class="rca-card rca-hint"><h4>Select the parts of the wheel</h4><p>Start with the energy that caused harm, then every condition that made the error likely, then the system factors behind them. You can select as many as apply.</p></div>`}
    <details class="rca-q"><summary>Leadership questions (${Object.values(S.wheel.q).filter(v => v && v.trim()).length}/10)</summary>${RCA_QUESTIONS.map((q, i) => `<div class="fld"><label>${i + 1}. ${q}</label><textarea class="mx-in" rows="2" data-rcf="wheel.q.${i}" data-rid="${rid}">${esc(S.wheel.q[i] || '')}</textarea></div>`).join('')}</details></div></div>`;
}
function rcaWhysPanel(S, rid) {
  return `<div class="rca-whys"><div class="fld"><label>Problem statement</label><textarea class="mx-in" rows="2" data-rcf="problem" data-rid="${rid}">${esc(S.problem)}</textarea></div>
   <ol class="rca-stairs">${S.whys.map((x, i) => `<li style="--i:${i}" class="${(S.whyRoot ?? -1) === i ? 'is-root' : ''}"><div class="rca-step"><span class="rca-why">Why ${i + 1}?</span>
     <input class="mx-in" data-rcf="whys.${i}.w" data-rid="${rid}" value="${esc(x.w)}" placeholder="${i === 0 ? 'Why did the event happen?' : 'Why did that happen?'}">
     <input class="mx-in ev" data-rcf="whys.${i}.e" data-rid="${rid}" value="${esc(x.e)}" placeholder="Evidence that confirms it">
     <button class="rca-rootbtn" data-rcwhyroot="${i}" aria-pressed="${(S.whyRoot ?? -1) === i}">${(S.whyRoot ?? -1) === i ? '★ Root cause' : 'Mark as root cause'}</button></div></li>`).join('')}</ol>
   <div class="filters">${S.whys.length < 7 ? '<button class="btn" data-rcwhyadd>+ Ask why again</button>' : ''}${S.whys.length > 1 ? '<button class="btn" data-rcwhydel>Remove last</button>' : ''}<span class="mx-muted">Stop when the answer is a system or management cause you can fix.</span></div></div>`;
}
function rcaFishPanel(S, rid) {
  const b = S.fish.sel, list = S.fish.c[b] = S.fish.c[b] || [];
  return `<div class="rca-grid fish"><div class="rca-visual">${rcaFishSvg(S)}</div><div class="rca-side"><div class="rca-card"><span class="rca-kicker">Category</span><h4>${esc(b)}</h4><p class="mx-muted">${esc(RCA_BONES.find(x => x[0] === b)[1])}</p>
    ${list.map((c, i) => `<div class="rca-cause"><input class="mx-in" data-rcf="fish.c.${b}.${i}.t" data-rid="${rid}" value="${esc(c.t)}" placeholder="Cause"><button class="rca-star" data-rcfroot="${b}.${i}" aria-pressed="${!!c.root}" title="Root cause">★</button><button class="rca-x" data-rcfdel="${b}.${i}" aria-label="Remove">×</button></div>`).join('')}
    <button class="btn" data-rcfadd="${b}">+ Add cause</button><p class="mx-muted">★ marks a root cause. Unmarked causes are contributing factors.</p></div></div></div>`;
}
function rcaTapPanel(S, rid) {
  return `<div class="rca-tap"><p class="mx-muted">1 · Build the sequence of events. 2 · Flag the causal factors. 3 · Choose the root cause categories for each causal factor.</p>
   <div class="rca-timeline">${S.tap.ev.map((e, i) => `<div class="rca-ev ${e.cf ? 'is-cf' : ''}"><span class="rca-evn">${i + 1}</span>
     <input class="mx-in" data-rcf="tap.ev.${i}.t" data-rid="${rid}" value="${esc(e.t)}" placeholder="What happened?"><input class="mx-in ev" data-rcf="tap.ev.${i}.e" data-rid="${rid}" value="${esc(e.e)}" placeholder="Time / evidence">
     <button class="rca-cf" data-rctapcf="${i}" aria-pressed="${!!e.cf}">${e.cf ? '⚠ Causal factor' : 'Flag causal factor'}</button>
     ${e.cf ? `<div class="rca-cats">${RCA_TAP.map(([c, d]) => `<button data-rctapcat="${i}" data-v="${c}" aria-pressed="${(e.cat || []).includes(c)}" title="${esc(d)}">${c}</button>`).join('')}</div>` : ''}</div>`).join('<i class="rca-arrow" aria-hidden="true"></i>')}</div>
   <div class="filters"><button class="btn" data-rctapadd>+ Add event</button>${S.tap.ev.length > 1 ? '<button class="btn" data-rctapdel>Remove last</button>' : ''}<span class="mx-muted">TapRooT® is a registered trademark of System Improvements, Inc. This is a simplified structure, not the licensed root cause dictionary.</span></div></div>`;
}
function rcaResultCard(S, r) {
  const R = rcaResult(S); const owner = r.contractor ? r.contractor + ' supervisor' : 'Area supervisor';
  const existing = new Set(L.actions.filter(a => a.sourceId === r.id || a.report === r.id).map(a => a.title));
  return `<div class="rca-result"><div class="rca-result-h"><span class="rca-kicker">Result</span><h4>${R.root.length ? 'Root cause identified' : 'Analysis in progress'}</h4></div>
   <div class="rca-cols">
    <div><h5>Root causes</h5>${R.root.length ? `<ul>${R.root.map(x => `<li class="root">${esc(x)}</li>`).join('')}</ul>` : '<p class="mx-muted">None yet.</p>'}</div>
    <div><h5>Contributing factors</h5>${R.contrib.length ? `<ul>${R.contrib.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p class="mx-muted">None yet.</p>'}${R.energy.length ? `<h5>Energy</h5><ul>${R.energy.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}</div>
    <div><h5>Recommended actions</h5>${R.actions.length ? R.actions.map((a, i) => `<div class="rca-act ${existing.has(a.title) ? 'is-done' : ''}"><span class="rca-type ${a.type === 'Corrective' ? 'c' : 'p'}">${a.type}</span><p>${esc(a.title)}</p><div><input class="mx-in" data-rcf="own.${i}" data-rid="${r.id}" value="${esc(S.own[i] ?? owner)}" aria-label="Owner"><em>${a.days} days</em>${existing.has(a.title) ? '<b>Created</b>' : ''}</div></div>`).join('') : '<p class="mx-muted">Actions appear when causes are recorded.</p>'}</div>
   </div>
   <div class="filters"><button class="btn" data-rcsave="${r.id}">Save investigation</button>${R.actions.some(a => !existing.has(a.title)) && isStaff() ? `<button class="btn pri" data-rcact="${r.id}">Create ${R.actions.filter(a => !existing.has(a.title)).length} actions</button>` : ''}</div></div>`;
}
function rcaStudio(r) {
  if (!isStaff()) return '';
  const S = rcaState(r);
  const body = S.method === 'wheel' ? rcaWheelPanel(S, r.id) : S.method === 'whys' ? rcaWhysPanel(S, r.id) : S.method === 'fish' ? rcaFishPanel(S, r.id) : rcaTapPanel(S, r.id);
  return `<section class="rca" data-rca="${r.id}"><div class="rca-head"><div><span class="rca-kicker">Root cause analysis</span><h3>Investigation studio</h3></div></div>
   <div class="rca-methods" role="tablist">${RCA_METHODS_UI.map(([id, t, d], i) => `<button role="tab" data-rcm="${id}" aria-selected="${S.method === id}"><span class="rca-mi m${i}"></span><b>${t}</b><small>${d}</small></button>`).join('')}</div>
   ${S.method !== 'whys' ? `<div class="fld rca-problem"><label>Problem statement</label><textarea class="mx-in" rows="2" data-rcf="problem" data-rid="${r.id}">${esc(S.problem)}</textarea></div>` : ''}
   ${body}${rcaResultCard(S, r)}</section>`;
}

/* ---------- Save ---------- */
async function rcaSave(id, quiet) {
  const r = L.reports.find(x => x.id === id); if (!r) return; const S = rcaState(r); const R = rcaResult(S);
  const name = RCA_METHODS_UI.find(m => m[0] === S.method)[1];
  const inv = { ...(r.investigation || {}), ...rcaPayload(r) }; r.investigation = inv;
  return liveSave(() => L.db.collection('reports').doc(id).update({ investigation: inv, history: hist(r, `Investigation saved (${name})`) }), quiet ? undefined : 'Investigation saved');
}
async function rcaActions(id) {
  const r = L.reports.find(x => x.id === id); if (!r) return; const S = rcaState(r); const R = rcaResult(S);
  const owner0 = r.contractor ? r.contractor + ' supervisor' : 'Area supervisor';
  const existing = new Set(L.actions.filter(a => a.sourceId === id || a.report === id).map(a => a.title));
  const todo = R.actions.map((a, i) => [a, i]).filter(([a]) => !existing.has(a.title));
  await rcaSave(id, true);
  await liveSave(async () => {
    for (const [a, i] of todo) {
      const own = (S.own[i] ?? owner0).trim() || owner0;
      await L.db.collection('actions').add({ title: a.title.slice(0, 300), project: r.project, owner: own, contractor: r.contractor || null, due: Date.now() + a.days * 864e5, priority: a.type === 'Corrective' ? 'High' : 'Normal', report: id, ts: Date.now(), by: L.me.id, closedAt: null, status: 'Assigned', source: 'Incident investigation', sourceId: id,
        history: [{ ts: Date.now(), by: L.me?.name || '', what: `${a.type} action from root cause analysis · assigned to ${own}` }] });
    }
  }, `${todo.length} action${todo.length === 1 ? '' : 's'} created and assigned`);
}

/* ---------- Wiring ---------- */
/* Incident record: what happened, the investigation and the actions on one page, in that order. */
function rcaPayload(r) {
  const S = rcaState(r), R = rcaResult(S), name = RCA_METHODS_UI.find(m => m[0] === S.method)[1];
  return { studio: JSON.parse(JSON.stringify(S)), rca: name, root: R.root.join('\n'), contributing: R.contrib.join('\n') };
}
incDetail = function (r) {
  const s = nStage(r), cl = nClass(r), inv = r.investigation || {}, A = L.actions.filter(a => a.sourceId === r.id || a.report === r.id), canMed = canVerify(), edit = isStaff() && s !== 'Closed';
  const next = { Notification: 'Registration', Registration: 'Classification', Classification: 'Investigation', Investigation: 'Management review', 'Management review': 'Approval', Approval: 'Corrective actions', 'Corrective actions': 'Verification', Verification: 'Closed' }[s];
  const needV = ['Approval', 'Verification', 'Closed'].includes(next);
  const p = L.projects.find(x => x.id === r.project) || {};
  const sev = sevOf(r);
  const facts = [['Date & time', new Date(r.eventTs || r.ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })], ['Project', projName(r.project)], ['Platform / division', [p.platform, divName(r.project)].filter(Boolean).join(' · ')], ['Location', r.loc || '—'], ['Contractor', r.contractor || '—'], ['Classification', cl + (r.incClass ? ' · ' + r.incClass : '')], ['Activity / department', [r.dept, r.cat].filter(Boolean).join(' · ') || '—']];
  const keep = INV_F.filter(([k]) => ['response', 'witnesses', 'lessons', 'review'].includes(k));
  return `<div class="panel mx-detail rci">
   <div class="nvi-head"><div><span class="nvi-eyebrow">${ref('INC', r)} · ${esc(s)}</span><h2>${esc(cl)}</h2><p>${esc(r.desc || '')}</p></div><button class="btn" data-nclose-d>Close</button></div>
   ${flowBar(N_STEPS, s)}
   <div class="rci-grid"><div class="rca-card"><h4>What happened</h4><dl class="rci-dl">${facts.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}
     ${sev ? (canMed ? `<dt>Injured person</dt><dd>${esc([r.personType, r.injuryType, r.bodyPart].filter(Boolean).join(' · '))}${r.lostDays ? ' · ' + r.lostDays + ' lost days' : ''}</dd>` : `<dt>Injury details</dt><dd class="mx-muted">Restricted to HSE staff</dd>`) : ''}
     ${r.photo ? `<dt>Photo</dt><dd><button class="linkbtn" data-photo="${esc(r.photo)}">Open photo</button></dd>` : ''}</dl></div>
    <div class="rca-card"><h4>Investigation record</h4><input type="hidden" id="inv-rca" value="${esc(inv.rca || '')}">
     ${keep.map(([k, l]) => `<div class="fld"><label for="inv-${k}">${l}</label>${edit ? `<textarea id="inv-${k}" class="mx-in" rows="2">${esc(inv[k] || '')}</textarea>` : `<p>${esc(inv[k] || '—')}</p>`}</div>`).join('')}
     <div class="fld"><label>Immediate cause codes</label>${causePick('Immediate', inv.immCodes, edit)}</div><div class="fld"><label>Root cause codes</label>${causePick('Root', inv.rootCodes, edit)}</div></div></div>
   ${rcaStudio(r)}
   <div class="rca-card rci-actions"><h4>Corrective and preventive actions <small>${A.length}</small>${edit ? ` <button class="btn" data-nact="${r.id}">+ Add action</button>` : ''}</h4>${A.length ? `<div class="tbl"><table><tbody>${A.map(a => `<tr class="hot" data-aopen="${a.id}" data-go2="lactions"><td class="id">${ref('ACT', a)}</td><td>${esc(a.title)}</td><td>${esc(a.owner || '')}</td><td>${fdt(a.due)}</td><td><span class="pill ${a.closedAt ? 'p-ok' : aOver(a) ? 'p-crit' : 'p-info'}">${aStatus(a)}</span></td></tr>`).join('')}</tbody></table></div>` : '<p class="mx-muted">No actions yet. Create them from the investigation result above.</p>'}</div>
   <div class="rca-card"><h4>History</h4>${histList(r.history)}</div>
   ${edit ? `<div class="nvi-foot"><div>Stage: <b>${esc(s)}</b>${next ? ` → next: <b>${esc(next)}</b>` : ''}</div><div class="filters"><button class="btn" data-nsave="${r.id}">Save</button>${next && (!needV || canVerify()) ? `<button class="btn pri" data-nnext="${r.id}" data-to="${next}">Move to ${next}</button>` : ''}${next && needV && !canVerify() ? `<span class="mx-muted">${next} needs an HSE Engineer or Admin.</span>` : ''}</div></div>` : ''}
  </div>`;
};
/* Saving the incident always carries the investigation studio with it, so neither overwrites the other. */
const rcaBaseIncSave = incSave;
incSave = async function (id, to) { const r = L.reports.find(x => x.id === id); if (r && RCA.by[id]) r.investigation = { ...(r.investigation || {}), ...rcaPayload(r) }; return rcaBaseIncSave(id, to); };
const rcaFor = el => { const sec = el.closest('[data-rca]'); return sec ? L.reports.find(x => x.id === sec.dataset.rca) : null; };
document.addEventListener('click', async e => {
  const t = e.target.closest('[data-rcm],[data-rcw],[data-rcclear],[data-rcset],[data-rcwhyroot],[data-rcwhyadd],[data-rcwhydel],[data-rcfish],[data-rcfadd],[data-rcfroot],[data-rcfdel],[data-rctapadd],[data-rctapdel],[data-rctapcf],[data-rctapcat],[data-rcsave],[data-rcact]');
  if (!t) return; const r = rcaFor(t); if (!r) return; e.preventDefault(); e.stopPropagation(); const S = rcaState(r); const D = t.dataset;
  if (D.rcsave) return rcaSave(r.id);
  if (D.rcact) return rcaActions(r.id);
  if (D.rcm) S.method = D.rcm;
  if (D.rcw) { const P = S.wheel.picked, k = P.indexOf(D.rcw); if (k >= 0) { P.splice(k, 1); delete S.wheel.a[D.rcw]; } else { P.push(D.rcw); S.wheel.a[D.rcw] = S.wheel.a[D.rcw] || { status: 'Contributed' }; } }
  if (t.hasAttribute('data-rcclear')) { S.wheel.picked = []; S.wheel.a = {}; }
  if (D.rcset) rcaSet(S, D.rcset, D.v);
  if (D.rcwhyroot != null) S.whyRoot = S.whyRoot === +D.rcwhyroot ? null : +D.rcwhyroot;
  if (t.hasAttribute('data-rcwhyadd')) S.whys.push({ w: '', e: '' });
  if (t.hasAttribute('data-rcwhydel')) { S.whys.pop(); if (S.whyRoot >= S.whys.length) S.whyRoot = null; }
  if (D.rcfish) S.fish.sel = D.rcfish;
  if (D.rcfadd) (S.fish.c[D.rcfadd] = S.fish.c[D.rcfadd] || []).push({ t: '', root: false });
  if (D.rcfroot) { const [b, i] = D.rcfroot.split('.'); S.fish.c[b][i].root = !S.fish.c[b][i].root; }
  if (D.rcfdel) { const [b, i] = D.rcfdel.split('.'); S.fish.c[b].splice(+i, 1); }
  if (t.hasAttribute('data-rctapadd')) S.tap.ev.push({ t: '', e: '', cf: false, cat: [] });
  if (t.hasAttribute('data-rctapdel')) S.tap.ev.pop();
  if (D.rctapcf != null) { const ev = S.tap.ev[+D.rctapcf]; ev.cf = !ev.cf; }
  if (D.rctapcat != null) { const ev = S.tap.ev[+D.rctapcat]; ev.cat = ev.cat || []; ev.cat = ev.cat.includes(D.v) ? ev.cat.filter(x => x !== D.v) : [...ev.cat, D.v]; }
  const y = window.scrollY; render(); window.scrollTo(0, y);
}, true);
document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-rcw],[data-rcfish]')) { e.preventDefault(); e.target.dispatchEvent(new MouseEvent('click', { bubbles: true })); } });
document.addEventListener('input', e => {
  const t = e.target.closest('[data-rcf]'); if (!t) return; const r = L.reports.find(x => x.id === t.dataset.rid); if (!r) return;
  rcaSet(rcaState(r), t.dataset.rcf, t.value);
});
document.addEventListener('change', e => {
  const t = e.target.closest('[data-rcf]'); if (!t) return; const sec = t.closest('[data-rca]'); if (!sec) return;
  const r = L.reports.find(x => x.id === sec.dataset.rca); if (!r) return; const box = sec.querySelector('.rca-result');
  if (box) { const tmp = document.createElement('div'); tmp.innerHTML = rcaResultCard(rcaState(r), r); box.replaceWith(tmp.firstElementChild); }
});
