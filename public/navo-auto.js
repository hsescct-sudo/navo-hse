/* NAVO automation.
   Rules run on the records the viewer can see and raise alerts in the bell and on the Automations page.
   Two rules can also create records: the monthly inspection plan and systemic actions for repeat findings.
   Both create records only on a button press, unless an HSE Admin switches them to run automatically.
   Email delivery runs on the server (api/notify.py) once the email service is configured. */
'use strict';
const AU = { open: false, ran: {} };
const DAY = 864e5;
const auCfg = () => { const a = (L.structure && L.structure.automation) || {}; return { rules: a.rules || {}, auto: a.auto || {}, email: { recipients: [], daily: true, ceo: true, env: true, ...(a.email || {}) } }; };
const AU_RULES = [
  ['overdue', 'Overdue actions and escalation', 'Open actions past their due date. 1–7 days: owner · 8–14 days: project manager · over 14 days: division director.'],
  ['dueSoon', 'Actions due within 3 days', 'Reminder before the deadline.'],
  ['serious', 'Serious incidents', 'Fatality, serious injury or lost time injury in the last 7 days. Leadership must be informed within one hour.'],
  ['hipo', 'High-potential events', 'Loss potential class A or B, or a dangerous occurrence, without a recorded root cause.'],
  ['invOverdue', 'Investigations open over 14 days', 'Incidents still before management review 14 days after the event.'],
  ['training', 'Training certificates expiring', 'Certificates expiring within 30 days, or already expired.'],
  ['plan', 'Inspection plan', 'Planned inspections not yet conducted this month, and scheduled inspections past their date.'],
  ['repeat', 'Repeat findings', 'The same checklist question at risk three or more times in 30 days on one project.'],
  ['data', 'Missing monthly data', 'Man-hours not entered for last month after the 5th of this month.'],
];
const auOn = id => auCfg().rules[id] !== false;
const auFmt = m => new Date(m + '-01T00:00:00').toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
const auMonth = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');

function auRepeatGroups(ids) {
  const since = Date.now() - 30 * DAY, map = {};
  (L.inspections || []).filter(i => ids.has(i.project) && i.ts >= since && i.answers && i.answers.a).forEach(i => Object.values(i.answers.a).forEach(x => {
    if (x.v !== 'No') return; const k = i.project + '|' + x.q; (map[k] = map[k] || { project: i.project, q: x.q, n: 0, crit: !!x.c }).n++;
  }));
  return Object.values(map).filter(g => g.n >= 3);
}
const auSystemicTitle = g => `Systemic action: "${g.q}" found at risk ${g.n} times in 30 days`.slice(0, 300);
function auPlanGaps(ids) {
  const m = auMonth(), out = [];
  myProjects().filter(p => ids.has(p.id) && +p.planInsp > 0).forEach(p => {
    const inMonth = (L.inspAll || L.inspections || []).filter(i => i.project === p.id && auMonth(new Date(i.ts)) === m);
    const done = inMonth.filter(i => i.status !== 'Scheduled').length, planned = inMonth.filter(i => i.answers && i.answers.plan === m).length;
    out.push({ project: p.id, plan: +p.planInsp, done, planned });
  });
  return out;
}

