/* NAVO Leadership scorecard: every leader's visible safety leadership in one place, linked to the rest of NAVO
   (walkthroughs, inspections, reports, actions raised and owned, approvals in the registers, own training),
   with a monthly target, an appraisal score and an Excel export for performance appraisals. */
'use strict';
const LD = { period: 'ytd', names: {}, loading: false, open: null };
const ldW = (L.structure && L.structure.leadership && L.structure.leadership.weights) || { walks: 35, actions: 25, insp: 15, report: 10, training: 15 };
async function ldNames(ids) { const need = ids.filter(i => !LD.names[i]); if (!need.length || LD.loading || !L.user || !L.user.profiles) return; LD.loading = true; try { const P = await L.user.profiles(need); Object.entries(P).forEach(([k, v]) => LD.names[k] = v); } catch (e) {} LD.loading = false; render(); }
function ldLeaders() { return Object.entries(L.members || {}).filter(([, m]) => m.leader || /director|manager|ceo|head|lead/i.test(m.title || '')).map(([uid, m]) => ({ uid, m })); }
function ldRange() { const now = new Date(); if (LD.period === 'month') return [new Date(now.getFullYear(), now.getMonth(), 1).getTime(), Date.now()]; if (LD.period === 'q') return [new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1).getTime(), Date.now()]; return [new Date(now.getFullYear(), 0, 1).getTime(), Date.now()]; }
function ldMonths() { const [a] = ldRange(); return Math.max(1, Math.round((Date.now() - a) / (30.4 * DAY_MS))); }
function ldStats(uid, m) {
  const [a, b] = ldRange(), inR = t => t >= a && t <= b, ids = new Set(myProjects().map(p => p.id)), name = ((LD.names[uid] || {}).name || '').toLowerCase(), email = ((LD.names[uid] || {}).email || '').toLowerCase();
  const act = (L.activities || []).filter(v => v.by === uid && ids.has(v.project) && inR(v.date || v.ts));
  const walksAct = act.filter(v => /walk/i.test(v.type || '')).reduce((n, v) => n + (+v.count || 1), 0);
  const walkRecs = (L.records || []).filter(r => r.kind === 'walkthrough' && ids.has(r.project) && inR(r.ts) && (r.by === uid || (name && (r.data.mgmt || '').toLowerCase().includes(name))) && r.data.status !== 'Scheduled').length;
  const walks = walksAct + walkRecs, tbt = act.filter(v => /toolbox/i.test(v.type || '')).reduce((n, v) => n + (+v.count || 1), 0);
  const insp = (L.inspections || []).filter(i => i.by === uid && ids.has(i.project) && inR(i.ts)).length;
  const reps = (L.reports || []).filter(r => r.by === uid && ids.has(r.project) && inR(r.ts)).length;
  const raised = (L.actions || []).filter(x => x.by === uid && ids.has(x.project) && inR(x.ts)), raisedClosed = raised.filter(x => x.closedAt).length;
  const owned = (L.actions || []).filter(x => ids.has(x.project) && name && (x.owner || '').toLowerCase() === name), ownedOpen = owned.filter(x => !x.closedAt), ownedOver = ownedOpen.filter(x => x.due && x.due < Date.now());
  const approvals = (L.records || []).filter(r => r.kind && r.kind.startsWith('r:') && ids.has(r.project)).reduce((n, r) => n + ((r.data.hist || []).filter(h => inR(h.at) && name && (h.by || '').toLowerCase() === name && /approved|verified|returned to service/i.test(h.what || '')).length), 0);
  const person = rgRecs('tp').find(p => name && (p.data.name || '').toLowerCase() === name), tr = person ? trPersonStatus(person) : null;
  const target = (+m.walkTarget || 0) * ldMonths();
  const sWalk = target ? Math.min(1, walks / target) : walks ? 1 : 0, sAct = raised.length ? raisedClosed / raised.length : 1, sOwn = owned.length ? 1 - ownedOver.length / Math.max(1, owned.length) : 1;
  const sInsp = Math.min(1, insp / Math.max(1, ldMonths() * 2)), sRep = Math.min(1, (reps + tbt) / Math.max(1, ldMonths() * 2)), sTr = tr ? tr.pct / 100 : 1;
  const score = Math.round(ldW.walks * sWalk + ldW.actions * (sAct * .5 + sOwn * .5) + ldW.insp * sInsp + ldW.report * sRep + ldW.training * sTr);
  return { walks, target, tbt, insp, reps, raised: raised.length, raisedClosed, owned: owned.length, ownedOpen: ownedOpen.length, ownedOver: ownedOver.length, approvals, tr, person, score, list: { owned: ownedOpen } };
}
const ldBand = s => s >= 85 ? ['Visible leader', 'ok'] : s >= 70 ? ['Engaged', 'info'] : s >= 50 ? ['Needs focus', 'warn'] : ['Not engaged', 'bad'];
function ldPage() {
  const Ls = ldLeaders(); ldNames(Ls.map(x => x.uid));
  const rows = Ls.map(x => ({ ...x, s: ldStats(x.uid, x.m), n: (LD.names[x.uid] || {}).name || 'Leader' })).sort((a, b) => b.s.score - a.s.score);
  const sel = LD.open && rows.find(r => r.uid === LD.open);
  const avg = rows.length ? Math.round(rows.reduce((n, r) => n + r.s.score, 0) / rows.length) : null;
  return `<div class="rg-bar"><div class="org-tabs" style="margin:0">${[['month', 'This month'], ['q', 'This quarter'], ['ytd', 'Year to date']].map(([k, l]) => `<button data-ld-p="${k}" aria-current="${LD.period === k}">${l}</button>`).join('')}</div><span class="rg-sp"></span><button class="btn" data-ld-xl>Export for appraisals (Excel)</button></div>
   <div class="rg-kpis">${rgKpi('Leaders', rows.length, 'info')}${rgKpi('Average score', avg ?? '—', avg >= 70 ? 'ok' : 'warn')}${rgKpi('Walkthroughs', rows.reduce((n, r) => n + r.s.walks, 0), 'info')}${rgKpi('Actions raised / closed', rows.reduce((n, r) => n + r.s.raised, 0) + ' / ' + rows.reduce((n, r) => n + r.s.raisedClosed, 0), 'info')}${rgKpi('Leaders’ own overdue actions', rows.reduce((n, r) => n + r.s.ownedOver, 0), rows.some(r => r.s.ownedOver) ? 'bad' : 'ok')}${rgKpi('Not engaged', rows.filter(r => r.s.score < 50).length, rows.some(r => r.s.score < 50) ? 'bad' : 'ok')}</div>
   ${sel ? ldDetail(sel) : ''}
   <div class="rg-dash">${rgCard('Leadership score', rows.length ? cdHbars(rows.slice(0, 14).map(r => ({ l: r.n, v: r.s.score, c: { ok: '#1f9d63', info: '#2f73c9', warn: '#e0a106', bad: '#d23b3f' }[ldBand(r.s.score)[1]] })), { lw: 150 }) : '<p class="cd-none">Mark leaders in Organisation & access</p>', 'cd-wide')}
    ${rgCard('Walkthroughs vs target', rows.length ? cdBars(rows.slice(0, 8).map(r => r.n.split(' ')[0]), [{ name: 'Target', vals: rows.slice(0, 8).map(r => r.s.target), color: '#8fa6e6' }, { name: 'Done', vals: rows.slice(0, 8).map(r => r.s.walks), color: '#2f73c9' }], { flat: 1 }) : '<p class="cd-none">—</p>')}</div>
   <div class="panel"><h2>Leadership scorecard</h2><div class="rg-tw"><table class="rg-t"><thead><tr><th>Leader</th><th>Position</th><th>Walks / target</th><th>Inspections</th><th>Reports & talks</th><th>Actions raised (closed)</th><th>Own actions open (overdue)</th><th>Approvals</th><th>Own training</th><th>Score</th></tr></thead><tbody>
   ${rows.map(r => `<tr data-ld-open="${rgEsc(r.uid)}" tabindex="0" style="cursor:pointer"><td><b>${rgEsc(r.n)}</b></td><td>${rgEsc(r.m.title || ROLES[r.m.role] || '')}</td><td>${r.s.walks} / ${r.s.target || '—'}</td><td>${r.s.insp}</td><td>${r.s.reps + r.s.tbt}</td><td>${r.s.raised} (${r.s.raisedClosed})</td><td>${r.s.ownedOpen} ${r.s.ownedOver ? rgPill(r.s.ownedOver + ' overdue', 'bad') : ''}</td><td>${r.s.approvals}</td><td>${r.s.tr ? rgPill(r.s.tr.pct + '%', r.s.tr.pct === 100 ? 'ok' : 'warn') : '<span class="rg-blank">not in register</span>'}</td><td>${rgPill(r.s.score + ' · ' + ldBand(r.s.score)[0], ldBand(r.s.score)[1])}</td></tr>`).join('') || '<tr><td colspan="10" class="rg-empty">No leaders yet. In Organisation & access, give managers a director or manager position, or tick “leader”.</td></tr>'}
   </tbody></table></div><p class="rg-note">Score out of 100: walkthroughs against target ${ldW.walks}, actions closed and own actions on time ${ldW.actions}, inspections ${ldW.insp}, reporting and toolbox talks ${ldW.report}, own required training ${ldW.training}. Monthly walkthrough target is set per person in Organisation & access.</p></div>`;
}
function ldDetail(r) {
  const s = r.s;
  return `<div class="panel" style="border-left:4px solid var(--ac)"><div class="rg-bar"><h2>${rgEsc(r.n)} <small>${rgEsc(r.m.title || '')}</small></h2><span class="rg-sp"></span>${rgPill(s.score + ' · ' + ldBand(s.score)[0], ldBand(s.score)[1])}<button class="btn" data-ld-close>Close</button></div>
   <div class="rg-secs"><div><h3>Own open actions</h3>${s.list.owned.length ? `<div class="rg-tw"><table class="rg-t"><tbody>${s.list.owned.slice(0, 12).map(a => `<tr><td>${rgEsc(a.title)}</td><td>${rgEsc(projName(a.project))}</td><td>${a.due ? (a.due < Date.now() ? rgPill('Overdue ' + Math.floor((Date.now() - a.due) / DAY_MS) + ' d', 'bad') : rgPill('Due ' + rgDate(a.due), 'info')) : ''}</td></tr>`).join('')}</tbody></table></div>` : '<p class="mx-muted">None open.</p>'}</div>
   <div><h3>Own training</h3>${s.person ? `<p><a href="#" data-rg-open="${rgEsc(s.person.id)}">${rgEsc(s.person.data.name)} · ${s.tr.pct}% of required training valid</a></p>` : '<p class="mx-muted">Add this leader to the people register to track their training.</p>'}
    <h3>Visible leadership</h3><p>${s.walks} walkthroughs (target ${s.target || '—'}), ${s.insp} inspections, ${s.reps} reports, ${s.tbt} toolbox talks, ${s.approvals} approvals in the registers.</p></div></div></div>`;
}
document.addEventListener('click', async e => {
  const t = e.target.closest('[data-ld-p],[data-ld-open],[data-ld-close],[data-ld-xl]'); if (!t) return; e.preventDefault();
  if (t.dataset.ldP) LD.period = t.dataset.ldP; if (t.dataset.ldOpen) LD.open = t.dataset.ldOpen; if (t.hasAttribute('data-ld-close')) LD.open = null;
  if (t.hasAttribute('data-ld-xl')) { await rgXlsxLib(); const rows = ldLeaders().map(x => { const s = ldStats(x.uid, x.m); return { Leader: (LD.names[x.uid] || {}).name || '', Position: x.m.title || '', Period: { month: 'This month', q: 'This quarter', ytd: 'Year to date' }[LD.period], Walkthroughs: s.walks, 'Walk target': s.target, Inspections: s.insp, Reports: s.reps, 'Toolbox talks': s.tbt, 'Actions raised': s.raised, 'Actions closed': s.raisedClosed, 'Own actions open': s.ownedOpen, 'Own actions overdue': s.ownedOver, Approvals: s.approvals, 'Own training %': s.tr ? s.tr.pct : '', Score: s.score, Rating: ldBand(s.score)[0] }; }); const ws = XLSX.utils.json_to_sheet(rows), wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Leadership'); XLSX.writeFile(wb, 'NAVO leadership scorecard.xlsx'); return; }
  render();
});
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches && e.target.matches('[data-ld-open]')) e.target.click(); });
regModule({ id: 'leadership', title: 'Leadership scorecard', eyebrow: 'Visible leadership', headline: 'Leaders who show up, follow up and close out', desc: 'Each leader’s walkthroughs against target, inspections, actions raised and owned, approvals and own training, rolled into one score linked to appraisals.', ents: [], tabs: [['score', 'Scorecard', () => ldPage()]] });
