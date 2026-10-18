const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('public/navo-supabase.js','utf8');
const calls=[];
const session={user:{id:'test-admin',email:'admin@example.test',user_metadata:{name:'Admin'}},access_token:'test-token'};
const sb={
 auth:{onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}},getSession:async()=>({data:{session}})},
 from(table){return {
  upsert:async(rows,options)=>{calls.push({kind:'upsert',table,rows,options});return {data:[],error:null}},
  update:values=>({eq:async(column,value)=>{calls.push({kind:'update',table,column,value,values});return {data:[],error:null}}}),
  delete:()=>({eq:async(column,value)=>{calls.push({kind:'delete',table,column,value});return {data:[],error:null}}}),
  select(){return this},maybeSingle:async()=>({data:null,error:null}),order(){return this},range:async()=>({data:[],error:null})
 }},
 channel(){return {on(){return this},subscribe(){return this}}},removeChannel:async()=>{}
};
const context={window:{NAVO_SUPABASE_CONFIG:{url:'https://example.test',anonKey:'public-test-key'},supabase:{createClient:()=>sb}},document:{getElementById:()=>({hidden:false,style:{},textContent:'',appendChild(){}}),querySelector:()=>null,createElement:()=>({})},location:{reload(){}},setTimeout,clearTimeout,Promise,crypto:{randomUUID:()=> 'test-id'}};
vm.runInNewContext(source,context);
(async()=>{
 await new Promise(r=>setTimeout(r,20));
 const db=await context.window.claude.use('db');
 await db.doc('projects/p-test').set({name:'Project',country:'Bahrain'});
 await db.doc('projects/p-test').delete();
 await db.doc('members/user-test').set({role:'hse',projects:['p-test'],leader:false});
 await db.doc('members/user-test').delete();
 const writes=calls.filter(c=>c.table==='projects'||c.table==='members');
 assert.deepEqual(writes.map(c=>[c.kind,c.table]),[['upsert','projects'],['delete','projects'],['upsert','members'],['delete','members']]);
 assert.equal(writes[0].rows.id,'p-test');
 assert.equal(writes[1].column,'id');assert.equal(writes[1].value,'p-test');
 assert.equal(writes[2].rows.user_id,'user-test');
 assert.equal(writes[3].column,'user_id');assert.equal(writes[3].value,'user-test');
 assert.equal(writes.some(c=>c.kind==='delete'&&c.column==='neq'),false,'saving a row must not delete unrelated records');
 console.log('PASS project and membership changes only write the selected rows');
})().catch(e=>{console.error(e);process.exit(1)});
