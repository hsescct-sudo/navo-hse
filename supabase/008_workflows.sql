-- NAVO HSE: workflows for actions, inspections and incidents. Safe to run more than once.
alter table public.actions
  add column if not exists status text,
  add column if not exists history jsonb not null default '[]',
  add column if not exists evidence text,
  add column if not exists source text,
  add column if not exists source_id text;
alter table public.inspections
  add column if not exists answers jsonb,
  add column if not exists status text,
  add column if not exists score numeric,
  add column if not exists contractor text,
  add column if not exists area text,
  add column if not exists inspector text,
  add column if not exists history jsonb not null default '[]';
alter table public.reports
  add column if not exists stage text,
  add column if not exists investigation jsonb,
  add column if not exists history jsonb not null default '[]';
