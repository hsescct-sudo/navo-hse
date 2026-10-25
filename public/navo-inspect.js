/* NASS Safe Link inspection flow.
   Four answers per question: Safe, At risk, Not applicable, Not evaluated.
   Finding and recommendation are optional for every answer and required only for At risk.
   Every At risk answer becomes an action assigned to its owner the moment the inspection is submitted. */
'use strict';
EV['Yes'] = 'Safe'; EV['No'] = 'At risk'; EV['N/A'] = 'Not applicable'; EV['NE'] = 'Not evaluated';
const NV_ANS = [['Yes', 'Safe', 'ok'], ['No', 'At risk', 'risk'], ['N/A', 'Not applicable', 'na'], ['NE', 'Not evaluated', 'ne']];
const nvDays = q => (q.c ? 3 : 7);

function nvInspCounts(Q, d) {
  const a = d.ans || {}; const n = v => Q.filter((q, k) => a[k] === v).length;
  const safe = n('Yes'), risk = n('No'), na = n('N/A'), ne = n('NE'), done = safe + risk + na + ne;
  return { safe, risk, na, ne, done, total: Q.length, score: safe + risk ? Math.round(safe / (safe + risk) * 100) : null, crit: Q.filter((q, k) => a[k] === 'No' && q.c).length };
}
function nvRing(pct, label) {
  const r = 34, c = 2 * Math.PI * r, v = pct == null ? 0 : pct;
  const col = pct == null ? '#9aa8ba' : pct >= 90 ? '#1f9d63' : pct >= 75 ? '#f2a516' : '#e5484d';
  return `<div class="nvi-ring"><svg viewBox="0 0 84 84"><circle cx="42" cy="42" r="${r}" stroke="#e5ebf3" stroke-width="9" fill="none"/><circle cx="42" cy="42" r="${r}" stroke="${col}" stroke-width="9" fill="none" stroke-linecap="round" stroke-dasharray="${(c * v / 100).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 42 42)"/></svg><b>${pct == null ? '—' : pct + '%'}</b><small>${label}</small></div>`;
}

