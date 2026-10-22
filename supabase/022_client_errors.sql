-- Browser error reports from /api/log. Only the server (service key) writes; only System admins read.
create table if not exists public.client_errors (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  kind text, msg text, src text, line int, stack text, view text, env text, ua text, at text
);
alter table public.client_errors enable row level security;
drop policy if exists client_errors_read on public.client_errors;
create policy client_errors_read on public.client_errors for select to authenticated
  using (exists (select 1 from public.members m where m.user_id = auth.uid() and m.role = 'admin') or exists (select 1 from public.owner o where o.user_id = auth.uid()));
-- keep 90 days
create index if not exists client_errors_created on public.client_errors (created_at desc);
