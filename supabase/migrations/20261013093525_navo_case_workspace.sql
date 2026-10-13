-- NAVO case workspace. Additive and safe to run twice. Existing records stay intact.
create schema if not exists navo_private;
grant usage on schema navo_private to authenticated;
create sequence if not exists public.navo_case_number start with 1000000 maxvalue 9999999;
grant usage on sequence public.navo_case_number to authenticated;

create table if not exists public.navo_cases (
  id uuid primary key default gen_random_uuid(),
  case_no bigint unique,
  project text not null references public.projects(id) on delete cascade,
  case_type text not null check(case_type in ('Observation','Accident','Near miss','Inspection','Audit','Audit finding','Meeting')),
  title text not null default '',
  status text not null default 'Draft' check(status in ('Draft','Registered','Planned','Processing','Approved','Closed')),
  body jsonb not null default '{}',
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revision int not null default 1,
  closed_at timestamptz,
  history jsonb not null default '[]'
);
create index if not exists navo_cases_project_updated_idx on public.navo_cases(project,updated_at desc);
create index if not exists navo_cases_creator_idx on public.navo_cases(created_by);

create table if not exists public.navo_case_notes (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.navo_cases(id) on delete cascade,
  kind text not null check(kind in ('Comment','Signature')),
  content text not null check(length(trim(content)) between 1 and 4000),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  revision int not null
);
create index if not exists navo_case_notes_case_idx on public.navo_case_notes(case_id,created_at);
create unique index if not exists navo_signature_once_idx on public.navo_case_notes(case_id,created_by,revision) where kind='Signature';

create table if not exists public.navo_case_links (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.navo_cases(id) on delete cascade,
  target_id uuid not null references public.navo_cases(id) on delete cascade,
  relation text not null check(relation in ('Related','Superior','Subordinate')),
  created_by uuid not null default auth.uid() references auth.users(id),
  check(case_id<>target_id), unique(case_id,target_id,relation)
);
create index if not exists navo_case_links_target_idx on public.navo_case_links(target_id);
-- Personal medical details are separate from project-visible case content.
create table if not exists public.navo_case_medical (
  case_id uuid primary key references public.navo_cases(id) on delete cascade,
  data jsonb not null default '{}'
);
alter table public.navo_case_medical enable row level security;
grant select,insert,update on public.navo_case_medical to authenticated;
drop policy if exists navo_medical_read on public.navo_case_medical;
create policy navo_medical_read on public.navo_case_medical for select to authenticated using (
  (public.is_admin() or public.my_role()='hse') and exists(select 1 from public.navo_cases c where c.id=case_id)
);
drop policy if exists navo_medical_insert on public.navo_case_medical;
create policy navo_medical_insert on public.navo_case_medical for insert to authenticated with check (
  (public.is_admin() or public.my_role()='hse') and exists(select 1 from public.navo_cases c where c.id=case_id)
);
drop policy if exists navo_medical_update on public.navo_case_medical;
create policy navo_medical_update on public.navo_case_medical for update to authenticated using (
  (public.is_admin() or public.my_role()='hse') and exists(select 1 from public.navo_cases c where c.id=case_id)
) with check((public.is_admin() or public.my_role()='hse') and exists(select 1 from public.navo_cases c where c.id=case_id));
alter table public.navo_cases enable row level security;
alter table public.navo_case_notes enable row level security;
alter table public.navo_case_links enable row level security;
grant select,insert,update,delete on public.navo_cases to authenticated;
grant select,insert on public.navo_case_notes to authenticated;
grant select,insert,delete on public.navo_case_links to authenticated;