inspForm = function () {
  const d = MX.i.draft; const P = myProjects(); const p = L.projects.find(x => x.id === d.project) || P[0]; if (!d.project && p) d.project = p.id;
  const lib = clLib().filter(c => c.active !== false && (!p || !c.platforms || c.platforms.includes(p.platform || 'Construction')) && (!c.divisions || !c.divisions.length || !p || c.divisions.includes(p.division)));
  if (!lib.find(c => c.id === d.cl)) d.cl = lib[0]?.id;
  const cl = clById(d.cl); const Q = (cl?.q || []).filter(q => q.on !== false);
  d.ans = d.ans || {}; d.f = d.f || {}; d.r = d.r || {}; d.o = d.o || {}; d.open = d.open || {};
  if (d._cl !== d.cl) { if (d._cl !== undefined) { d.ans = {}; } d.f = {}; d.r = {}; d.o = {}; d.open = {}; d.err = null; d._cl = d.cl; }
  const cats = {}; lib.forEach(c => (cats[c.category || 'Other checklists'] = cats[c.category || 'Other checklists'] || []).push(c));
  const picker = `<select id="in-cl" class="mx-in" data-idr="cl" aria-label="Checklist">${Object.entries(cats).map(([g, cs]) => `<optgroup label="${esc(g)}">${cs.map(c => `<option value="${esc(c.id)}" ${c.id === d.cl ? 'selected' : ''}>${esc(c.name)} · rev ${c.rev || 1}</option>`).join('')}</optgroup>`).join('')}</select>`;
  const head = `<div class="nvi-head"><div><span class="nvi-eyebrow">New inspection</span><h2>${esc(cl ? cl.name : 'Choose a checklist')}</h2><p>${cl ? `${Q.length} questions · ${Q.filter(q => q.c).length} critical controls` : ''}</p></div><button class="btn" data-icancel>Cancel</button></div>
   <div class="mx-grid nvi-meta">${selx('in-proj', P.map(x => [x.id, x.name]), d.project, 'data-idr="project"')}<div class="fld"><label for="in-cl">Checklist</label>${picker}</div>${inp('in-area', d.area, 'Area / location')}${inp('in-con', d.contractor, 'Responsible contractor')}${inp('in-date', d.date || new Date().toISOString().slice(0, 10), '', 'date')}${inp('in-map', d.googleMapUrl, 'Google Maps link', 'url')}${selx('in-mode', [['now', 'Conduct now'], ['sched', 'Schedule only']], d.mode || 'now', 'data-idr="mode"')}</div>`;
  if (d.mode === 'sched') return `<div class="panel mx-detail nvi">${head}<p class="mx-muted">The inspection is added to the register as Scheduled. Open it later to conduct it.</p><div class="filters"><button class="btn pri" data-isave>Schedule inspection</button></div></div>`;
  const C = nvInspCounts(Q, d);
  const sections = []; Q.forEach((q, k) => { const s = q.s || 'Checklist'; let g = sections.find(x => x[0] === s); if (!g) sections.push(g = [s, []]); g[1].push([q, k]); });
  const owner = d.contractor ? d.contractor + ' supervisor' : 'Area supervisor';
  const err = d.err || {};
  const row = ([q, k]) => {
    const v = d.ans[k], risk = v === 'No', show = risk || d.open[k] || d.f[k] || d.r[k];
    return `<div class="nvi-q ${risk ? 'is-risk' : v === 'Yes' ? 'is-safe' : v ? 'is-na' : ''} ${err[k] ? 'has-err' : ''}" id="nvq-${k}">
     <div class="nvi-qt"><span class="nvi-n">${k + 1}</span><div><p>${esc(q.t)}</p>${q.c ? '<span class="nvi-tag crit">Critical control</span>' : ''}${q.e ? '<span class="nvi-tag ev">Evidence</span>' : ''}</div></div>
     <div class="nvi-opts" role="radiogroup" aria-label="Answer for question ${k + 1}">${NV_ANS.map(([val, lab, cls]) => `<button class="nvi-o ${cls}" data-nvq="${k}" data-nvv="${val}" role="radio" aria-checked="${v === val}">${lab}</button>`).join('')}</div>
     ${show ? `<div class="nvi-notes ${risk ? 'req' : ''}">
       <div class="fld"><label>Finding${risk ? ' *' : ' (optional)'}</label><textarea rows="2" class="mx-in" data-nvf="f" data-k="${k}" placeholder="What did you see?">${esc(d.f[k] || '')}</textarea></div>
       <div class="fld"><label>Recommendation${risk ? ' *' : ' (optional)'}</label><textarea rows="2" class="mx-in" data-nvf="r" data-k="${k}" placeholder="What must be done?">${esc(d.r[k] || '')}</textarea></div>
       ${risk ? `<div class="nvi-act"><div class="fld"><label>Action owner *</label><input class="mx-in" data-nvf="o" data-k="${k}" value="${esc(d.o[k] ?? owner)}"></div><div class="nvi-due"><span>Due</span><b>${nvDays(q)} days</b><em class="${q.c ? 'crit' : ''}">${q.c ? 'High priority' : 'Normal priority'}</em></div></div>` : ''}
     </div>` : `<button class="nvi-add" data-nvopen="${k}">+ Add finding or recommendation</button>`}
    </div>`;
  };
  const errCount = Object.keys(err).length;
  return `<div class="panel mx-detail nvi">${head}
   <div class="nvi-progress">
     ${nvRing(C.score, 'Score')}
     <div class="nvi-bar"><div class="nvi-bar-top"><b>${C.done} of ${C.total} answered</b><span>Score = Safe ÷ (Safe + At risk)</span></div><div class="nvi-track"><i class="ok" style="width:${C.total ? C.safe / C.total * 100 : 0}%"></i><i class="risk" style="width:${C.total ? C.risk / C.total * 100 : 0}%"></i><i class="na" style="width:${C.total ? (C.na + C.ne) / C.total * 100 : 0}%"></i></div>
       <div class="nvi-chips"><span class="ok">${C.safe} Safe</span><span class="risk">${C.risk} At risk${C.crit ? ` · ${C.crit} critical` : ''}</span><span class="na">${C.na} Not applicable</span><span class="ne">${C.ne} Not evaluated</span></div></div>
   </div>
   ${errCount ? `<div class="nvi-alert" role="alert">${esc(d.errMsg || 'Complete the highlighted questions.')}${d.errRest ? ' <button class="btn" data-nvrest>Mark the rest Not evaluated</button>' : ''}</div>` : ''}
   ${sections.map(([s, qs]) => `<section class="nvi-sec"><div class="nvi-sec-h"><h3>${esc(s)}</h3><span>${qs.filter(([, k]) => d.ans[k]).length}/${qs.length}</span><button class="nvi-secna" data-nvsecna="${qs.map(([, k]) => k).join(',')}">Section not applicable</button></div>${qs.map(row).join('')}</section>`).join('')}
   <div class="nvi-foot"><div><b>${C.risk}</b> action${C.risk === 1 ? '' : 's'} will be created and assigned when you submit.</div><button class="btn pri" data-isave>Submit inspection</button></div>
  </div>`;
};

