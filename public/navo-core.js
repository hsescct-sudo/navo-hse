'use strict';
/* NAVO core (v3): the final word on navigation and the organisation filter.
   Loaded last. One place defines the menu (three sections) and one filter scopes every page. */

/* ================= 1. one organisation filter for the whole site ================= */
const NF = (() => { try { return JSON.parse(localStorage.getItem('navo-org-filter') || '{}'); } catch (e) { return {}; } })();
const nfSave = () => { try { localStorage.setItem('navo-org-filter', JSON.stringify(NF)); } catch (e) { } };
const nfPl = p => p.platform || 'Construction', nfDv = p => p.division || 'Unassigned', nfCl = p => p.cluster || '';
const nfActive = () => !!(NF.plat || NF.div || NF.clu || NF.proj);
const NF_SKIP = ['access', 'settings', 'report', 'auto', 'flows', 'hdata', 'entry', 'm-devices', 'm-qr', 'm-dguide', 'caseedit'];
const nfBase = myProjects;
myProjects = function () {
  let P = nfBase.apply(this, arguments) || [];
  if (NF_SKIP.includes(st.view)) return P;
  if (NF.plat) P = P.filter(p => nfPl(p) === NF.plat);
  if (NF.div) P = P.filter(p => nfDv(p) === NF.div);
  if (NF.clu) P = P.filter(p => nfCl(p) === NF.clu);
  if (NF.proj) P = P.filter(p => p.id === NF.proj);
  return P;
};
function nfBar() {
  const all = nfBase() || [], uq = a => [...new Set(a)].filter(Boolean).sort();
  const inPl = p => !NF.plat || nfPl(p) === NF.plat, inDv = p => inPl(p) && (!NF.div || nfDv(p) === NF.div), inCl = p => inDv(p) && (!NF.clu || nfCl(p) === NF.clu);
  const sel = (k, lab, opts, allL) => `<label><span>${lab}</span><select data-nf="${k}"><option value="">${allL}</option>${opts.map(o => { const [v, t] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${NF[k] === v ? 'selected' : ''}>${esc(t)}</option>`; }).join('')}</select></label>`;
  const clus = uq(all.filter(inDv).map(nfCl));
  return `<div class="nf-bar" role="search" aria-label="Organisation filter">${sel('plat', 'Platform', uq(all.map(nfPl)).map(x => [x, x + ' platform']), 'Corporation (all)')}${sel('div', 'Division', uq(all.filter(inPl).map(nfDv)), 'All divisions')}${clus.length ? sel('clu', 'Sub-division', clus, 'All sub-divisions') : ''}${sel('proj', 'Project', all.filter(inCl).sort((a, b) => a.name.localeCompare(b.name)).map(p => [p.id, p.name]), 'All projects')}${nfActive() ? '<button class="nf-reset" data-nf-reset>Clear filter</button>' : ''}<span class="nf-scope">${nfActive() ? 'Showing ' + myProjects().length + ' of ' + all.length + ' projects' : 'All ' + all.length + ' projects'}</span></div>`;
}
function nfMount() {
  const main = document.querySelector('main'); if (!main || !L.ready || !L.projects || !L.projects.length) return;
  const old = document.getElementById('nf-host'); if (old) old.remove();
  if (NF_SKIP.includes(st.view) || (typeof myRole === 'function' && myRole() === 'worker')) return;
  const top = main.querySelector(':scope > .top'); const html = `<div id="nf-host">${nfBar()}</div>`; if (top) top.insertAdjacentHTML('afterend', html); else main.insertAdjacentHTML('afterbegin', html);
}
document.addEventListener('change', e => { const t = e.target; if (!t.dataset || !t.dataset.nf) return; const k = t.dataset.nf; NF[k] = t.value; if (k === 'plat') NF.div = NF.clu = NF.proj = ''; if (k === 'div') NF.clu = NF.proj = ''; if (k === 'clu') NF.proj = ''; nfSave(); render(); });
document.addEventListener('click', e => { if (!e.target.closest('[data-nf-reset]')) return; e.preventDefault(); NF.plat = NF.div = NF.clu = NF.proj = ''; nfSave(); render(); });

/* ================= 2. one menu in three sections ================= */
const NAV_SECTIONS = [
  ['Analysis', ['overview', 'trends', 'reporting']],
  ['Operations', ['incidents', 'records', 'inspections', 'actions', 'leadership', 'training', 'operations', 'food', 'monitoring']],
  ['Administration', ['admin']],
];
(function navTidy() {
  const g = id => NX_GROUPS.find(x => x[0] === id);
  /* QR posters are an administrator task: keep them with the other admin tools */
  const rec = g('records'), adm = g('admin');
  if (rec && adm) { const i = rec[4].findIndex(x => x[0] === 'm-qr'); if (i >= 0) { const [q] = rec[4].splice(i, 1); if (!adm[4].some(x => x[0] === 'm-qr')) adm[4].splice(adm[4].length - 1, 0, [q[0], 'QR reporting posters']); } }
  /* one training section: the monthly sessions sit inside it */
  const tr = g('training'); if (tr) tr[4] = tr[4].map(([v, l]) => [v, v === 'train' ? 'Monthly training sessions' : v === 'm-training' ? 'Training dashboard & matrix' : l]);
  /* one leadership section: the scorecard first */
  const ld = g('leadership'); if (ld) { ld[2] = 'm-leadership'; ld[4] = ld[4].map(([v, l]) => [v, v === 'leaders' ? 'Engagement targets' : l]); }
  /* order the groups by section */
  const order = NAV_SECTIONS.flatMap(s => s[1]);
  NX_GROUPS.sort((a, b) => (order.indexOf(a[0]) < 0 ? 99 : order.indexOf(a[0])) - (order.indexOf(b[0]) < 0 ? 99 : order.indexOf(b[0])));
})();
function navSectionLabels() {
  const side = document.getElementById('sidenav'); if (!side) return;
  side.querySelectorAll('.nv-section').forEach(x => x.remove());
  NAV_SECTIONS.forEach(([label, ids]) => {
    const first = ids.map(id => side.querySelector(`[data-nv-group="${id}"]`)).find(Boolean);
    if (first) first.closest('.nv-group').insertAdjacentHTML('beforebegin', `<div class="nv-section">${label}</div>`);
  });
}

/* page-level organisation pickers are replaced by the one filter at the top */
try { ['plat', 'div', 'clu', 'proj'].forEach(k => { TA[k] = ''; V2A.acc[k] = ''; V2A.aud[k] = ''; }); } catch (e) { }

/* ================= 3. after every render ================= */
const coreBase = render;
render = function () { const o = coreBase.apply(this, arguments); try { nfMount(); } catch (e) { console.error(e); } try { navSectionLabels(); } catch (e) { } return o; };

/* one period control on Trend analysis: the period buttons also set how many months the monthly charts show */
document.addEventListener('click', e => { const b = e.target.closest('[data-v2per]'); if (!b) return; try { TA.months = { week: 6, month: 6, bimonth: 6, quarter: 12, year: 12, all: 24 }[b.dataset.v2per] || 12; } catch (x) { } }, true);