function auAlerts() {
  if (!L.ready || !L.me) return [];
  const ids = new Set(myProjects().map(p => p.id)), now = Date.now(), A = [], add = (rule, sev, title, detail, project, go) => A.push({ rule, sev, title, detail, project, go });
  const acts = (L.actions || []).filter(a => ids.has(a.project) && !a.closedAt);
  if (auOn('overdue')) acts.filter(a => a.due && a.due < now).forEach(a => {
    const d = Math.floor((now - a.due) / DAY), lvl = d > 14 ? 'Division director' : d > 7 ? 'Project manager' : 'Action owner';
    add('overdue', d > 14 ? 'critical' : d > 7 ? 'high' : 'medium', `Overdue ${d} day${d === 1 ? '' : 's'}: ${a.title}`, `Owner ${a.owner || '—'} · escalated to ${lvl}`, a.project, { view: 'lactions', aopen: a.id });
  });
  if (auOn('dueSoon')) acts.filter(a => a.due && a.due >= now && a.due < now + 3 * DAY).forEach(a => add('dueSoon', 'info', `Due ${fdt(a.due)}: ${a.title}`, `Owner ${a.owner || '—'}`, a.project, { view: 'lactions', aopen: a.id }));
  const R = (L.reports || []).filter(r => ids.has(r.project) && r.rt === 'Incident');
  if (auOn('serious')) R.filter(r => (r.eventTs || r.ts) > now - 7 * DAY && ['Fatality', 'Serious Injury', 'Lost Time (> 7 days)', 'Lost Time'].includes(sevOf(r))).forEach(r =>
    add('serious', 'critical', `${sevOf(r)}: ${r.desc || r.kind || 'incident'}`, `${fdt(r.eventTs || r.ts)} · inform leadership within one hour`, r.project, { view: 'incm', nopen: r.id }));
  if (auOn('hipo')) R.filter(r => (r.eventTs || r.ts) > now - 30 * DAY && (['Class A', 'Class B'].includes(r.incClass) || r.kind === 'Dangerous Occurrence') && !(r.investigation && (r.investigation.root || '').trim())).forEach(r =>
    add('hipo', 'high', `High potential: ${r.desc || r.kind}`, `${r.incClass || r.kind} · full investigation required`, r.project, { view: 'incm', nopen: r.id }));
  if (auOn('invOverdue')) R.filter(r => ['Notification', 'Registration', 'Classification', 'Investigation'].includes(nStage(r)) && (r.eventTs || r.ts) < now - 14 * DAY && r.status !== 'Closed').forEach(r =>
    add('invOverdue', 'high', `Investigation open ${Math.floor((now - (r.eventTs || r.ts)) / DAY)} days: ${r.desc || r.kind}`, `Stage ${nStage(r)}`, r.project, { view: 'incm', nopen: r.id }));
  if (auOn('training')) (L.records || []).filter(r => r.kind === 'training' && ids.has(r.project) && r.data && r.data.expiry && r.data.expiry < now + 30 * DAY && r.data.expiry > now - 60 * DAY).forEach(r =>
    add('training', r.data.expiry < now ? 'high' : 'medium', `${r.data.expiry < now ? 'Expired' : 'Expiring ' + fdt(r.data.expiry)}: ${r.data.course || 'certificate'}`, `${r.data.person || ''}${r.data.expiry < now ? ' · remove from critical tasks until renewed' : ''}`, r.project, { view: 'train' }));
  if (auOn('plan')) {
    const day = new Date().getDate();
    if (day >= 20) auPlanGaps(ids).filter(g => g.done < g.plan).forEach(g => add('plan', 'medium', `${projName(g.project)}: ${g.done} of ${g.plan} planned inspections done`, `${g.plan - g.done} still to do this month`, g.project, { view: 'inspm' }));
    (L.inspAll || []).filter(i => ids.has(i.project) && i.status === 'Scheduled' && i.ts < now - DAY).forEach(i => add('plan', 'high', `Missed scheduled inspection: ${i.tpl}`, `${projName(i.project)} · due ${fdt(i.ts)}`, i.project, { view: 'inspm' }));
  }
  if (auOn('repeat')) auRepeatGroups(ids).forEach(g => { const has = (L.actions || []).some(a => a.project === g.project && a.title === auSystemicTitle(g));
    add('repeat', g.crit ? 'high' : 'medium', `Repeat finding ×${g.n}: ${g.q}`, `${projName(g.project)}${has ? ' · systemic action exists' : ' · no systemic action yet'}`, g.project, { view: 'auto' }); });
  if (auOn('data') && new Date().getDate() > 5) {
    const d = new Date(); d.setMonth(d.getMonth() - 1); const lm = auMonth(d);
    myProjects().filter(p => ids.has(p.id)).filter(p => !(L.records || []).some(r => r.kind === 'monthly' && r.project === p.id && r.data && r.data.month === lm && (+r.data.empHours || +r.data.conHours))).forEach(p =>
      add('data', 'medium', `${p.name}: man-hours missing for ${auFmt(lm)}`, 'Frequency rates cannot be calculated without them', p.id, { view: 'hdata' }));
  }
  const rank = { critical: 0, high: 1, medium: 2, info: 3 };
  return A.sort((a, b) => rank[a.sev] - rank[b.sev]);
}

