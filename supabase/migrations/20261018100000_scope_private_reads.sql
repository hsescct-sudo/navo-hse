-- Limit directory, project and score-card reads to the signed-in user's scope.
-- Existing records and ownership are preserved.

create schema if not exists navo_private;
revoke all on schema navo_private from public, anon;
grant usage on schema navo_private to authenticated;

-- Privileged helpers live outside the exposed public schema. Their callers are
-- restricted to authenticated users and every lookup is tied to auth.uid().
create or replace function navo_private.is_owner() returns boolean
language sql stable security definer set search_path = '' as
$$ select exists(select 1 from public.owner where user_id = auth.uid()) $$;

create or replace function navo_private.my_role() returns text
language sql stable security definer set search_path = '' as
$$ select role from public.members where user_id = auth.uid() $$;

create or replace function navo_private.is_admin() returns boolean
language sql stable security definer set search_path = '' as
$$ select navo_private.is_owner() or coalesce(navo_private.my_role() = 'admin', false) $$;

create or replace function navo_private.is_staff() returns boolean
language sql stable security definer set search_path = '' as
$$ select navo_private.is_admin() or coalesce(navo_private.my_role() in ('hse','supervisor'), false) $$;

create or replace function navo_private.in_project(p text) returns boolean
language sql stable security definer set search_path = '' as
$$ select navo_private.is_admin() or exists(select 1 from public.members where user_id = auth.uid() and p = any(projects)) $$;

create or replace function navo_private.can_read_person(target_user uuid) returns boolean
language sql stable security definer set search_path = '' as
$$
  select target_user = auth.uid()
    or navo_private.is_admin()
    or exists (
      select 1 from public.members target
      join public.members viewer on viewer.user_id = auth.uid()
      where target.user_id = target_user
        and coalesce(target.projects, '{}'::text[]) && coalesce(viewer.projects, '{}'::text[])
    )
$$;

revoke all on function navo_private.is_owner() from public, anon;
revoke all on function navo_private.my_role() from public, anon;
revoke all on function navo_private.is_admin() from public, anon;
revoke all on function navo_private.is_staff() from public, anon;
revoke all on function navo_private.in_project(text) from public, anon;
revoke all on function navo_private.can_read_person(uuid) from public, anon;
grant execute on function navo_private.is_owner() to authenticated;
grant execute on function navo_private.my_role() to authenticated;
grant execute on function navo_private.is_admin() to authenticated;
grant execute on function navo_private.is_staff() to authenticated;
grant execute on function navo_private.in_project(text) to authenticated;
grant execute on function navo_private.can_read_person(uuid) to authenticated;

-- Keep policy call sites and existing clients compatible without exposing a
-- SECURITY DEFINER endpoint in public.
create or replace function public.is_owner() returns boolean
language sql stable security invoker set search_path = '' as
$$ select navo_private.is_owner() $$;
create or replace function public.my_role() returns text
language sql stable security invoker set search_path = '' as
$$ select navo_private.my_role() $$;
create or replace function public.is_admin() returns boolean
language sql stable security invoker set search_path = '' as
$$ select navo_private.is_admin() $$;
create or replace function public.is_staff() returns boolean
language sql stable security invoker set search_path = '' as
$$ select navo_private.is_staff() $$;
create or replace function public.in_project(p text) returns boolean
language sql stable security invoker set search_path = '' as
$$ select navo_private.in_project(p) $$;

revoke all on function public.is_owner() from public, anon;
revoke all on function public.my_role() from public, anon;
revoke all on function public.is_admin() from public, anon;
revoke all on function public.is_staff() from public, anon;
revoke all on function public.in_project(text) from public, anon;
grant execute on function public.is_owner() to authenticated;
grant execute on function public.my_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.in_project(text) to authenticated;

drop policy if exists owner_read on public.owner;
create policy owner_read on public.owner for select to authenticated
  using (user_id = auth.uid());

drop policy if exists people_read on public.people;
create policy people_read on public.people for select to authenticated
  using (navo_private.can_read_person(user_id));

drop policy if exists projects_read on public.projects;
create policy projects_read on public.projects for select to authenticated
  using (public.in_project(id));

drop policy if exists members_read on public.members;
create policy members_read on public.members for select to authenticated
  using (navo_private.can_read_person(user_id));

drop policy if exists reviews_read on public.reviews;
create policy reviews_read on public.reviews for select to authenticated
  using (
    public.is_admin() or exists (
      select 1 from public.projects p
      where left(public.reviews.id, length(p.id) + 1) = p.id || '_'
        and public.in_project(p.id)
    )
  );
