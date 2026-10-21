/* NAVO 3D shell: one sidebar with every route, one header, a phone bottom bar.
   Replaces the stacked top nav, sub-nav, dashboard rail and return bar with a single navigation. */
'use strict';
const NV = { open: null, drawer: false };
const NV_IC = {
  overview: '<path d="M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 3v6h8V3z"/>',
  records: '<path d="M9 3h6l1 2h3v16H5V5h3z"/><path d="M9 12l2 2 4-4"/>',
  actions: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  assurance: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  leadership: '<circle cx="12" cy="7" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
  admin: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
  chev: '<path d="M9 6l6 6-6 6"/>',
};
const nvIcon = (k, s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${NV_IC[k] || ''}</svg>`;

function nvDashboards() {
  const views = [['overview', 'Leadership overview']];
  try { HSEC.filter(x => x[0] !== 'exe').forEach(x => views.push([x[0], x[1]])); } catch (e) {}
  views.push(['portfolio', 'Portfolio & safety cycle'], ['evidence', 'Risk & ESG evidence'], ['scorecard', 'Project scorecards']);
  return views;
}
function nvDashboardCurrent() {
  if (st.view === 'sc') return 'scorecard';
  if (st.view !== 'exec') return '';
  try { return !CD.detail && hsInit().sec === 'exe' ? (CL.dashboard === 'summary' ? 'overview' : CL.dashboard) : hsInit().sec; } catch (e) { return 'overview'; }
}
function nvGroups() {
  const worker = typeof myRole === 'function' && myRole() === 'worker';
  const groups = NX_GROUPS.map(([id, label, route, , items]) => ({ id, label, route, items }));
  return worker ? groups.filter(g => ['records', 'actions'].includes(g.id)) : groups;
}
function nvRender() {
  const side = document.getElementById('sidenav');
  if (!side) return;
  const current = nxGroup()[0];
  if (NV.open === null || NV.lastView !== st.view) NV.open = current;
  NV.lastView = st.view;
  side.innerHTML = `<button class="nv-new" data-nvreport aria-current="${st.view === 'report'}"><span>+</span>New report</button>` + nvGroups().map(g => {
    let sub = '';
    if (g.id === 'overview') {
      const cur = nvDashboardCurrent();
      sub = '<span class="nv-sub-label">Dashboards</span>' + nvDashboards().map(([v, l]) => `<button data-co-view="${v}" aria-current="${cur === v}">${esc(l)}</button>`).join('');
    } else if (g.items.length > 1) {
      sub = g.items.map(([r, l]) => `<button data-go="${r}" aria-current="${st.view === r}">${esc(l)}</button>`).join('');
    }
    const cls = `nv-group${g.id === current ? ' is-current' : ''}${NV.open === g.id && sub ? ' is-open' : ''}`;
    return `<div class="${cls}"><button data-nv-group="${g.id}" data-nv-route="${g.route}" aria-expanded="${NV.open === g.id}"><span class="nv-ic">${nvIcon(g.id === 'admin' ? 'admin' : g.id)}</span><span>${esc(g.label)}</span>${sub ? `<span class="nv-chev">${nvIcon('chev', 14)}</span>` : ''}</button>${sub ? `<div class="nv-sub">${sub}</div>` : ''}</div>`;
  }).join('');
  const tab = document.getElementById('tabbar'); if (tab) tab.innerHTML = '';
  const sub = document.getElementById('nx-subnav'); if (sub) sub.innerHTML = '';
  nvChrome();
}

function nvChrome() {
  document.body.classList.add('nv3d');
  const aside = document.querySelector('.app>aside');
  const logo = aside && aside.querySelector('.logo');
  if (logo && !logo.querySelector('.nv-cube')) logo.insertAdjacentHTML('afterbegin', '<span class="nv-cube" aria-hidden="true"><i></i></span>');
  if (aside) {
    let user = aside.querySelector('.nv-user');
    if (!user) { aside.insertAdjacentHTML('beforeend', '<div class="nv-user"></div>'); user = aside.querySelector('.nv-user'); }
    const name = (L.me && L.me.name) || 'Signed in';
    const initials = name.split(/\s+/).map(s => s[0]).join('').slice(0, 2).toUpperCase();
    const role = typeof myRole === 'function' ? ({ admin: 'HSE Admin', hse: 'HSE Engineer', supervisor: 'Supervisor', worker: 'Site worker' }[myRole()] || 'Member') : '';
    user.innerHTML = `<span class="nv-avatar">${esc(initials)}</span><span><b>${esc(name)}</b><small>${esc(role)}</small></span>`;
  }
  const top = document.querySelector('.top');
  if (top && !top.querySelector('.nv-burger')) {
    top.insertAdjacentHTML('afterbegin', `<button class="nv-burger" data-nv-drawer aria-label="Open menu">${nvIcon('menu', 20)}</button><button class="nv-back" data-co-back aria-label="Back">${nvIcon('back', 20)}</button>`);
  }
  if (!document.querySelector('.nv-scrim')) document.body.insertAdjacentHTML('beforeend', '<div class="nv-scrim" data-nv-close></div>');
  let bottom = document.querySelector('.nv-bottom');
  if (!bottom) { document.body.insertAdjacentHTML('beforeend', '<nav class="nv-bottom" aria-label="Quick navigation"></nav>'); bottom = document.querySelector('.nv-bottom'); }
  const g = nxGroup()[0];
  const items = nvGroups().filter(x => x.id !== 'admin').slice(0, 4);
  const btn = x => `<button data-go="${x.route}" aria-current="${g === x.id && st.view !== 'report'}">${nvIcon(x.id)}<span>${esc(x.label)}</span></button>`;
  const half = Math.ceil(items.length / 2);
  bottom.innerHTML = items.slice(0, half).map(btn).join('') + `<button class="nv-plus" data-nvreport aria-label="New report" aria-current="${st.view === 'report'}"><i>+</i><span>Report</span></button>` + items.slice(half).map(btn).join('') + `<button data-nv-drawer aria-label="All pages">${nvIcon('menu')}<span>Menu</span></button>`;
  bottom.style.gridTemplateColumns = `repeat(${items.length + 2},1fr)`;
  document.querySelectorAll('.cd-appearance').forEach(n => n.remove());
}

function nvSetDrawer(open) { NV.drawer = open; document.body.classList.toggle('nv-drawer', open); }

nav = nvRender;
const nvBaseRender = render;
render = function () {
  const changed = NV.animView !== st.view; NV.animView = st.view;
  nvBaseRender(); nvRender(); nvTilt();
  if (changed) { document.body.classList.add('nv-enter'); clearTimeout(NV.enterT); NV.enterT = setTimeout(() => document.body.classList.remove('nv-enter'), 700); }
  if (NV.drawer) nvSetDrawer(false);
};

document.addEventListener('click', e => {
  const grp = e.target.closest('[data-nv-group]');
  if (grp) {
    const id = grp.dataset.nvGroup;
    const hasSub = !!grp.parentElement.querySelector('.nv-sub');
    if (hasSub && NV.open === id && nxGroup()[0] === id) { NV.open = ''; nvRender(); return; }
    NV.open = id;
    if (nxGroup()[0] !== id) { if (id === 'overview' && typeof coHome === 'function') coHome(); else go(grp.dataset.nvRoute); }
    else nvRender();
    return;
  }
  if (e.target.closest('[data-nv-drawer]')) { nvSetDrawer(!NV.drawer); return; }
  if (e.target.closest('[data-nv-close]')) { nvSetDrawer(false); return; }
  if (NV.drawer && e.target.closest('.app>aside [data-go],.app>aside [data-co-view]')) setTimeout(() => nvSetDrawer(false), 0);
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && NV.drawer) nvSetDrawer(false); });

/* Subtle 3D tilt on KPI blocks for mouse users. */
function nvTilt() {
  if (!window.matchMedia || !matchMedia('(hover:hover) and (pointer:fine)').matches || matchMedia('(prefers-reduced-motion:reduce)').matches) return;
  document.querySelectorAll('.kpi,.nx-stat').forEach(el => {
    if (el.dataset.nvTilt) return; el.dataset.nvTilt = '1';
    el.addEventListener('pointermove', ev => {
      const r = el.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width - .5, y = (ev.clientY - r.top) / r.height - .5;
      el.style.transform = `perspective(700px) rotateX(${(-y * 6).toFixed(2)}deg) rotateY(${(x * 8).toFixed(2)}deg) translateY(-2px)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  });
}

document.body.classList.add('nv3d');
try { if (typeof cdTheme === 'function') { cdTheme('sage'); ['--accent', '--brand', '--bg', '--fg', '--cd-accent', '--cd-bg', '--cd-ink'].forEach(v => document.documentElement.style.removeProperty(v)); } } catch (e) {}
try { render(); } catch (e) {}
