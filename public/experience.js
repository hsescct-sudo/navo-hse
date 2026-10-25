/* One navigation and one record register for the operational platform. */
'use strict';
const NX={page:1,size:30,quick:''};
const NX_GROUPS=[
 ['overview','Overview','exec','dash',[['exec','Executive dashboard'],['sc','Project performance']]],
 ['records','Records','casehome','insp',[['casehome','All records']]],
 ['actions','Actions','lactions','capa',[['lactions','Action management']]],
 ['assurance','Assurance','inspm','obs',[['inspm','Inspections'],['incm','Investigations'],['walk','Walkthroughs'],['train','Training']]],
 ['leadership','Leadership','leaders','leaders',[['leaders','Engagement'],['activity','Activities']]],
 ['admin','Administration','hdata','settings',[['hdata','Performance data'],['entry','Monthly review'],['chk','Checklists'],['flows','Workflows'],['access','Projects & people'],['settings','Settings']]]
];
Object.assign(TITLES,{exec:'Executive overview',casehome:'Records',casesearch:'Records',caseedit:'Record details'});
const nxGroup=()=>NX_GROUPS.find(g=>g[4].some(t=>t[0]===st.view))||NX_GROUPS.find(g=>g[0]===(['casesearch','caseedit','live','report','home'].includes(st.view)?'records':'overview'));
function nxNav(){
 const current=nxGroup(),worker=myRole()==='worker',groups=worker?NX_GROUPS.filter(g=>['records','actions'].includes(g[0])):NX_GROUPS;
 document.getElementById('sidenav').innerHTML=groups.map(([id,label,route,icon])=>`<button data-go="${route}" aria-current="${current[0]===id}">${svg(icon)}<span>${label}</span></button>`).join('');
 document.getElementById('tabbar').innerHTML='';
 let sub=document.getElementById('nx-subnav');if(!sub){sub=document.createElement('nav');sub.id='nx-subnav';sub.setAttribute('aria-label','Section navigation');document.querySelector('.top').after(sub);}
 sub.innerHTML=current[4].length>1?current[4].map(([route,label])=>`<button data-go="${route}" aria-current="${st.view===route}">${label}</button>`).join(''):'';
}
nav=nxNav;
const nxOriginalRender=render;
render=function(){nxOriginalRender();document.body.classList.remove('hs-full');document.body.classList.add('nx-app');document.body.classList.toggle('nx-executive',st.view==='exec');document.getElementById('crumb').textContent=nxGroup()[1]+' / '+(st.country||'All countries');const exports=document.querySelector('#view .xexp');if(exports){const disclosure=document.createElement('details');disclosure.className='nx-exports';const summary=document.createElement('summary');summary.textContent='Executive summary exports';disclosure.append(summary);exports.before(disclosure);disclosure.append(exports);}};

function nxHero(eyebrow,title,description,graphic,action='',className=''){
 return `<div class="nx-hero ${className}"><div><span class="nx-eyebrow">${esc(eyebrow)}</span><h2>${esc(title)}</h2><p>${esc(description)}</p>${action}</div><div class="nx-hero-art" aria-hidden="true">${graphic}</div></div>`;
}
const nxShield=`<svg viewBox="0 0 280 180" fill="none"><circle cx="158" cy="88" r="66" stroke="#ffffff12"/><circle cx="158" cy="88" r="83" stroke="#ffffff12"/><path d="M158 36l43 17v39c0 24-21 43-43 55-23-12-43-31-43-55V53z" fill="#13c9b522" stroke="#56dfca" stroke-width="2"/><path d="M137 89l15 15 30-33" stroke="#7ef0da" stroke-width="5" stroke-linecap="round"/><path d="M20 132h42l17-34 19 14h25M204 66h30l15-19h21" stroke="#46bbd1" stroke-width="2"/><circle cx="79" cy="98" r="4" fill="#70e8d0"/><circle cx="249" cy="47" r="4" fill="#70e8d0"/></svg>`;
const nxRecordsArt=`<svg viewBox="0 0 280 180" fill="none"><rect x="85" y="24" width="132" height="137" rx="16" fill="#fff" fill-opacity=".06" stroke="#ffffff30"/><rect x="62" y="41" width="132" height="137" rx="16" fill="#152f48" stroke="#57cbbc"/><path d="M87 75h81M87 95h55M87 134h36" stroke="#92c8d0" stroke-width="5" stroke-linecap="round"/><circle cx="175" cy="132" r="23" fill="#1da691"/><path d="M165 132l7 7 14-16" stroke="white" stroke-width="3" stroke-linecap="round"/><circle cx="233" cy="65" r="6" fill="#63e4d0"/><path d="M217 65h10M38 108h24" stroke="#63e4d0"/></svg>`;

