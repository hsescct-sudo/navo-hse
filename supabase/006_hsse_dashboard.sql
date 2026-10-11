-- NAVO HSE: data behind the Global HSSE Dashboard. Run once after 005_ai_reporting.sql.
-- Injury details on reports.
alter table public.reports
  add column if not exists person_type text,
  add column if not exists injury_type text,
  add column if not exists body_part text,
  add column if not exists inc_class text;

-- One table for the other HSSE records, told apart by "kind":
--   monthly       man-hours, headcount, training, permits, waste, energy and other monthly figures for one project and month
--   finding       an audit finding (corporate, process safety or OSHE audit)
--   audit         an audit result: overall score, or PSM element scores
--   grievance     a worker grievance
--   accommodation a worker accommodation assessment
create table if not exists public.hsse_records (
  id uuid primary key default gen_random_uuid(),
  project text not null references public.projects on delete cascade,
  kind text not null,
  ts bigint not null,
  data jsonb not null default '{}',
  created_by uuid references auth.users on delete set null
);
create index if not exists hsse_records_project_idx on public.hsse_records(project);
alter table public.hsse_records enable row level security;
create policy hsse_read on public.hsse_records for select to authenticated using (public.in_project(project));
create policy hsse_insert on public.hsse_records for insert to authenticated with check (public.is_staff() and public.in_project(project));
create policy hsse_update on public.hsse_records for update to authenticated using (public.is_staff() and public.in_project(project)) with check (public.in_project(project));
create policy hsse_delete on public.hsse_records for delete to authenticated using (public.is_admin());
alter publication supabase_realtime add table public.hsse_records;