drop policy if exists navo_cases_read on public.navo_cases;
create policy navo_cases_read on public.navo_cases for select to authenticated using (
  public.in_project(project) and (status<>'Draft' or created_by=(select auth.uid()))
);
drop policy if exists navo_cases_insert on public.navo_cases;
create policy navo_cases_insert on public.navo_cases for insert to authenticated with check (
  public.in_project(project) and created_by=(select auth.uid()) and status='Draft'
  and (case_type in ('Observation','Accident','Near miss') or public.is_staff())
);
drop policy if exists navo_cases_update on public.navo_cases;
create policy navo_cases_update on public.navo_cases for update to authenticated using (
  public.in_project(project) and ((status='Draft' and created_by=(select auth.uid())) or
  (status<>'Draft' and (public.is_admin() or public.my_role()='hse')))
) with check(public.in_project(project));
drop policy if exists navo_cases_delete on public.navo_cases;
create policy navo_cases_delete on public.navo_cases for delete to authenticated using (
  status='Draft' and created_by=(select auth.uid()) and public.in_project(project)
);
drop policy if exists navo_notes_read on public.navo_case_notes;
create policy navo_notes_read on public.navo_case_notes for select to authenticated using (
  exists(select 1 from public.navo_cases c where c.id=case_id)
);
drop policy if exists navo_notes_insert on public.navo_case_notes;
create policy navo_notes_insert on public.navo_case_notes for insert to authenticated with check (
  created_by=(select auth.uid()) and exists(select 1 from public.navo_cases c
    where c.id=case_id and c.status<>'Draft' and c.revision=navo_case_notes.revision)
);
drop policy if exists navo_links_read on public.navo_case_links;
create policy navo_links_read on public.navo_case_links for select to authenticated using (
  exists(select 1 from public.navo_cases c where c.id=case_id) and
  exists(select 1 from public.navo_cases c where c.id=target_id)
);
drop policy if exists navo_links_insert on public.navo_case_links;
create policy navo_links_insert on public.navo_case_links for insert to authenticated with check (
  created_by=(select auth.uid()) and (public.is_admin() or public.my_role()='hse') and
  exists(select 1 from public.navo_cases c where c.id=case_id and c.status<>'Draft') and
  exists(select 1 from public.navo_cases c where c.id=target_id and c.status<>'Draft')
);
drop policy if exists navo_links_delete on public.navo_case_links;
create policy navo_links_delete on public.navo_case_links for delete to authenticated using (
  (public.is_admin() or public.my_role()='hse') and
  exists(select 1 from public.navo_cases c where c.id=case_id)
);

