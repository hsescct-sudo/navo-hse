-- NAVO HSE: platform / division hierarchy and leadership engagement targets.
-- Run once after schema.sql: Supabase dashboard > SQL Editor > New query > paste > Run.

alter table public.projects
  add column if not exists platform text not null default 'Construction'
    check (platform in ('Construction', 'Non-Construction')),
  add column if not exists division text;

alter table public.members
  add column if not exists leader boolean not null default false,
  add column if not exists walk_target int;
