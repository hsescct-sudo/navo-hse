/* NAVO style switch: Classic (light) or Cinematic 3D (dark glass, chrome, moving 3D floor). Saved on this device. */
'use strict';
const CM_STYLES = [['classic', 'Classic', 'Light, clean, print friendly'], ['cinema', 'Cinematic 3D', 'Dark glass, chrome and depth'], ['report', 'Report (Power BI)', 'Flat, light, executive report look']];
const cmStyle = () => document.documentElement.dataset.style || 'classic';
function cmSet(s) { if (s === 'classic') delete document.documentElement.dataset.style; else document.documentElement.dataset.style = s; try { localStorage.setItem('navo-style', s); } catch (e) {} cmStage(); moPicker(); }
function cmStage() {
  if (document.getElementById('cm-stage') || !document.body) return;
  document.body.insertAdjacentHTML('afterbegin', '<div id="cm-stage" aria-hidden="true"><div class="cm-sky"></div><div class="cm-ring"></div><div class="cm-orb o1"></div><div class="cm-orb o2"></div><div class="cm-orb o3"></div><div class="cm-floor"></div></div>');
}
const cmBasePicker = moPicker;
moPicker = function () {
  cmBasePicker();
  const pop = document.querySelector('#mo-pick .mo-pop'); if (!pop || pop.querySelector('[data-cm]')) return;
  pop.insertAdjacentHTML('afterbegin', `<b>Style</b>${CM_STYLES.map(([v, l, d]) => `<button role="menuitemradio" aria-checked="${cmStyle() === v}" data-cm="${v}"><span><i></i>${l}</span><small>${d}</small></button>`).join('')}`);
};
document.addEventListener('click', e => { const t = e.target.closest('[data-cm]'); if (!t) return; e.preventDefault(); e.stopPropagation(); cmSet(t.dataset.cm); }, true);
/* light follows the pointer; the backdrop drifts with it */
let cmRaf = 0;
document.addEventListener('pointermove', e => {
  if (cmStyle() !== 'cinema' || cmRaf) return;
  cmRaf = requestAnimationFrame(() => {
    cmRaf = 0;
    const s = document.getElementById('cm-stage'); if (s) { s.style.setProperty('--px', (e.clientX / innerWidth - .5).toFixed(3)); s.style.setProperty('--py', (e.clientY / innerHeight - .5).toFixed(3)); }
    const c = e.target.closest && e.target.closest('.panel,.kpi,.ceo-rate,.nvr-card,.cd-card');
    if (c) { const r = c.getBoundingClientRect(); c.style.setProperty('--lx', (e.clientX - r.left) + 'px'); c.style.setProperty('--ly', (e.clientY - r.top) + 'px'); }
  });
}, { passive: true });
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', cmStage); else cmStage();

/* Every page has its own components. In the cinematic style, any light surface becomes dark glass and any dark text becomes light,
   so no page shows a white block or unreadable text. Coloured chips and status pills keep their colours. */
const CM_KEEP = /(^|\s)(pill|cx-pill|nx-type|p-ok|p-crit|p-warn|p-info|leaflet[\w-]*|cd-tile|cd-bar|cd-hbar|au-item|badge|chip|sev|dot|swatch)(\s|$)/;
function cmLum(c) { const m = c && c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/); if (!m) return null; return { l: (0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3]) / 255, a: m[4] == null ? 1 : +m[4], s: Math.max(m[1], m[2], m[3]) - Math.min(m[1], m[2], m[3]) }; }
function cmFix(root) {
  if (cmStyle() !== 'cinema' || !root) return;
  root.querySelectorAll('*').forEach(el => {
    if (el.closest('#cm-stage,.leaflet-container,.cd-tile') || CM_KEEP.test(el.className && el.className.baseVal == null ? el.className : '')) return;
    const cs = getComputedStyle(el);
    if (el instanceof SVGElement) {
      if (el.tagName === 'text' || el.tagName === 'tspan') { const f = cmLum(cs.fill); if (f && f.l < .35 && f.s < 90) el.classList.add('cm-lt'); }
      else { const f = cmLum(cs.fill); if (f && f.a > .5 && f.l > .9 && f.s < 20 && el.tagName === 'rect') el.classList.add('cm-dk'); }
      return;
    }
    const b = cmLum(cs.backgroundColor);
    if (b && b.a > .5 && b.l > .82 && b.s < 40 && !/^(INPUT|SELECT|TEXTAREA|IMG|VIDEO|CANVAS)$/.test(el.tagName)) el.classList.add('cm-dk');
    else if (b && b.a > .5 && b.l > .82 && b.s >= 40) el.classList.add('cm-tint');
    const t = cmLum(cs.color); if (t && t.l < .35 && t.s < 90) el.classList.add('cm-lt');
  });
}
function cmClear() { document.querySelectorAll('.cm-dk,.cm-lt,.cm-tint').forEach(el => el.classList.remove('cm-dk', 'cm-lt', 'cm-tint')); }
let cmT = 0;
function cmQueue() { clearTimeout(cmT); cmT = setTimeout(() => { const m = document.querySelector('main') || document.body; cmFix(m); cmFix(document.querySelector('.top')); document.querySelectorAll('body > .acc-modal,body > .modal,body > dialog').forEach(cmFix); }, 30); }
new MutationObserver(cmQueue).observe(document.documentElement, { childList: true, subtree: true });
const cmBaseSet = cmSet;
cmSet = function (s) { cmClear(); cmBaseSet(s); cmQueue(); };
