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
create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as
$$ select exists(select 1 from owner where user_id = auth.uid()) $$;

create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as
$$ select role from members where user_id = auth.uid() $$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select is_owner() or coalesce(my_role() = 'admin', false) $$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as
$$ select is_admin() or coalesce(my_role() in ('hse','supervisor'), false) $$;

create or replace function public.in_project(p text) returns boolean
language sql stable security definer set search_path = public as
$$ select is_admin() or exists(select 1 from members where user_id = auth.uid() and p = any(projects)) $$;

-- The first person to sign in becomes the system owner. Later calls do nothing.
create or replace function public.claim_owner() returns void
language sql security definer set search_path = public as
$$ insert into owner(id, user_id) select 1, auth.uid() where auth.uid() is not null on conflict (id) do nothing $$;

grant execute on function public.claim_owner() to authenticated;

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

-- owner: readable, changed only through claim_owner()
create policy owner_read on public.owner for select to authenticated using (true);

-- people directory: everyone signed in reads, each person writes their own row
create policy people_read on public.people for select to authenticated using (true);
create policy people_insert on public.people for insert to authenticated with check (user_id = auth.uid());
create policy people_update on public.people for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- projects, members, reviews: everyone signed in reads, admins write
create policy projects_read on public.projects for select to authenticated using (true);
create policy projects_write on public.projects for insert to authenticated with check (is_admin());
create policy projects_update on public.projects for update to authenticated using (is_admin()) with check (is_admin());
create policy projects_delete on public.projects for delete to authenticated using (is_admin());

create policy members_read on public.members for select to authenticated using (true);
create policy members_write on public.members for insert to authenticated with check (is_admin());
create policy members_update on public.members for update to authenticated using (is_admin()) with check (is_admin());
create policy members_delete on public.members for delete to authenticated using (is_admin());

create policy reviews_read on public.reviews for select to authenticated using (true);
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
