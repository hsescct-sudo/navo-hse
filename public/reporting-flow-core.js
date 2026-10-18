(function(root){
 const groups=[
  {id:'capture',name:'1. Report details',hint:'Describe what happened, where and who was involved.',sections:['Where and What','Form details','General classifications','Involved persons']},
  {id:'assess',name:'2. Risk & evidence',hint:'Assess potential harm and record the supporting evidence.',sections:['Risk assessment & prevention','Consequences','Loss potential','Check list','Attachments']},
  {id:'investigate',name:'3. Investigation',hint:'Review the controls, causes and related cases.',sections:['Causes','Root cause analysis','Connected cases']},
  {id:'followup',name:'4. Actions & review',hint:'Assign follow-up, check completeness and register the report.',sections:['Actions','Processing','Comments','Signatures','Review & submit']}
 ];
 const label={'Where and What':'What happened & where','Form details':'Activity-specific details','Risk assessment & prevention':'Assess risk & controls','General classifications':'Classify the event','Consequences':'Actual consequences','Involved persons':'People involved','Loss potential':'Potential consequences','Causes':'Initial cause findings','Root cause analysis':'System investigation & RCA','Check list':'Inspection checklist','Actions':'Action plan','Attachments':'Photos & evidence','Comments':'Review comments','Signatures':'Review signatures','Connected cases':'Related cases','Processing':'Responsibility & deadline','Review & submit':'Review & register'};
 function checklistStats(checks=[]){const questions=checks.flatMap(c=>c.questions||[]),answered=questions.filter(q=>q.evaluation&&q.evaluation!=='').length,atRisk=questions.filter(q=>q.evaluation==='At risk'),safe=questions.filter(q=>q.evaluation==='Safe').length;return {total:questions.length,answered,remaining:questions.length-answered,safe,atRisk:atRisk.length,unlinked:atRisk.filter(q=>!q.actionId).length,critical:atRisk.filter(q=>q.critical).length};}
 function applicable(checklist,project){return checklist.active!==false&&(!checklist.platforms?.length||checklist.platforms.includes(project?.platform||'Construction'))&&(!checklist.divisions?.length||checklist.divisions.includes(project?.division));}
 root.NavoReportingFlow={groups,label,checklistStats,applicable};if(typeof module!=='undefined')module.exports=root.NavoReportingFlow;
})(typeof window==='undefined'?globalThis:window);
