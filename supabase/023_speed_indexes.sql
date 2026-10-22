-- Speed: indexes for the filters NAVO uses most (project + date, open actions, record kind and month).
-- Safe to run more than once.
create index if not exists reports_project_ts on public.reports (project, ts desc);
create index if not exists reports_project_event on public.reports (project, event_ts desc);
create index if not exists reports_status on public.reports (status) where status <> 'Closed';
create index if not exists actions_project_due on public.actions (project, due) where closed_at is null;
create index if not exists actions_report on public.actions (report);
create index if not exists inspections_project_ts on public.inspections (project, ts desc);
create index if not exists activities_project_date on public.activities (project, date desc);
create index if not exists hsse_records_project_kind_ts on public.hsse_records (project, kind, ts desc);
create index if not exists hsse_records_month on public.hsse_records ((data->>'month'), kind);
analyze public.reports; analyze public.actions; analyze public.inspections; analyze public.activities; analyze public.hsse_records;
