-- NAVO HSE: access requests that an administrator approves or rejects.
-- Requests are written by the server (/api/public) and read only by administrators.
create table if not exists public.access_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null, email text not null, phone text, company text, position text,
  project text, manager text, reason text,
  status text not null default 'Pending' check (status in ('Pending', 'Approved', 'Rejected')),
  decided_by text, decided_at timestamptz, note text
);
alter table public.access_requests enable row level security;
drop policy if exists access_requests_admin_read on public.access_requests;
create policy access_requests_admin_read on public.access_requests for select to authenticated using (is_admin());
drop policy if exists access_requests_admin_update on public.access_requests;
create policy access_requests_admin_update on public.access_requests for update to authenticated using (is_admin()) with check (is_admin());
create index if not exists access_requests_status on public.access_requests (status, created_at desc);
