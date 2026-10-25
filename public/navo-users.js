/* NASS Safe Link accounts: create people in bulk from Excel, and manage every account from one table
   (name, email, password, position, level, projects, disable, delete). Admin only.
   Accounts are created on the server (/api/users); access is saved through the admin's own database rights. */
'use strict';
const ACC = { users: null, loading: false, err: '', rows: null, results: null, edit: null, q: '', busy: false };
const ACC_LEVELS = ['corporate', 'platform', 'division', 'cluster', 'project'];

async function accApi(body) {
  const token = L.db && L.db.token ? await L.db.token() : null;
  const r = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) });
  let d = {}; try { d = await r.json(); } catch (e) {}
  if (!r.ok) throw new Error(d.error || 'The request failed.');
  return d;
}
const accScopes = lvl => [...new Set(L.projects.map(p => p[lvl]).filter(Boolean))].sort();
const accFindProject = v => { v = String(v || '').trim().toLowerCase(); return L.projects.find(p => String(p.id).toLowerCase() === v || String(p.name || '').toLowerCase() === v); };
function accMember(posTitle, level, value, projects, old) {
  const pos = POSITIONS.find(p => p[0] === posTitle);
  const role = pos[1]; level = role === 'admin' ? 'corporate' : level;
  const node = { level, value: level === 'corporate' ? null : level === 'project' ? (projects[0] || null) : value };
  const m = { ...(old || {}), role, title: pos[0], scopeLevel: level, scopeValue: ['platform', 'division', 'cluster'].includes(level) ? value : null };
  m.projects = role === 'admin' ? [] : level === 'project' ? [...new Set(projects)] : orgNodeProjects(node).map(p => p.id);
  return m;
}
/* Check one uploaded row; returns {ok, msg, member} */
function accCheck(r, seen) {
  const errs = [];
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.email || '')) errs.push('email');
  if (seen.has(r.email)) errs.push('repeated email'); seen.add(r.email);
  const pos = POSITIONS.find(p => p[0].toLowerCase() === String(r.position || '').trim().toLowerCase());
  if (!pos) errs.push('position');
  let level = String(r.level || '').trim().toLowerCase() || (pos ? pos[2] : '');
  if (!ACC_LEVELS.includes(level)) errs.push('level');
  let value = null; const projects = [];
  if (['platform', 'division', 'cluster'].includes(level) && pos && pos[1] !== 'admin') {
    value = accScopes(level).find(s => s.toLowerCase() === String(r.scope || '').trim().toLowerCase()) || null;
    if (!value) errs.push(level + ' name');
  }
  (r.projects || []).forEach(x => { const p = accFindProject(x); p ? projects.push(p.id) : errs.push('project ' + x); });
  if (level === 'project' && pos && pos[1] !== 'admin' && !projects.length) errs.push('projects');
  if (r.password && r.password.length < 8) errs.push('password under 8 characters');
  return errs.length ? { ok: false, msg: 'Check: ' + errs.join(', ') } : { ok: true, member: accMember(pos[0], level, value, projects, null), scopeText: level === 'corporate' || pos[1] === 'admin' ? 'Everything' : level === 'project' ? projects.map(projName).join(', ') : value };
}
function accDownload(b64, name, type) {
  const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([u], { type })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
async function accLoad(force) {
  if (ACC.loading || (ACC.users && !force)) return;
  ACC.loading = true; ACC.err = '';
  try { ACC.users = (await accApi({ op: 'list' })).users; } catch (e) { ACC.err = e.message; ACC.users = ACC.users || []; }
  ACC.loading = false; if (st.view === 'access' && ORG.tab === 'accounts') render();
}
const accWhen = s => s ? new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Never';
function accScopeText(m) {
  if (!m) return '<span class="mx-muted">No access</span>';
  if (m.role === 'admin' || m.scopeLevel === 'corporate') return 'Corporate · everything';
  if (m.scopeLevel === 'project' || !m.scopeLevel) return 'Project · ' + esc((m.projects || []).map(projName).join(', ') || '—');
  return esc(LEVEL_LABEL[m.scopeLevel] + ' · ' + (m.scopeValue || ''));
}

function accPreview() {
  const seen = new Set(), checked = ACC.rows.map(r => ({ r, c: accCheck(r, seen) })), good = checked.filter(x => x.c.ok).length;
  return `<div class="panel"><h2>Check before creating · ${ACC.rows.length} rows</h2>
  <p class="mx-muted">${good} ready${good < ACC.rows.length ? `, <b style="color:#b42318">${ACC.rows.length - good} need fixing</b> (fix them in Excel and upload again, or create the ready ones now)` : ''}. People who already have an account keep their password; their access is updated.</p>
  <div class="acc-table-wrap"><table class="acc-table"><thead><tr><th></th><th>Name</th><th>Email</th><th>Position</th><th>Sees</th><th>Password</th></tr></thead><tbody>
  ${checked.map(({ r, c }) => `<tr class="${c.ok ? '' : 'bad'}"><td>${c.ok ? '✓' : '!'}</td><td>${esc(r.name)}</td><td>${esc(r.email)}</td><td>${esc(r.position)}</td><td>${c.ok ? esc(c.scopeText) : `<b>${esc(c.msg)}</b>`}</td><td>${r.password ? 'Set in file' : 'Generated'}</td></tr>`).join('')}
  </tbody></table></div>
  <div class="filters" style="margin-top:12px"><button class="btn primary" data-acc-create ${good && !ACC.busy ? '' : 'disabled'}>${ACC.busy ? 'Creating…' : `Create ${good} account${good === 1 ? '' : 's'}`}</button><button class="btn" data-acc-cancel>Cancel</button></div></div>`;
}
function accResults() {
  const R = ACC.results, pw = R.filter(r => r.password);
  return `<div class="panel acc-done"><h2>Done</h2><p>${R.filter(r => r.status === 'created').length} created · ${R.filter(r => r.status === 'existing').length} already existed (access updated) · ${R.filter(r => r.status === 'error').length} failed</p>
  ${pw.length ? `<div class="nvi-alert" style="background:#fff8e6;border-color:#f3d48a;color:#7a4b00">These passwords are shown only now. Download them and hand each person their own.</div>` : ''}
  <div class="acc-table-wrap"><table class="acc-table"><thead><tr><th>Email</th><th>Result</th><th>Password</th></tr></thead><tbody>
  ${R.map(r => `<tr class="${r.status === 'error' ? 'bad' : ''}"><td>${esc(r.email)}</td><td>${r.status === 'created' ? 'Created' : r.status === 'existing' ? 'Existing · access updated' : esc(r.message || 'Failed')}</td><td>${r.password ? `<code>${esc(r.password)}</code>` : r.status === 'created' ? 'As in file' : ''}</td></tr>`).join('')}
  </tbody></table></div>
  <div class="filters" style="margin-top:12px">${pw.length ? '<button class="btn primary" data-acc-cred>Download sign-in list (CSV)</button>' : ''}<button class="btn" data-acc-close-results>Close</button></div></div>`;
}
function accEdit() {
  const E = ACC.edit, pos = POSITIONS.find(p => p[0] === E.title), admin = pos && pos[1] === 'admin';
  const scopes = ['platform', 'division', 'cluster'].includes(E.level) ? accScopes(E.level) : [];
  return `<div class="acc-modal" role="dialog" aria-modal="true" aria-label="Edit account"><div class="acc-sheet">
  <div class="acc-sheet-h"><h2>${esc(E.name || E.email)}</h2><button class="btn" data-acc-edit-close aria-label="Close">✕</button></div>
  <div class="acc-form">
   <div class="fld"><label for="acc-name">Full name</label><input id="acc-name" class="mx-in" value="${esc(E.name)}"></div>
   <div class="fld"><label for="acc-email">Email (sign-in)</label><input id="acc-email" class="mx-in" type="email" value="${esc(E.email)}"></div>
   <div class="fld"><label for="acc-pos">Position</label><select id="acc-pos" class="mx-in">${POSITIONS.map(p => `<option ${p[0] === E.title ? 'selected' : ''}>${esc(p[0])}</option>`).join('')}</select><small class="mx-muted">${pos ? esc(ROLES[pos[1]] + ' · ' + pos[3]) : 'Pick a position'}</small></div>
   ${admin ? '<p class="mx-muted">System admins see everything.</p>' : `
   <div class="fld"><label for="acc-level">Sees</label><select id="acc-level" class="mx-in">${ACC_LEVELS.map(l => `<option value="${l}" ${l === E.level ? 'selected' : ''}>${LEVEL_LABEL[l]}${l === 'corporate' ? ' (everything)' : ''}</option>`).join('')}</select></div>
   ${scopes.length || ['platform', 'division', 'cluster'].includes(E.level) ? `<div class="fld"><label for="acc-scope">${LEVEL_LABEL[E.level]}</label><select id="acc-scope" class="mx-in">${scopes.map(s => `<option ${s === E.value ? 'selected' : ''}>${esc(s)}</option>`).join('') || '<option value="">None set on projects yet</option>'}</select></div>` : ''}
   ${E.level === 'project' ? `<div class="fld"><label>Projects</label><div class="acc-chips">${L.projects.map(p => `<button type="button" class="${E.projects.includes(p.id) ? 'on' : ''}" data-acc-proj="${esc(p.id)}">${esc(p.name || p.id)}</button>`).join('')}</div></div>` : ''}`}
   <div class="fld acc-pw"><label for="acc-pw">New password</label><div class="acc-row"><input id="acc-pw" class="mx-in" type="text" autocomplete="new-password" placeholder="Leave empty to keep the current one" value="${esc(E.pw || '')}"><button type="button" class="btn" data-acc-gen>Generate</button></div></div>
  </div>
  <div class="filters acc-foot"><button class="btn primary" data-acc-save ${ACC.busy ? 'disabled' : ''}>${ACC.busy ? 'Saving…' : 'Save changes'}</button>
   ${E.id !== L.me?.id ? `<button class="btn" data-acc-toggle>${E.disabled ? 'Enable account' : 'Disable account'}</button><button class="btn danger" data-acc-del>Delete account</button>` : ''}</div>
  </div></div>`;
}
function accountsPage() {
  accLoad();
  const U = ACC.users || [], q = ACC.q.trim().toLowerCase();
  const list = U.filter(u => !q || (u.name + ' ' + u.email + ' ' + (L.members[u.id]?.title || '')).toLowerCase().includes(q)).sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
  const noAccess = U.filter(u => !L.members[u.id]).length;
  return `${ACC.err ? `<div class="nvi-alert">${esc(ACC.err)}</div>` : ''}
  <div class="panel acc-upload"><div><h2>Add people from Excel</h2><p class="mx-muted">1. Download the template · 2. One row per person: name, email, position, level · 3. Upload. NASS Safe Link creates the accounts, sets their access and gives you the passwords.</p></div>
   <div class="filters"><button class="btn" data-acc-tpl>Download template</button><label class="btn primary acc-file">Upload Excel<input type="file" id="acc-file" accept=".xlsx" hidden></label><button class="btn" data-acc-one>Add one person</button></div></div>
  ${ACC.results ? accResults() : ACC.rows ? accPreview() : ''}
  <div class="panel"><div class="acc-head"><h2>All accounts · ${U.length}</h2>${noAccess ? `<span class="acc-pill">${noAccess} without access</span>` : ''}<input id="acc-q" class="mx-in" placeholder="Search name, email or position" value="${esc(ACC.q)}"><button class="btn" data-acc-refresh>Refresh</button></div>
  ${ACC.loading && !ACC.users ? '<p class="mx-muted">Loading accounts…</p>' : `<div class="acc-table-wrap"><table class="acc-table"><thead><tr><th>Name</th><th>Email</th><th>Position</th><th>Sees</th><th>Last sign-in</th><th>Status</th><th></th></tr></thead><tbody>
  ${list.map(u => { const m = L.members[u.id]; return `<tr class="${u.disabled ? 'off' : ''}"><td><b>${esc(u.name || '—')}</b>${u.id === L.me?.id ? ' <small>(you)</small>' : ''}</td><td>${esc(u.email)}</td><td>${esc(m?.title || (m ? ROLES[m.role] : ''))}</td><td>${accScopeText(m)}</td><td>${accWhen(u.lastSignIn)}</td><td>${u.disabled ? '<span class="acc-st off">Disabled</span>' : m ? '<span class="acc-st on">Active</span>' : '<span class="acc-st no">No access</span>'}</td><td><button class="btn" data-acc-open="${esc(u.id)}">Edit</button></td></tr>`; }).join('') || '<tr><td colspan="7" class="mx-muted">No accounts found.</td></tr>'}
  </tbody></table></div>`}</div>
  ${ACC.edit ? accEdit() : ''}`;
}

/* ---------- hook into Organisation & access ---------- */
const accBaseAccess = access;
access = function () {
  const html = accBaseAccess();
  if (myRole() !== 'admin') return html;
  const btn = `<button data-org-tab="accounts" aria-current="${ORG.tab === 'accounts'}">Accounts & passwords</button>`;
  const withTab = html.replace('<button data-org-tab="projects"', btn + '<button data-org-tab="projects"');
  if (ORG.tab !== 'accounts') return withTab;
  const cut = withTab.indexOf('</div>', withTab.indexOf('class="org-tabs"')) + 6;
  return withTab.slice(0, cut) + accountsPage();
};

function accOpen(uid) {
  const u = (ACC.users || []).find(x => x.id === uid) || { id: uid, email: '', name: '' }, m = L.members[uid];
  ACC.edit = { id: uid, name: u.name, email: u.email, disabled: u.disabled, title: m?.title || (m?.role === 'admin' ? 'System administrator' : 'Site worker / reporter'), level: m?.role === 'admin' ? 'corporate' : (m?.scopeLevel || 'project'), value: m?.scopeValue || null, projects: [...(m?.projects || [])], pw: '' };
}
function accReadForm() {
  const E = ACC.edit, g = id => document.getElementById(id);
  if (g('acc-name')) E.name = g('acc-name').value; if (g('acc-email')) E.email = g('acc-email').value.trim();
  if (g('acc-pos')) E.title = g('acc-pos').value; if (g('acc-level')) E.level = g('acc-level').value;
  if (g('acc-scope')) E.value = g('acc-scope').value || null; if (g('acc-pw')) E.pw = g('acc-pw').value;
}
async function accSaveEdit() {
  accReadForm(); const E = ACC.edit, u = (ACC.users || []).find(x => x.id === E.id) || {};
  if (E.pw && E.pw.length < 8) { toast('Passwords need at least 8 characters.'); return; }
  const pos = POSITIONS.find(p => p[0] === E.title);
  if (pos[1] !== 'admin' && E.level === 'project' && !E.projects.length) { toast('Pick at least one project.'); return; }
  if (pos[1] !== 'admin' && ['platform', 'division', 'cluster'].includes(E.level) && !E.value) { toast('Pick the ' + LEVEL_LABEL[E.level].toLowerCase() + '.'); return; }
  if (E.id === L.me?.id && L.members[E.id]?.role === 'admin' && pos[1] !== 'admin') { toast('You cannot remove your own admin rights.'); return; }
  ACC.busy = true; render();
  try {
    const body = { op: 'update', id: E.id };
    if (E.name !== u.name) body.name = E.name;
    if (E.email && E.email !== u.email) body.email = E.email;
    if (E.pw) body.password = E.pw;
    if (Object.keys(body).length > 2) await accApi(body);
    const m = accMember(E.title, E.level, E.value, E.projects, L.members[E.id]);
    const ok = await liveSave(() => saveMembers({ ...L.members, [E.id]: m }), null);
    if (ok !== false) L.members = { ...L.members, [E.id]: m };
    Object.assign(u, { name: E.name, email: E.email || u.email });
    toast(E.pw ? 'Saved. New password: ' + E.pw : 'Account saved'); ACC.edit = null;
  } catch (e) { toast(e.message); }
  ACC.busy = false; render();
}
async function accCreate() {
  const seen = new Set(), ready = ACC.rows.map(r => ({ r, c: accCheck(r, seen) })).filter(x => x.c.ok);
  if (!ready.length) return; ACC.busy = true; render();
  try {
    const res = (await accApi({ op: 'create', users: ready.map(x => ({ email: x.r.email, name: x.r.name, password: x.r.password })) })).results;
    const next = { ...L.members };
    res.forEach(r => { if (!r.id) return; const x = ready.find(y => y.r.email === r.email); if (x) next[r.id] = r.id === L.me?.id ? next[r.id] : { ...(next[r.id] || {}), ...x.c.member }; });
    await liveSave(() => saveMembers(next), null); L.members = next;
    ACC.results = res.map(r => ({ ...r, name: (ready.find(y => y.r.email === r.email) || {}).r?.name || '' })); ACC.rows = null; ACC.users = null; accLoad(true);
  } catch (e) { toast(e.message); }
  ACC.busy = false; render();
}
const csvCell = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';

document.addEventListener('change', async e => {
  if (e.target.id === 'acc-file') {
    const f = e.target.files[0]; if (!f) return;
    if (f.size > 5e6) { toast('The file must be smaller than 5 MB.'); return; }
    const b64 = await new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(f); });
    toast('Reading ' + f.name + '…');
    try { const d = await accApi({ op: 'parse', file: b64 }); ACC.rows = d.rows; ACC.results = null; if (!d.rows.length) toast('No people found in the file.'); } catch (err) { toast(err.message); }
    render(); return;
  }
  if (ACC.edit && ['acc-pos', 'acc-level'].includes(e.target.id)) { accReadForm(); if (e.target.id === 'acc-pos') { const p = POSITIONS.find(x => x[0] === ACC.edit.title); if (p) ACC.edit.level = p[2]; } if (!['platform', 'division', 'cluster'].includes(ACC.edit.level)) ACC.edit.value = null; else if (!accScopes(ACC.edit.level).includes(ACC.edit.value)) ACC.edit.value = accScopes(ACC.edit.level)[0] || null; render(); }
});
let accTimer = null;
document.addEventListener('input', e => {
  if (e.target.id !== 'acc-q') return; ACC.q = e.target.value; clearTimeout(accTimer);
  accTimer = setTimeout(() => { render(); const i = document.getElementById('acc-q'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 200);
});
document.addEventListener('click', async e => {
  const t = e.target.closest('[data-acc-tpl],[data-acc-one],[data-acc-create],[data-acc-cancel],[data-acc-cred],[data-acc-close-results],[data-acc-refresh],[data-acc-open],[data-acc-edit-close],[data-acc-proj],[data-acc-gen],[data-acc-save],[data-acc-toggle],[data-acc-del]');
  if (!t) { if (e.target.classList?.contains('acc-modal')) { ACC.edit = null; render(); } return; }
  e.preventDefault(); const D = t.dataset;
  if (t.hasAttribute('data-acc-tpl')) {
    try { const d = await accApi({ op: 'template', positions: POSITIONS.map(p => p[0]), scopes: [...new Set(['platform', 'division', 'cluster'].flatMap(accScopes))], projects: L.projects.map(p => p.id) }); accDownload(d.file, 'NASS Safe Link accounts template.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); } catch (err) { toast(err.message); }
    return;
  }
  if (t.hasAttribute('data-acc-one')) { const email = prompt('Email of the new person'); if (!email) return; const name = prompt('Full name') || ''; ACC.rows = [{ name, email: email.trim().toLowerCase(), position: 'Site worker / reporter', level: 'project', scope: '', projects: L.projects.slice(0, 1).map(p => p.id), password: '' }]; ACC.results = null; }
  if (t.hasAttribute('data-acc-create')) return accCreate();
  if (t.hasAttribute('data-acc-cancel')) ACC.rows = null;
  if (t.hasAttribute('data-acc-close-results')) ACC.results = null;
  if (t.hasAttribute('data-acc-cred')) {
    const rows = [['Name', 'Email', 'Password', 'Sign in at']].concat(ACC.results.filter(r => r.password).map(r => [r.name, r.email, r.password, location.origin]));
    const csv = '﻿' + rows.map(r => r.map(csvCell).join(',')).join('\r\n');
    accDownload(btoa(unescape(encodeURIComponent(csv))), 'NASS Safe Link sign-in list.csv', 'text/csv'); return;
  }
  if (t.hasAttribute('data-acc-refresh')) { ACC.users = null; accLoad(true); }
  if (D.accOpen) accOpen(D.accOpen);
  if (t.hasAttribute('data-acc-edit-close')) ACC.edit = null;
  if (D.accProj && ACC.edit) { accReadForm(); const s = new Set(ACC.edit.projects); s.has(D.accProj) ? s.delete(D.accProj) : s.add(D.accProj); ACC.edit.projects = [...s]; }
  if (t.hasAttribute('data-acc-gen') && ACC.edit) { accReadForm(); const A = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789', r = crypto.getRandomValues(new Uint32Array(12)); ACC.edit.pw = 'N' + [...r].map(x => A[x % A.length]).join('').slice(1, 11) + '7'; }
  if (t.hasAttribute('data-acc-save')) return accSaveEdit();
  if (t.hasAttribute('data-acc-toggle') && ACC.edit) {
    accReadForm(); const E = ACC.edit;
    try { await accApi({ op: 'update', id: E.id, disabled: !E.disabled }); E.disabled = !E.disabled; const u = ACC.users.find(x => x.id === E.id); if (u) u.disabled = E.disabled; toast(E.disabled ? 'Account disabled: they can no longer sign in' : 'Account enabled'); } catch (err) { toast(err.message); }
  }
  if (t.hasAttribute('data-acc-del') && ACC.edit) {
    const E = ACC.edit; if (!confirm('Delete the account of ' + (E.name || E.email) + '? Their reports stay in NASS Safe Link. This cannot be undone.')) return;
    try { await accApi({ op: 'delete', id: E.id }); const next = { ...L.members }; delete next[E.id]; if (L.members[E.id]) { await liveSave(() => saveMembers(next), null); L.members = next; } ACC.users = ACC.users.filter(x => x.id !== E.id); ACC.edit = null; toast('Account deleted'); } catch (err) { toast(err.message); }
  }
  render();
}, true);
/* the edit panel sits above everything, so it lives on <body> rather than inside the animated page */
const accBaseRender = render;
render = function () {
  document.querySelectorAll('body > .acc-modal').forEach(n => { try { if (n.parentNode) n.parentNode.removeChild(n); } catch (e) {} });
  accBaseRender();
  const m = document.querySelector('#view .acc-modal'); if (m) document.body.appendChild(m);
};