/* ---------- Automatic records ---------- */
async function auCreatePlan(quiet) {
  const ids = new Set(myProjects().map(p => p.id)), m = auMonth(), [y, mo] = m.split('-').map(Number), days = new Date(y, mo, 0).getDate(); let n = 0;
  const cl = clById('pro-site') || clLib()[0];
  await liveSave(async () => {
    for (const g of auPlanGaps(ids)) {
      for (let k = g.planned; k < g.plan; k++) {
        const ts = new Date(y, mo - 1, Math.min(days, 1 + Math.floor((k + .5) * days / g.plan)), 9).getTime();
        await L.db.collection('inspections').add({ project: g.project, tpl: cl.name, area: '', contractor: null, inspector: '', ts, by: L.me.id, items: 0, fails: 0, status: 'Scheduled', answers: { plan: m, checklist: cl.id, rev: cl.rev || 1, a: {} }, history: [{ ts: Date.now(), by: 'NAVO automation', what: `Planned inspection ${k + 1} of ${g.plan} for ${auFmt(m)}` }] });
        n++;
      }
    }
  }, quiet ? undefined : undefined);
  if (!quiet) toast(n ? `${n} planned inspection${n > 1 ? 's' : ''} added for ${auFmt(m)}` : 'The inspection plan for this month is already complete.');
  return n;
}
async function auCreateSystemic(quiet) {
  const ids = new Set(myProjects().map(p => p.id)); let n = 0;
  await liveSave(async () => {
    for (const g of auRepeatGroups(ids)) {
      const title = auSystemicTitle(g); if ((L.actions || []).some(a => a.project === g.project && a.title === title)) continue;
      await L.db.collection('actions').add({ title, project: g.project, owner: 'Project HSE lead', contractor: null, due: Date.now() + 14 * DAY, priority: 'High', report: null, ts: Date.now(), by: L.me.id, closedAt: null, status: 'Assigned', source: 'Repeat findings', sourceId: 'repeat:' + g.project,
        history: [{ ts: Date.now(), by: 'NAVO automation', what: `Created because the same finding was recorded ${g.n} times in 30 days. Find the system cause, not the individual case.` }] });
      n++;
    }
  });
  if (!quiet) toast(n ? `${n} systemic action${n > 1 ? 's' : ''} created` : 'No new repeat findings need a systemic action.');
  return n;
}
async function auRunAutomatic() {
  if (!L.ready || !L.me || !isStaff() || AU.busy) return; const c = auCfg().auto, m = auMonth();
  if (Object.values(L.dataLoads || {}).some(s => s !== 'ready')) return;
  AU.busy = true;
  try {
    if (c.plan && myRole() === 'admin' && !AU.ran['plan' + m]) { AU.ran['plan' + m] = 1; const n = await auCreatePlan(true); if (n) toast(`Automation added ${n} planned inspections for ${auFmt(m)}`); }
    if (c.systemic && !AU.ran['sys']) { AU.ran['sys'] = 1; const n = await auCreateSystemic(true); if (n) toast(`Automation created ${n} systemic action${n > 1 ? 's' : ''}`); }
  } finally { AU.busy = false; }
}

/* ---------- Bell ---------- */
function auBell() {
  const top = document.querySelector('.top .ctrls'); if (!top || !L.ready) return;
  let w = document.getElementById('au-bell'); if (!w) { top.insertAdjacentHTML('afterbegin', '<div id="au-bell"></div>'); w = document.getElementById('au-bell'); }
  const al = auAlerts(), hot = al.filter(a => a.sev === 'critical' || a.sev === 'high').length;
  w.innerHTML = `<button class="au-btn ${hot ? 'hot' : ''}" data-au-toggle aria-expanded="${AU.open}" aria-label="Alerts, ${al.length}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 16v-5a6 6 0 1 0-12 0v5l-2 2h16z"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>${al.length ? `<b>${al.length > 99 ? '99+' : al.length}</b>` : ''}</button>
   ${AU.open ? `<div class="au-pop" role="dialog" aria-label="Alerts"><div class="au-pop-h"><b>Alerts</b><button data-go="auto">Open automations</button></div>${al.length ? al.slice(0, 8).map((a, i) => `<button class="au-item s-${a.sev}" data-au-go="${i}"><i></i><span><b>${esc(a.title)}</b><small>${esc(a.detail)}</small></span></button>`).join('') : '<p class="mx-muted">No alerts. Everything is on track.</p>'}${al.length > 8 ? `<button class="au-more" data-go="auto">${al.length - 8} more alerts</button>` : ''}</div>` : ''}`;
  AU.list = al;
}
function auGo(a) {
  AU.open = false; if (!a || !a.go) return; const g = a.go;
  if (g.aopen) MX.a.sel = g.aopen;
  if (g.nopen) MX.n.sel = g.nopen;
  go(g.view);
}

