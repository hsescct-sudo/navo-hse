/* Navigation for the operational modules */
'use strict';
(function () {
  const lead = NX_GROUPS.find(g => g[0] === 'leadership'); if (lead && !lead[4].some(x => x[0] === 'm-leadership')) lead[4].unshift(['m-leadership', 'Leadership scorecard']);
  rgNav('operations', 'Equipment & operations', '<path d="M3 21h18M5 21V10l7-5 7 5v11"/><path d="M9 21v-6h6v6"/>', [['m-equipment', 'Equipment'], ['m-scaffold', 'Scaffolds'], ['m-fleet', 'Fleet & garage'], ['m-food', 'Food safety']], 'training');
  rgNav('monitoring', 'Live monitoring', '<circle cx="12" cy="12" r="3"/><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/>', [['m-envmon', 'Environmental sensors'], ['m-cctv', 'CCTV analytics']], 'operations');
  const adm = NX_GROUPS.find(g => g[0] === 'admin'); if (adm && !adm[4].some(x => x[0] === 'm-devices')) adm[4].splice(adm[4].length - 1, 0, ['m-devices', 'Connected devices']);
})();
