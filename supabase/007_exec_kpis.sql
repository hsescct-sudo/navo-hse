-- NAVO HSE: lost workdays and contractors for the executive KPIs (LTIFR, LTISR, TRCF). Safe to run more than once.
alter table public.reports add column if not exists lost_days int, add column if not exists contractor text;
alter table public.actions add column if not exists contractor text;
