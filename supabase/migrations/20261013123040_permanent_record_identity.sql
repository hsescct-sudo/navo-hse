-- A private reservation ledger enforces uniqueness across every reporting stream.
-- Projections of the SAME UUID share its identity; different records never do.
create table if not exists navo_private.record_identity (
  record_id text primary key,
  case_no bigint not null unique,
  project text not null,
  family text not null check (family in ('event','inspection','record','action','activity','review')),
  reserved_at timestamptz not null default now()
);
alter table navo_private.record_identity enable row level security;
revoke all on navo_private.record_identity from public,anon,authenticated;
grant select,insert on navo_private.record_identity to authenticated;
drop policy if exists identity_read on navo_private.record_identity;
create policy identity_read on navo_private.record_identity for select to authenticated
using (pg_trigger_depth()>0 and public.in_project(project));
drop policy if exists identity_reserve on navo_private.record_identity;
create policy identity_reserve on navo_private.record_identity for insert to authenticated
with check (pg_trigger_depth()>0 and public.in_project(project));

insert into navo_private.record_identity(record_id,case_no,project,family)
select id::text,case_no,project,case when case_type in ('Observation','Accident','Near miss') then 'event' when case_type='Inspection' then 'inspection' else 'record' end
from public.navo_cases where case_no is not null
on conflict(record_id) do nothing;
do $$ declare stream text; family text;begin
 foreach stream in array array['reports','inspections','actions','activities','hsse_records'] loop
  family:=case stream when 'reports' then 'event' when 'inspections' then 'inspection' when 'actions' then 'action' when 'activities' then 'activity' else 'record' end;
  execute format('insert into navo_private.record_identity(record_id,case_no,project,family) select id::text,case_no,project,%L from public.%I on conflict(record_id) do nothing',family,stream);
 end loop;
end $$;

create or replace function navo_private.reserve_record_identity() returns trigger
language plpgsql security invoker set search_path='' as $$
declare reservation navo_private.record_identity; family text; record_key text; project_key text;
begin
 if TG_OP='UPDATE' and (new.id<>old.id or new.case_no is distinct from old.case_no) then
  raise exception 'Record identity, project and reference are permanent';
 end if;
 record_key:=new.id::text;
 if TG_TABLE_NAME='reviews' then
  record_key:='review:'||new.id;project_key:=regexp_replace(new.id,'_[0-9]{4}-[0-9]{2}$','');family:='review';
 else
  project_key:=new.project;
 if TG_TABLE_NAME='navo_cases' then
  family:=case when new.case_type in ('Observation','Accident','Near miss') then 'event' when new.case_type='Inspection' then 'inspection' else 'record' end;
 else
  family:=case TG_TABLE_NAME when 'reports' then 'event' when 'inspections' then 'inspection' when 'actions' then 'action' when 'activities' then 'activity' when 'hsse_records' then 'record' else null end;
 end if;
 end if;
 if family is null or new.case_no is null then raise exception 'Missing reporting identity'; end if;
 select * into reservation from navo_private.record_identity where record_id=record_key;
 if reservation.record_id is not null then
  if reservation.project<>project_key or reservation.family<>family then raise exception 'Reference already reserved for another record'; end if;
  new.case_no:=reservation.case_no;
 end if;
 insert into navo_private.record_identity(record_id,case_no,project,family)
 values(record_key,new.case_no,project_key,family) on conflict(record_id) do nothing;
 select * into reservation from navo_private.record_identity where record_id=record_key;
 if reservation.record_id is null or reservation.case_no<>new.case_no or reservation.project<>project_key or reservation.family<>family then
  raise exception 'Reference already reserved for another record';
 end if;
 return new;
end $$;
revoke all on function navo_private.reserve_record_identity() from public;
grant execute on function navo_private.reserve_record_identity() to authenticated;
do $$ declare stream text;begin
 foreach stream in array array['navo_cases','reports','inspections','actions','activities','hsse_records'] loop
  execute format('drop trigger if exists z_navo_record_identity on public.%I',stream);
  execute format('create trigger z_navo_record_identity before insert or update on public.%I for each row execute function navo_private.reserve_record_identity()',stream);
 end loop;
end $$;

-- Drafts receive their permanent reference at creation, retaining it on submission.
do $$ declare definition text;begin
 select pg_get_functiondef('navo_private.case_guard()'::regprocedure) into definition;
 definition:=replace(definition,'new.case_no:=null;','new.case_no:=nextval(''public.navo_case_number'');');
 definition:=replace(definition,'new.case_no:=old.case_no;','new.case_no:=coalesce(old.case_no,nextval(''public.navo_case_number''));');
 definition:=replace(definition,'      new.case_no:=nextval(''public.navo_case_number'');','      new.case_no:=coalesce(old.case_no,new.case_no);');
 execute definition;
end $$;
-- Temporarily omit the identity check only for existing unnumbered drafts.
alter table public.navo_cases disable trigger z_navo_record_identity;
update public.navo_cases set body=body where case_no is null;
alter table public.navo_cases enable trigger z_navo_record_identity;
insert into navo_private.record_identity(record_id,case_no,project,family)
select id::text,case_no,project,case when case_type in ('Observation','Accident','Near miss') then 'event' when case_type='Inspection' then 'inspection' else 'record' end
from public.navo_cases on conflict(record_id) do nothing;
alter table public.navo_cases alter column case_no set not null;

-- Monthly management reviews are also first-class numbered records.
alter table public.reviews add column if not exists case_no bigint;
update public.reviews set case_no=nextval('public.navo_case_number') where case_no is null;
alter table public.reviews alter column case_no set not null;
create unique index if not exists reviews_case_no_idx on public.reviews(case_no);
insert into navo_private.record_identity(record_id,case_no,project,family)
select 'review:'||id,case_no,regexp_replace(id,'_[0-9]{4}-[0-9]{2}$',''),'review' from public.reviews on conflict(record_id) do nothing;
drop trigger if exists navo_reporting_number on public.reviews;
create trigger navo_reporting_number before insert or update on public.reviews for each row execute function navo_private.reporting_number();
drop trigger if exists z_navo_record_identity on public.reviews;
create trigger z_navo_record_identity before insert or update on public.reviews for each row execute function navo_private.reserve_record_identity();
