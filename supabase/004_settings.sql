-- NAVO HSE: editable settings (organisation structure: countries, platforms, businesses, clusters).
-- Run once after 003_clusters.sql.
create table if not exists public.settings (
  id text primary key,
  data jsonb not null default '{}'
);
alter table public.settings enable row level security;
create policy settings_read on public.settings for select to authenticated using (true);
create policy settings_insert on public.settings for insert to authenticated with check (is_admin());
create policy settings_update on public.settings for update to authenticated using (is_admin()) with check (is_admin());
create policy settings_delete on public.settings for delete to authenticated using (is_admin());

-- Platform names are now editable, so drop the fixed list check.
alter table public.projects drop constraint if exists projects_platform_check;

insert into public.settings(id, data) values ('structure', '{
  "corporation": "Corporation",
  "countries": ["Bahrain", "KSA", "Oman", "Qatar", "UAE"],
  "platforms": [
    {"name": "Construction", "businesses": [
      {"name": "Contracting", "clusters": ["Construction", "Infrastructure", "Asphalt"]},
      {"name": "MEP", "clusters": []}, {"name": "Asphalt", "clusters": []}, {"name": "Plant", "clusters": []},
      {"name": "NIS", "clusters": []}, {"name": "Landscapes", "clusters": []}]},
    {"name": "Non-Construction", "businesses": [
      {"name": "Precast & Readymix", "clusters": []}, {"name": "Food", "clusters": []}, {"name": "Logistics", "clusters": []},
      {"name": "Sand plant", "clusters": []}, {"name": "Ice plant", "clusters": []}, {"name": "Scafform", "clusters": []},
      {"name": "Commercial (heavy equipment)", "clusters": []}]}
  ]}') on conflict (id) do nothing;

alter publication supabase_realtime add table public.settings;
