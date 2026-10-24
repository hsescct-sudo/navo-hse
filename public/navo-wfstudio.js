/* NAVO Workflow studio: every process drawn as a flowchart (start/end, step, decision with a branch, automatic step).
   A System admin edits it on the page: click a shape to change its words or type, add, remove or move steps,
   rename or recolour a workflow, add a new one, and save. Everyone else sees the saved drawings.
   Saved in admin/workflows (settings) as `maps`, beside the older responsibility table (`rows`). */
'use strict';
const WFS_DEF = [
  ['incident', 'Incidents', '#ff5a5f', [['s', 'Event on site', 'anyone reports'], ['p', 'New report', 'type, project, time, photos'], ['d', 'Injury?', 'severity must be set', 'yes'], ['p', 'Classify', 'FAC · MTC · RWC · LTI · fatality'], ['d', 'High potential?', 'alert bell + live ticker', 'yes'], ['p', 'Investigate', 'Wheel · 5 Whys · Fishbone · TapRooT'], ['p', 'Root causes → actions', 'owner and due date'], ['d', 'HSE approves?', 'back to investigator', 'no'], ['p', 'Verify actions', 'effective?'], ['e', 'Closed', 'feeds KPIs and CEO report']]],
  ['hazard', 'Hazards and observations', '#f2a516', [['s', 'Unsafe act or condition', 'or good practice'], ['p', 'Report from phone', 'photo and location'], ['d', 'Positive?', 'recorded and closed', 'yes'], ['p', 'Risk rating', 'high · medium · low'], ['p', 'Assign owner', 'supervisor or HSE'], ['p', 'Action', 'due date'], ['d', 'Overdue?', 'escalated automatically', 'yes'], ['e', 'Closed with evidence', 'risk profile updated']]],
  ['insp', 'Inspections and audits', '#9b7bff', [['s', 'Planned inspection', 'or audit'], ['p', 'Pick checklist', '24 professional lists'], ['p', 'Answer each item', 'Safe · At risk · N/A · Not evaluated'], ['d', 'At risk?', 'finding, recommendation, owner required', 'yes'], ['a', 'Action raised', '3 days critical, 7 days other'], ['p', 'Submit', 'signed and dated'], ['e', 'Score and findings', 'audit dashboard']]],
  ['action', 'Actions', '#2fd38a', [['s', 'Action created', 'from any section'], ['p', 'Owner works it', 'updates and evidence'], ['a', 'Due in 3 days', 'daily email reminder'], ['d', 'Overdue?', 'escalated, shown on bell', 'yes'], ['p', 'Owner closes', 'evidence attached'], ['d', 'Verified effective?', 'reopened', 'no'], ['e', 'Closed', 'closure rate on dashboards']]],
  ['lead', 'Leadership walks', '#7aa9ff', [['s', 'Plan walkthrough', 'manager and site'], ['p', 'Site visit', 'conversations'], ['d', 'Finding?', 'action raised', 'yes'], ['p', 'Record engagement', 'who, where, topics'], ['e', 'Leadership count', 'cockpit and CEO report']]],
  ['train', 'Training', '#2bd1c4', [['s', 'Training session', 'induction, IOSH, toolbox'], ['p', 'Record attendees', 'hours per person'], ['p', 'Monthly total', 'training man-hours'], ['e', 'Training KPIs', 'IOSH target vs completed']]],
  ['perf', 'Performance data and CEO report', '#2fd38a', [['s', 'Month end', 'per project'], ['p', 'Enter monthly data', 'or upload Excel template'], ['d', 'Blank cells?', 'keep the saved value', 'yes'], ['a', 'Rates calculated', 'per 1,000,000 man-hours'], ['p', 'Fortnight figures', 'or upload the CEO workbook'], ['a', 'CEO and environment reports', 'PowerPoint · Word · Excel'], ['e', 'Emails', '1st and 15th, monthly environment']]],
  ['project', 'Project life cycle', '#4f8dff', [['s', 'Admin creates project', 'country, platform, division, cluster, location'], ['p', 'Accounts from Excel', 'name, email, position, level'], ['p', 'Set targets', 'LTIFR, TRCF, LTISR, environment'], ['p', 'Go live on site', 'training per role'], ['p', 'Daily work', 'reports, inspections, actions'], ['a', 'Month end', 'man-hours, energy, waste'], ['a', 'Fortnight figures', 'CEO bi-monthly report'], ['d', 'Project complete?', 'next month', 'no'], ['e', 'Close out', 'records kept, read only']]],
].map(([id, name, color, nodes]) => ({ id, name, color, nodes: nodes.map(([k, t, sub, br]) => ({ k, t, sub: sub || '', br: br || '' })) }));
const WFS_KINDS = [['s', 'Start'], ['p', 'Step'], ['d', 'Decision'], ['a', 'Automatic'], ['e', 'End']];
const WFS_COLORS = ['#ff5a5f', '#f2a516', '#9b7bff', '#2fd38a', '#7aa9ff', '#2bd1c4', '#4f8dff', '#e879f9'];
const WFS = { cur: null, sel: null, draft: null, dirty: false, table: false };
const wfsSaved = () => (L.workflows && Array.isArray(L.workflows.maps) && L.workflows.maps.length) ? L.workflows.maps : WFS_DEF;
const wfsList = () => WFS.draft || wfsSaved();
const wfsCur = () => { const l = wfsList(); return l.find(w => w.id === WFS.cur) || l[0]; };
const wfsEsc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
function wfsWrap(t, n) { const w = String(t || '').split(' '); const L2 = []; let c = ''; w.forEach(x => { if ((c + ' ' + x).trim().length > n) { if (c.trim()) L2.push(c.trim()); c = x; } else c += ' ' + x; }); if (c.trim()) L2.push(c.trim()); return L2.length ? L2 : ['']; }
function wfsLight() { return document.documentElement.dataset.style !== 'cinema'; }

