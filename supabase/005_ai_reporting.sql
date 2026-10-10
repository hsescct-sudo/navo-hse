-- NAVO HSE: injury severity, AI analysis on reports, private photo storage.
-- Run once after 004_settings.sql.
alter table public.reports
  add column if not exists severity text,
  add column if not exists original_text text,
  add column if not exists lang text,
  add column if not exists ai jsonb,
  add column if not exists photo text;

-- Report photos: private bucket, files stored as <project id>/<file>, readable and writable only by people on that project.
insert into storage.buckets (id, name, public) values ('photos', 'photos', false) on conflict (id) do nothing;
create policy photos_read on storage.objects for select to authenticated
  using (bucket_id = 'photos' and public.in_project(split_part(name, '/', 1)));
create policy photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and public.in_project(split_part(name, '/', 1)));
create policy photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and public.is_admin());