-- Timestamp, numbering and audit fields are always generated by the database.
create or replace function navo_private.case_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
declare f text; a jsonb; old_action jsonb; normalized_actions jsonb:='[]';
begin
  if new.body ? 'injury' then raise exception 'Medical details belong in the protected medical table'; end if;
  if TG_OP='INSERT' then
    new.case_no:=null; new.history:='[]'; new.revision:=1;
    new.created_at:=now(); new.updated_at:=now(); new.closed_at:=null;
  else
    if new.created_by<>old.created_by or new.project<>old.project or new.case_type<>old.case_type then
      raise exception 'Creator, project and case type cannot be changed';
    end if;
    if old.status<>'Draft' and new.status='Draft' then raise exception 'A submitted case cannot become a draft'; end if;
    if old.status<>new.status and old.status<>'Draft' and not (
      (old.status='Registered' and new.status in ('Planned','Processing')) or
      (old.status='Planned' and new.status='Processing') or
      (old.status='Processing' and new.status='Approved') or
      (old.status='Approved' and new.status in ('Closed','Processing')) or
      (old.status='Closed' and new.status='Processing')
    ) then raise exception 'Invalid processing transition: % to %',old.status,new.status; end if;
    if new.status='Closed' and exists(select 1 from public.actions where source_id=new.id::text and closed_at is null) then
      raise exception 'Verify and close all linked actions before closing the case';
    end if;
    if new.status in ('Approved','Closed') and not (public.is_admin() or public.my_role()='hse') then
      raise exception 'HSE verification is required';
    end if;
    new.case_no:=old.case_no; new.created_at:=old.created_at;
    new.revision:=old.revision+1; new.updated_at:=now(); new.history:=old.history;
    if new.status<>old.status then
      new.history:=new.history||jsonb_build_array(jsonb_build_object('at',now(),'by',auth.uid(),'from',old.status,'to',new.status));
    end if;
    if old.status='Draft' and new.status<>'Draft' then
      if new.status<>'Registered' then raise exception 'Submit as Registered first'; end if;
      new.case_no:=nextval('public.navo_case_number');
    end if;
    -- Preserve original action deadlines; log every extension on the server.
    if jsonb_typeof(new.body->'actions')='array' then
      for a in select value from jsonb_array_elements(new.body->'actions') loop
        select value into old_action from jsonb_array_elements(coalesce(old.body->'actions','[]')) where value->>'id'=a->>'id';
        if old_action is not null and coalesce(old_action->>'due','')<>coalesce(a->>'due','') then
          if coalesce(trim(a->>'justification'),'')='' then raise exception 'A deadline change needs justification'; end if;
          new.history:=new.history||jsonb_build_array(jsonb_build_object('at',now(),'by',auth.uid(),'action',a->>'id','oldDeadline',old_action->>'due','newDeadline',a->>'due','justification',a->>'justification'));
        end if;
        normalized_actions:=normalized_actions||jsonb_build_array(a||jsonb_build_object('originalDue',coalesce(old_action->>'originalDue',old_action->>'due',a->>'due')));
      end loop;
      new.body:=jsonb_set(new.body,'{actions}',normalized_actions);
    end if;
  end if;
  if new.status<>'Draft' then
    if trim(new.title)='' then raise exception 'Title is required'; end if;
    foreach f in array array['description','date','location','responsibleDepartment','reportedDepartment','departmentInCharge','due'] loop
      if coalesce(trim(new.body->>f),'')='' then raise exception 'Required field: %',f; end if;
    end loop;
    perform (new.body->>'due')::date;
    perform (new.body->>'date')::timestamp;
    if new.case_type in ('Observation','Accident','Near miss') and coalesce(new.body->>'category','')='' then raise exception 'Category is required'; end if;
    if new.case_type='Accident' and coalesce(new.body->>'technology','')='' then raise exception 'Technology is required'; end if;
    if new.case_type in ('Inspection','Audit','Meeting') and coalesce(new.body->>'endDate','')='' then raise exception 'End date is required'; end if;
    if new.case_type='Inspection' and jsonb_array_length(coalesce(new.body->'checklists','[]'))=0 then raise exception 'Add a checklist'; end if;
    if new.body->>'endDate' is not null and (new.body->>'endDate')::timestamp<(new.body->>'date')::timestamp then raise exception 'End date must follow start date'; end if;
    for a in select value from jsonb_array_elements(coalesce(new.body->'potential','[]')) loop
      if coalesce((a->>'severity')::int,0) not between 1 and 4 then raise exception 'Select loss potential severity'; end if;
    end loop;
    for a in select value from jsonb_array_elements(coalesce(new.body->'actual','[]')) loop
      if coalesce((a->>'severity')::int,0) not between 1 and 4 then raise exception 'Select actual loss severity'; end if;
      if coalesce((a->>'cost')::numeric,0)<0 then raise exception 'Loss cannot be negative'; end if;
    end loop;
    for a in select value from jsonb_array_elements(coalesce(new.body->'actions','[]')) loop
      if coalesce(trim(a->>'title'),'')='' or coalesce(a->>'owner','')='' or coalesce(a->>'due','')='' or coalesce(a->>'department','')='' then raise exception 'Complete action description, responsible user, department and deadline'; end if;
      if coalesce(a->>'type','') not in ('Immediate','Corrective','Preventative','Coordination','Administrative','Notification to SAP') then raise exception 'Invalid action type'; end if;
      if coalesce(a->>'priority','') not in ('High','Medium','Low') then raise exception 'Invalid action priority'; end if;
      perform (a->>'owner')::uuid;
      if not exists(select 1 from public.people where user_id=(a->>'owner')::uuid) then raise exception 'Choose a responsible user from the directory'; end if;
      if not exists(select 1 from public.members where user_id=(a->>'owner')::uuid and (role='admin' or new.project=any(projects)))
        and not exists(select 1 from public.owner where user_id=(a->>'owner')::uuid) then raise exception 'Responsible user needs access to this project'; end if;
    end loop;
  end if;
  if new.status in ('Approved','Closed') then new.closed_at:=coalesce(old.closed_at,now()); else new.closed_at:=null; end if;
  return new;
end $$;
revoke all on function navo_private.case_guard() from public;
grant execute on function navo_private.case_guard() to authenticated;
drop trigger if exists navo_case_guard on public.navo_cases;
create trigger navo_case_guard before insert or update on public.navo_cases for each row execute function navo_private.case_guard();

