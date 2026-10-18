-- NAVO HSE: database schema and access rules for Supabase.
-- Run once: Supabase dashboard > SQL Editor > New query > paste this file > Run.

-- ============ Tables ============
create table if not exists public.owner (
  id int primary key default 1 check (id = 1),
  user_id uuid not null references auth.users on delete cascade
);

create table if not exists public.people (
  user_id uuid primary key references auth.users on delete cascade,
  name text,
  email text
);

create table if not exists public.projects (
  id text primary key,
  name text not null,
  country text,
  headcount int,
  plan_insp int,
  plan_walk int
);

create table if not exists public.members (
  user_id uuid primary key references auth.users on delete cascade,
  role text not null check (role in ('admin','hse','supervisor','worker')),
  projects text[] not null default '{}'
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  rt text, kind text, cat text,
  project text not null references public.projects on delete cascade,
  dept text, loc text, description text, safe text,
  created_by uuid references auth.users on delete set null,
  ts bigint not null, event_ts bigint,
  status text not null default 'Open'
);

create table if not exists public.actions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  project text not null references public.projects on delete cascade,
  owner text, due bigint, priority text,
  report uuid references public.reports on delete set null,
  ts bigint not null,
  created_by uuid references auth.users on delete set null,
  closed_at bigint
);

create table if not exists public.inspections (
  id uuid primary key default gen_random_uuid(),
  project text not null references public.projects on delete cascade,
  tpl text, items int, fails int,
  ts bigint not null,
  created_by uuid references auth.users on delete set null
);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  project text not null references public.projects on delete cascade,
  date bigint not null, count int not null default 1,
  created_by uuid references auth.users on delete set null,
  ts bigint
);

-- Admin score-card reviews: one row per project and month ("<projectId>_<YYYY-MM>").
create table if not exists public.reviews (
  id text primary key,
  override jsonb not null default '{}',
  admin jsonb not null default '{}',
  qual jsonb not null default '[]',
  note text,
  created_by uuid references auth.users on delete set null,
  ts bigint
);

create index if not exists reports_project_idx on public.reports(project);
create index if not exists actions_project_idx on public.actions(project);
create index if not exists inspections_project_idx on public.inspections(project);
create index if not exists activities_project_idx on public.activities(project);

-- ============ Who is who ============
create schema if not exists navo_private;
revoke all on schema navo_private from public, anon;
grant usage on schema navo_private to authenticated;

create or replace function navo_private.is_owner() returns boolean
language sql stable security definer set search_path = '' as
$$ select exists(select 1 from public.owner where user_id = auth.uid()) $$;

create or replace function navo_private.my_role() returns text
language sql stable security definer set search_path = '' as
$$ select role from public.members where user_id = auth.uid() $$;

create or replace function navo_private.is_admin() returns boolean
language sql stable security definer set search_path = '' as
$$ select navo_private.is_owner() or coalesce(navo_private.my_role() = 'admin', false) $$;

create or replace function navo_private.is_staff() returns boolean
language sql stable security definer set search_path = '' as
$$ select navo_private.is_admin() or coalesce(navo_private.my_role() in ('hse','supervisor'), false) $$;

create or replace function navo_private.in_project(p text) returns boolean
language sql stable security definer set search_path = '' as
$$ select navo_private.is_admin() or exists(select 1 from public.members where user_id = auth.uid() and p = any(projects)) $$;

create or replace function navo_private.can_read_person(target_user uuid) returns boolean
language sql stable security definer set search_path = '' as
$$
  select target_user = auth.uid()
    or navo_private.is_admin()
    or exists (
      select 1
      from public.members target
      join public.members viewer on viewer.user_id = auth.uid()
      where target.user_id = target_user
        and coalesce(target.projects, '{}'::text[]) && coalesce(viewer.projects, '{}'::text[])
    )
$$;

revoke all on function navo_private.is_owner() from public, anon;
revoke all on function navo_private.my_role() from public, anon;
revoke all on function navo_private.is_admin() from public, anon;
revoke all on function navo_private.is_staff() from public, anon;
revoke all on function navo_private.in_project(text) from public, anon;
revoke all on function navo_private.can_read_person(uuid) from public, anon;
grant execute on function navo_private.is_owner() to authenticated;
grant execute on function navo_private.my_role() to authenticated;
grant execute on function navo_private.is_admin() to authenticated;
grant execute on function navo_private.is_staff() to authenticated;
grant execute on function navo_private.in_project(text) to authenticated;
grant execute on function navo_private.can_read_person(uuid) to authenticated;