function nxLoading(){const state=L.dataLoads;if(!state)return '';const pending=Object.values(state).some(s=>s==='loading'),failed=Object.values(state).some(s=>s==='error');if(pending)return '<div class="nx-loading" role="status"><div class="nx-spinner"></div><h3>Loading your records</h3><p>Collecting reports, inspections, actions and exposure hours before calculating performance.</p></div>';if(failed)nxRetry();return '';}
/* A failed page of records never blocks the dashboards: show what loaded and quietly retry the missing streams. */
let nxRetryAt=0,nxRetries=0;function nxRetry(){const now=Date.now();if(now-nxRetryAt<8000||nxRetries>=4)return;nxRetryAt=now;nxRetries++;setTimeout(()=>{try{L.subKey=null;resub()}catch(e){}},1500)}
const nxOriginalHsse=hsse;
hsse=function(){
 const loading=nxLoading();if(loading)return loading;const result=nxOriginalHsse();if(!result.includes('class="hs"'))return result;
 const h=hsInit(),sec=HSEC.find(s=>s[0]===h.sec)||HSEC[0];
 const clean=result.replace(/<nav class="hs-nav">[\s\S]*?<\/nav>/,'').replace(/<aside class="hs-strip">[\s\S]*?<\/aside>/,'');
 const tabs=`<div class="nx-dashboard-tabs" role="navigation" aria-label="Dashboard views">${HSEC.filter(s=>['exe','health','site'].includes(s[0])).map(s=>`<button data-hsec="${s[0]}" aria-current="${s[0]===sec[0]}">${s[1]}</button>`).join('')}<button data-go="sc">Project performance</button><select data-nx-dashboard aria-label="More dashboard views"><option value="">More dashboards</option>${HSEC.filter(s=>!['exe','health','site'].includes(s[0])).map(s=>`<option value="${s[0]}" ${s[0]===sec[0]?'selected':''}>${s[1]}</option>`).join('')}</select></div>`;
 return nxHero('NASS Safe Link / EXECUTIVE INTELLIGENCE','Protect people. Strengthen performance.','One view of safety, risk and action across your projects and facilities.',nxShield,`<div class="nx-hero-actions"><button class="nx-primary" data-go="casehome">View records ${svg('live',16)}</button><button class="nx-ghost" data-hfilt>Filter dashboard</button></div>`,'nx-executive-hero')+tabs+(hsIsSample()?'<div class="nx-data-note"><span>Illustrative dataset</span>Sample project records are included in this view.</div>':'')+clean;
};