/* draw one workflow as SVG; shapes carry data-wfs-i for selection */
function wfsDraw(wf, opts = {}) {
  const F = wf.nodes, color = wf.color, light = opts.light, W = 170, G = 34, RH = 230, per = opts.per || 5;
  const C = light ? { fill: '#ffffff', text: '#122033', sub: '#5f6f84', line: '#c7d2e0', box: 'rgba(18,32,51,.03)' } : { fill: '#101a2c', text: '#ffffff', sub: '#93a3ba', line: 'rgba(201,212,229,.55)', box: 'rgba(255,255,255,.03)' };
  let s = ''; const rows = Math.max(1, Math.ceil(F.length / per)), width = 20 + per * (W + G) - G + 30;
  const mid = 'wfm' + wf.id;
  F.forEach((n, i) => {
    const { k, t, sub, br } = n, r = Math.floor(i / per), c = i % per, x = 20 + c * (W + G), y0 = 28 + r * RH, cx = x + W / 2;
    const auto = k === 'a', dec = k === 'd', ends = k === 's' || k === 'e', on = opts.sel === i;
    const stroke = on ? (light ? '#1d5fd1' : '#ffffff') : auto ? '#f2a516' : ends ? color : C.line;
    s += `<g class="wfs-n${on ? ' on' : ''}" data-wfs-i="${i}" tabindex="${opts.edit ? 0 : -1}" role="${opts.edit ? 'button' : 'img'}" aria-label="${wfsEsc(t)}">`;
    if (dec) {
      s += `<path d="M${cx} ${y0 - 4}L${x + W - 4} ${y0 + 44}L${cx} ${y0 + 92}L${x + 4} ${y0 + 44}Z" fill="${C.fill}" stroke="${on ? stroke : color}" stroke-width="${on ? 2.6 : 1.6}"/>`;
      const T = wfsWrap(t, 14); T.forEach((l, j) => s += `<text x="${cx}" y="${y0 + 48 - (T.length - 1) * 8 + j * 16}" fill="${C.text}" font-size="12.5" font-weight="700" text-anchor="middle">${wfsEsc(l)}</text>`);
      if (sub) {
        const S = wfsWrap(sub, 24);
        s += `<path d="M${cx} ${y0 + 92}V${y0 + 124}" stroke="${color}" stroke-width="1.6" fill="none" marker-end="url(#${mid})"/>${br ? `<text x="${cx + 7}" y="${y0 + 112}" fill="${color}" font-size="11" font-weight="700">${wfsEsc(br)}</text>` : ''}`;
        s += `<rect x="${x + 4}" y="${y0 + 126}" width="${W - 8}" height="${22 + S.length * 15}" rx="10" fill="${C.box}" stroke="${color}" stroke-dasharray="4 4"/>`;
        S.forEach((l, j) => s += `<text x="${cx}" y="${y0 + 144 + j * 15}" fill="${C.text}" fill-opacity=".8" font-size="11.5" text-anchor="middle">${wfsEsc(l)}</text>`);
      }
    } else {
      const T = wfsWrap(t, 19), S = sub ? wfsWrap(sub, 26) : [], h = 26 + T.length * 16 + S.length * 14, ty = y0 + 44 - h / 2;
      s += `<rect x="${x}" y="${ty}" width="${W}" height="${h}" rx="${ends ? Math.min(h / 2, 30) : 12}" fill="${C.fill}" stroke="${stroke}" stroke-width="${on ? 2.6 : ends || auto ? 2 : 1.2}"/>`;
      if (auto) s += `<rect x="${x + W - 44}" y="${ty - 9}" width="38" height="16" rx="8" fill="#f2a516"/><text x="${x + W - 25}" y="${ty + 3}" fill="#1a1205" font-size="9.5" text-anchor="middle" font-weight="800">AUTO</text>`;
      T.forEach((l, j) => s += `<text x="${cx}" y="${ty + 22 + j * 16}" fill="${C.text}" font-size="13" font-weight="700" text-anchor="middle">${wfsEsc(l)}</text>`);
      S.forEach((l, j) => s += `<text x="${cx}" y="${ty + 24 + T.length * 16 + j * 14}" fill="${C.sub}" font-size="11" text-anchor="middle">${wfsEsc(l)}</text>`);
    }
    s += '</g>';
    if (i < F.length - 1) {
      const other = dec && br ? (/^yes$/i.test(br) ? 'no' : /^no$/i.test(br) ? 'yes' : '') : '';
      if (c < per - 1) { s += `<path d="M${x + W - (dec ? 4 : 0)} ${y0 + 44}H${x + W + G - 3}" stroke="${color}" stroke-width="2" fill="none" marker-end="url(#${mid})"/>${other ? `<text x="${x + W + 3}" y="${y0 + 36}" fill="${C.sub}" font-size="10.5">${other}</text>` : ''}`; }
      else { const nx = 20 + W / 2, yb = y0 + RH - 30; s += `<path d="M${x + W} ${y0 + 44}C${x + W + 24} ${y0 + 44} ${x + W + 24} ${yb} ${x + W - 20} ${yb}H${nx + 30}C${nx} ${yb} ${nx} ${yb} ${nx} ${yb + 24}" stroke="${color}" stroke-width="2" fill="none" stroke-dasharray="6 5" marker-end="url(#${mid})"/>${other ? `<text x="${x + W + 8}" y="${y0 + 36}" fill="${C.sub}" font-size="10.5">${other}</text>` : ''}`; }
    }
  });
  if (!F.length) s += `<text x="30" y="70" fill="${C.sub}" font-size="14">No steps yet. Add the first one.</text>`;
  const H = 28 + rows * RH - 30;
  return `<svg class="wfs-svg" viewBox="0 0 ${width} ${H}" xmlns="http://www.w3.org/2000/svg" style="min-width:${opts.min || 820}px"><defs><marker id="${mid}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="${color}"/></marker></defs>${s}</svg>`;
}

