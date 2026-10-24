/* NAVO organisation & access.
   One screen to decide who sees what: corporate → platform → division → cluster → project.
   Each person gets a position; the position sets the permission tier and the default level of the organisation they see.
   The database enforces the same scopes (supabase/021_scope_access.sql). */
'use strict';
Object.assign(ROLES, { admin: 'System admin', hse: 'HSE full rights', supervisor: 'Supervisor rights', worker: 'Reporter', viewer: 'View only' });
const ORG = { node: { level: 'corporate', value: null }, tab: 'access', q: '', hits: [], pick: null, form: null, preview: null };
const POSITIONS = [
  // [title, role, default level, description]
  ['System administrator', 'admin', 'corporate', 'Manages users, structure and settings; sees everything'],
  ['CEO / executive', 'viewer', 'corporate', 'Reads every dashboard and report across the organisation'],
  ['Corporate HSE director', 'hse', 'corporate', 'Full HSE rights across the organisation'],
  ['Platform director', 'viewer', 'platform', 'Reads dashboards and records for the platform'],
  ['Platform HSE head', 'hse', 'platform', 'Full HSE rights in the platform'],
  ['Division director', 'viewer', 'division', 'Reads dashboards and records for the division'],
  ['Division HSE manager', 'hse', 'division', 'Full HSE rights in the division'],
  ['Cluster HSE lead', 'hse', 'cluster', 'Full HSE rights in the cluster'],
  ['Project director / manager', 'viewer', 'project', 'Reads the project dashboards and records'],
  ['Project HSE manager', 'hse', 'project', 'Runs HSE for the project: records, investigations, approvals'],
  ['HSE engineer / officer', 'hse', 'project', 'Records, inspects, investigates and closes actions'],
  ['Supervisor / foreman', 'supervisor', 'project', 'Reports, inspects and works on actions'],
  ['Site worker / reporter', 'worker', 'project', 'Reports hazards and incidents, sees own project actions'],
];
const CAPS = [['View dashboards & reports', r => r !== 'worker'], ['Report hazards & incidents', () => true], ['Conduct inspections', r => ['admin', 'hse', 'supervisor'].includes(r)], ['Create & manage actions', r => ['admin', 'hse', 'supervisor'].includes(r)],
  ['Investigate & approve', r => ['admin', 'hse'].includes(r)], ['Enter performance data', r => ['admin', 'hse', 'supervisor'].includes(r)], ['Manage users & settings', r => r === 'admin']];
const LEVEL_LABEL = { corporate: 'Corporate', platform: 'Platform', division: 'Division', cluster: 'Cluster', project: 'Project' };

/* ---------- Scope rules (same as the database) ---------- */
function orgProjectsFor(m) {
  if (!m) return [];
  if (m.role === 'admin') return L.projects;
  const v = m.scopeValue, ex = new Set(m.projects || []);
  return L.projects.filter(p => ex.has(p.id) || m.scopeLevel === 'corporate' || (m.scopeLevel === 'platform' && p.platform === v) || (m.scopeLevel === 'division' && p.division === v) || (m.scopeLevel === 'cluster' && p.cluster === v));
}
myProjects = function () { if (myRole() === 'admin') return L.projects; return orgProjectsFor(L.members[L.me?.id]); };
const orgNodeProjects = n => L.projects.filter(p => n.level === 'corporate' || (n.level === 'platform' && p.platform === n.value) || (n.level === 'division' && p.division === n.value) || (n.level === 'cluster' && p.cluster === n.value) || (n.level === 'project' && p.id === n.value));
const orgNodeName = n => n.level === 'corporate' ? ((L.structure && L.structure.corporation) || 'Corporation') : n.level === 'project' ? projName(n.value) : n.value;
function orgCovers(m, n) {
  if (m.role === 'admin' || m.scopeLevel === 'corporate') return n.level === 'corporate' ? 'direct' : 'corporate';
  const P = orgNodeProjects(n); if (!P.length) return null;
  const mine = new Set(orgProjectsFor(m).map(p => p.id));
  return P.every(p => mine.has(p.id)) ? (m.scopeLevel === n.level && (m.scopeValue === n.value || n.level === 'project') ? 'direct' : 'inherited') : null;
}

