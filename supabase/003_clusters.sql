-- NAVO HSE: business cluster (used under Contracting: Construction, Infrastructure, Asphalt).
-- Run once after 002_dashboards.sql.
alter table public.projects add column if not exists cluster text;