function wfsEditor(wf) {
  const n = WFS.sel != null ? wf.nodes[WFS.sel] : null;
  const head = `<div class="wfs-tools">
     <div class="wfs-group"><label class="wfs-lbl" for="wfs-name">Workflow name</label><input id="wfs-name" class="mx-in" value="${wfsEsc(wf.name)}"></div>
     <div class="wfs-group"><span class="wfs-lbl">Colour</span><div class="wfs-sw">${WFS_COLORS.map(c => `<button type="button" data-wfs-color="${c}" aria-pressed="${wf.color === c}" style="--c:${c}" aria-label="Colour ${c}"></button>`).join('')}</div></div>
     <div class="wfs-group wfs-add"><span class="wfs-lbl">Add ${WFS.sel != null ? 'after the selected shape' : 'at the end'}</span><div class="filters">${WFS_KINDS.map(([k, l]) => `<button type="button" class="btn" data-wfs-add="${k}"><i class="wfs-ico k-${k}"></i>${l}</button>`).join('')}</div></div>
   </div>`;
  const panel = n ? `<div class="wfs-edit"><div class="wfs-edit-h"><b>Shape ${WFS.sel + 1} of ${wf.nodes.length}</b><span class="filters"><button type="button" class="btn" data-wfs-move="-1" ${WFS.sel === 0 ? 'disabled' : ''} aria-label="Move earlier">◀ Earlier</button><button type="button" class="btn" data-wfs-move="1" ${WFS.sel === wf.nodes.length - 1 ? 'disabled' : ''} aria-label="Move later">Later ▶</button><button type="button" class="btn" data-wfs-dup>Duplicate</button><button type="button" class="btn danger" data-wfs-del>Delete</button><button type="button" class="btn" data-wfs-desel>Done</button></span></div>
     <div class="wfs-fields"><div class="fld"><label for="wfs-k">Shape</label><select id="wfs-k" class="mx-in" data-wfs-f="k">${WFS_KINDS.map(([k, l]) => `<option value="${k}" ${n.k === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="fld"><label for="wfs-t">${n.k === 'd' ? 'Question' : 'Title'}</label><input id="wfs-t" class="mx-in" data-wfs-f="t" value="${wfsEsc(n.t)}"></div>
      <div class="fld"><label for="wfs-sub">${n.k === 'd' ? 'What happens on the branch' : 'Detail'}</label><input id="wfs-sub" class="mx-in" data-wfs-f="sub" value="${wfsEsc(n.sub)}"></div>
      ${n.k === 'd' ? `<div class="fld"><label for="wfs-br">Branch answer</label><select id="wfs-br" class="mx-in" data-wfs-f="br"><option ${n.br === 'yes' ? 'selected' : ''}>yes</option><option ${n.br === 'no' ? 'selected' : ''}>no</option></select></div>` : ''}</div></div>`
    : `<p class="mx-muted wfs-hint">Click any shape in the drawing to edit its words, change its type, move it or delete it.</p>`;
  return head + panel;
}

const wfsBaseFlows = flowsPage;
flowsPage = function () {
  const g = typeof liveGate === 'function' && liveGate(); if (g) return g;
  const list = wfsList(), wf = wfsCur(); WFS.cur = wf.id;
  const ed = myRole() === 'admin';
  const nav = `<div class="wfs-nav" role="tablist">${list.map(w => `<button role="tab" aria-selected="${w.id === wf.id}" data-wfs-pick="${wfsEsc(w.id)}" style="--c:${w.color}"><i></i>${wfsEsc(w.name)}<small>${w.nodes.length} steps</small></button>`).join('')}${ed ? '<button class="wfs-new" data-wfs-new>+ New workflow</button>' : ''}</div>`;
  const bar = ed ? `<div class="wfs-bar"><span class="${WFS.dirty ? 'wfs-dirty' : 'mx-muted'}">${WFS.dirty ? 'Unsaved changes' : 'All changes saved'}</span><span class="filters"><button class="btn" data-wfs-png>Download picture</button>${WFS.dirty ? '<button class="btn" data-wfs-undo>Discard changes</button>' : ''}<button class="btn" data-wfs-reset>Restore NAVO defaults</button>${list.length > 1 ? '<button class="btn danger" data-wfs-remove>Delete this workflow</button>' : ''}<button class="btn pri" data-wfs-save ${WFS.dirty ? '' : 'disabled'}>Save workflows</button></span></div>` : `<div class="wfs-bar"><span class="mx-muted">Set by your System admin</span><span class="filters"><button class="btn" data-wfs-png>Download picture</button></span></div>`;
  return `<div class="nvr-hero wfs-hero"><div><span class="nvi-eyebrow">Workflow studio</span><h2>How work flows in NAVO</h2><p>Every process as a flowchart: start and end, steps, decisions with their branch, and what NAVO does automatically.${ed ? ' Click a shape to change it, add steps, or build a new workflow, then save.' : ''}</p></div>
    <div class="wfs-legend"><span><i class="wfs-ico k-s"></i>Start / end</span><span><i class="wfs-ico k-p"></i>Step</span><span><i class="wfs-ico k-d"></i>Decision</span><span><i class="wfs-ico k-a"></i>Automatic</span></div></div>
   ${nav}
   <div class="panel wfs-panel" style="--c:${wf.color}">
     ${bar}
     ${ed ? wfsEditor(wf) : ''}
     <div class="wfs-canvas" id="wfs-canvas">${wfsDraw(wf, { edit: ed, sel: WFS.sel, light: wfsLight() })}</div>
   </div>
   <details class="panel wfs-table" ${WFS.table ? 'open' : ''}><summary data-wfs-table>Responsibilities and time limits per workflow</summary>${wfsBaseFlows()}</details>`;
};

function wfsTouch() { if (!WFS.draft) WFS.draft = JSON.parse(JSON.stringify(wfsSaved())); WFS.dirty = true; return WFS.draft.find(w => w.id === WFS.cur) || WFS.draft[0]; }
function wfsRedraw(keepFocus) {
  const y = window.scrollY, a = document.activeElement, id = a && a.id, pos = a && a.selectionStart;
  render(); window.scrollTo(0, y);
  if (keepFocus && id) { const el = document.getElementById(id); if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch (e) {} } }
}
async function wfsSave() {
  const maps = WFS.draft || wfsSaved();
  const data = { ...(L.workflows || {}), maps };
  const ok = await liveSave(() => L.db.doc('admin/workflows').set(data), 'Workflows saved');
  if (ok !== false) { L.workflows = data; WFS.draft = null; WFS.dirty = false; render(); }
}
async function wfsPng() {
  const svg = document.querySelector('#wfs-canvas svg'); if (!svg) return;
  const vb = svg.viewBox.baseVal, scale = 2, c = document.createElement('canvas'); c.width = vb.width * scale; c.height = vb.height * scale;
  const ctx = c.getContext('2d'); ctx.fillStyle = wfsLight() ? '#ffffff' : '#0a1120'; ctx.fillRect(0, 0, c.width, c.height);
  const clone = svg.cloneNode(true); clone.setAttribute('width', vb.width); clone.setAttribute('height', vb.height); clone.style.minWidth = '';
  clone.querySelectorAll('text').forEach(t => t.setAttribute('font-family', 'IBM Plex Sans, Arial, sans-serif'));
  const img = new Image(); const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }));
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
  ctx.drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
  c.toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'NAVO workflow - ' + wfsCur().name + '.png'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }, 'image/png');
}

document.addEventListener('click', e => {
  if (st.view !== 'flows') return;
  const t = e.target.closest('[data-wfs-i],[data-wfs-pick],[data-wfs-new],[data-wfs-add],[data-wfs-move],[data-wfs-dup],[data-wfs-del],[data-wfs-desel],[data-wfs-color],[data-wfs-save],[data-wfs-undo],[data-wfs-reset],[data-wfs-remove],[data-wfs-png],[data-wfs-table]');
  if (!t) return;
  const ed = myRole() === 'admin', D = t.dataset;
  if (t.hasAttribute('data-wfs-table')) { WFS.table = !t.closest('details').open; return; }
  e.preventDefault();
  if (t.hasAttribute('data-wfs-png')) return wfsPng();
  if (D.wfsPick) { WFS.cur = D.wfsPick; WFS.sel = null; return wfsRedraw(); }
  if (!ed) return;
  if (D.wfsI != null) { WFS.sel = WFS.sel === +D.wfsI ? null : +D.wfsI; return wfsRedraw(); }
  if (t.hasAttribute('data-wfs-new')) { wfsTouch(); const id = 'wf' + Date.now().toString(36); WFS.draft.push({ id, name: 'New workflow', color: WFS_COLORS[WFS.draft.length % WFS_COLORS.length], nodes: [{ k: 's', t: 'Start', sub: '', br: '' }, { k: 'p', t: 'First step', sub: '', br: '' }, { k: 'e', t: 'End', sub: '', br: '' }] }); WFS.cur = id; WFS.sel = 1; return wfsRedraw(); }
  if (D.wfsAdd) { const wf = wfsTouch(); const n = { k: D.wfsAdd, t: { s: 'Start', p: 'New step', d: 'Decision?', a: 'Automatic step', e: 'End' }[D.wfsAdd], sub: '', br: D.wfsAdd === 'd' ? 'yes' : '' }; const at = WFS.sel != null ? WFS.sel + 1 : wf.nodes.length; wf.nodes.splice(at, 0, n); WFS.sel = at; wfsRedraw(); setTimeout(() => { const i = document.getElementById('wfs-t'); if (i) { i.focus(); i.select(); } }, 30); return; }
  if (D.wfsMove) { const wf = wfsTouch(), i = WFS.sel, j = i + +D.wfsMove; if (j < 0 || j >= wf.nodes.length) return; [wf.nodes[i], wf.nodes[j]] = [wf.nodes[j], wf.nodes[i]]; WFS.sel = j; return wfsRedraw(); }
  if (t.hasAttribute('data-wfs-dup')) { const wf = wfsTouch(); wf.nodes.splice(WFS.sel + 1, 0, { ...wf.nodes[WFS.sel] }); WFS.sel++; return wfsRedraw(); }
  if (t.hasAttribute('data-wfs-del')) { const wf = wfsTouch(); wf.nodes.splice(WFS.sel, 1); WFS.sel = wf.nodes.length ? Math.min(WFS.sel, wf.nodes.length - 1) : null; return wfsRedraw(); }
  if (t.hasAttribute('data-wfs-desel')) { WFS.sel = null; return wfsRedraw(); }
  if (D.wfsColor) { wfsTouch().color = D.wfsColor; return wfsRedraw(); }
  if (t.hasAttribute('data-wfs-save')) return wfsSave();
  if (t.hasAttribute('data-wfs-undo')) { WFS.draft = null; WFS.dirty = false; WFS.sel = null; if (!wfsList().some(w => w.id === WFS.cur)) WFS.cur = null; return wfsRedraw(); }
  if (t.hasAttribute('data-wfs-reset')) { if (t.dataset.armed !== '1') { t.dataset.armed = '1'; t.textContent = 'Click again to restore'; setTimeout(() => { if (t.isConnected) { t.dataset.armed = ''; t.textContent = 'Restore NAVO defaults'; } }, 3000); return; } WFS.draft = JSON.parse(JSON.stringify(WFS_DEF)); WFS.dirty = true; WFS.sel = null; WFS.cur = WFS.draft[0].id; toast('Defaults restored. Save to keep them.'); return wfsRedraw(); }
  if (t.hasAttribute('data-wfs-remove')) { if (t.dataset.armed !== '1') { t.dataset.armed = '1'; t.textContent = 'Click again to delete'; setTimeout(() => { if (t.isConnected) { t.dataset.armed = ''; t.textContent = 'Delete this workflow'; } }, 3000); return; } wfsTouch(); WFS.draft = WFS.draft.filter(w => w.id !== WFS.cur); WFS.cur = WFS.draft[0].id; WFS.sel = null; return wfsRedraw(); }
}, true);
document.addEventListener('keydown', e => { if (st.view === 'flows' && (e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[data-wfs-i]')) { e.preventDefault(); e.target.dispatchEvent(new MouseEvent('click', { bubbles: true })); } });
let wfsT = 0;
document.addEventListener('input', e => {
  if (st.view !== 'flows') return;
  if (e.target.id === 'wfs-name') { wfsTouch().name = e.target.value; clearTimeout(wfsT); wfsT = setTimeout(() => wfsRedraw(true), 350); return; }
  const f = e.target.dataset && e.target.dataset.wfsF; if (!f || WFS.sel == null) return;
  if (f === 'k' || f === 'br') return;
  const wf = wfsTouch(); wf.nodes[WFS.sel][f] = e.target.value;
  clearTimeout(wfsT); wfsT = setTimeout(() => { const c = document.getElementById('wfs-canvas'); if (c) c.innerHTML = wfsDraw(wf, { edit: true, sel: WFS.sel, light: wfsLight() }); const s = document.querySelector('.wfs-bar > span'); if (s) { s.className = 'wfs-dirty'; s.textContent = 'Unsaved changes'; } const b = document.querySelector('[data-wfs-save]'); if (b) b.disabled = false; }, 120);
});
document.addEventListener('change', e => { if (st.view === 'flows' && e.target.dataset && (e.target.dataset.wfsF === 'k' || e.target.dataset.wfsF === 'br')) { const wf = wfsTouch(); wf.nodes[WFS.sel][e.target.dataset.wfsF] = e.target.value; if (e.target.dataset.wfsF === 'k' && e.target.value === 'd' && !wf.nodes[WFS.sel].br) wf.nodes[WFS.sel].br = 'yes'; wfsRedraw(); } });
window.addEventListener('beforeunload', e => { if (WFS.dirty) { e.preventDefault(); e.returnValue = ''; } });
Object.assign(TITLES, { flows: 'Workflow studio' });

if (typeof cmSet === 'function') { const wfsBaseCm = cmSet; cmSet = function (x) { wfsBaseCm(x); if (st.view === 'flows') render(); }; }
