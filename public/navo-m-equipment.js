/* NASS Safe Link Equipment management: register by category, documents with verification and expiry, QR per item,
   onboarding approval, inspections with hold / return to service, maintenance by date or hours,
   project transfers that keep the same ID and QR, reminders and dashboards. */
'use strict';
const EQ_CAT = ['Mobile equipment', 'Lifting equipment', 'Static equipment', 'Vehicle', 'Lifting accessory'];
const EQ_OP = ['Operating', 'Idle', 'Under maintenance', 'Out of service', 'Demobilised'];
const EQ_DOCS = {
  'Mobile equipment': ['Third-party inspection certificate', 'Registration / licence', 'Insurance', 'Maintenance record', 'Operator licence'],
  'Lifting equipment': ['Third-party inspection certificate', 'Load test certificate', 'Load chart', 'Registration / licence', 'Insurance', 'Operator licence', 'Maintenance record'],
  'Static equipment': ['Third-party inspection certificate', 'Maintenance record'],
  'Vehicle': ['Registration / licence', 'Insurance', 'Third-party inspection certificate', 'Operator licence'],
  'Lifting accessory': ['Third-party inspection certificate', 'Load test certificate'] };
const EQ_REQ = { 'Mobile equipment': ['Third-party inspection certificate', 'Operator licence'], 'Lifting equipment': ['Third-party inspection certificate', 'Load test certificate', 'Load chart', 'Operator licence'], 'Static equipment': ['Third-party inspection certificate'], 'Vehicle': ['Registration / licence', 'Insurance'], 'Lifting accessory': ['Third-party inspection certificate'] };
const EQ_COLOURS = ['#e11d48', '#f59e0b', '#16a34a', '#2563eb', '#ffffff', '#111827'];
const eqColourName = c => ({ '#e11d48': 'Red', '#f59e0b': 'Yellow', '#16a34a': 'Green', '#2563eb': 'Blue', '#ffffff': 'White', '#111827': 'Black' })[c] || c;
const eqCfg = () => (L.structure && L.structure.equipment) || {};
const eqLift = d => d.cat === 'Lifting equipment' || d.cat === 'Lifting accessory';
const eqInsp = id => rgRecs('ei').filter(x => x.data.eq === id).sort((a, b) => (b.data.date || '') > (a.data.date || '') ? 1 : -1);
const eqMaint = id => rgRecs('em').filter(x => x.data.eq === id).sort((a, b) => (b.data.date || '') > (a.data.date || '') ? 1 : -1);
function eqNextInsp(r) { const I = eqInsp(r.id).filter(x => x.data.next); return I.length ? I[0].data.next : null; }
function eqNextMaint(r) { const M = eqMaint(r.id).filter(x => x.data.next); return M.length ? M[0].data.next : null; }
function eqCompliance(d, r) {
  if (d.hold) return { label: 'Suspended', tone: 'bad', k: 'suspended', rank: 0 };
  if (d.opStatus === 'Demobilised') return { label: 'Demobilised', tone: 'mute', k: 'demob', rank: 9 };
  if (d.approval !== 'Approved') return { label: d.approval === 'Returned' ? 'Returned for correction' : 'Pending verification', tone: 'info', k: 'pending', rank: 2 };
  const s = rgDocSummary(REG.ents.eq, d), ni = r && eqNextInsp(r);
  if (s.expired || s.missing.length || (ni && rgDays(ni) < 0)) return { label: s.expired ? 'Expired' : s.missing.length ? 'Missing documents' : 'Inspection overdue', tone: 'bad', k: 'expired', rank: 1 };
  if (s.due || (ni && rgDays(ni) <= 7)) return { label: 'Expiring soon', tone: 'warn', k: 'due', rank: 3 };
  return { label: 'Compliant', tone: 'ok', k: 'ok', rank: 5 };
}
async function eqProjectPick(cur) {
  return new Promise(res => {
    const P = myProjects().filter(p => p.id !== cur), w = document.createElement('div'); w.className = 'acc-modal rg-modal';
    w.innerHTML = `<div class="acc-sheet rg-sheet"><div class="acc-sheet-h"><h2>Transfer to another project</h2><button class="btn" data-x>✕</button></div><div class="rg-grid">
     <div class="fld"><label for="eqt-p">Destination project</label><select id="eqt-p" class="mx-in">${P.map(p => `<option value="${rgEsc(p.id)}">${rgEsc(p.name)}</option>`).join('')}</select></div>
     <div class="fld"><label for="eqt-d">Transfer date</label><input id="eqt-d" type="date" class="mx-in" value="${new Date().toISOString().slice(0, 10)}"></div>
     <div class="fld rg-wide"><label for="eqt-c">Handover condition</label><textarea id="eqt-c" class="mx-in" rows="2" placeholder="Condition, hours, defects, accessories"></textarea></div></div>
     <div class="filters acc-foot"><button class="btn pri" data-ok>Transfer</button><button class="btn" data-x>Cancel</button></div></div>`;
    document.body.appendChild(w);
    w.addEventListener('click', e => { if (e.target.closest('[data-x]') || e.target === w) { w.remove(); res(null); } if (e.target.closest('[data-ok]')) { const v = { to: w.querySelector('#eqt-p').value, date: w.querySelector('#eqt-d').value, cond: w.querySelector('#eqt-c').value.trim() }; w.remove(); res(v.to ? v : null); } });
  });
}
async function eqEvidence(title, note) {
  return new Promise(res => {
    const w = document.createElement('div'); w.className = 'acc-modal rg-modal';
    w.innerHTML = `<div class="acc-sheet rg-sheet"><div class="acc-sheet-h"><h2>${rgEsc(title)}</h2><button class="btn" data-x>✕</button></div><p class="mx-muted">${rgEsc(note)}</p><div class="rg-grid">
     <div class="fld rg-wide"><label for="eqe-t">Corrective action taken</label><textarea id="eqe-t" class="mx-in" rows="3"></textarea></div>
     <div class="fld rg-wide"><label for="eqe-f">Evidence (photos, re-inspection report)</label><input id="eqe-f" type="file" multiple class="mx-in"></div></div>
     <div class="filters acc-foot"><button class="btn pri" data-ok>Submit</button><button class="btn" data-x>Cancel</button></div></div>`;
    document.body.appendChild(w);
    w.addEventListener('click', e => { if (e.target.closest('[data-x]') || e.target === w) { w.remove(); res(null); } if (e.target.closest('[data-ok]')) { const t = w.querySelector('#eqe-t').value.trim(), f = [...w.querySelector('#eqe-f').files]; if (!t || !f.length) { toast('Describe the corrective action and attach evidence'); return; } w.remove(); res({ t, f }); } });
  });
}
function eqPrint(r) {
  const d = r.data, e = REG.ents.eq, c = eqCompliance(d, r), s = rgDocSummary(e, d), I = eqInsp(r.id).slice(0, 8);
  const w = window.open('', '_blank'); if (!w) { toast('Allow pop-ups to print'); return; }
  w.document.write(`<!doctype html><title>${rgEsc(d._no)} equipment profile</title><style>body{font-family:Arial,sans-serif;margin:14mm;color:#122033}h1{margin:0 0 2mm;font-size:18pt}h2{font-size:12pt;margin:6mm 0 2mm;border-bottom:1px solid #ccd;padding-bottom:1mm}table{width:100%;border-collapse:collapse;font-size:9.5pt}td,th{border-bottom:1px solid #e3e8ef;padding:1.5mm;text-align:left;vertical-align:top}.k{color:#5f6f84;width:38%}.top{display:flex;justify-content:space-between;gap:8mm}.q svg{width:32mm;height:32mm}.p{display:inline-block;border:1px solid #888;border-radius:10px;padding:1mm 3mm;font-weight:700;font-size:9pt}</style>
  <div class="top"><div><div style="font:700 9pt Arial;letter-spacing:.1em;color:#2f73c9">EQUIPMENT PROFILE</div><h1>${rgEsc(d._no)} · ${rgEsc(rgTitle(r))}</h1><div>${rgEsc(projName(r.project))} · ${rgEsc(d.cat || '')}</div><p><span class="p">${rgEsc(c.label)}</span> <span class="p">${rgEsc(d.opStatus || '')}</span></p></div><div class="q">${typeof qrcode === 'function' ? rgQrSvg(rgQrUrl(r)) : ''}</div></div>
  <h2>Details</h2><table>${e.fields.filter(f => rgFieldOn(f, d) && !['files', 'photo'].includes(f.type) && d[f.k] != null && d[f.k] !== '').map(f => `<tr><td class="k">${rgEsc(f.l)}</td><td>${rgVal(e, f, d).replace(/<[^>]+>/g, '')}</td></tr>`).join('')}</table>
  <h2>Documents</h2><table><tr><th>Type</th><th>No.</th><th>Expiry</th><th>Status</th></tr>${Object.values(s.latest).map(x => `<tr><td>${rgEsc(x.type)}</td><td>${rgEsc(x.no || '')}</td><td>${x.noExpiry ? 'No expiry' : rgDate(x.expiry)}</td><td>${rgEsc(rgDocState(x, e.warn).label)}</td></tr>`).join('')}${s.missing.map(t => `<tr><td>${rgEsc(t)}</td><td></td><td></td><td><b>Missing</b></td></tr>`).join('')}</table>
  <h2>Recent inspections</h2><table><tr><th>Date</th><th>Type</th><th>Result</th><th>Inspector</th><th>Next due</th></tr>${I.map(x => `<tr><td>${rgDate(x.data.date)}</td><td>${rgEsc(x.data.type)}</td><td>${rgEsc(x.data.result)}</td><td>${rgEsc(x.data.inspector || '')}</td><td>${rgDate(x.data.next)}</td></tr>`).join('') || '<tr><td colspan="5">None</td></tr>'}</table>
  <p style="font-size:8pt;color:#5f6f84;margin-top:8mm">Printed ${new Date().toLocaleString('en-GB')} from NASS Safe Link</p><script>setTimeout(()=>print(),400)<\/script>`);
  w.document.close();
}

