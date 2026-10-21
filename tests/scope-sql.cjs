// Access by organisation level: corporate, platform, division, cluster and project members see only their scope.
// Runs on a disposable PGlite database. EXTRA_MIGRATION can point to another migration to apply before 021.
const fs = require('fs'), path = require('path'), assert = require('node:assert/strict');
const { PGlite } = require(process.env.PGLITE_PATH || '@electric-sql/pglite');
(async () => {
  const db = new PGlite(); await db.waitReady;
  await db.exec(`create role authenticated;create role anon;create schema auth;create schema storage;
create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
create table storage.buckets(id text primary key,name text,public boolean);create table storage.objects(id uuid,name text,bucket_id text);`);
  const base = path.join(__dirname, '../supabase'), read = f => fs.readFileSync(path.isAbsolute(f) ? f : path.join(base, f), 'utf8').replace(/alter publication supabase_realtime add table[\s\S]*?;/g, '');
  const chain = ['schema.sql', ...fs.readdirSync(base).filter(f => /^00[2-8]_/.test(f)).sort(), ...(process.env.EXTRA_MIGRATION ? [process.env.EXTRA_MIGRATION] : []), '018_project_location_visibility.sql', '021_scope_access.sql', '021_scope_access.sql'];
  for (const f of chain) { try { await db.exec(read(f)); } catch (e) { console.error('Failed', f, e.message); process.exit(1); } }
  const id = n => `20000000-0000-0000-0000-00000000000${n}`;
  const U = { admin: id(1), corp: id(2), plat: id(3), div: id(4), clu: id(5), proj: id(6), view: id(7) };
  await db.exec(`grant select,insert,update,delete on all tables in schema public to authenticated;
insert into auth.users values ${Object.values(U).map(u => `('${u}')`).join(',')};
insert into public.projects(id,name,platform,division,cluster) values
 ('c1','Tower','Construction','Contracting','Infrastructure'),('c2','Road','Construction','Contracting','Asphalt'),('c3','MEP job','Construction','MEP',null),('n1','Food plant','Non-Construction','Food',null);
insert into public.owner(user_id) values ('${U.admin}');
insert into public.members(user_id,role,projects,scope_level,scope_value,title) values
 ('${U.corp}','hse','{}','corporate',null,'Corporate HSE Director'),
 ('${U.plat}','hse','{}','platform','Construction','Platform HSE Head'),
 ('${U.div}','hse','{}','division','Contracting','Division HSE Manager'),
 ('${U.clu}','supervisor','{}','cluster','Asphalt','Cluster supervisor'),
 ('${U.proj}','worker','{c3}','project',null,'Worker'),
 ('${U.view}','viewer','{}','division','Food','Division Director');
insert into public.reports(rt,project,ts,description) values ('Hazard','c1',1,'r1'),('Hazard','c2',1,'r2'),('Hazard','c3',1,'r3'),('Hazard','n1',1,'r4');
set role authenticated;`);
  const see = async (u, table = 'projects') => { await db.exec(`select set_config('request.jwt.claim.sub','${u}',false)`); const col = table === 'reports' ? 'description' : 'id'; return (await db.query(`select ${col} as id from public.${table} order by ${col}`)).rows.map(r => r.id).join(','); };
  assert.equal(await see(U.admin), 'c1,c2,c3,n1');
  assert.equal(await see(U.corp), 'c1,c2,c3,n1');
  assert.equal(await see(U.plat), 'c1,c2,c3');
  assert.equal(await see(U.div), 'c1,c2');
  assert.equal(await see(U.clu), 'c2');
  assert.equal(await see(U.proj), 'c3');
  assert.equal(await see(U.view), 'n1');
  assert.equal(await see(U.div, 'reports'), 'r1,r2');
  assert.equal(await see(U.view, 'reports'), 'r4');
  // A viewer reads but is not staff, so cannot create actions.
  await db.exec(`select set_config('request.jwt.claim.sub','${U.view}',false)`);
  await assert.rejects(db.query(`insert into public.actions(title,project,ts) values ('x','n1',1)`));
  // A division HSE manager can create actions in the division, not outside it.
  await db.exec(`select set_config('request.jwt.claim.sub','${U.div}',false)`);
  await db.query(`insert into public.actions(title,project,ts) values ('x','c1',1)`);
  await assert.rejects(db.query(`insert into public.actions(title,project,ts) values ('x','n1',1)`));
  console.log('Scope access: corporate, platform, division, cluster, project and viewer checks passed' + (process.env.EXTRA_MIGRATION ? ' (with ' + path.basename(process.env.EXTRA_MIGRATION) + ')' : ''));
})().catch(e => { console.error(e); process.exit(1); });
