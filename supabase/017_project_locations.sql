-- Project coordinates share the existing admin-only project write policies.
alter table public.projects add column if not exists latitude double precision;
alter table public.projects add column if not exists longitude double precision;
alter table public.projects add column if not exists location_label text;
alter table public.projects add column if not exists location_mode text not null default 'none';
do $$ begin
if not exists(select 1 from pg_constraint where conrelid='public.projects'::regclass and conname='project_coordinate_pair') then
alter table public.projects add constraint project_coordinate_pair check (
 (latitude is null and longitude is null and location_mode='none') or
 (latitude is not null and longitude is not null and latitude between -90 and 90 and longitude between -180 and 180 and location_mode in ('demo','real'))
);
end if;
end $$;
comment on column public.projects.location_mode is 'none: unlocated; demo: explicitly illustrative; real: administrator-confirmed project position';
