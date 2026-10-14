-- Coordinates are visible only to administrators and assigned project members.
-- Uses the same project predicate as operational reporting; no new grants.
alter policy projects_read on public.projects using (public.in_project(id));