/* ---------- Automations page ---------- */
function autoPage() {
  if (!isStaff()) return '<div class="panel"><h2>Automations are managed by the HSE team</h2></div>';
  const al = auAlerts(), c = auCfg(), admin = myRole() === 'admin', ids = new Set(myProjects().map(p => p.id));
  const by = id => al.filter(a => a.rule === id), sevCount = s => al.filter(a => a.sev === s).length;
  const gaps = auPlanGaps(ids), missingPlan = gaps.reduce((n, g) => n + Math.max(0, g.plan - g.planned), 0), rep = auRepeatGroups(ids).filter(g => !(L.actions || []).some(a => a.project === g.project && a.title === auSystemicTitle(g)));
  const em = c.email;
  return `<div class="au">
   <div class="nvr-hero"><div><span class="nvi-eyebrow">Automation centre</span><h2>The system watches, reminds and escalates.</h2><p>${AU_RULES.length} rules run on live records. Alerts appear in the bell for everyone in scope. Email delivery runs every morning on the server once it is configured.</p></div>
    <div class="au-sum"><span class="c">${sevCount('critical')}<small>critical</small></span><span class="h">${sevCount('high')}<small>high</small></span><span class="m">${sevCount('medium')}<small>medium</small></span><span class="i">${sevCount('info')}<small>reminders</small></span></div></div>
   <div class="au-grid">
    <div class="panel au-act"><h2>Monthly inspection plan</h2><p>${gaps.length ? `${gaps.reduce((n, g) => n + g.plan, 0)} inspections planned this month across ${gaps.length} projects · ${missingPlan} not yet scheduled.` : 'Set “Inspections / month” for projects in Projects & people to use the plan.'}</p>
     <div class="filters">${admin ? `<button class="btn pri" data-au-plan ${missingPlan ? '' : 'disabled'}>Schedule ${missingPlan} inspection${missingPlan === 1 ? '' : 's'}</button>` : ''}${admin ? `<label class="au-sw"><input type="checkbox" data-au-auto="plan" ${c.auto.plan ? 'checked' : ''}><span></span>Run automatically at the start of each month</label>` : ''}</div></div>
    <div class="panel au-act"><h2>Systemic actions for repeat findings</h2><p>${rep.length ? `${rep.length} repeat finding${rep.length > 1 ? 's' : ''} without a systemic action.` : 'No repeat findings waiting for a systemic action.'}</p>
     <div class="filters"><button class="btn pri" data-au-sys ${rep.length ? '' : 'disabled'}>Create ${rep.length} systemic action${rep.length === 1 ? '' : 's'}</button>${admin ? `<label class="au-sw"><input type="checkbox" data-au-auto="systemic" ${c.auto.systemic ? 'checked' : ''}><span></span>Create automatically</label>` : ''}</div></div>
   </div>
   <h3 class="nvr-g">Rules</h3>
   <div class="au-rules">${AU_RULES.map(([id, t, d]) => { const x = by(id), on = auOn(id); return `<div class="panel au-rule ${on ? '' : 'off'}"><div class="au-rule-h"><div><b>${t}</b><small>${d}</small></div>${admin ? `<label class="au-sw"><input type="checkbox" data-au-rule="${id}" ${on ? 'checked' : ''}><span></span></label>` : ''}<em class="${x.some(a => a.sev === 'critical') ? 'c' : x.some(a => a.sev === 'high') ? 'h' : x.length ? 'm' : 'z'}">${on ? x.length : 'off'}</em></div>
     ${on && x.length ? `<div class="au-list">${x.slice(0, 4).map(a => `<button class="au-item s-${a.sev}" data-au-goi="${al.indexOf(a)}"><i></i><span><b>${esc(a.title)}</b><small>${esc(projName(a.project))} · ${esc(a.detail)}</small></span></button>`).join('')}${x.length > 4 ? `<span class="mx-muted">+${x.length - 4} more</span>` : ''}</div>` : ''}</div>`; }).join('')}</div>
   ${admin ? `<h3 class="nvr-g">Email delivery</h3><div class="panel au-mail"><p>Every morning at 07:00 Riyadh time the server sends the HSE team a digest of overdue and escalated actions, serious and high-potential incidents. The CEO summary goes on the 1st and 15th; the environmental summary on the 1st. It needs the email service keys in Vercel (see the setup note below).</p>
     <div class="fld"><label for="au-rcpt">Recipients (comma separated)</label><input id="au-rcpt" class="mx-in" value="${esc((em.recipients || []).join(', '))}" placeholder="hse.manager@company.com, ceo.office@company.com"></div>
     <div class="filters"><label class="au-sw"><input type="checkbox" id="au-daily" ${em.daily ? 'checked' : ''}><span></span>Daily digest</label><label class="au-sw"><input type="checkbox" id="au-ceo" ${em.ceo ? 'checked' : ''}><span></span>CEO summary (1st & 15th)</label><label class="au-sw"><input type="checkbox" id="au-env" ${em.env ? 'checked' : ''}><span></span>Environmental summary (1st)</label></div>
     <div class="filters"><button class="btn pri" data-au-mailsave>Save email settings</button><button class="btn" data-au-test>Send a test digest now</button><span id="au-test-msg" class="mx-muted"></span></div>
     <details class="rca-q"><summary>Setup note for the administrator</summary><p>In Vercel → Project → Settings → Environment Variables add: <b>RESEND_API_KEY</b> (from resend.com), <b>NAVO_MAIL_FROM</b> (a verified sender, e.g. navo@yourdomain.com), <b>NAVO_SUPABASE_SERVICE_KEY</b> (Supabase → Project settings → API → service role; keep it secret, server only) and <b>CRON_SECRET</b> (any long random text). Then redeploy. Until then nothing is emailed and the bell alerts still work.</p></details></div>` : ''}
  </div>`;
}
async function auSave(patch, msg) {
  const cur = (L.structure && L.structure.automation) || {};
  const s = { ...(L.structure || DEFAULT_STRUCT), automation: { ...cur, ...patch } };
  const ok = await liveSave(() => L.db.doc('admin/structure').set(s), msg); if (ok !== false) { L.structure = s; render(); }
}