regModule({ id: 'equipment', title: 'Equipment', eyebrow: 'Equipment management', headline: 'Every machine, its papers and its condition', desc: 'Register across all projects, certificates with verification and expiry, a QR on every item, inspections that can stop a machine, maintenance, transfers and reminders.',
  ents: [
    { kind: 'eq', name: 'Equipment', plural: 'Equipment', prefix: 'EQ', qr: true, docs: true, warn: 30, unique: ['serial', 'plate'],
      cols: ['name', 'cat', 'contractor', 'opStatus'], filters: ['cat', 'opStatus', 'ownership'],
      title: d => d.name || 'Equipment', sub: d => [d.cat, d.make, d.model].filter(Boolean).join(' · '),
      docTypes: d => [...(EQ_DOCS[d.cat] || []), ...((eqCfg().extraDocs || {})[d.cat] || [])],
      docReq: d => [...(EQ_REQ[d.cat] || []), ...((eqCfg().extraReq || {})[d.cat] || [])],
      fields: [
        { k: 'name', l: 'Equipment name', type: 'text', req: true, sec: 'Identity', example: 'Mobile crane 50 t' }, { k: 'cat', l: 'Category', type: 'select', opts: EQ_CAT, req: true }, { k: 'type', l: 'Type', type: 'text', ph: 'e.g. crawler crane, forklift, generator' },
        { k: 'make', l: 'Manufacturer', type: 'text' }, { k: 'model', l: 'Model', type: 'text' }, { k: 'serial', l: 'Serial number', type: 'text', req: true }, { k: 'plate', l: 'Plate / registration no.', type: 'text', show: d => d.cat !== 'Lifting accessory' && d.cat !== 'Static equipment' }, { k: 'year', l: 'Year of manufacture', type: 'num' },
        { k: 'ownership', l: 'Ownership', type: 'select', opts: ['Owned', 'Rented'], req: true, sec: 'Ownership & assignment' }, { k: 'owner', l: 'Owner', type: 'text' }, { k: 'contractor', l: 'Contractor', type: 'text' }, { k: 'rental', l: 'Rental company', type: 'text', show: d => d.ownership === 'Rented' },
        { k: 'rentStart', l: 'Rental start', type: 'date', show: d => d.ownership === 'Rented' }, { k: 'rentEnd', l: 'Rental end', type: 'date', show: d => d.ownership === 'Rented' },
        { k: 'area', l: 'Work area', type: 'text' }, { k: 'location', l: 'Location', type: 'text' }, { k: 'mob', l: 'Mobilisation date', type: 'date' }, { k: 'demobPlan', l: 'Planned demobilisation', type: 'date' }, { k: 'demob', l: 'Actual demobilisation', type: 'date' },
        { k: 'capacity', l: 'Capacity', type: 'text', sec: 'Technical', ph: 'e.g. 50 t, 400 kVA, 3 m³' }, { k: 'specs', l: 'Technical specifications', type: 'textarea' },
        { k: 'rated', l: 'Rated capacity (SWL)', type: 'num', unit: 't', show: d => d.cat === 'Lifting equipment' }, { k: 'loadChart', l: 'Load chart reference', type: 'text', show: d => d.cat === 'Lifting equipment' },
        { k: 'tagId', l: 'Accessory ID (stamped)', type: 'text', show: d => d.cat === 'Lifting accessory' }, { k: 'wll', l: 'WLL / SWL', type: 'num', unit: 't', show: d => d.cat === 'Lifting accessory' },
        { k: 'colour', l: 'Inspection colour code', type: 'color', opts: EQ_COLOURS, optLabel: eqColourName, show: d => d.cat === 'Lifting accessory' },
        { k: 'meter', l: 'Usage meter', type: 'select', opts: ['None', 'Hours', 'Kilometres'], show: d => d.cat !== 'Lifting accessory' }, { k: 'reading', l: 'Current reading', type: 'num', show: d => d.meter && d.meter !== 'None' }, { k: 'interval', l: 'Service every', type: 'num', show: d => d.meter && d.meter !== 'None', help: 'Hours or km between services' },
        { k: 'operator', l: 'Assigned operator', type: 'ref', ref: 'tp', sec: 'Operation', show: d => d.cat !== 'Lifting accessory' }, { k: 'opStatus', l: 'Operational status', type: 'select', opts: EQ_OP, req: true },
        { k: 'photo', l: 'Photo', type: 'photo', noImport: true }, { k: 'files', l: 'Other attachments', type: 'files' }, { k: 'remarks', l: 'Remarks', type: 'textarea' }],
      defaults: () => ({ opStatus: 'Idle', ownership: 'Owned', approval: 'Draft', meter: 'None' }),
      validate: d => d.rentEnd && d.rentStart && d.rentEnd < d.rentStart ? 'Rental end is before rental start' : null,
      status: (d, r) => eqCompliance(d, r),
      chips: (d, r) => { const c = [[d.opStatus || '', d.opStatus === 'Operating' ? 'ok' : d.opStatus === 'Out of service' ? 'bad' : 'mute'], ['Approval: ' + (d.approval || 'Draft'), d.approval === 'Approved' ? 'ok' : 'info']]; const ni = eqNextInsp(r); if (ni) c.push(['Next inspection ' + rgDate(ni), rgDays(ni) < 0 ? 'bad' : rgDays(ni) <= 7 ? 'warn' : 'mute']); if (d.hold) c.push(['ON HOLD', 'bad']); if (d.cat === 'Lifting accessory' && d.colour) c.push(['Colour ' + eqColourName(d.colour), 'info']); return c; },
      panel: (d, r) => {
        const op = d.operator && rgGet(d.operator), ops = op ? trPersonStatus(op) : null, nm = eqNextMaint(r), tr = d.transfers || [];
        return `<div class="rg-secs">
          ${d.hold ? `<div class="panel" style="border-left:4px solid #d23b3f"><h3>On hold since ${rgDate(d.holdAt)}</h3><p>${rgEsc(d.holdReason || '')}</p><p class="mx-muted">Return to service needs corrective-action evidence and approval by HSE.</p></div>` : ''}
          ${op ? `<div class="panel"><h3>Operator</h3><p><a href="#" data-rg-open="${rgEsc(op.id)}"><b>${rgEsc(op.data.name)}</b></a> · ${rgEsc(op.data.position || '')}</p><p>${ops.req ? rgPill(ops.pct + '% of required training valid', ops.pct === 100 ? 'ok' : 'bad') : rgPill('No required courses set', 'mute')}</p></div>` : ''}
          ${d.meter && d.meter !== 'None' ? `<div class="panel"><h3>Usage</h3><p>${rgEsc((+d.reading || 0).toLocaleString('en-GB'))} ${d.meter === 'Hours' ? 'h' : 'km'} now${d.interval ? ` · service every ${rgEsc(d.interval)}` : ''}</p>${nm ? `<p>Next service ${rgExpPill(nm, 14)}</p>` : ''}</div>` : nm ? `<div class="panel"><h3>Maintenance</h3><p>Next service ${rgExpPill(nm, 14)}</p></div>` : ''}
          ${tr.length ? `<div class="panel"><h3>Project history</h3><ol class="rg-hist">${tr.slice().reverse().map(t => `<li><b>${rgEsc(projName(t.from))} → ${rgEsc(projName(t.to))}</b><small>${rgDate(t.date)} · ${rgEsc(t.by)}${t.cond ? ' · ' + rgEsc(t.cond) : ''}</small></li>`).join('')}</ol></div>` : ''}
        </div>`; },
      related: [{ kind: 'ei', l: 'Inspections', addLabel: 'Record inspection', match: (x, r) => x.data.eq === r.id, pre: r => ({ eq: r.id }) }, { kind: 'em', l: 'Maintenance', addLabel: 'Record maintenance', match: (x, r) => x.data.eq === r.id, pre: r => ({ eq: r.id, reading: r.data.reading }) }],
      actions: [
        { l: 'Submit for approval', show: d => !d.approval || d.approval === 'Draft' || d.approval === 'Returned', run: async r => { await rgSave('eq', r.project, { ...r.data, approval: 'Submitted' }, r, 'Submitted for approval'); toast('Sent for review'); } },
        { l: 'Approve for use', perm: 'review', show: d => d.approval === 'Submitted', run: async r => { const s = rgDocSummary(REG.ents.eq, r.data); const unver = Object.values(s.latest).filter(x => x.status !== 'Verified'); if (s.missing.length || s.expired || unver.length) { toast('Cannot approve: ' + [s.missing.length && 'missing ' + s.missing.join(', '), s.expired && s.expired + ' expired', unver.length && unver.length + ' not verified'].filter(Boolean).join(' · ')); return; } await rgSave('eq', r.project, { ...r.data, approval: 'Approved', approvedBy: L.me && L.me.name, approvedAt: Date.now() }, r, 'Approved for use'); toast('Approved for use'); } },
        { l: 'Return for correction', perm: 'review', tone: 'danger', show: d => d.approval === 'Submitted', run: async r => { const why = prompt('What needs correcting?'); if (!why) return; await rgSave('eq', r.project, { ...r.data, approval: 'Returned' }, r, 'Returned for correction: ' + why); } },
        { l: 'Return to service', perm: 'review', show: d => d.hold, run: async r => { const ev = await eqEvidence('Return to service', 'Attach evidence that the defect is corrected. You are approving this machine for use again.'); if (!ev) return; const up = await rgUpload(r.project, ev.f); await rgSave('eq', r.project, { ...r.data, hold: false, opStatus: 'Operating', files: [...(r.data.files || []), ...up] }, r, 'Returned to service: ' + ev.t); toast('Returned to service'); } },
        { l: 'Transfer project', perm: 'edit', show: d => d.opStatus !== 'Demobilised', run: async r => { const t = await eqProjectPick(r.project); if (!t) return; const who = (L.me && L.me.name) || ''; await rgSave('eq', t.to, { ...r.data, transfers: [...(r.data.transfers || []), { from: r.project, to: t.to, date: t.date, by: who, cond: t.cond }] }, r, `Transferred ${projName(r.project)} → ${projName(t.to)}`); toast('Transferred. Same ID and QR.'); } },
        { l: 'Print profile', run: async r => { await rgQrLib().catch(() => {}); eqPrint(r); } }],
      alerts: (d, r) => { if (d.opStatus === 'Demobilised') return []; const A = rgDocAlerts(REG.ents.eq, d), ni = eqNextInsp(r), nm = eqNextMaint(r);
        if (d.hold) A.push({ sev: 'critical', title: `${d.name} on hold: ${d.holdReason || 'failed inspection'}` });
        if (ni && rgDays(ni) < 0) A.push({ sev: 'high', title: `Inspection overdue ${-rgDays(ni)} d` }); else if (ni && rgDays(ni) <= 7) A.push({ sev: 'medium', title: `Inspection due in ${rgDays(ni)} d` });
        if (nm && rgDays(nm) < 0) A.push({ sev: 'medium', title: `Maintenance overdue ${-rgDays(nm)} d` });
        if (d.ownership === 'Rented' && d.rentEnd && rgDays(d.rentEnd) >= 0 && rgDays(d.rentEnd) <= 15) A.push({ sev: 'info', title: `Rental ends in ${rgDays(d.rentEnd)} d` });
        if (d.demobPlan && !d.demob && rgDays(d.demobPlan) >= 0 && rgDays(d.demobPlan) <= 14) A.push({ sev: 'info', title: `Planned demobilisation in ${rgDays(d.demobPlan)} d` });
        if (d.approval === 'Submitted') A.push({ sev: 'info', title: `${d.name} waiting for approval` });
        return A.map(a => ({ ...a, detail: `${d._no} ${d.name} · ${projName(r.project)}` })); },
      kpis: R => { const C = R.map(r => [r, eqCompliance(r.data, r)]), act = R.filter(r => r.data.opStatus !== 'Demobilised');
        return [{ id: 'all', l: 'Total equipment', v: act.length, tone: 'info', test: r => r.data.opStatus !== 'Demobilised' }, { id: 'op', l: 'Operating', v: act.filter(r => r.data.opStatus === 'Operating').length, tone: 'ok', test: r => r.data.opStatus === 'Operating' },
          { id: 'ok', l: 'Compliant', v: C.filter(x => x[1].k === 'ok').length, tone: 'ok', test: r => eqCompliance(r.data, r).k === 'ok' }, { id: 'due', l: 'Expiring soon', v: C.filter(x => x[1].k === 'due').length, tone: 'warn', test: r => eqCompliance(r.data, r).k === 'due' },
          { id: 'exp', l: 'Expired / missing docs', v: C.filter(x => x[1].k === 'expired').length, tone: 'bad', test: r => eqCompliance(r.data, r).k === 'expired' }, { id: 'hold', l: 'On hold / out of service', v: act.filter(r => r.data.hold || r.data.opStatus === 'Out of service').length, tone: 'bad', test: r => r.data.hold || r.data.opStatus === 'Out of service' },
          { id: 'pend', l: 'Pending approval', v: C.filter(x => x[1].k === 'pending').length, tone: 'info', test: r => eqCompliance(r.data, r).k === 'pending' }]; } },
    { kind: 'ei', name: 'Equipment inspection', plural: 'Inspections', prefix: 'EQI', cols: ['eq', 'type', 'date', 'result'], filters: ['type', 'result'], noImport: true,
      title: d => { const e = rgGet(d.eq); return (d.type || 'Inspection') + ' · ' + (e ? e.data._no : ''); }, sub: d => rgDate(d.date) + ' · ' + (d.result || ''),
      fields: [{ k: 'eq', l: 'Equipment', type: 'ref', ref: 'eq', req: true, sec: 'Inspection' }, { k: 'type', l: 'Inspection type', type: 'select', opts: ['Daily / pre-use', 'Weekly', 'Periodic', 'Third-party'], req: true }, { k: 'date', l: 'Date', type: 'date', req: true }, { k: 'inspector', l: 'Inspector', type: 'text', req: true },
        { k: 'result', l: 'Result', type: 'select', opts: ['Pass', 'Pass with remarks', 'Fail'], req: true }, { k: 'findings', l: 'Findings', type: 'textarea', req: false }, { k: 'next', l: 'Next inspection due', type: 'date' },
        { k: 'hold', l: 'Take out of service until corrected', type: 'bool', show: d => d.result === 'Fail', sec: 'If failed' }, { k: 'action', l: 'Corrective action', type: 'text', show: d => d.result !== 'Pass' }, { k: 'owner', l: 'Action owner', type: 'text', show: d => d.result !== 'Pass' }, { k: 'due', l: 'Action due', type: 'date', show: d => d.result !== 'Pass' },
        { k: 'files', l: 'Photos / report', type: 'files' }],
      defaults: () => ({ date: new Date().toISOString().slice(0, 10), result: 'Pass', hold: true, inspector: (L.me && L.me.name) || '' }),
      validate: d => d.result === 'Fail' && (!d.findings || !d.action || !d.owner) ? 'A failed inspection needs findings, a corrective action and an owner' : null,
      derive: d => { if (!d.next && d.date) { const t = new Date(d.date + 'T00:00:00'); t.setDate(t.getDate() + ({ 'Daily / pre-use': 1, Weekly: 7, Periodic: 30, 'Third-party': 365 }[d.type] || 30)); d.next = t.toISOString().slice(0, 10); } return d; },
      status: d => ({ label: d.result || '', tone: d.result === 'Fail' ? 'bad' : d.result === 'Pass' ? 'ok' : 'warn' }),
      afterSave: async (x, wasEdit) => { if (wasEdit) return; const e = rgGet(x.data.eq); if (!e) return;
        if (x.data.result !== 'Pass' && x.data.action) await rgAction(e.project, `${e.data._no} ${e.data.name}: ${x.data.action}`, x.data.owner, x.data.due ? Math.max(1, rgDays(x.data.due)) : 3, x.data.result === 'Fail' ? 'High' : 'Normal', 'Equipment inspection');
        if (x.data.result === 'Fail' && x.data.hold) await rgSave('eq', e.project, { ...e.data, hold: true, holdAt: Date.now(), holdReason: x.data.findings, opStatus: 'Out of service' }, e, 'Put on hold after failed inspection ' + x.data._no);
        if (x.data.colour) {} } },
    { kind: 'em', name: 'Maintenance', plural: 'Maintenance', prefix: 'EQM', cols: ['eq', 'type', 'date', 'next'], filters: ['type'], noImport: true,
      title: d => { const e = rgGet(d.eq); return (d.type || 'Maintenance') + ' · ' + (e ? e.data._no : ''); }, sub: d => rgDate(d.date),
      fields: [{ k: 'eq', l: 'Equipment', type: 'ref', ref: 'eq', req: true }, { k: 'type', l: 'Type', type: 'select', opts: ['Planned service', 'Breakdown repair', 'Overhaul'], req: true }, { k: 'date', l: 'Date done', type: 'date', req: true }, { k: 'reading', l: 'Reading at service', type: 'num' },
        { k: 'by', l: 'Done by', type: 'text' }, { k: 'work', l: 'Work done', type: 'textarea' }, { k: 'next', l: 'Next service due', type: 'date' }, { k: 'files', l: 'Job card / invoice', type: 'files' }],
      defaults: () => ({ date: new Date().toISOString().slice(0, 10), type: 'Planned service' }),
      status: d => d.next ? (e => e.k === 'expired' ? { label: 'Next overdue', tone: 'bad' } : e.k === 'due' ? { label: 'Next due ' + rgDate(d.next), tone: 'warn' } : { label: 'Done', tone: 'ok' })(rgExpiry(d.next, 14)) : { label: 'Done', tone: 'ok' },
      afterSave: async (x, wasEdit) => { const e = rgGet(x.data.eq); if (!e || wasEdit || !x.data.reading) return; if (+x.data.reading > (+e.data.reading || 0)) await rgSave('eq', e.project, { ...e.data, reading: +x.data.reading }, e, 'Meter updated to ' + x.data.reading); } }],
  tabs: [['dash', 'Dashboard', () => eqDash()], ['reg', 'Register', () => rgList(REG.ents.eq)], ['docs', 'Documents & expiry', () => eqDocsTab()], ['insp', 'Inspections', () => rgList(REG.ents.ei)], ['maint', 'Maintenance', () => rgList(REG.ents.em)], ['set', 'Settings', () => eqSettings()]] });

