/* NAVO Excel import: download a template, fill it, upload, preview, then save.
   Monthly performance data (man-hours, training, permits, waste, energy) and environmental data in one file.
   Rows are saved through the signed-in person's own permissions; blank cells never erase saved figures. */
'use strict';
const XI = { month: null, preview: null, busy: false };
const XI_ENV = () => (typeof ENV_FIELDS !== 'undefined' ? ENV_FIELDS : [['electricity', 'Electricity from grid (kWh)'], ['renewable', 'Renewable electricity (kWh)'], ['dieselL', 'Diesel (litres)'], ['waterPotable', 'Potable water (m³)'], ['waterNonPotable', 'Non-potable water (m³)'], ['offset', 'GHG offset (tCO₂e)']]);
const XI_MON = () => MF.flatMap(([g, f]) => f.map(([k, l]) => [k, `${l} (${g})`]));
function xiMonth() { if (!XI.month) { const d = new Date(); d.setMonth(d.getMonth() - 1); XI.month = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); } return XI.month; }
function xiPanel() {
  const P = XI.preview;
  return `<div class="panel xi" id="xi"><div class="nvi-head"><div><span class="nvi-eyebrow">Import from Excel</span><h2>Monthly and environmental data in one file</h2><p>Download the template for a month, fill it, upload it. You will see a preview before anything is saved.</p></div></div>
   <div class="xi-steps"><div class="xi-step"><b>1</b><div><label>Month</label><input type="month" id="xi-month" value="${xiMonth()}"></div><button class="btn" data-xi-template>Download template</button></div>
    <div class="xi-step"><b>2</b><div><label>Filled template (.xlsx)</label><input type="file" id="xi-file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"></div><button class="btn pri" data-xi-read ${XI.busy ? 'disabled' : ''}>${XI.busy ? 'Reading…' : 'Check file'}</button></div></div>
   ${P ? `<div class="xi-prev"><div class="xi-counts"><span class="ok">${P.rows.filter(r => r.kind === 'monthly').length}<small>monthly rows</small></span><span class="ok">${P.rows.filter(r => r.kind === 'env').length}<small>environmental rows</small></span><span class="${P.errors.length ? 'bad' : 'ok'}">${P.errors.length}<small>problems</small></span><span>${P.rows.filter(r => xiExisting(r)).length}<small>will update saved figures</small></span></div>
     ${P.errors.length ? `<div class="nvi-alert"><div>${P.errors.slice(0, 12).map(esc).join('<br>')}${P.errors.length > 12 ? `<br>… and ${P.errors.length - 12} more` : ''}</div></div>` : ''}
     ${P.rows.length ? `<div class="tbl"><table><thead><tr><th>Sheet</th><th>Project</th><th>Month</th><th class="r">Figures</th><th>Action</th></tr></thead><tbody>${P.rows.slice(0, 30).map(r => `<tr><td>${esc(r.sheet)}</td><td>${esc(projName(r.project))}</td><td>${esc(r.month)}</td><td class="r">${Object.keys(r.values).length}</td><td>${xiExisting(r) ? 'Update' : 'New'}</td></tr>`).join('')}</tbody></table></div>${P.rows.length > 30 ? `<p class="mx-muted">${P.rows.length - 30} more rows</p>` : ''}
     <div class="filters"><button class="btn pri" data-xi-save>Import ${P.rows.length} row${P.rows.length === 1 ? '' : 's'}</button><button class="btn" data-xi-clear>Cancel</button></div>` : '<p class="mx-muted">No rows with figures were found.</p>'}</div>` : ''}
  </div>`;
}
const xiExisting = r => (L.records || []).find(x => x.kind === r.kind && x.project === r.project && x.data && x.data.month === r.month);
async function xiTemplate(btn) {
  XI.month = document.getElementById('xi-month').value || xiMonth();
  const P = myProjects(), existing = { monthly: {}, env: {} };
  (L.records || []).filter(r => (r.kind === 'monthly' || r.kind === 'env') && r.data && r.data.month === XI.month).forEach(r => { existing[r.kind][r.project] = r.data; });
  const payload = { kind: 'template', title: 'Import template', month: XI.month, projects: P.map(p => ({ id: p.id, name: p.name })), monthly: XI_MON(), env: XI_ENV(), existing };
  if (typeof ceoDownload === 'function') return ceoDownload({ ...payload, scopeLabel: 'Data import', month: XI.month }, 'xlsx', btn);
}
async function xiRead() {
  const f = document.getElementById('xi-file').files[0]; if (!f) { toast('Choose the filled template first.'); return; }
  if (f.size > 5e6) { toast('The file must be smaller than 5 MB.'); return; }
  XI.busy = true; render();
  try {
    const b64 = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(f); });
    const res = await fetch('/api/xlimport', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file: b64, projects: myProjects().map(p => ({ id: p.id, name: p.name })), monthly: XI_MON(), env: XI_ENV() }) });
    const j = await res.json().catch(() => ({})); if (!res.ok) throw new Error(j.error || 'The file could not be read.');
    XI.preview = j;
  } catch (e) { toast(e.message || 'The file could not be read.'); }
  finally { XI.busy = false; render(); document.getElementById('xi')?.scrollIntoView({ block: 'start' }); }
}
async function xiSave() {
  const rows = (XI.preview && XI.preview.rows) || []; let n = 0;
  const ok = await liveSave(async () => {
    for (const r of rows) {
      const ex = xiExisting(r), [y, m] = r.month.split('-').map(Number), ts = new Date(y, m - 1, 15).getTime();
      if (ex) { const data = { ...ex.data, ...r.values }; await L.db.collection('records').doc(ex.id).update({ data }); ex.data = data; }
      else await L.db.collection('records').add({ project: r.project, kind: r.kind, ts, data: { month: r.month, ...r.values }, by: L.me.id });
      n++;
    }
  });
  if (ok !== false) { toast(`${n} row${n === 1 ? '' : 's'} imported`); XI.preview = null; render(); }
}
const xiBaseHdata = hdata;
hdata = function () { const html = xiBaseHdata(); return isStaff() && !/Only HSE staff/.test(html) ? xiPanel() + html : html; };
document.addEventListener('click', e => {
  const t = e.target.closest('[data-xi-template],[data-xi-read],[data-xi-save],[data-xi-clear]'); if (!t) return; e.preventDefault();
  if (t.hasAttribute('data-xi-template')) return xiTemplate(t);
  if (t.hasAttribute('data-xi-read')) return xiRead();
  if (t.hasAttribute('data-xi-save')) return xiSave();
  XI.preview = null; render();
});
document.addEventListener('change', e => { if (e.target.id === 'xi-month') XI.month = e.target.value; });
