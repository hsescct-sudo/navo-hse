/* Pure case rules shared by the browser and regression checks. */
(function(root){
  'use strict';
  const types=['Observation','Accident','Near miss','Inspection','Audit','Audit finding','Meeting'];
  const actionTypes=['Immediate','Corrective','Preventative','Coordination','Administrative','Notification to SAP'];
  const lossTypes=['Personal injury','Spill','Gas leak','Fire/Explosion','Asset damage'];
  const severity=['Not selected','Class D – First aid / minor loss','Class C – MTC / RWC / moderate loss','Class B – LTI / major loss','Class A – Fatality / permanent impairment / severe loss'];
  function lossLabel(type,value){
    if(!value)return 'Not selected';
    if(type==='Personal injury')return ['Not selected','Class D – First Aid','Class C – Medical Treatment Case (MTC) or Restricted Work Case (RWC)','Class B – Lost Time Injury (LTI)','Class A – Fatality / Permanent Impairment (FPI)'][value];
    if(type==='Spill')return ['Not selected','Class D – Loss < $5,000','Class C – Loss $5,000–25,000','Class B – Loss $25,000–50,000','Class A – Reportable spill / loss > $50,000'][value];
    return ['Not selected','Class D – Minor','Class C – Moderate','Class B – Major','Class A – Severe'][value];
  }
  const colors={'Overdue':'#E00000','Due today':'#EE8A00','Due this week':'#F6D09E','Due next week':'#FFCC00','Not due':'#4FB7E6','No deadline':'#9AD8F0','Closed within due date':'#3A8530','Closed after due date':'#B8E2A8','Closed (no deadline)':'#B8E2A8'};
  function day(value=Date.now()){
    return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
  }
  function dueStatus(due,closed,now=Date.now()){
    if(closed)return !due?'Closed (no deadline)':day(closed)<=due?'Closed within due date':'Closed after due date';
    if(!due)return 'No deadline';
    const today=day(now);if(due<today)return 'Overdue';if(due===today)return 'Due today';
    const date=new Date(today+'T00:00:00Z');const offset=(date.getUTCDay()+6)%7;
    const nextMonday=new Date(date.getTime()+(7-offset)*864e5).toISOString().slice(0,10);
    const afterNext=new Date(date.getTime()+(14-offset)*864e5).toISOString().slice(0,10);
    return due<nextMonday?'Due this week':due<afterNext?'Due next week':'Not due';
  }
  function sections(type){return ['Where and What','Risk assessment & prevention',...(type==='Accident'?['General classifications','Consequences','Involved persons','Loss potential','Causes']:type==='Observation'||type==='Near miss'?['Loss potential']:type==='Inspection'?['Involved persons','Check list']:['Involved persons']), 'Actions','Attachments','Comments','Signatures','Connected cases','Processing'];}
  function validate(row){
    const b=row.body||{},errors=[];
    const required={title:row.title,description:b.description,date:b.date,location:b.location,responsibleDepartment:b.responsibleDepartment,reportedDepartment:b.reportedDepartment,departmentInCharge:b.departmentInCharge,due:b.due};
    for(const [key,value]of Object.entries(required))if(!String(value||'').trim())errors.push(key);
    if(['Observation','Accident','Near miss'].includes(row.case_type)&&!b.category)errors.push('category');
    if(row.case_type==='Accident'&&!b.technology)errors.push('technology');
    if(['Inspection','Audit','Meeting'].includes(row.case_type)&&!b.endDate)errors.push('endDate');
    if(b.endDate&&b.date&&b.endDate<b.date)errors.push('endDate must follow start date');
    if(row.case_type==='Inspection'){
      if(!b.checklists?.length)errors.push('checklists');
      (b.checklists||[]).forEach(c=>(c.questions||[]).forEach(q=>{if(!q.evaluation)errors.push('checklist evaluation');}));
    }
    (b.actions||[]).forEach(a=>{if(!a.title?.trim()||!a.owner||!a.department||!a.due||!actionTypes.includes(a.type))errors.push('action details');});
    [...(b.potential||[]),...(b.actual||[])].forEach(l=>{if(!l.severity)errors.push('loss severity');});
    return [...new Set(errors)];
  }
  function filter(rows,f={}){
    const q=(f.q||'').toLowerCase().trim();return rows.filter(r=>r.status!=='Draft'&&(!q||[r.case_no,r.title,r.body?.description].join(' ').toLowerCase().includes(q))&&(!f.type||r.case_type===f.type)&&(!f.status||r.status===f.status)&&(!f.project||r.project===f.project)&&(!f.from||(r.body?.date||'')>=f.from)&&(!f.to||(r.body?.date||'').slice(0,10)<=f.to)&&(!f.person||r.body?.personInCharge===f.person)&&(!f.department||r.body?.departmentInCharge===f.department));
  }
  root.NavoCasesCore={types,actionTypes,lossTypes,severity,lossLabel,colors,day,dueStatus,sections,validate,filter};
  if(typeof module!=='undefined')module.exports=root.NavoCasesCore;
})(typeof window==='undefined'?globalThis:window);