function eqDocsTab() {
  const rows = []; rgMine('eq').filter(r => r.data.opStatus !== 'Demobilised').forEach(r => { const s = rgDocSummary(REG.ents.eq, r.data); Object.values(s.latest).forEach(x => rows.push({ r, x, st: rgDocState(x, 30) })); s.missing.forEach(t => rows.push({ r, x: { type: t }, st: { label: 'Missing', tone: 'bad', k: 'missing' } })); });
  const order = { expired: 0, missing: 1, rejected: 2, due: 3, pending: 4, noexp: 5, ok: 6 }; rows.sort((a, b) => (order[a.st.k] ?? 9) - (order[b.st.k] ?? 9) || ((a.x.expiry || 'z') > (b.x.expiry || 'z') ? 1 : -1));
  const n = k => rows.filter(x => x.st.k === k).length;
  return `<div class="rg-kpis">${rgKpi('Expired', n('expired'), 'bad')}${rgKpi('Missing', n('missing'), 'bad')}${rgKpi('Expiring in 30 days', n('due'), 'warn')}${rgKpi('Waiting for review', n('pending') + n('noexp'), 'info')}${rgKpi('Valid', n('ok'), 'ok')}</div>
   <div class="panel"><h2>Documents and expiry tracking</h2><div class="rg-tw"><table class="rg-t"><thead><tr><th>Equipment</th><th>Project</th><th>Document</th><th>Expiry</th><th>Status</th></tr></thead><tbody>${rows.slice(0, 400).map(({ r, x, st: s }) => `<tr data-rg-open="${rgEsc(r.id)}" tabindex="0"><td><span class="rg-id">${rgEsc(r.data._no)}</span> ${rgEsc(r.data.name)}</td><td>${rgEsc(projName(r.project))}</td><td>${rgEsc(x.type)}</td><td>${x.noExpiry ? 'No expiry' : x.expiry ? rgDate(x.expiry) : '—'}</td><td>${rgPill(s.label, s.tone)}</td></tr>`).join('') || '<tr><td colspan="5" class="rg-empty">No equipment documents yet.</td></tr>'}</tbody></table></div></div>`;
}
function eqDash() {
  const R = rgMine('eq'), act = R.filter(r => r.data.opStatus !== 'Demobilised'), e = REG.ents.eq, kp = e.kpis(R);
  const due = []; act.forEach(r => { const ni = eqNextInsp(r), nm = eqNextMaint(r); if (ni && rgDays(ni) <= 14) due.push([r, 'Inspection', ni]); if (nm && rgDays(nm) <= 14) due.push([r, 'Maintenance', nm]); if (r.data.ownership === 'Rented' && r.data.rentEnd && rgDays(r.data.rentEnd) <= 30 && rgDays(r.data.rentEnd) >= -1) due.push([r, 'Rental end', r.data.rentEnd]); if (r.data.demobPlan && !r.data.demob && rgDays(r.data.demobPlan) <= 30) due.push([r, 'Planned demobilisation', r.data.demobPlan]); });
  due.sort((a, b) => (a[2] > b[2] ? 1 : -1));
  const acts = (L.actions || []).filter(a => /Equipment inspection/.test(a.source || '') && !a.closedAt), od = acts.filter(a => a.due && a.due < Date.now());
  const opC = { Operating: '#1f9d63', Idle: '#8a96a8', 'Under maintenance': '#e0a106', 'Out of service': '#d23b3f', Demobilised: '#4b5563' };
  return `<div class="rg-kpis">${kp.map(k => rgKpi(k.l, k.v, k.tone, 'eq|' + k.id)).join('').replace(/data-rg-kf="eq\|(\w+)"/g, 'data-rg-kf="eq|$1" data-rg-go="m-equipment|reg"')}${rgKpi('Open corrective actions', acts.length, acts.length ? 'warn' : 'ok')}${rgKpi('Overdue actions', od.length, od.length ? 'bad' : 'ok')}</div>
   <div class="rg-dash">
    ${rgCard('Operational status', act.length ? cdDonut(EQ_OP.filter(o => o !== 'Demobilised').map(o => ({ l: o, v: act.filter(r => r.data.opStatus === o).length, c: opC[o] }))) : '<p class="cd-none">No equipment yet</p>')}
    ${rgCard('Compliance', act.length ? cdDonut([['Compliant', 'ok', '#1f9d63'], ['Expiring soon', 'due', '#e0a106'], ['Expired / missing', 'expired', '#d23b3f'], ['Pending verification', 'pending', '#2f73c9'], ['Suspended', 'suspended', '#7f1d1d']].map(([l, k, c]) => ({ l, v: act.filter(r => eqCompliance(r.data, r).k === k).length, c }))) : '<p class="cd-none">No equipment yet</p>')}
    ${rgCard('By project', rgBarsFrom(rgCount(act, r => projName(r.project)), '#2f73c9'))}
    ${rgCard('By category', rgBarsFrom(rgCount(act, r => r.data.cat), '#7aa9ff'))}
    ${rgCard('By contractor', rgBarsFrom(rgCount(act, r => r.data.contractor || 'Own'), '#9b7bff'))}
    ${rgCard('Owned vs rented', act.length ? cdDonut([{ l: 'Owned', v: act.filter(r => r.data.ownership !== 'Rented').length, c: '#2f73c9' }, { l: 'Rented', v: act.filter(r => r.data.ownership === 'Rented').length, c: '#e0a106' }]) : '<p class="cd-none">—</p>')}
    ${rgCard('Coming up in the next 14–30 days', due.length ? `<div class="rg-tw"><table class="rg-t"><tbody>${due.slice(0, 14).map(([r, what, dt]) => `<tr data-rg-open="${rgEsc(r.id)}" tabindex="0"><td><span class="rg-id">${rgEsc(r.data._no)}</span> ${rgEsc(r.data.name)}</td><td>${rgEsc(what)}</td><td>${rgExpPill(dt, 14)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="cd-none">Nothing due</p>', 'cd-wide')}
   </div>`;
}
function eqSettings() {
  if (myRole() !== 'admin') return '<div class="panel"><p class="mx-muted">Settings are managed by the System admin.</p></div>';
  const c = eqCfg();
  return `<div class="panel"><h2>Required documents by category</h2><p class="mx-muted">Add document types your company requires, per category. One per line. These add to the NASS Safe Link defaults.</p>
   <div class="rg-grid">${EQ_CAT.map(cat => `<div class="fld"><label>${rgEsc(cat)}</label><small class="mx-muted">Defaults: ${rgEsc((EQ_REQ[cat] || []).join(', '))}</small><textarea class="mx-in" rows="3" data-eqset="${rgEsc(cat)}">${rgEsc(((c.extraReq || {})[cat] || []).join('\n'))}</textarea></div>`).join('')}</div>
   <div class="filters" style="margin-top:12px"><button class="btn pri" data-eqset-save>Save</button></div></div>`;
}
document.addEventListener('click', e => { if (!e.target.closest('[data-eqset-save]')) return; const extraReq = {}; document.querySelectorAll('[data-eqset]').forEach(t => { const v = t.value.split('\n').map(x => x.trim()).filter(Boolean); if (v.length) extraReq[t.dataset.eqset] = v; }); const s = { ...(L.structure || {}), equipment: { ...eqCfg(), extraReq, extraDocs: extraReq } }; liveSave(() => L.db.doc('admin/structure').set(s), 'Saved').then(ok => { if (ok !== false) { L.structure = s; render(); } }); });