const nxBaseAll=cxAll;
function nxLegacy(source,r,type,title,body={}){
 const timestamp=r.ts||r.date||Date.now(),closed=!!r.closedAt||r.status==='Closed'||r.data?.status==='Closed';
 return {id:r.id,legacy:source,project:r.project,case_no:r.caseNo||r.case_no,case_type:type,title:title||type,created_by:r.by,created_at:new Date(timestamp).toISOString(),updated_at:new Date(timestamp).toISOString(),status:closed?'Closed':r.status||r.data?.status||'Recorded',closed_at:closed?new Date(r.closedAt||timestamp).toISOString():null,history:r.history||r.data?.history||[],body:{date:new Date(timestamp+10800000).toISOString().slice(0,16),description:title||type,location:projName(r.project),due:r.due?CXC.day(r.due):'',personInCharge:r.owner,...body}};
}
cxAll=function(){
 const signature=[CX.rows,L.reports,L.inspAll,L.inspections,L.actions,L.activities,L.records,L.reviews,L.projects,L.members,st.country,L.me?.id,L.owner,myRole(),L.records?.length,L.reports.length,L.actions.length,L.activities.length,CX.rows.map(r=>r.revision).join(',')];if(NX.recordCache?.signature.every((value,i)=>value===signature[i]))return NX.recordCache.rows;const reportsById=new Map(L.reports.map(r=>[r.id,r])),inspectionsById=new Map((L.inspAll||L.inspections).map(r=>[r.id,r]));
 const rows=nxBaseAll(),seen=new Set(rows.map(r=>r.id)),ids=myIds();
 for(const row of rows){if(row.legacy==='inspection'){const source=inspectionsById.get(row.id),answers=RCC.inspectionAnswers(source||{});row.body.checklists=answers.length?[{name:source.tpl||'Inspection checklist',questions:answers.map(q=>({text:q.q,critical:q.c,evaluation:EV[q.v]||q.v,comment:q.n||q.note}))}]:[];}if(row.legacy==='report'){const source=reportsById.get(row.id);row.history=source.history||[];row.body={...row.body,ai:source.ai,likelihood:source.riskAssessment?.likelihood,riskSeverity:source.riskAssessment?.severity,residualLikelihood:source.riskAssessment?.residualLikelihood,residualSeverity:source.riskAssessment?.residualSeverity};}}

 const extra=[...L.actions.map(r=>nxLegacy('action',r,'Action',r.title,{sourceId:r.sourceId||r.report,departmentInCharge:r.owner,description:r.title+(r.evidence?'\nCompletion evidence: '+r.evidence:'')})),
 ...L.activities.map(r=>nxLegacy('activity',r,'Leadership activity',leadershipActivityLabel(r.type),{description:leadershipActivityLabel(r.type)+' · '+(+r.count||1)+' engagements'})),
 ...Object.entries(L.reviews||{}).map(([id,r])=>{const match=id.match(/^(.*)_([0-9]{4}-[0-9]{2})$/);return nxLegacy('review',{...r,id:'review:'+id,reviewId:id,project:match?.[1]||''},'Management review','Monthly review · '+(match?.[2]||id),{recordKind:'review',reviewId:id});}),
 ...(L.records||[]).map(r=>{const names={walk:'Walkthrough',walkthrough:'Walkthrough',finding:'Audit finding',training:'Training',monthly:'Performance data',audit:'Audit',grievance:'Grievance',accommodation:'Accommodation visit',meeting:'Meeting',audit_finding:'Audit finding'};return nxLegacy('record',r,names[r.kind]||r.kind,r.data?.title||r.data?.course||r.data?.topic||r.data?.month||names[r.kind]||r.kind,{recordKind:r.kind,description:r.data?.description||r.data?.notes||r.data?.title||r.data?.course||r.data?.topic||r.kind});})];
 for(const r of extra)if(ids.has(r.project)&&!seen.has(r.id)){rows.push(r);seen.add(r.id);}
 NX.recordCache={signature,rows};return rows;
};
function nxRecordTypes(){return [...new Set([...CXC.types,...cxAll().map(r=>r.case_type)])];}
cxTop=function(){if(['casehome','casesearch'].includes(st.view))return '';return `<div class="cx-top"><div><span class="nx-eyebrow">CONNECTED RECORDS</span><strong>One record. One reference.</strong></div><div class="cx-actions"><button data-cx="catalog">${svg('entry',16)} New record</button><button data-cx="home">All records</button></div></div>`;};
function nxOption(key,values,caption){return `<label class="nx-filter">${caption}<select data-cx-search="${key}" aria-label="${caption}"><option value="">All ${caption.toLowerCase()}</option>${values.map(v=>`<option value="${esc(Array.isArray(v)?v[0]:v)}" ${CX.filter[key]===(Array.isArray(v)?v[0]:v)?'selected':''}>${esc(Array.isArray(v)?v[1]:v)}</option>`).join('')}</select></label>`;}
function nxFiltered(){let rows=CXC.filter(cxAll(),{...CX.filter,includeDraft:true});if(NX.quick==='open')rows=rows.filter(r=>!r.closed_at&&!['Draft','Recorded'].includes(r.status));if(NX.quick==='overdue')rows=rows.filter(r=>!r.closed_at&&r.body.due&&r.body.due<CXC.day());if(NX.quick==='drafts')rows=rows.filter(r=>r.status==='Draft');rows.sort((a,b)=>CX.filter.sort==='oldest'?a.created_at.localeCompare(b.created_at):CX.filter.sort==='title'?a.title.localeCompare(b.title):b.created_at.localeCompare(a.created_at));return rows;}
function nxTable(rows){return `<div class="cx-table"><table><thead><tr><th>Reference</th><th>Record / project</th><th>Type</th><th>Status</th><th>Target date</th><th>Linked actions</th></tr></thead><tbody>${rows.map(r=>{const linked=L.actions.filter(a=>a.sourceId===r.id||a.report===r.id),open=linked.filter(a=>!a.closedAt).length;return `<tr><td><button class="cx-link nx-reference" data-cx-open="${esc(r.id)}">#${esc(r.case_no||'Pending')}</button></td><td><button class="cx-link nx-record-title" data-cx-open="${esc(r.id)}">${esc(r.title||'Untitled '+r.case_type)}</button><small>${esc(projName(r.project))} · ${cxDate(r.created_at)}</small></td><td><span class="nx-type">${esc(r.case_type)}</span></td><td><span class="cx-pill ${r.status==='Closed'?'nx-closed':''}">${esc(r.status)}</span></td><td>${r.body.due?esc(r.body.due):'—'}${r.body.due?'<br>'+cxPill(r):''}</td><td>${linked.length?`<button class="cx-link" data-cx-open="${r.id}">${open} open / ${linked.length} total</button>`:'—'}</td></tr>`;}).join('')||'<tr><td colspan="6"><div class="cx-empty">No records match these filters.</div></td></tr>'}</tbody></table></div>`;}
caseHome=function(){
 const gate=cxGate();if(gate)return cxShell(gate);const loading=nxLoading();if(loading)return cxShell(loading);const all=cxAll(),drafts=all.filter(r=>r.status==='Draft'),rows=nxFiltered(),pages=Math.max(1,Math.ceil(rows.length/NX.size));NX.page=Math.min(pages,NX.page);const shown=rows.slice((NX.page-1)*NX.size,NX.page*NX.size),overdue=all.filter(r=>!r.closed_at&&r.body.due&&r.body.due<CXC.day());
 return nxHero('NASS Safe Link / RECORD REGISTER','Every record, connected.','Register, find and follow up on events, inspections, actions and activities in one place.',nxRecordsArt,`<div class="nx-hero-actions"><button class="nx-primary" data-cx="catalog">${svg('entry',17)} Register a new case</button><button class="nx-ghost" data-cx="export">Export records</button></div>`)+cxShell(`<div class="nx-stats">${[['Total records',all.length,'insp',''],['Open cases',all.filter(r=>!r.closed_at&&!['Draft','Recorded'].includes(r.status)).length,'live','open'],['Overdue',overdue.length,'inc','overdue'],['My drafts',drafts.length,'entry','drafts']].map(([label,value,icon,quick])=>`<button class="nx-stat" data-nx-quick="${quick}" aria-pressed="${NX.quick===quick}"><span>${svg(icon,22)}</span><div><small>${label}</small><b>${value.toLocaleString()}</b></div></button>`).join('')}</div>
 <div class="cx-panel nx-register"><div class="nx-register-head"><div><h3>All records</h3><p class="cx-muted">A permanent reference follows each record throughout its lifecycle.</p></div><div class="cx-actions"><button class="cx-btn" data-cx="save-search">Save filters</button><button class="cx-btn" data-cx="refresh">Refresh</button></div></div>
 <div class="nx-searchbar"><input id="cx-query" aria-label="Search cases" placeholder="Search by reference, title or description…" value="${esc(CX.filter.q||'')}"><button class="cx-btn cx-primary" data-cx="run-search">Search</button><button class="cx-link" data-cx="clear-filters">Clear filters</button></div>
 <div class="nx-filterbar">${nxOption('type',nxRecordTypes(),'Type')}${nxOption('status',[...new Set(all.map(r=>r.status))],'Status')}${nxOption('project',myProjects().map(p=>[p.id,p.name]),'Project')}${nxOption('sort',[['newest','Newest first'],['oldest','Oldest first'],['title','Title']],'Sort')}<label class="nx-filter">From<input type="date" data-cx-search="from" value="${esc(CX.filter.from||'')}"></label><label class="nx-filter">To<input type="date" data-cx-search="to" value="${esc(CX.filter.to||'')}"></label></div>
 ${nxTable(shown)}<div class="nx-pagination"><span>${rows.length.toLocaleString()} records · Page ${NX.page} of ${pages}</span><div><button class="cx-btn" data-nx-page="${NX.page-1}" ${NX.page<=1?'disabled':''}>Previous</button><button class="cx-btn" data-nx-page="${NX.page+1}" ${NX.page>=pages?'disabled':''}>Next</button></div></div></div>
 ${cxSaved().length?`<div class="nx-saved"><span>Saved filters</span>${cxSaved().map((r,i)=>`<button class="cx-btn" data-cx-saved="${i}">${esc(r.name)}</button>`).join('')}</div>`:''}`);
};
caseSearch=function(){return caseHome();};
const nxOriginalActionCards=cxActionCards;
cxActionCards=function(){
 if(CX.editing)return nxOriginalActionCards();const links=L.actions.filter(a=>a.sourceId===CX.row.id||a.report===CX.row.id),saved=CX.row.body.actions||[],ids=new Set(links.map(a=>a.id));
 return links.map(a=>`<div class="cx-card"><button class="cx-link" data-nx-action="${a.id}">#${esc(a.caseNo||a.case_no||'Pending')} · ${esc(a.title)}</button><p class="cx-muted">${esc(aStatus(a))} · ${esc(a.owner||'Unassigned')} · Target ${fdt(a.due)}</p>${duePill(a.due,a.closedAt)}</div>`).join('')+saved.filter(a=>!ids.has(a.id)).map(a=>`<div class="cx-card"><b>${esc(a.title)}</b><p class="cx-muted">Saved in this record · ${esc(a.ownerName||a.owner)}</p></div>`).join('')||'<p class="cx-muted">No linked actions.</p>';
};
function nxConnections(){const r=CX.row,parentId=r.body.sourceId,parent=cxAll().find(x=>x.id===parentId),links=L.actions.filter(a=>a.sourceId===r.id||a.report===r.id),closed=links.filter(a=>a.closedAt).length;
 return `<div class="nx-chain"><div><span class="nx-eyebrow">RECORD LIFECYCLE</span><h3>From reporting to verified closure</h3></div><div class="nx-chain-steps"><span class="active">${svg('insp')}Record #${esc(r.case_no||'Pending')}</span><i>→</i><span class="${links.length?'active':''}">${svg('capa')}${links.length} linked actions</span><i>→</i><span>${svg('sc')}${closed} verified closed</span><i>→</i><button data-go="exec">${svg('dash')}Executive insight</button></div>${parent?`<p>Source: <button class="cx-link" data-cx-open="${parent.id}">#${esc(parent.case_no)} · ${esc(parent.title)}</button></p>`:''}</div>`;
}
const nxOriginalHistory=cxHistory;
cxHistory=function(){if(!CX.row.legacy)return nxOriginalHistory();return `<h3>Record history</h3>${histList(CX.row.history)}`;};
function nxSourceDetails(){if(CX.row.legacy!=='record')return '';const record=(L.records||[]).find(r=>r.id===CX.row.id),data=record?.data||{};const fields=Object.entries(data).filter(([key,value])=>!['history','negative','critical','people','answers'].includes(key)&&value!==null&&value!==''&&typeof value!=='object');return fields.length?`<div class="cx-panel"><h3>${esc(CX.row.case_type)} details</h3><div class="cx-grid">${fields.map(([key,value])=>`<div class="cx-field"><label>${esc(key.replace(/([A-Z])/g,' $1').replace(/_/g,' '))}</label><b>${esc(typeof value==='boolean'?(value?'Yes':'No'):key==='expiry'?fdt(value):value)}</b></div>`).join('')}</div></div>`:'';}
const nxOriginalRead=caseRead;
caseRead=function(){const html=nxOriginalRead();return html.replace('<div class="cx">','<div class="cx">'+nxConnections()+nxSourceDetails());};
const nxOriginalOpen=cxOpen;
cxOpen=async function(id){await nxOriginalOpen(id);};
cxCatalog=function(){
 document.getElementById('cx-catalog')?.remove();
 const descriptions={Observation:'Unsafe conditions, good practice or improvement ideas',Accident:'Injury, damage, environmental or security events','Near miss':'An event that could have caused harm',Inspection:'Facility checks, findings and critical controls',Audit:'Plan and record an assurance review','Audit finding':'A non-conformance or opportunity for improvement',Meeting:'Decisions, lessons learned and leadership commitments'};
 const overlay=document.createElement('div');overlay.id='cx-catalog';overlay.className='cx-overlay';overlay.innerHTML=`<div class="cx"><div class="cx-actions"><button class="cx-btn" data-cx="close-catalog">Close</button></div><h2>What would you like to record?</h2><p>Choose the type. Your record receives a permanent reference automatically.</p><div class="cx-catalog">${CXC.types.map(type=>`<button class="cx-tile direct" data-cx-new="${type}">${svg(type==='Inspection'?'insp':type==='Observation'?'obs':type==='Meeting'?'leaders':'inc',25)}<b>${type}</b><small>${descriptions[type]}</small></button>`).join('')}</div>${isStaff()?`<h3 class="nx-catalog-heading">Other operational records</h3><div class="nx-catalog-extra">${[['lactions','Action'],['walk','Walkthrough'],['train','Training'],['activity','Leadership activity'],['hdata','Performance data'],['entry','Management review']].map(([route,label])=>`<button class="cx-btn" data-nx-new="${route}">${label} →</button>`).join('')}</div>`:''}</div>`;document.body.append(overlay);
};
document.addEventListener('click',async e=>{
 const t=e.target.closest('[data-nx-page],[data-nx-action],[data-nx-new],[data-nx-quick]');if(!t)return;
 if(t.hasAttribute('data-nx-quick')){NX.quick=t.dataset.nxQuick;NX.page=1;CX.filter={};render();return;}
 if(t.dataset.nxNew){document.getElementById('cx-catalog')?.remove();if(CX.dirty)await cxSave();CX.editing=false;if(t.dataset.nxNew==='lactions')MX.a.creating=true;go(t.dataset.nxNew);return;}
 if(t.dataset.nxPage){NX.page=Math.max(1,+t.dataset.nxPage);render();return;}
 if(t.dataset.nxAction){if(CX.dirty)await cxSave();MX.a.sel=t.dataset.nxAction;go('lactions');}
});
document.addEventListener('change',e=>{if(e.target.matches('[data-nx-dashboard]')&&e.target.value){hsInit().sec=e.target.value;hsInit().drill=null;render();}if(e.target.matches('[data-cx-search]')){NX.page=1;NX.quick='';}},true);
document.addEventListener('click',e=>{if(e.target.closest('[data-cx="run-search"],[data-cx="clear-filters"],[data-cx-filter-type]')){NX.page=1;NX.quick='';}},true);
// Keep old routes usable while presenting one records destination.
const nxOriginalGo=go;
go=function(view){const target=view==='casesearch'?'casehome':view;if(st.view==='caseedit'&&CX.editing&&CX.dirty&&target!=='caseedit')return cxSave().then(()=>{CX.editing=false;nxOriginalGo(target);}).catch(cxFail);nxOriginalGo(target);};
render();
