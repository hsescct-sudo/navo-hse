'use strict';
/* NAVO sidebar: search the menu, collapse to icons, live badges. Styling in navo-sidebar.css. */
const SB = { q: '' };
try { if (localStorage.getItem('navo-sb-mini') === '1') document.documentElement.classList.add('sb-mini'); } catch (e) { }
function sbBadges() {
  const side = document.getElementById('sidenav'); if (!side || !L.ready) return;
  side.querySelectorAll('.sb-badge').forEach(b => b.remove());
  let n = 0; try { const ids = new Set(myProjects().map(p => p.id)), now = Date.now(); n = (L.actions || []).filter(a => ids.has(a.project) && !a.closedAt && a.due && a.due < now).length; } catch (e) { }
  const g = side.querySelector('[data-nv-group="actions"]'); if (g && n) g.insertAdjacentHTML('beforeend', `<span class="sb-badge" title="Overdue actions">${n > 99 ? '99+' : n}</span>`);
  let inc = 0; try { const ids = new Set(myProjects().map(p => p.id)); inc = (L.reports || []).filter(r => ids.has(r.project) && r.rt === 'Incident' && r.status !== 'Closed' && Date.now() - r.ts < 30 * 864e5).length; } catch (e) { }
  const gi = side.querySelector('[data-nv-group="incidents"]'); if (gi && inc) gi.insertAdjacentHTML('beforeend', `<span class="sb-badge" title="Open incidents, last 30 days">${inc > 99 ? '99+' : inc}</span>`);
}
function sbSearch() {
  const side = document.getElementById('sidenav'); if (!side) return;
  if (!side.querySelector('.sb-search')) {
    const nb = side.querySelector('.nv-new');
    const html = `<label class="sb-search"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg><input type="search" placeholder="Search menu…" aria-label="Search menu" value="${esc(SB.q)}" data-sb-q style="background:transparent !important;border:0 !important;box-shadow:none !important;padding:0 !important;color:var(--sb-text) !important"></label>`;
    if (nb) nb.insertAdjacentHTML('afterend', html); else side.insertAdjacentHTML('afterbegin', html);
  }
  sbFilter();
}
function sbFilter() {
  const side = document.getElementById('sidenav'); if (!side) return; const q = SB.q.trim().toLowerCase();
  side.querySelectorAll('.nv-group').forEach(g => {
    if (!q) { g.style.display = ''; g.querySelectorAll('.nv-sub button').forEach(b => b.style.display = ''); g.classList.remove('sb-hit'); return; }
    const own = (g.querySelector(':scope>button')?.textContent || '').toLowerCase().includes(q);
    let any = false; g.querySelectorAll('.nv-sub button').forEach(b => { const hit = own || b.textContent.toLowerCase().includes(q); b.style.display = hit ? '' : 'none'; any = any || hit; });
    g.style.display = own || any ? '' : 'none'; g.classList.toggle('is-open', !!(any && !own));
  });
  side.querySelectorAll('.nv-section').forEach(s => { let n = s.nextElementSibling, vis = false; while (n && !n.classList.contains('nv-section')) { if (n.classList.contains('nv-group') && n.style.display !== 'none') vis = true; n = n.nextElementSibling; } s.style.display = vis || !q ? '' : 'none'; });
}
function sbToggle() {
  const aside = document.querySelector('.app>aside'); if (!aside || aside.querySelector('.sb-toggle')) return;
  aside.insertAdjacentHTML('afterbegin', `<button class="sb-toggle" data-sb-toggle aria-label="Collapse menu" title="Collapse / expand menu"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M15 18l-6-6 6-6"/></svg></button>`);
}
function sbMount() { try { sbToggle(); sbSearch(); sbBadges(); } catch (e) { console.error(e); } }
if (typeof onAfterRender === 'function') onAfterRender(sbMount); else { const sbR = render; render = function () { const o = sbR.apply(this, arguments); sbMount(); return o; }; }
document.addEventListener('input', e => { if (!e.target.matches('[data-sb-q]')) return; SB.q = e.target.value; sbFilter(); });
document.addEventListener('click', e => { const t = e.target.closest('[data-sb-toggle]'); if (!t) return; e.preventDefault(); e.stopPropagation(); const on = document.documentElement.classList.toggle('sb-mini'); try { localStorage.setItem('navo-sb-mini', on ? '1' : '0'); } catch (x) { } t.style.transform = on ? 'rotate(180deg)' : ''; }, true);
