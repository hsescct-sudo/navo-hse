/* NAVO report centre: one entry point for every report, inspection and record.
   Each card opens the right form with the right type already chosen. */
'use strict';
const NVR_IC = {
  hazard: '<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4M12 17h.01"/>',
  near: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>',
  injury: '<path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z"/><path d="M12 9v6M9 12h6"/>',
  env: '<path d="M5 19c8 0 14-6 14-14-8 0-14 6-14 14z"/><path d="M5 19l7-7"/>',
  damage: '<path d="M3 17h18l-2-6H5z"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/><path d="M9 7l2 3 2-2 2 3"/>',
  good: '<path d="M7 11v9H4v-9z"/><path d="M7 11l4-8c1.5 0 2.5 1 2.5 2.5V9h5a2 2 0 0 1 2 2.3l-1.2 6.5A2 2 0 0 1 17.3 20H7"/>',
  insp: '<path d="M9 3h6l1 2h3v16H5V5h3z"/><path d="M9 12l2 2 4-4"/>',
  walk: '<circle cx="12" cy="5" r="2"/><path d="M10 22l2-7 3 3v6M12 15l-1-5 4 2 3 1M11 10l-3 3-2 1"/>',
  action: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  train: '<path d="M2 8l10-5 10 5-10 5z"/><path d="M6 10v5c3 2 9 2 12 0v-5"/>',
  more: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
};
const NVR_TYPES = [
  // id, group, title, what it covers, what happens next, colour, staff only
  ['hazard', 'Events', 'Hazard observation', 'Unsafe act, unsafe condition or equipment defect', 'Risk rated, reviewed by HSE, action assigned', 'amber', 0],
  ['near', 'Events', 'Near miss', 'An event that could have caused harm but did not', 'Potential severity screened, investigated if high potential', 'orange', 0],
  ['injury', 'Events', 'Injury / incident', 'Injury, illness, first aid, medical or lost time case', 'Classified, investigated, actions tracked to closure', 'red', 0],
  ['env', 'Events', 'Environmental incident', 'Spill, leak, emission, waste or water release', 'Contained, classified and investigated', 'green', 0],
  ['damage', 'Events', 'Property or vehicle damage', 'Damage to plant, vehicles, structures or property', 'Loss assessed and investigated', 'slate', 0],
  ['good', 'Events', 'Good practice', 'Safe behaviour or a good idea worth sharing', 'Recognised and shared across projects', 'teal', 0],
  ['insp', 'Assurance', 'Inspection', 'Professional checklists for every activity', 'At-risk findings become assigned actions', 'blue', 1],
  ['walk', 'Assurance', 'HSE walkthrough', 'Leadership or HSE walk with observations', 'Negative and critical findings become actions', 'indigo', 1],
  ['action', 'Assurance', 'Corrective action', 'An action that is not linked to a report', 'Assigned, evidenced, verified and closed', 'cyan', 1],
  ['train', 'Assurance', 'Training record', 'Course attendance and certificates', 'Compliance and expiry tracked', 'violet', 1],
  ['more', 'Assurance', 'Audit, MOC and other cases', 'Audits, findings, meetings and management of change', 'Opens the full case catalogue', 'navy', 1],
];
function nvrCenter() {
  const staff = typeof isStaff === 'function' ? isStaff() : true;
  const list = NVR_TYPES.filter(t => staff || !t[6]);
  const groups = [...new Set(list.map(t => t[1]))];
  return `<div class="nvr">
   <div class="nvr-hero"><div><span class="nvi-eyebrow">Report centre</span><h2>What would you like to report?</h2><p>Choose one card. The form opens with the right questions, and the right people are notified when you submit.</p></div>
    <div class="nvr-steps"><span><b>1</b>Choose</span><i></i><span><b>2</b>Describe</span><i></i><span><b>3</b>Submit</span><i></i><span><b>4</b>Follow up</span></div></div>
   ${groups.map(g => `<h3 class="nvr-g">${g}</h3><div class="nvr-grid">${list.filter(t => t[1] === g).map(([id, , title, what, next, col]) => `
     <button class="nvr-card c-${col}" data-nvpick="${id}"><span class="nvr-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${NVR_IC[id]}</svg></span>
      <b>${title}</b><small>${what}</small><em>${next}</em></button>`).join('')}</div>`).join('')}
  </div>`;
}

/* The field wizard is shown only once a type is chosen; otherwise the centre is shown. */
const nvrWizard = report;
report = function () {
  if (!st.w || st.w.center || !st.w.rt) return nvrCenter();
  const html = nvrWizard();
  const title = { Hazard: 'Hazard observation', Incident: st.w.kind === 'Near Miss' ? 'Near miss' : st.w.kind === 'Environmental' ? 'Environmental incident' : st.w.kind === 'Property Damage' ? 'Property or vehicle damage' : 'Injury / incident', 'Good practice': 'Good practice' }[st.w.rt] || st.w.rt;
  return `<div class="nvr-wiz"><button class="nvr-change" data-nvcenter>← All report types</button>${html.replace(`<b style="font:600 22px var(--f-display)">${st.w.rt}</b>`, `<b class="nvr-wtitle">${esc(title)}</b>`).replace(`<label>${st.w.rt} type</label>`, `<label>Type</label>`)}</div>`;
};
TITLES.report = 'Report centre';

function nvrOpen(id) {
  const preset = { hazard: ['Hazard'], near: ['Incident', 'Near Miss'], injury: ['Incident', 'Injury'], env: ['Incident', 'Environmental'], damage: ['Incident', 'Property Damage'], good: ['Good practice'] }[id];
  if (preset) { st.w = { step: 0, rt: preset[0], kind: preset[1], c: 'KSA' }; st.view = 'report'; window.scrollTo(0, 0); render(); return; }
  if (id === 'insp') { MX.i.draft = { ans: {}, notes: {} }; go('inspm'); return; }
  if (id === 'walk') { MX.w.draft = {}; go('walk'); return; }
  if (id === 'action') { MX.a.creating = true; MX.a.form = {}; go('lactions'); return; }
  if (id === 'train') { MX.t.draft = {}; go('train'); return; }
  if (id === 'more' && typeof cxCatalog === 'function') { cxCatalog(); }
}
document.addEventListener('click', e => {
  const t = e.target.closest('[data-nvpick],[data-nvcenter],[data-nvreport]'); if (!t) return;
  e.preventDefault(); e.stopPropagation();
  if (t.dataset.nvpick) return nvrOpen(t.dataset.nvpick);
  st.w = { center: true }; if (st.view !== 'report') go('report'); else { window.scrollTo(0, 0); render(); }
}, true);