create or replace function navo_private.note_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
declare r public.navo_cases;
begin
  select * into r from public.navo_cases where id=new.case_id;
  if r.id is null or r.status='Draft' then raise exception 'Register the case before adding a note'; end if;
  if new.revision<>r.revision then raise exception 'The case changed. Refresh before signing or commenting'; end if;
  new.created_at:=now();new.created_by:=auth.uid();return new;
end $$;
revoke all on function navo_private.note_guard() from public;
grant execute on function navo_private.note_guard() to authenticated;
drop trigger if exists navo_note_guard on public.navo_case_notes;
create trigger navo_note_guard before insert on public.navo_case_notes for each row execute function navo_private.note_guard();

-- Keep operational dashboards fed by the original tables. The projection is transactional
-- and uses the caller's permissions, so a rejected source write rolls back the case save.
alter table public.actions add column if not exists action_type text,
  add column if not exists original_due bigint, add column if not exists justification_log jsonb not null default '[]';
create or replace function navo_private.case_project() returns trigger
language plpgsql security invoker set search_path='' as $$
declare b jsonb:=new.body; a jsonb; chk jsonb; q jsonb; n int:=0; bad int:=0; evaluated int:=0; answers jsonb:='{}'; previous jsonb;
begin
  if new.status='Draft' then return new; end if;
  if new.case_type in ('Observation','Accident','Near miss') then
    if TG_OP='UPDATE' and old.status<>'Draft' then
      update public.reports set description=new.title||': '||(b->>'description'),dept=b->>'responsibleDepartment',loc=b->>'location',
        rt=case when new.case_type='Observation' then case when b->>'category'='Positive Observation' then 'Good practice' else 'Hazard' end else 'Incident' end,
        kind=case when new.case_type='Near miss' then 'Near Miss' when new.case_type='Accident' and b->>'category'='Injury/illness' then 'Injury' else b->>'category' end,
        safe=case when b->>'stopWork'='true' then 'Yes' else 'No' end,
        status=case when new.status in ('Approved','Closed') then 'Closed' else 'Open' end,contractor=b->>'company',
        event_ts=(extract(epoch from ((b->>'date')::timestamp at time zone 'Asia/Riyadh'))*1000)::bigint where id=new.id;
      if not found then raise exception 'Report update not authorized'; end if;
    else
    insert into public.reports(id,rt,kind,project,dept,loc,description,safe,created_by,ts,event_ts,status,contractor,stage)
    values(new.id,case when new.case_type='Observation' then case when b->>'category'='Positive Observation' then 'Good practice' else 'Hazard' end else 'Incident' end,
      case when new.case_type='Near miss' then 'Near Miss' when new.case_type='Accident' and b->>'category'='Injury/illness' then 'Injury' else b->>'category' end,
      new.project,b->>'responsibleDepartment',b->>'location',new.title||': '||(b->>'description'),case when b->>'stopWork'='true' then 'Yes' else 'No' end,
      new.created_by,(extract(epoch from new.created_at)*1000)::bigint,(extract(epoch from ((b->>'date')::timestamp at time zone 'Asia/Riyadh'))*1000)::bigint,
      case when new.status in ('Approved','Closed') then 'Closed' else 'Open' end,b->>'company','Registration')
    ;
    end if;
    if exists(select 1 from public.navo_case_medical where case_id=new.id) then
      update public.navo_case_medical set data=data where case_id=new.id;
    end if;
  elsif new.case_type='Inspection' then
    for chk in select value from jsonb_array_elements(coalesce(b->'checklists','[]')) loop
      for q in select value from jsonb_array_elements(chk->'questions') loop
        if coalesce(q->>'evaluation','')='' then raise exception 'Every checklist question needs an evaluation'; end if;
        n:=n+1;
        answers:=answers||jsonb_build_object(n::text,jsonb_build_object('q',q->>'text','v',case q->>'evaluation' when 'Safe' then 'Yes' when 'At risk' then 'No' else 'N/A' end,'c',coalesce((q->>'critical')::boolean,false),'note',q->>'comment'));
        if q->>'evaluation'='At risk' then bad:=bad+1; end if;
        if q->>'evaluation' in ('Safe','At risk') then evaluated:=evaluated+1; end if;
      end loop;
    end loop;
    insert into public.inspections(id,project,tpl,items,fails,ts,created_by,answers,status,score,area,inspector)
    values(new.id,new.project,new.title,n,bad,(extract(epoch from new.created_at)*1000)::bigint,new.created_by,answers,
      case when new.status in ('Approved','Closed') then 'Closed' when new.status='Planned' then 'Scheduled' else 'Findings recorded' end,
      case when evaluated>0 then round((evaluated-bad)*100.0/evaluated) else null end,b->>'location',b->>'personInCharge')
    on conflict(id) do update set tpl=excluded.tpl,items=excluded.items,fails=excluded.fails,answers=excluded.answers,status=excluded.status,score=excluded.score,area=excluded.area;
  end if;
  for a in select value from jsonb_array_elements(coalesce(b->'actions','[]')) loop
    if TG_OP='UPDATE' then
      select value into previous from jsonb_array_elements(coalesce(old.body->'actions','[]')) where value->>'id'=a->>'id';
      if old.status<>'Draft' and previous=a then continue; end if;
    end if;
    insert into public.actions(id,title,project,owner,due,priority,source,source_id,ts,created_by,status,action_type,original_due)
    values((a->>'id')::uuid,a->>'title',new.project,(select coalesce(name,email,user_id::text) from public.people where user_id=(a->>'owner')::uuid),(extract(epoch from ((a->>'due')::date::timestamp at time zone 'Asia/Riyadh')+interval '23 hours 59 minutes')*1000)::bigint,
      a->>'priority',new.case_type,new.id::text,
      (extract(epoch from new.created_at)*1000)::bigint,new.created_by,'Assigned',a->>'type',
      (extract(epoch from ((a->>'due')::date::timestamp at time zone 'Asia/Riyadh')+interval '23 hours 59 minutes')*1000)::bigint)
    on conflict(id) do update set title=excluded.title,owner=excluded.owner,due=excluded.due,priority=excluded.priority,action_type=excluded.action_type,
      justification_log=case when public.actions.due is distinct from excluded.due then public.actions.justification_log||jsonb_build_array(jsonb_build_object('at',now(),'by',auth.uid(),'old',public.actions.due,'new',excluded.due,'reason',a->>'justification')) else public.actions.justification_log end
    where public.actions.source_id=new.id::text and public.actions.project=new.project;
  end loop;
  return new;