/* ---------- Wiring ---------- */
SOON.auto = ['Automations', '', []]; TITLES.auto = 'Automations';
const auBaseSoon = soon; soon = function () { return st.view === 'auto' ? autoPage() : auBaseSoon(); };
function auNav() { const g = NX_GROUPS.find(x => x[0] === 'admin'); if (g && !g[4].some(i => i[0] === 'auto')) g[4].splice(1, 0, ['auto', 'Automations']); }
const auBaseRender = render;
render = function () { auNav(); auBaseRender(); try { auBell(); } catch (e) {} setTimeout(auRunAutomatic, 0); };

document.addEventListener('click', async e => {
  const t = e.target.closest('[data-au-toggle],[data-au-go],[data-au-goi],[data-au-plan],[data-au-sys],[data-au-mailsave],[data-au-test]');
  if (!t) { if (AU.open && !e.target.closest('#au-bell')) { AU.open = false; auBell(); } return; }
  e.preventDefault(); e.stopPropagation();
  if (t.hasAttribute('data-au-toggle')) { AU.open = !AU.open; auBell(); return; }
  if (t.dataset.auGo != null) return auGo(AU.list[+t.dataset.auGo]);
  if (t.dataset.auGoi != null) return auGo(auAlerts()[+t.dataset.auGoi]);
  if (t.hasAttribute('data-au-plan')) { await auCreatePlan(false); render(); return; }
  if (t.hasAttribute('data-au-sys')) { await auCreateSystemic(false); render(); return; }
  if (t.hasAttribute('data-au-mailsave')) {
    const rc = document.getElementById('au-rcpt').value.split(/[,;\s]+/).map(x => x.trim()).filter(Boolean), bad = rc.filter(x => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x));
    if (bad.length) { toast('Check these addresses: ' + bad.join(', ')); return; }
    return auSave({ email: { recipients: rc, daily: document.getElementById('au-daily').checked, ceo: document.getElementById('au-ceo').checked, env: document.getElementById('au-env').checked } }, 'Email settings saved');
  }
  if (t.hasAttribute('data-au-test')) {
    const m = document.getElementById('au-test-msg'); m.textContent = 'Sending…';
    try {
      const token = L.db && L.db.token ? await L.db.token() : null;
      const r = await fetch('/api/notify?test=1', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: '{}' });
      const j = await r.json().catch(() => ({})); m.textContent = r.ok ? (j.message || 'Test sent.') : (j.error || 'The test could not be sent.');
    } catch (err) { m.textContent = 'The test could not be sent.'; }
  }
}, true);
document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.auRule) return auSave({ rules: { ...auCfg().rules, [t.dataset.auRule]: t.checked } }, t.checked ? 'Rule switched on' : 'Rule switched off');
  if (t.dataset.auAuto) return auSave({ auto: { ...auCfg().auto, [t.dataset.auAuto]: t.checked } }, t.checked ? 'Automatic run switched on' : 'Automatic run switched off');
});
