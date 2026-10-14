const assert=require('node:assert/strict');const S=require('../public/client-assurance-core.js');
assert.equal(new Set(S.forms.map(f=>f.id)).size,S.forms.length);
const construction=S.profile('construction:base-observation'),operations=S.profile('operations:base-observation');
assert(construction.fields.some(f=>f.key==='epcContractor'));assert(!construction.fields.some(f=>f.key==='assetUnit'));assert(operations.fields.some(f=>f.key==='assetUnit'));assert(!operations.fields.some(f=>f.key==='workStage'));
assert(!S.profile('construction:monthly-operations'));assert(!S.profile('operations:monthly-construction'));
assert(S.profile('construction:monthly-construction').fields.filter(f=>f.key.startsWith('indicator')).length===45);
assert(S.profile('operations:monthly-operations').fields.filter(f=>f.key.startsWith('indicator')).length===34);
assert(S.validate({case_type:'Observation',body:{formId:construction.id}}).includes('EPC / principal contractor'));
assert.equal(S.highPotential({body:{aiRiskDraft:{pfpi:true}}}).flag,null);
assert.equal(S.highPotential({body:{highPotential:'Yes',highPotentialReason:'Credible fatality'}}).flag,true);
const rows=[{id:'a',project:'p',case_type:'Observation',status:'Registered',body:{highPotential:'Yes',highPotentialReason:'Credible fatality'}},{id:'b',project:'p',case_type:'Observation',status:'Draft',body:{highPotential:'Yes',highPotentialReason:'Credible fatality'}},{id:'c',project:'p',case_type:'Observation',status:'Registered',body:{}}];
const h=S.hipoGroups(rows,[{id:'p',country:'KSA'}]);assert.equal(h.total,1);assert.equal(h.unassessed,1);assert.equal(h.groups[0].percent,100);assert.deepEqual(h.groups[0].ids,['a']);assert(S.csv([['=1+1','normal']]).includes("'=1+1"));
console.log('PASS: distinct sector profiles, actual monthly indicator counts, mandatory context, HIPO denominator and CSV safety');

const programs=[{id:'walk',type:'Leadership walkthrough',label:'HSSE Leadership Walkthrough'},{id:'near',type:'Proactive event reporting - Near miss',label:'Proactive event reporting – Near miss'}];
const counts=S.programEvidence([{id:'a',type:'HSSE Leadership Walkthrough',count:2},{id:'a',type:'Leadership walkthrough',count:2},{id:'b',type:'Proactive event reporting-Near miss',count:1}],programs);assert.deepEqual(counts.map(p=>p.count),[2,1]);assert.deepEqual(counts[0].ids,['a']);console.log('PASS: leadership aliases, punctuation, counts and source-ID deduplication');
