const {PGlite}=require(process.env.PGLITE_PATH||'@electric-sql/pglite');
const fs=require('fs');const path=require('path');const assert=require('node:assert/strict');
(async()=>{
const db=new PGlite();await db.waitReady;
await db.exec(`create role authenticated;create role anon;create schema auth;create schema storage;
create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
create table storage.buckets(id text primary key,name text,public boolean);create table storage.objects(id uuid,name text,bucket_id text);
`);
const base='../supabase';
const releaseMigrations=fs.readdirSync(path.join(__dirname,base,'migrations')).filter(f=>f.endsWith('.sql')).sort().map(f=>'migrations/'+f);
if(process.env.CLIENT_MIGRATION_PATH)releaseMigrations.push(process.env.CLIENT_MIGRATION_PATH);
for(const file of ['schema.sql',...fs.readdirSync(path.join(__dirname,base)).filter(f=>/^00[2-9]_/.test(f)).sort(),...releaseMigrations]){
let sql=fs.readFileSync((path.isAbsolute(file)?file:path.join(__dirname,base,file)),'utf8').replace(/alter publication supabase_realtime add table[\s\S]*?;/g,'');
try{await db.exec(sql);console.log('Applied',file);}catch(e){console.error('Migration failed:',file,e.message);process.exit(1);}}
for(const file of releaseMigrations)await db.exec(fs.readFileSync(path.isAbsolute(file)?file:path.join(__dirname,base,file),'utf8'));console.log('Migrations safe to run twice');
const ids={admin:'10000000-0000-0000-0000-000000000001',hse:'10000000-0000-0000-0000-000000000002',worker:'10000000-0000-0000-0000-000000000003',other:'10000000-0000-0000-0000-000000000004'};
await db.exec(`grant select,insert,update,delete on all tables in schema public to authenticated;insert into auth.users values ${Object.values(ids).map(id=>`('${id}')`).join(',')};insert into public.projects(id,name) values ('p1','Test 1'),('p2','Test 2');insert into public.owner(user_id) values ('${ids.admin}');insert into public.members(user_id,role,projects) values ('${ids.hse}','hse','{p1}'),('${ids.worker}','worker','{p1}'),('${ids.other}','hse','{p2}');insert into public.settings(id,data) values ('structure','{"keepMe":true,"kpi":{"mult":200000}}') on conflict(id) do update set data=excluded.data;insert into public.people(user_id,name) select id,'Test user' from auth.users;set role authenticated;`);
const user=async name=>db.query(`select set_config('request.jwt.claim.sub',$1,false)`,[ids[name]]);
const body={description:'Validation case',date:'2026-10-13T14:00',location:'Test site',responsibleDepartment:'HSE',reportedDepartment:'HSE',departmentInCharge:'HSE',due:'2026-10-20',likelihood:'3',riskSeverity:'5',category:'Unsafe act',technology:'CCGT',endDate:'2026-10-14T14:00',actions:[],potential:[]};
await user('worker');
let r=(await db.query(`insert into navo_cases(project,case_type,body) values('p1','Observation',$1) returning *`,[body])).rows[0];
assert.equal(+r.case_no,1000000);const permanentDraftNumber=r.case_no;let denied=false;try{await db.query(`insert into navo_cases(project,case_type) values('p2','Observation')`);}catch{denied=true;}assert(denied,'cross-project insertion denied');
await user('hse');assert.equal((await db.query('select * from navo_cases')).rows.length,0,'other person cannot read private draft');
await user('worker');r=(await db.query(`update navo_cases set title='Worker observation',status='Registered' where id=$1 returning *`,[r.id])).rows[0];assert.equal(r.case_no,permanentDraftNumber);assert.equal((await db.query('select case_no from reports where id=$1',[r.id])).rows[0].case_no,r.case_no,'source and case numbers agree');assert.equal((await db.query(`select * from reports where id=$1`,[r.id])).rows.length,1);assert.equal((await db.query(`select event_ts from reports where id=$1`,[r.id])).rows[0].event_ts,Date.parse('2026-10-13T14:00:00+03:00'));
await db.query(`insert into navo_case_notes(case_id,kind,content,revision,created_by,created_at) values($1,'Signature','Reviewed',$2,$3,'1990-01-01')`,[r.id,r.revision,ids.hse]);const note=(await db.query('select * from navo_case_notes')).rows[0];assert.equal(note.created_by,ids.worker,'cannot forge signature author');assert(new Date(note.created_at).getFullYear()>2025,'server signature timestamp');
await user('other');assert.equal((await db.query('select * from navo_cases')).rows.length,0);assert.equal((await db.query('select * from navo_case_notes')).rows.length,0);
await user('hse');
for(const type of ['Accident','Near miss','Inspection','Audit','Audit finding','Meeting']){
const b=structuredClone(body);if(type==='Inspection')b.checklists=[{name:'PTW',questions:[{text:'Safe control',evaluation:'Safe'},{text:'Critical gap',critical:true,evaluation:'At risk'},{text:'Not applicable',evaluation:'Not evaluated'}]}];
let c=(await db.query(`insert into navo_cases(project,case_type,body) values('p1',$1,$2) returning *`,[type,b])).rows[0];
c=(await db.query(`update navo_cases set title=$1,status='Registered' where id=$2 returning *`,[type+' test',c.id])).rows[0];
if(type==='Inspection'){const i=(await db.query('select * from inspections where id=$1',[c.id])).rows[0];assert.equal(+i.score,50);assert.equal(i.fails,1);assert.equal(i.answers.a['2'].v,'No');await db.query(`update navo_cases set status='Processing' where id=$1`,[c.id]);}
console.log('Submitted',type);
}
let actionId='20000000-0000-0000-0000-000000000001';let c=(await db.query(`select * from navo_cases where id=$1`,[r.id])).rows[0];c.body.actions=[{id:actionId,title:'Correct condition',owner:ids.hse,department:'HSE',due:'2026-10-16',type:'Corrective',priority:'High'}];
c=(await db.query(`update navo_cases set body=$1 where id=$2 returning *`,[c.body,c.id])).rows[0];assert.equal((await db.query('select * from actions')).rows.length,1);
c.body.actions[0].due='2026-10-19';denied=false;try{await db.query(`update navo_cases set body=$1 where id=$2`,[c.body,c.id]);}catch(e){denied=/justification/i.test(e.message);}assert(denied,'deadline extension requires justification');c.body.actions[0].justification='Equipment delivery';c=(await db.query(`update navo_cases set body=$1 where id=$2 returning *`,[c.body,c.id])).rows[0];assert(c.history.some(h=>h.justification==='Equipment delivery'));
assert.equal((await db.query('select * from actions')).rows[0].justification_log.length,1);
assert.equal((await db.query('select * from actions')).rows[0].original_due,Date.parse('2026-10-16T23:59:00+03:00'));
assert.equal(c.body.actions[0].originalDue,'2026-10-16');
await db.query(`update navo_cases set status='Processing' where id=$1`,[c.id]);await db.query(`update navo_cases set status='Approved' where id=$1`,[c.id]);
denied=false;try{await db.query(`update navo_cases set status='Closed' where id=$1`,[c.id]);}catch(e){denied=/linked actions/i.test(e.message);}assert(denied,'open actions prevent closing');
await db.query(`update actions set closed_at=123456789,status='Closed' where id=$1`,[actionId]);
await db.query(`update navo_cases set status='Closed' where id=$1`,[c.id]);
c=(await db.query('select * from navo_cases where id=$1',[c.id])).rows[0];assert.equal(c.status,'Closed');
const stale=(await db.query(`update navo_cases set title='stale' where id=$1 and revision=$2 returning *`,[c.id,c.revision-1])).rows;assert.equal(stale.length,0);
await db.query(`insert into navo_case_medical(case_id,data) values($1,'{"age":40}')`,[c.id]);await user('worker');assert.equal((await db.query('select * from navo_case_medical')).rows.length,0);assert.equal((await db.query(`update navo_cases set title='Unauthorized' where id=$1 returning *`,[c.id])).rows.length,0);
await db.exec('reset role');for(const file of releaseMigrations)await db.exec(fs.readFileSync(path.isAbsolute(file)?file:path.join(__dirname,base,file),'utf8'));const config=(await db.query("select data from settings where id='structure'")).rows[0].data;assert.equal(config.kpi.mult,1000000);assert.equal(config.keepMe,true);assert.equal(config.kpi.targets.Construction.ltifr,0.14);assert.equal(config.kpi.targets['Non-Construction'].ltisr,7.62);

await user('admin');await db.exec('set role authenticated');
const extra=[];
for(const sql of [
 "insert into reports(project,rt,ts,case_no) values('p1','Hazard',1,2) returning case_no",
 "insert into inspections(project,ts,case_no) values('p1',1,2) returning case_no",
 "insert into actions(project,title,ts,case_no) values('p1','Standalone action',1,2) returning case_no",
 "insert into activities(project,type,date,ts,case_no) values('p1','Training',1,1,2) returning case_no",
 "insert into hsse_records(project,kind,ts,case_no) values('p1','monthly',1,2) returning case_no",
 "insert into reviews(id,ts,case_no) values('p1_2026-10',1,2) returning case_no"
])extra.push((await db.query(sql)).rows[0].case_no);
assert.equal(new Set(extra).size,6,'all reporting streams reserve different numbers');assert(extra.every(n=>+n>=1000000),'client-supplied numbers ignored');
const reviewNumber=extra[5];await db.query("insert into reviews(id,ts) values('p1_2026-10',2) on conflict(id) do update set ts=excluded.ts");assert.equal((await db.query("select case_no from reviews where id='p1_2026-10'")).rows[0].case_no,reviewNumber,'upsert retains permanent number');
let crossFamily=false;try{await db.query("insert into actions(id,project,title,ts) values($1,'p1','Wrong identity',1)",[r.id]);}catch(e){crossFamily=/reserved/.test(e.message);}assert(crossFamily,'event identity cannot be reused as an action');
assert.equal((await db.query('select * from navo_private.record_identity')).rows.length,0,'private reservation ledger cannot be read directly');
const draft=(await db.query("insert into navo_cases(project,case_type) values('p1','Observation') returning id,case_no")).rows[0];await db.query('delete from navo_cases where id=$1',[draft.id]);const next=(await db.query("insert into navo_cases(project,case_type) values('p1','Observation') returning case_no")).rows[0];assert(+next.case_no>+draft.case_no,'discarded draft numbers are never reused');
await db.exec('reset role');assert.equal((await db.query('select count(*)::int n from navo_private.record_identity where record_id=$1',[draft.id])).rows[0].n,1,'reservation survives deletion');
const maxNo=(await db.query('select max(case_no) n from navo_private.record_identity')).rows[0].n;await db.query("select setval('public.navo_case_number',1000000,false)");await db.exec('set role authenticated');let collision=false;try{await db.query("insert into activities(project,type,date,ts) values('p1','Training',1,1)");}catch(e){collision=/unique|duplicate/i.test(e.message);}assert(collision,'global ledger rejects sequence-reset collision across tables');await db.exec('reset role');await db.query("select setval('public.navo_case_number',$1,true)",[maxNo]);
console.log('PASS: global identity across six legacy streams, draft-to-submission stability, upserts, tombstones, spoofing and cross-table collision rejection');
console.log('PASS: numbering, seven forms, idempotence, projection, deadlines, revision conflicts, project isolation, private drafts, authentic signatures, medical privacy');await db.close();
})().catch(e=>{console.error(e.message,e.stack);process.exit(1)});