saveInspection = async function () {
  const d = MX.i.draft; d.project = gv('in-proj') || d.project; const cl = clById(gv('in-cl') || d.cl); if (!cl) { toast('Choose a checklist.'); return; }
  d.area = gv('in-area'); d.contractor = gv('in-con'); d.date = gv('in-date'); d.googleMapUrl = gv('in-map');
  const ts = new Date(d.date || Date.now()).getTime() || Date.now();
  const base = { project: d.project, tpl: cl.name, area: d.area, contractor: d.contractor || null, inspector: L.me?.name || '', ts, by: L.me.id };
  if ((gv('in-mode') || d.mode) === 'sched') {
    await liveSave(() => L.db.collection('inspections').add({ ...base, items: 0, fails: 0, status: 'Scheduled', answers: { googleMapUrl: d.googleMapUrl, checklist: cl.id, rev: cl.rev || 1, a: {} }, history: [{ ts: Date.now(), by: L.me?.name || '', what: 'Inspection scheduled' }] }), 'Inspection scheduled');
    MX.i.draft = null; render(); return;
  }
  const Q = cl.q.filter(q => q.on !== false); const a = d.ans || {}; const err = {};
  const missing = Q.map((q, k) => k).filter(k => !a[k]);
  Q.forEach((q, k) => { if (a[k] === 'No' && (!(d.f[k] || '').trim() || !(d.r[k] || '').trim() || !(d.o[k] ?? 'x').trim())) err[k] = 1; });
  missing.forEach(k => err[k] = 1);
  if (Object.keys(err).length) {
    d.err = err; d.errRest = missing.length > 0;
    d.errMsg = missing.length ? `${missing.length} question${missing.length > 1 ? 's are' : ' is'} not answered.` : 'Every At risk answer needs a finding, a recommendation and an action owner.';
    render(); setTimeout(() => document.getElementById('nvq-' + Object.keys(err)[0])?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50); return;
  }
  d.err = null;
  const C = nvInspCounts(Q, d); const owner0 = d.contractor ? d.contractor + ' supervisor' : 'Area supervisor';
  const risks = Q.map((q, k) => [q, k]).filter(([, k]) => a[k] === 'No');
  const answers = Object.fromEntries(Q.map((q, k) => [k, { q: q.t, s: q.s || '', c: q.c, v: a[k], n: d.f[k] || '', r: d.r[k] || '', o: a[k] === 'No' ? (d.o[k] ?? owner0) : '' }]));
  const scoreTxt = C.score == null ? 'not evaluated' : C.score + '%';
  const rec = { ...base, items: C.safe + C.risk, fails: C.risk, score: C.score, status: !(C.safe + C.risk) ? 'Not evaluated' : C.risk ? 'Actions assigned' : 'Closed',
    answers: { googleMapUrl: d.googleMapUrl, checklist: cl.id, rev: cl.rev || 1, a: answers },
    history: [{ ts: Date.now(), by: L.me?.name || '', what: `Inspection conducted · score ${scoreTxt}` }, ...(C.risk ? [{ ts: Date.now(), by: L.me?.name || '', what: `${C.risk} at-risk finding${C.risk > 1 ? 's' : ''}${C.crit ? `, ${C.crit} critical` : ''} · actions assigned` }] : [])] };
  const ok = await liveSave(async () => {
    let r; if (d.replace) { await L.db.collection('inspections').doc(d.replace).update(rec); r = { id: d.replace }; } else r = await L.db.collection('inspections').add(rec);
    for (const [q, k] of risks) {
      const title = (d.r[k] || '').trim().slice(0, 300); const own = (d.o[k] ?? owner0).trim();
      if (L.actions.some(x => x.source === 'Inspection' && x.sourceId === r.id && x.title === title)) continue;
      await L.db.collection('actions').add({ title, project: d.project, owner: own, contractor: d.contractor || null, due: Date.now() + nvDays(q) * 864e5, priority: q.c ? 'High' : 'Normal', report: null, ts: Date.now(), by: L.me.id, closedAt: null, status: 'Assigned', source: 'Inspection', sourceId: r.id,
        history: [{ ts: Date.now(), by: L.me?.name || '', what: `Created from inspection finding: ${(d.f[k] || '').trim().slice(0, 300)} · assigned to ${own}` }] });
    }
  }, `Inspection submitted · score ${scoreTxt}${C.risk ? ` · ${C.risk} action${C.risk > 1 ? 's' : ''} assigned` : ''}`);
  if (ok !== false) { MX.i.draft = null; render(); }
};

