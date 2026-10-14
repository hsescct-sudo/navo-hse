-- Draft-owned links to accessible prior cases and legacy operational records.
create table if not exists public.navo_record_links (
 id uuid primary key default gen_random_uuid(),
 source_id uuid not null references public.navo_cases(id) on delete cascade,
 target_id text not null,
 target_project text not null references public.projects(id) on delete cascade,
 target_case_no bigint,
 target_type text,
 relation text not null check(relation in ('Related','Repeat event','Follow-up')),
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 unique(source_id,target_id), check(source_id::text<>target_id)
);
create index if not exists navo_record_link_target on public.navo_record_links(target_id);
alter table public.navo_record_links enable row level security;
grant select,insert,delete on public.navo_record_links to authenticated;
drop policy if exists record_links_read on public.navo_record_links;
create policy record_links_read on public.navo_record_links for select to authenticated using (
 public.in_project(target_project) and exists(select 1 from public.navo_cases c where c.id=source_id)
);
drop policy if exists record_links_insert on public.navo_record_links;
create policy record_links_insert on public.navo_record_links for insert to authenticated with check (
 created_by=auth.uid() and public.in_project(target_project) and exists(select 1 from public.navo_cases c where c.id=source_id and
 ((c.status='Draft' and c.created_by=auth.uid()) or (c.status<>'Draft' and (public.is_admin() or public.my_role()='hse'))))
);
drop policy if exists record_links_delete on public.navo_record_links;
create policy record_links_delete on public.navo_record_links for delete to authenticated using (
 exists(select 1 from public.navo_cases c where c.id=source_id and
 ((c.status='Draft' and c.created_by=auth.uid()) or (c.status<>'Draft' and (public.is_admin() or public.my_role()='hse'))))
);
create or replace function navo_private.record_link_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare target record;
begin
 select * into target from (
  select c.project,c.case_no,c.case_type as kind,0 as rank from public.navo_cases c where c.id::text=new.target_id and c.status<>'Draft'
  union all select r.project,r.case_no,'Event',1 from public.reports r where r.id::text=new.target_id
  union all select i.project,i.case_no,'Inspection',1 from public.inspections i where i.id::text=new.target_id
  union all select r.project,r.case_no,r.kind,1 from public.hsse_records r where r.id::text=new.target_id
  union all select a.project,a.case_no,'Action',1 from public.actions a where a.id::text=new.target_id
  union all select a.project,a.case_no,'Leadership activity',1 from public.activities a where a.id::text=new.target_id
 ) x order by rank limit 1;
 if target.project is null or not public.in_project(target.project) then raise exception 'Choose an accessible, submitted prior record'; end if;
 new.target_project:=target.project;new.target_case_no:=target.case_no;new.target_type:=target.kind;
 new.created_by:=auth.uid();new.created_at:=now();return new;
end $$;
revoke all on function navo_private.record_link_guard() from public;
grant execute on function navo_private.record_link_guard() to authenticated;
drop trigger if exists navo_record_link_guard on public.navo_record_links;
create trigger navo_record_link_guard before insert on public.navo_record_links for each row execute function navo_private.record_link_guard();
create or replace function navo_private.link_invalidates_rca() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 update public.navo_cases set body=jsonb_set(body,'{rcaReviewed}','false') where id=case when TG_OP='DELETE' then old.source_id else new.source_id end and body->>'rcaReviewed'='true';
 return new;
end $$;
revoke all on function navo_private.link_invalidates_rca() from public;
grant execute on function navo_private.link_invalidates_rca() to authenticated;
drop trigger if exists navo_record_link_review on public.navo_record_links;
create trigger navo_record_link_review after insert or delete on public.navo_record_links for each row execute function navo_private.link_invalidates_rca();