end $$;
revoke all on function navo_private.case_project() from public;
grant execute on function navo_private.case_project() to authenticated;
drop trigger if exists navo_case_projection on public.navo_cases;
create trigger navo_case_projection after insert or update on public.navo_cases for each row execute function navo_private.case_project();

-- HSE can update only inspections created through this case workspace.
drop policy if exists navo_inspection_update on public.inspections;
create policy navo_inspection_update on public.inspections for update to authenticated
using (public.my_role()='hse' and public.in_project(project) and exists(select 1 from public.navo_cases c where c.id=inspections.id))
with check(public.in_project(project));

-- Export only injury classification and total lost days to KPI records, never personal details.
create or replace function navo_private.medical_projection() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if coalesce((new.data->>'lostDays')::int,0)<0 then raise exception 'Lost workdays cannot be negative'; end if;
  update public.reports set lost_days=coalesce((new.data->>'lostDays')::int,0),
    severity=case new.data->>'category' when 'Fatality' then 'Fatality' when 'Permanent Impairment' then 'Serious Injury'
      when 'LTI' then 'Lost Time' when 'RWC' then 'Restricted Work' when 'MTC' then 'Medical Treatment' when 'FAC' then 'First Aid' else severity end
    where id=new.case_id and kind='Injury';
  return new;
end $$;
revoke all on function navo_private.medical_projection() from public;
grant execute on function navo_private.medical_projection() to authenticated;
drop trigger if exists navo_medical_projection on public.navo_case_medical;
create trigger navo_medical_projection after insert or update on public.navo_case_medical for each row execute function navo_private.medical_projection();