inspDetail = function (i) {
  const s = iScore(i), st = iStatus(i); const A = L.actions.filter(a => a.sourceId === i.id); const ans = i.answers && i.answers.a ? Object.values(i.answers.a) : null;
  const btns = []; if (st === 'Scheduled' && isStaff()) btns.push(`<button class="btn pri" data-iconduct="${i.id}">Conduct now</button>`); if (st === 'Awaiting verification' && canVerify()) btns.push(`<button class="btn pri" data-iverify="${i.id}">Verify & close</button>`);
  const n = v => (ans || []).filter(x => x.v === v).length;
  const risks = (ans || []).filter(x => x.v === 'No');
  const groups = {}; (ans || []).forEach(x => (groups[x.s || 'Checklist'] = groups[x.s || 'Checklist'] || []).push(x));
  const pill = v => `<span class="nvi-pill ${v === 'Yes' ? 'ok' : v === 'No' ? 'risk' : v === 'N/A' ? 'na' : 'ne'}">${EV[v] || v || '—'}</span>`;
  return `<div class="panel mx-detail nvi"><div class="nvi-head"><div><span class="nvi-eyebrow">${ref('INS', i)}</span><h2>${esc(i.tpl)}</h2><p>${esc(projName(i.project))} · ${esc(i.area || 'No area')} · ${fdt(i.ts)} · ${esc(i.inspector || '')}</p></div><button class="btn" data-iclose-d>Close</button></div>${flowBar(I_STEPS, st)}
   <div class="nvi-progress">${nvRing(s, 'Score')}<div class="nvi-chips big"><span class="ok">${n('Yes')} Safe</span><span class="risk">${n('No')} At risk</span><span class="na">${n('N/A')} Not applicable</span><span class="ne">${n('NE')} Not evaluated</span></div>${btns.length ? `<div class="filters">${btns.join('')}</div>` : ''}</div>
   ${risks.length ? `<h3>At-risk findings and actions</h3><div class="nvi-findings">${risks.map(x => { const act = A.find(a => a.title === x.r) || null; return `<div class="nvi-find"><div>${x.c ? '<span class="nvi-tag crit">Critical control</span>' : ''}<b>${esc(x.q)}</b><p><em>Finding</em> ${esc(x.n || '—')}</p><p><em>Recommendation</em> ${esc(x.r || '—')}</p></div>${act ? `<button class="nvi-actlink" data-aopen="${act.id}" data-go2="lactions"><span>${ref('ACT', act)}</span><b>${esc(act.owner || '')}</b><em class="${act.closedAt ? 'ok' : aOver(act) ? 'risk' : ''}">${aStatus(act)}</em></button>` : ''}</div>`; }).join('')}</div>` : ''}
   ${A.length && !risks.length ? `<h3>Actions</h3><div class="tbl"><table><tbody>${A.map(a => `<tr class="hot" data-aopen="${a.id}" data-go2="lactions"><td class="id">${ref('ACT', a)}</td><td>${esc(a.title)}</td><td>${esc(a.owner || '')}</td><td><span class="pill ${a.closedAt ? 'p-ok' : aOver(a) ? 'p-crit' : 'p-info'}">${aStatus(a)}</span></td></tr>`).join('')}</tbody></table></div>` : ''}
   <h3>Completed checklist</h3>${ans ? Object.entries(groups).map(([g, xs]) => `<div class="nvi-sec"><div class="nvi-sec-h"><h3>${esc(g)}</h3></div><div class="tbl"><table><thead><tr><th>Question</th><th>Answer</th><th>Finding</th><th>Recommendation</th></tr></thead><tbody>${xs.map(x => `<tr><td>${esc(x.q)}${x.c ? ' <span class="nvi-tag crit">Critical</span>' : ''}</td><td>${pill(x.v)}</td><td>${esc(x.n || '')}</td><td>${esc(x.r || '')}</td></tr>`).join('')}</tbody></table></div></div>`).join('') : `<p class="mx-muted">${st === 'Scheduled' ? 'Not conducted yet.' : 'Recorded as a summary: ' + (i.items || 0) + ' items checked, ' + (i.fails || 0) + ' at risk.'}</p>`}
   <h3>History</h3>${histList(i.history)}</div>`;
};

