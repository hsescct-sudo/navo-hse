/* NAVO motion: three levels the viewer chooses from the header (saved on this device).
   Cinematic · 3D page transitions, staggered reveals, numbers that count up, charts that grow, hero parallax, button ripples.
   Subtle · a soft fade and rise only.
   Off · no animation. */
'use strict';
const MO = { level: 'cinematic', view: null, open: false };
try { MO.level = localStorage.getItem('navo-motion') || (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'subtle' : 'cinematic'); } catch (e) {}
const MO_LEVELS = [['cinematic', 'Cinematic', '3D transitions, counters, growing charts, parallax'], ['subtle', 'Subtle', 'Soft fade and rise only'], ['off', 'Off', 'No animation']];

function moApply() {
  document.body.classList.remove('mo-cinematic', 'mo-subtle', 'mo-off');
  document.body.classList.add('mo-' + MO.level);
}
function moSet(level) { MO.level = level; try { localStorage.setItem('navo-motion', level); } catch (e) {} moApply(); MO.open = false; moPicker(); if (level === 'cinematic') moEnter(true); }

function moPicker() {
  const top = document.querySelector('.top .ctrls'); if (!top) return;
  let w = document.getElementById('mo-pick');
  if (!w) { top.insertAdjacentHTML('afterbegin', '<div id="mo-pick"></div>'); w = document.getElementById('mo-pick'); }
  w.innerHTML = `<button class="mo-btn" data-mo-toggle aria-expanded="${MO.open}" aria-label="Animation level" title="Animation level"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4z"/><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z"/></svg><span>${MO_LEVELS.find(l => l[0] === MO.level)[1]}</span></button>
   ${MO.open ? `<div class="mo-pop" role="menu"><b>Animation</b>${MO_LEVELS.map(([v, l, d]) => `<button role="menuitemradio" aria-checked="${MO.level === v}" data-mo="${v}"><span><i></i>${l}</span><small>${d}</small></button>`).join('')}</div>` : ''}`;
}

/* Numbers count up from zero, keeping their format (1,234 · 12.5 · 93% · 15.95M). */
function moCount(el) {
  if (el.children.length) return;
  const raw = el.textContent.trim(); const m = raw.match(/^([^\d-]*)(-?[\d,]*\.?\d+)(.*)$/s); if (!m) return;
  const target = parseFloat(m[2].replace(/,/g, '')); if (!isFinite(target) || target === 0) return;
  const dec = (m[2].split('.')[1] || '').length, comma = m[2].includes(','), t0 = performance.now(), dur = 1100;
  const fmt = v => { let s = v.toFixed(dec); if (comma) { const [a, b] = s.split('.'); s = (+a).toLocaleString('en-US') + (b ? '.' + b : ''); } return m[1] + s + m[3]; };
  const step = now => { const k = Math.max(0, Math.min(1, (now - t0) / dur)), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(target * e); if (k < 1 && document.body.contains(el)) requestAnimationFrame(step); else el.textContent = raw; };
  requestAnimationFrame(step);
}
function moEnter(force) {
  if (MO.level !== 'cinematic') return;
  const v = document.getElementById('view'); if (!v) return;
  if (!force && MO.view === st.view) return; MO.view = st.view;
  document.body.classList.remove('mo-go'); void v.offsetWidth; document.body.classList.add('mo-go');
  const items = v.querySelectorAll('.kpi,.nx-stat,.panel,.hc,.co-panel,.cd-card,.nvr-card,.ceo-rate,.ceo-sec,.nvi-q,.rca-card,.rca-methods button,.wf-card,.nvi-find,.env-tile');
  items.forEach((el, i) => el.style.setProperty('--mo-d', Math.min(i, 14) * 55 + 'ms'));
  v.querySelectorAll('.kpi .v,.nx-stat strong,.nx-stat b,.ceo-rate b,.nvi-ring b,.co-kpis b,.xkpis b').forEach(moCount);
  clearTimeout(MO.t); MO.t = setTimeout(() => document.body.classList.remove('mo-go'), 1800);
}

/* Hero parallax and card tilt follow the pointer. */
document.addEventListener('pointermove', e => {
  if (MO.level !== 'cinematic') return;
  const h = e.target.closest && e.target.closest('.nx-hero,.nvr-hero');
  if (h) { const r = h.getBoundingClientRect(); h.style.setProperty('--mx', ((e.clientX - r.left) / r.width - .5).toFixed(3)); h.style.setProperty('--my', ((e.clientY - r.top) / r.height - .5).toFixed(3)); }
  const c = e.target.closest && e.target.closest('.nvr-card,.ceo-rate,.rca-methods button');
  if (c) { const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5; c.style.transform = `perspective(800px) rotateX(${(-y * 8).toFixed(2)}deg) rotateY(${(x * 10).toFixed(2)}deg) translateY(-4px)`; c.dataset.moTilt = '1'; }
}, { passive: true });
document.addEventListener('pointerout', e => { const c = e.target.closest && e.target.closest('[data-mo-tilt]'); if (c && !c.contains(e.relatedTarget)) { c.style.transform = ''; delete c.dataset.moTilt; } });

/* Ripple on press. */
document.addEventListener('pointerdown', e => {
  if (MO.level !== 'cinematic') return;
  const b = e.target.closest('.btn,.nvi-o,.nvr-card,.nv-new,.rca-seg button,.nv-group>button,.nv-sub button'); if (!b) return;
  const r = b.getBoundingClientRect(), s = Math.max(r.width, r.height) * 2, i = document.createElement('i');
  i.className = 'mo-ripple'; i.style.cssText = `width:${s}px;height:${s}px;left:${e.clientX - r.left - s / 2}px;top:${e.clientY - r.top - s / 2}px`;
  if (getComputedStyle(b).position === 'static') b.style.position = 'relative';
  b.style.overflow = 'hidden'; b.appendChild(i); setTimeout(() => i.remove(), 650);
});

document.addEventListener('click', e => {
  const t = e.target.closest('[data-mo-toggle],[data-mo]');
  if (!t) { if (MO.open && !e.target.closest('#mo-pick')) { MO.open = false; moPicker(); } return; }
  e.preventDefault(); e.stopPropagation();
  if (t.dataset.mo) return moSet(t.dataset.mo);
  MO.open = !MO.open; moPicker();
}, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && MO.open) { MO.open = false; moPicker(); } });

const moBaseRender = render;
render = function () { moBaseRender(); moApply(); moPicker(); moEnter(false); };
moApply(); try { moPicker(); } catch (e) {}
