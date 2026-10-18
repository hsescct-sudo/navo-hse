const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('public/navo-supabase.js','utf8');
const session={user:{id:'test-user',email:'user@example.test',user_metadata:{name:'Test user'}},access_token:'test-token'};
const sb={
 auth:{onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}},getSession:async()=>({data:{session}})},
 from(){return {upsert:async()=>({error:null}),select(){return this},maybeSingle:async()=>({data:null,error:null}),order(){return this},range:async()=>{throw Error('simulated network failure')}}},
 rpc:async()=>({error:null}),channel(){return {on(){return this},subscribe(){return this}}},removeChannel:async()=>{}
};
const context={window:{NAVO_SUPABASE_CONFIG:{url:'https://example.test',anonKey:'public-test-key'},supabase:{createClient:()=>sb}},document:{getElementById:()=>({hidden:false,style:{},textContent:'',appendChild(){}}),querySelector:()=>null,createElement:()=>({})},location:{reload(){}},setTimeout,clearTimeout,Promise,crypto:{randomUUID:()=> 'test-id'}};
vm.runInNewContext(source,context);
(async()=>{
 await new Promise(r=>setTimeout(r,20));
 const db=await context.window.claude.use('db');let failure;
 db.doc('admin/projects').onSnapshot(()=>assert.fail('failed project request must not report success'),e=>{failure=e});
 await new Promise(r=>setTimeout(r,20));
 assert.equal(failure?.code,'unavailable');
 assert.match(failure?.message,/simulated network failure/);
 console.log('PASS project data network failures reach the connection error handler');
})().catch(e=>{console.error(e);process.exit(1)});