/* Interaction: answers, notes, section N/A, fill rest. Inputs write straight into the draft so nothing is lost on re-render. */
document.addEventListener('click', e => {
  const d = MX?.i?.draft; if (!d) return;
  const b = e.target.closest('[data-nvq],[data-nvopen],[data-nvsecna],[data-nvrest]'); if (!b) return;
  e.preventDefault(); e.stopPropagation();
  ['in-area', 'in-con', 'in-date', 'in-map'].forEach(id => { const el = document.getElementById(id); if (el) d[{ 'in-area': 'area', 'in-con': 'contractor', 'in-date': 'date', 'in-map': 'googleMapUrl' }[id]] = el.value; });
  if (b.dataset.nvq != null) { const k = b.dataset.nvq; d.ans[k] = d.ans[k] === b.dataset.nvv ? undefined : b.dataset.nvv; if (d.err) delete d.err[k]; }
  if (b.dataset.nvopen != null) d.open[b.dataset.nvopen] = 1;
  if (b.dataset.nvsecna) b.dataset.nvsecna.split(',').forEach(k => { if (!d.ans[k]) d.ans[k] = 'N/A'; if (d.err) delete d.err[k]; });
  if (b.hasAttribute('data-nvrest')) { const cl = clById(d.cl); (cl?.q || []).filter(q => q.on !== false).forEach((q, k) => { if (!d.ans[k]) { d.ans[k] = 'NE'; if (d.err) delete d.err[k]; } }); d.errRest = false; }
  const y = window.scrollY; render(); window.scrollTo(0, y);
}, true);
document.addEventListener('input', e => {
  const t = e.target.closest('[data-nvf]'); const d = MX?.i?.draft; if (!t || !d) return;
  d[t.dataset.nvf][t.dataset.k] = t.value;
});
