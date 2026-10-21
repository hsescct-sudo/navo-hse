-- NAVO HSE: access by organisation level.
-- Corporate sees everything, a platform sees its platform, a division its division, a cluster its cluster,
-- a project member only the projects listed for them. Adds a read-only "viewer" role for leaders.
-- Safe to run more than once. Works whether or not the navo_private hardening migration was applied.

alter table public.members
  add column if not exists scope_level text not null default 'project',
  add column if not exists scope_value text,
  add column if not exists title text;

alter table public.members drop constraint if exists members_scope_level_check;
alter table public.members add constraint members_scope_level_check
  check (scope_level in ('corporate', 'platform', 'division', 'cluster', 'project'));

alter table public.members drop constraint if exists members_role_check;
alter table public.members add constraint members_role_check
  check (role in ('admin', 'hse', 'supervisor', 'worker', 'viewer'));

create index if not exists projects_platform_idx on public.projects(platform);
create index if not exists projects_division_idx on public.projects(division);
create index if not exists projects_cluster_idx on public.projects(cluster);

-- Scope test shared by every row-level policy that calls in_project().
do $do$
declare
  body text := $f$
    select %1$s.is_admin() or exists (
      select 1 from public.members m
      where m.user_id = auth.uid()
        and (
          p = any(m.projects)
          or m.scope_level = 'corporate'
          or (m.scope_level = 'platform' and exists (select 1 from public.projects x where x.id = p and x.platform = m.scope_value))
          or (m.scope_level = 'division' and exists (select 1 from public.projects x where x.id = p and x.division = m.scope_value))
          or (m.scope_level = 'cluster'  and exists (select 1 from public.projects x where x.id = p and x.cluster  = m.scope_value))
        )
    )
  $f$;
begin
  if exists (select 1 from pg_proc pr join pg_namespace n on n.oid = pr.pronamespace where n.nspname = 'navo_private' and pr.proname = 'in_project') then
    execute format('create or replace function navo_private.in_project(p text) returns boolean language sql stable security definer set search_path = '''' as %L', format(body, 'navo_private'));
  else
    execute format('create or replace function public.in_project(p text) returns boolean language sql stable security definer set search_path = public as %L', format(body, 'public'));
  end if;
end
$do$;

-- Leaders with the viewer role read their scope but never write HSE records (is_staff() stays false for them).