-- Compatibility wrappers are SECURITY INVOKER; the privileged lookups stay private.
create or replace function public.is_owner() returns boolean
language sql stable security invoker set search_path = '' as
$$ select navo_private.is_owner() $$;
create or replace function public.my_role() returns text
language sql stable security invoker set search_path = '' as
$$ select navo_private.my_role() $$;
create or replace function public.is_admin() returns boolean
language sql stable security invoker set search_path = '' as
$$ select navo_private.is_admin() $$;
create or replace function public.is_staff() returns boolean
language sql stable security invoker set search_path = '' as
$$ select navo_private.is_staff() $$;
create or replace function public.in_project(p text) returns boolean
language sql stable security invoker set search_path = '' as
$$ select navo_private.in_project(p) $$;

revoke all on function public.is_owner() from public, anon;
revoke all on function public.my_role() from public, anon;
revoke all on function public.is_admin() from public, anon;
revoke all on function public.is_staff() from public, anon;
revoke all on function public.in_project(text) from public, anon;
grant execute on function public.is_owner() to authenticated;
grant execute on function public.my_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.in_project(text) to authenticated;

-- A signed-in user can see their own profile and teammates on shared projects.
-- The private SECURITY DEFINER lookup avoids recursive evaluation of members_read.

-- Provision the system owner through the trusted Supabase SQL editor. Never
-- assign ownership to the first public registrant.

-- ============ Row Level Security ============
alter table public.owner enable row level security;
alter table public.people enable row level security;
alter table public.projects enable row level security;
alter table public.members enable row level security;
alter table public.reports enable row level security;
alter table public.actions enable row level security;
alter table public.inspections enable row level security;
alter table public.activities enable row level security;
alter table public.reviews enable row level security;

-- The owner identity is only visible to its own account.
create policy owner_read on public.owner for select to authenticated using (user_id = auth.uid());

-- Profiles and member assignments are visible only to self, admins, and teammates
-- who share at least one assigned project.
create policy people_read on public.people for select to authenticated using (navo_private.can_read_person(user_id));
create policy people_insert on public.people for insert to authenticated with check (user_id = auth.uid());
create policy people_update on public.people for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Project metadata and reviews follow project membership; admins can see all.
create policy projects_read on public.projects for select to authenticated using (public.in_project(id));
create policy projects_write on public.projects for insert to authenticated with check (is_admin());
create policy projects_update on public.projects for update to authenticated using (is_admin()) with check (is_admin());
create policy projects_delete on public.projects for delete to authenticated using (is_admin());

create policy members_read on public.members for select to authenticated using (navo_private.can_read_person(user_id));
create policy members_write on public.members for insert to authenticated with check (is_admin());
create policy members_update on public.members for update to authenticated using (is_admin()) with check (is_admin());
create policy members_delete on public.members for delete to authenticated using (is_admin());

create policy reviews_read on public.reviews for select to authenticated using (
  public.is_admin() or exists (
    select 1 from public.projects p
    where left(public.reviews.id, length(p.id) + 1) = p.id || '_'
      and public.in_project(p.id)
  )
);
create policy reviews_write on public.reviews for insert to authenticated with check (is_admin());
create policy reviews_update on public.reviews for update to authenticated using (is_admin()) with check (is_admin());
create policy reviews_delete on public.reviews for delete to authenticated using (is_admin());

-- reports: anyone on the project reports (named or anonymous); HSE Engineers and Admins close them
create policy reports_read on public.reports for select to authenticated using (in_project(project));
create policy reports_insert on public.reports for insert to authenticated
  with check (in_project(project) and (created_by is null or created_by = auth.uid()));
create policy reports_update on public.reports for update to authenticated
  using ((is_admin() or my_role() = 'hse') and in_project(project)) with check (in_project(project));
create policy reports_delete on public.reports for delete to authenticated using (is_admin());

-- actions: staff on the project add and close
create policy actions_read on public.actions for select to authenticated using (in_project(project));
create policy actions_insert on public.actions for insert to authenticated with check (is_staff() and in_project(project));
create policy actions_update on public.actions for update to authenticated using (is_staff() and in_project(project)) with check (in_project(project));
create policy actions_delete on public.actions for delete to authenticated using (is_admin());

-- inspections and activity logs: staff on the project add, admins correct
create policy inspections_read on public.inspections for select to authenticated using (in_project(project));
create policy inspections_insert on public.inspections for insert to authenticated with check (is_staff() and in_project(project));
create policy inspections_admin on public.inspections for update to authenticated using (is_admin()) with check (is_admin());
create policy inspections_delete on public.inspections for delete to authenticated using (is_admin());

create policy activities_read on public.activities for select to authenticated using (in_project(project));
create policy activities_insert on public.activities for insert to authenticated with check (is_staff() and in_project(project));
create policy activities_admin on public.activities for update to authenticated using (is_admin()) with check (is_admin());
create policy activities_delete on public.activities for delete to authenticated using (is_admin());

-- ============ Live updates ============
alter publication supabase_realtime add table
  public.projects, public.members, public.reviews,
  public.reports, public.actions, public.inspections, public.activities;
