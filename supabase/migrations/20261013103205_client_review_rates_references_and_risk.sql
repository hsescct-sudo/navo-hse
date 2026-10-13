-- Client release: stable numbering for every reporting stream and approved KPI basis.
-- Additive; safe to apply repeatedly. Source copies share their workspace case number.
alter table public.reports add column if not exists case_no bigint, add column if not exists risk_assessment jsonb;
alter table public.inspections add column if not exists case_no bigint;
alter table public.actions add column if not exists case_no bigint;
alter table public.activities add column if not exists case_no bigint;
alter table public.hsse_records add column if not exists case_no bigint;

create or replace function navo_private.reporting_number() returns trigger
language plpgsql security invoker set search_path='' as $$
declare shared bigint;
begin
  if TG_OP='UPDATE' then new.case_no:=old.case_no;return new;end if;
  if TG_TABLE_NAME in ('reports','inspections') then
    select case_no into shared from public.navo_cases where id=new.id and status<>'Draft'
      and ((TG_TABLE_NAME='reports' and case_type in ('Observation','Accident','Near miss'))
        or (TG_TABLE_NAME='inspections' and case_type='Inspection'));
  end if;
  new.case_no:=coalesce(shared,nextval('public.navo_case_number'));
  return new;
end $$;
revoke all on function navo_private.reporting_number() from public;
grant execute on function navo_private.reporting_number() to authenticated;
do $$ declare t text;begin
  foreach t in array array['reports','inspections','actions','activities','hsse_records'] loop
    execute format('update public.%I r set case_no=c.case_no from public.navo_cases c where r.id=c.id and r.case_no is null and c.case_no is not null',t);
    execute format('update public.%I set case_no=nextval(''public.navo_case_number'') where case_no is null',t);
    execute format('alter table public.%I alter column case_no set not null',t);
    execute format('create unique index if not exists %I on public.%I(case_no)',t||'_case_no_idx',t);
    execute format('drop trigger if exists navo_reporting_number on public.%I',t);
    execute format('create trigger navo_reporting_number before insert or update on public.%I for each row execute function navo_private.reporting_number()',t);
  end loop;
end $$;

create or replace function navo_private.risk_input_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
declare k text;v int;
begin
  foreach k in array array['likelihood','riskSeverity','residualLikelihood','residualSeverity'] loop
    if coalesce(new.body->>k,'')<>'' then
      v:=(new.body->>k)::int;if v<1 or v>5 then raise exception 'Risk matrix inputs must be integers from 1 to 5';end if;
    end if;
  end loop;
  foreach k in array array['fmeaSeverity','fmeaOccurrence','fmeaDetection'] loop
    if coalesce(new.body->>k,'')<>'' then
      v:=(new.body->>k)::int;if v<1 or v>10 then raise exception 'FMEA inputs must be integers from 1 to 10';end if;
    end if;
  end loop;
  return new;
end $$;
revoke all on function navo_private.risk_input_guard() from public;
grant execute on function navo_private.risk_input_guard() to authenticated;
drop trigger if exists navo_risk_guard on public.navo_cases;
create trigger navo_risk_guard before insert or update on public.navo_cases for each row execute function navo_private.risk_input_guard();

-- Preserve all other structure, branding and organisation settings.
update public.settings set data=jsonb_set(data,'{kpi}',
  '{"mult":1000000,"targets":{"Corporation":{"ltifr":0.13,"ltisr":2.33,"trcf":0.11},"Construction":{"ltifr":0.14,"ltisr":1.36,"trcf":0.06},"Non-Construction":{"ltifr":0.33,"ltisr":7.62,"trcf":0.60}}}'::jsonb,true)
where id='structure';
create or replace function navo_private.case_project() returns trigger
language plpgsql security invoker set search_path='' as $$
declare b jsonb:=new.body; a jsonb; chk jsonb; q jsonb; n int:=0; bad int:=0; evaluated int:=0; answers jsonb:='{}'; previous jsonb;
begin
  if new.status='Draft' then return new; end if;
  if new.case_type in ('Observation','Accident','Near miss') then
    if TG_OP='UPDATE' and old.status<>'Draft' then
      update public.reports set ai=b->'ai',cat=coalesce(b->'ai'->>'category',b->>'riskCategory',''),risk_assessment=jsonb_build_object('likelihood',b->'likelihood','severity',b->'riskSeverity','residualLikelihood',b->'residualLikelihood','residualSeverity',b->'residualSeverity','reviewed',b->'riskReviewed'),description=new.title||': '||(b->>'description'),dept=b->>'responsibleDepartment',loc=b->>'location',
        rt=case when new.case_type='Observation' then case when b->>'category'='Positive Observation' then 'Good practice' else 'Hazard' end else 'Incident' end,
        kind=case when new.case_type='Near miss' then 'Near Miss' when new.case_type='Accident' and b->>'category'='Injury/illness' then 'Injury' else b->>'category' end,
        safe=case when b->>'stopWork'='true' then 'Yes' else 'No' end,
        status=case when new.status in ('Approved','Closed') then 'Closed' else 'Open' end,contractor=b->>'company',
        event_ts=(extract(epoch from ((b->>'date')::timestamp at time zone 'Asia/Riyadh'))*1000)::bigint where id=new.id;
      if not found then raise exception 'Report update not authorized'; end if;
    else
    insert into public.reports(id,rt,kind,project,dept,loc,description,safe,created_by,ts,event_ts,status,contractor,stage,ai,cat,risk_assessment)
    values(new.id,case when new.case_type='Observation' then case when b->>'category'='Positive Observation' then 'Good practice' else 'Hazard' end else 'Incident' end,
      case when new.case_type='Near miss' then 'Near Miss' when new.case_type='Accident' and b->>'category'='Injury/illness' then 'Injury' else b->>'category' end,
      new.project,b->>'responsibleDepartment',b->>'location',new.title||': '||(b->>'description'),case when b->>'stopWork'='true' then 'Yes' else 'No' end,
      new.created_by,(extract(epoch from new.created_at)*1000)::bigint,(extract(epoch from ((b->>'date')::timestamp at time zone 'Asia/Riyadh'))*1000)::bigint,
      case when new.status in ('Approved','Closed') then 'Closed' else 'Open' end,b->>'company','Registration',b->'ai',coalesce(b->'ai'->>'category',b->>'riskCategory',''),jsonb_build_object('likelihood',b->'likelihood','severity',b->'riskSeverity','residualLikelihood',b->'residualLikelihood','residualSeverity',b->'residualSeverity','reviewed',b->'riskReviewed'))
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