/* ---------- Tree ---------- */
function orgTree() {
  const plats = [...new Set(L.projects.map(p => p.platform || 'Unassigned'))];
  const count = n => Object.values(L.members).filter(m => m.role !== 'admin' && m.scopeLevel === n.level && (n.level === 'project' ? (m.projects || []).includes(n.value) : m.scopeValue === n.value || n.level === 'corporate')).length;
  const row = (n, depth, label, sub) => { const sel = ORG.node.level === n.level && ORG.node.value === n.value, c = count(n);
    return `<button class="org-n d${depth} ${sel ? 'on' : ''}" data-org-node="${n.level}|${esc(n.value || '')}"><span class="org-lv l-${n.level}">${LEVEL_LABEL[n.level][0]}</span><span class="org-nm">${esc(label)}</span>${sub ? `<small>${sub}</small>` : ''}${c ? `<em>${c}</em>` : ''}</button>`; };
  let out = row({ level: 'corporate', value: null }, 0, orgNodeName({ level: 'corporate' }), `${L.projects.length} projects`);
  plats.forEach(pl => {
    const pp = L.projects.filter(p => (p.platform || 'Unassigned') === pl); out += row({ level: 'platform', value: pl }, 1, pl, `${pp.length}`);
    [...new Set(pp.map(p => p.division || 'Unassigned'))].forEach(dv => {
      const dp = pp.filter(p => (p.division || 'Unassigned') === dv); out += row({ level: 'division', value: dv }, 2, dv, `${dp.length}`);
      const cls = [...new Set(dp.map(p => p.cluster).filter(Boolean))];
      cls.forEach(cl => { const cp = dp.filter(p => p.cluster === cl); out += row({ level: 'cluster', value: cl }, 3, cl, `${cp.length}`); cp.forEach(p => out += row({ level: 'project', value: p.id }, 4, p.name)); });
      dp.filter(p => !p.cluster).forEach(p => out += row({ level: 'project', value: p.id }, 3, p.name));
    });
  });
  return `<div class="org-tree" role="tree">${out}</div>`;
}

