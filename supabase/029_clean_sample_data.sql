-- Removes ALL sample data in one step (projects whose id starts with demo-, and everything recorded on them).
-- Real projects and their records are not touched. Safe to run more than once.
-- After it finishes: refresh the site (Ctrl+Shift+R) and press "Load sample data" ONCE.
begin;
select 'before' as step,
  (select count(*) from public.reports where project like 'demo-%') as reports,
  (select count(*) from public.actions where project like 'demo-%') as actions,
  (select count(*) from public.inspections where project like 'demo-%') as inspections,
  (select count(*) from public.activities where project like 'demo-%') as activities,
  (select count(*) from public.hsse_records where project like 'demo-%') as hsse_records;
delete from public.navo_cases where project like 'demo-%';
delete from public.reports where project like 'demo-%';
delete from public.actions where project like 'demo-%';
delete from public.inspections where project like 'demo-%';
delete from public.activities where project like 'demo-%';
delete from public.hsse_records where project like 'demo-%';
delete from public.reviews where id like 'demo-%';
delete from public.projects where id like 'demo-%';
delete from navo_private.record_identity where project like 'demo-%';
commit;
select 'after' as step, (select count(*) from public.reports) as reports_left, (select count(*) from public.projects) as projects_left;
