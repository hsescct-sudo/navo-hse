-- Sample data can be removed and loaded again.
-- Removing sample projects left their permanent reference reservations behind, so a reload
-- stopped with "Reference already reserved for another record". Sample reservations are
-- released only for sample projects (ids starting demo-) and only by an administrator.
create or replace function public.navo_release_demo_identity() returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if not public.is_admin() then raise exception 'Administrators only'; end if;
  delete from navo_private.record_identity r
   where r.project like 'demo-%'
     and not exists (select 1 from public.projects p where p.id = r.project);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.navo_release_demo_identity() from public, anon;
grant execute on function public.navo_release_demo_identity() to authenticated;

-- Release what the earlier removal left behind.
delete from navo_private.record_identity r
 where r.project like 'demo-%'
   and not exists (select 1 from public.projects p where p.id = r.project);