/* ---------- Node detail ---------- */
function orgPerson(uid, m, how) {
  return `<div class="org-p"><span class="nv-avatar sm">${esc(((m.title || ROLES[m.role] || '?')[0] || '?').toUpperCase())}</span><div><b class="uname" data-uid="${esc(uid)}">…</b><small>${esc(m.title || ROLES[m.role] || m.role)} · ${LEVEL_LABEL[m.scopeLevel || 'project']}${m.scopeValue ? ' ' + esc(m.scopeValue) : ''}</small></div>
   <span class="org-badge r-${m.role}">${esc(ROLES[m.role] || m.role)}</span>${how === 'inherited' || how === 'corporate' ? `<span class="org-inh">${how === 'corporate' ? 'Corporate' : 'From a higher level'}</span>` : `<button class="btn" data-org-edit="${esc(uid)}">Edit</button>`}
   <button class="btn" data-org-preview="${esc(uid)}" title="See what this person sees">View as</button></div>`;
}
function orgForm() {
  const f = ORG.form; if (!f) return '';
  const n = f.node, allowed = POSITIONS.filter(p => p[2] === n.level || (n.level !== 'project' && p[1] === 'admin'));
  const pos = POSITIONS.find(p => p[0] === f.title) || allowed[0]; if (!f.title) f.title = pos[0];
  const P = n.level === 'project' ? L.projects : [];
  return `<div class="org-form"><h4>${f.uid ? 'Edit access' : 'Give access'} · ${esc(orgNodeName(n))}</h4>
   ${f.uid ? `<p><b class="uname" data-uid="${esc(f.uid)}">…</b></p>` : `<div class="fld"><label for="org-q">Find the person (they must have signed in once)</label><input id="org-q" class="mx-in" placeholder="Name or email" value="${esc(ORG.q)}" autocomplete="off"></div>
   <div class="org-hits">${ORG.hits.map(h => `<button class="${ORG.pick === h.id ? 'on' : ''}" data-org-pick="${esc(h.id)}">${esc(h.name)}${h.isMe ? ' (you)' : ''}</button>`).join('') || (ORG.q ? '<span class="mx-muted">No match yet.</span>' : '')}</div>`}
   <div class="fld"><label>Position</label><div class="org-pos">${allowed.map(p => `<button class="${f.title === p[0] ? 'on' : ''}" data-org-pos="${esc(p[0])}"><b>${esc(p[0])}</b><small>${esc(p[3])}</small><span class="org-badge r-${p[1]}">${esc(ROLES[p[1]])}</span></button>`).join('')}</div></div>
   ${n.level === 'project' ? `<div class="fld"><label>Projects this person works on</label><div class="chips">${P.map(p => `<button data-org-proj="${esc(p.id)}" aria-pressed="${(f.projects || []).includes(p.id)}">${esc(p.name)}</button>`).join('')}</div></div>` : ''}
   <label class="au-sw"><input type="checkbox" id="org-leader" ${f.leader ? 'checked' : ''}><span></span>Counts as a leader for leadership engagement</label>
   <div class="filters"><button class="btn pri" data-org-save ${f.uid || ORG.pick ? '' : 'disabled'}>Save access</button>${f.uid ? `<button class="btn" data-org-remove="${esc(f.uid)}">Remove access</button>` : ''}<button class="btn" data-org-cancel>Cancel</button></div></div>`;
}
function orgPreview() {
  const uid = ORG.preview; if (!uid) return ''; const m = L.members[uid]; if (!m) return '';
  const P = orgProjectsFor(m);
  return `<div class="org-prev"><div class="org-prev-h"><h4>What <span class="uname" data-uid="${esc(uid)}">…</span> sees</h4><button class="btn" data-org-preview-close>Close</button></div>
   <p>${esc(m.title || ROLES[m.role])} · ${LEVEL_LABEL[m.scopeLevel || 'project']} ${esc(m.scopeValue || '')} · <b>${m.role === 'admin' ? L.projects.length : P.length}</b> of ${L.projects.length} projects</p>
   <div class="org-caps">${CAPS.map(([l, f]) => `<span class="${f(m.role) ? 'y' : 'n'}">${f(m.role) ? '✓' : '—'} ${l}</span>`).join('')}</div>
   <div class="chips">${(m.role === 'admin' ? L.projects : P).slice(0, 40).map(p => `<span class="org-chip">${esc(p.name)}</span>`).join('')}</div></div>`;
}
function orgDetail() {
  const n = ORG.node, P = orgNodeProjects(n), M = Object.entries(L.members);
  const direct = M.filter(([, m]) => orgCovers(m, n) === 'direct'), inh = M.filter(([, m]) => ['inherited', 'corporate'].includes(orgCovers(m, n)));
  return `<div class="org-detail"><div class="org-dh"><span class="org-lv big l-${n.level}">${LEVEL_LABEL[n.level]}</span><div><h3>${esc(orgNodeName(n))}</h3><small>${P.length} project${P.length === 1 ? '' : 's'} · ${direct.length + inh.length} ${direct.length + inh.length === 1 ? 'person' : 'people'} can see it</small></div>
    <button class="btn pri" data-org-add>+ Give access here</button></div>
   ${orgForm()}${orgPreview()}
   <h4 class="org-h">Assigned at this level <small>${direct.length}</small></h4>${direct.length ? direct.map(([u, m]) => orgPerson(u, m, 'direct')).join('') : '<p class="mx-muted">Nobody is assigned at this level yet.</p>'}
   <h4 class="org-h">Can also see it <small>${inh.length}</small></h4>${inh.length ? inh.map(([u, m]) => orgPerson(u, m, orgCovers(m, n))).join('') : '<p class="mx-muted">Only the people above.</p>'}
  </div>`;
}
function orgMatrix() {
  return `<div class="panel org-matrix"><h2>What each position can do</h2><div class="tbl"><table><thead><tr><th>Position</th><th>Sees</th>${CAPS.map(c => `<th class="c">${c[0]}</th>`).join('')}</tr></thead><tbody>
   ${POSITIONS.map(([t, r, lv]) => `<tr><td><b>${esc(t)}</b><br><span class="org-badge r-${r}">${esc(ROLES[r])}</span></td><td>${LEVEL_LABEL[lv]}</td>${CAPS.map(([, f]) => `<td class="c">${f(r) ? '<span class="org-y">✓</span>' : '<span class="org-n0">—</span>'}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
}

/* ---------- Page ---------- */
/* Other features add tabs (addOrgTab) and admin panels (addOrgPanel) here instead of wrapping access(). */
const ORG_TABS = [], ORG_PANELS = [];
function addOrgTab(id, label, page) { ORG_TABS.push([id, label, page]); }
function addOrgPanel(f) { ORG_PANELS.push(f); }
const orgBaseAccess = access;
access = function () {
  if (myRole() !== 'admin') return orgBaseAccess();
  const M = Object.values(L.members), lv = l => M.filter(m => (m.scopeLevel || 'project') === l && m.role !== 'admin').length;
  const tabs = `<div class="org-tabs"><button data-org-tab="access" aria-current="${ORG.tab === 'access'}">People & access</button>${ORG_TABS.map(([id, l]) => `<button data-org-tab="${id}" aria-current="${ORG.tab === id}">${l}</button>`).join('')}<button data-org-tab="projects" aria-current="${ORG.tab === 'projects'}">Projects</button><button data-org-tab="matrix" aria-current="${ORG.tab === 'matrix'}">Permissions</button></div>`;
  const banner = L.scopeReady === false ? `<div class="nvi-alert">The database has not been updated for organisation levels yet. Until <b>supabase/021_scope_access.sql</b> is run in Supabase, people are saved with their project list only and leaders are saved as site workers.</div>` : '';
  const head = `<div class="nvr-hero org-hero"><div><span class="nvi-eyebrow">Organisation & access</span><h2>Who sees what, in one place.</h2><p>Corporate sees everything, a division sees its division, a project team sees its project. Pick a level on the left, then give access.</p></div>
   <div class="au-sum"><span>${lv('corporate') + M.filter(m => m.role === 'admin').length}<small>corporate</small></span><span>${lv('platform')}<small>platform</small></span><span>${lv('division') + lv('cluster')}<small>division</small></span><span>${lv('project')}<small>project</small></span></div></div>`;
  const extra = ORG_PANELS.map(f => { try { return f() || ''; } catch (e) { console.error(e); return ''; } }).join('');
  const custom = ORG_TABS.find(t => t[0] === ORG.tab);
  if (custom) return head + tabs + custom[2]() + extra;
  if (ORG.tab === 'projects') return head + tabs + banner + orgBaseAccess() + extra;
  if (ORG.tab === 'matrix') return head + tabs + orgMatrix() + extra;
  return head + tabs + banner + `<div class="org-grid"><div class="panel org-left"><h2>Organisation</h2>${orgTree()}</div><div class="panel org-right">${orgDetail()}</div></div>` + extra;
};

onAfterRender(function () {if (st.view === 'access' && ORG.tab === 'projects') { // the projects tab keeps the project table only; people are managed in People & access
    document.querySelectorAll('#view .panel').forEach(p => { if (p.querySelector('#acc-hits') || /People with access/.test(p.querySelector('h2')?.textContent || '')) p.remove(); });
  }
if (st.view === 'access') { try { fillNames(); } catch (e) {} }});

async function orgSave() {
  const f = ORG.form, uid = f.uid || ORG.pick; if (!uid) return;
  const pos = POSITIONS.find(p => p[0] === f.title); const n = f.node;
  const lead = document.getElementById('org-leader')?.checked;
  const m = { ...(L.members[uid] || {}), role: pos[1], title: pos[0], scopeLevel: pos[1] === 'admin' ? 'corporate' : n.level, scopeValue: pos[1] === 'admin' || n.level === 'corporate' || n.level === 'project' ? null : n.value, leader: !!lead };
  m.projects = n.level === 'project' ? [...new Set([...(f.projects || []), n.value])] : orgNodeProjects(n).map(p => p.id); // project list kept as a fallback until the database is updated
  if (m.role === 'admin') m.projects = [];
  if (uid === L.me?.id && L.members[uid]?.role === 'admin' && m.role !== 'admin') { toast('You cannot remove your own admin rights here.'); return; }
  const ok = await liveSave(() => saveMembers({ ...L.members, [uid]: m }), 'Access saved');
  if (ok !== false) { L.members = { ...L.members, [uid]: m }; ORG.form = null; ORG.pick = null; ORG.q = ''; ORG.hits = []; render(); }
}
async function orgRemove(uid) {
  if (uid === L.me?.id) { toast('You cannot remove your own access.'); return; }
  const next = { ...L.members }; delete next[uid];
  const ok = await liveSave(() => saveMembers(next), 'Access removed'); if (ok !== false) { L.members = next; ORG.form = null; render(); }
}
let orgTimer = null;
document.addEventListener('input', e => {
  if (e.target.id !== 'org-q') return; ORG.q = e.target.value; clearTimeout(orgTimer);
  orgTimer = setTimeout(async () => { if (ORG.q.trim().length < 2) { ORG.hits = []; } else { try { ORG.hits = (await L.user.search(ORG.q.trim())).slice(0, 8); } catch (err) { ORG.hits = []; } } const box = document.querySelector('.org-hits'); if (box) box.innerHTML = ORG.hits.map(h => `<button class="${ORG.pick === h.id ? 'on' : ''}" data-org-pick="${esc(h.id)}">${esc(h.name)}${h.isMe ? ' (you)' : ''}</button>`).join('') || '<span class="mx-muted">No match yet.</span>'; }, 250);
});
document.addEventListener('click', e => {
  const t = e.target.closest('[data-org-node],[data-org-tab],[data-org-add],[data-org-edit],[data-org-pos],[data-org-proj],[data-org-pick],[data-org-save],[data-org-remove],[data-org-cancel],[data-org-preview],[data-org-preview-close]'); if (!t) return;
  e.preventDefault(); e.stopPropagation(); const D = t.dataset;
  if (D.orgNode != null) { const [level, ...v] = D.orgNode.split('|'); ORG.node = { level, value: v.join('|') || null }; ORG.form = null; ORG.preview = null; }
  if (D.orgTab) ORG.tab = D.orgTab;
  if (t.hasAttribute('data-org-add')) { ORG.form = { node: { ...ORG.node }, projects: ORG.node.level === 'project' ? [ORG.node.value] : [] }; ORG.pick = null; ORG.q = ''; ORG.hits = []; }
  if (D.orgEdit) { const m = L.members[D.orgEdit]; ORG.form = { uid: D.orgEdit, node: { ...ORG.node }, title: m.title, projects: [...(m.projects || [])], leader: m.leader }; }
  if (D.orgPos && ORG.form) ORG.form.title = D.orgPos;
  if (D.orgProj && ORG.form) { const s = new Set(ORG.form.projects || []); s.has(D.orgProj) ? s.delete(D.orgProj) : s.add(D.orgProj); ORG.form.projects = [...s]; }
  if (D.orgPick) ORG.pick = D.orgPick;
  if (t.hasAttribute('data-org-save')) return orgSave();
  if (D.orgRemove) return orgRemove(D.orgRemove);
  if (t.hasAttribute('data-org-cancel')) ORG.form = null;
  if (D.orgPreview) ORG.preview = D.orgPreview;
  if (t.hasAttribute('data-org-preview-close')) ORG.preview = null;
  const y = window.scrollY; render(); window.scrollTo(0, y);
}, true);
Object.assign(TITLES, { access: 'Organisation & access' });
