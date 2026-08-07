create table public.availability_blocks (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  membership_id uuid not null references public.memberships(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index availability_blocks_membership_time_idx
on public.availability_blocks(membership_id, starts_at, ends_at);

create trigger availability_blocks_set_updated_at before update on public.availability_blocks
for each row execute function public.set_updated_at();

create or replace function public.can_manage_teams(target_club_id uuid, target_team_ids uuid[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_club_role(target_club_id, array['club_admin', 'cohort_admin']::public.app_role[])
    or (
      cardinality(target_team_ids) > 0
      and not exists (
        select 1 from unnest(target_team_ids) selected_team_id
        where not public.has_team_role(selected_team_id, array['coach']::public.app_role[])
      )
    );
$$;

create or replace function public.create_availability_block(
  target_club_id uuid,
  block_starts_at timestamptz,
  block_ends_at timestamptz,
  block_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_membership_id uuid;
  new_block_id uuid;
begin
  select id into target_membership_id
  from public.memberships
  where club_id = target_club_id and profile_id = auth.uid() and status = 'active';

  if target_membership_id is null then raise exception 'membership not found'; end if;
  if block_ends_at <= block_starts_at then raise exception 'end must be after start'; end if;

  insert into public.availability_blocks (club_id, membership_id, starts_at, ends_at, reason)
  values (target_club_id, target_membership_id, block_starts_at, block_ends_at, nullif(trim(block_reason), ''))
  returning id into new_block_id;
  return new_block_id;
end;
$$;

create or replace function public.delete_availability_block(target_block_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.availability_blocks ab
  using public.memberships m
  where ab.id = target_block_id and m.id = ab.membership_id and m.profile_id = auth.uid();
  if not found then raise exception 'availability block not found'; end if;
end;
$$;

create or replace function public.plan_team_availability(
  target_club_id uuid,
  target_team_ids uuid[],
  window_starts_at timestamptz,
  window_ends_at timestamptz
)
returns table (
  team_id uuid,
  player_total bigint,
  player_available bigint,
  coach_total bigint,
  coach_available bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.can_manage_teams(target_club_id, target_team_ids) then
    raise exception 'insufficient permission';
  end if;
  if window_ends_at <= window_starts_at then raise exception 'end must be after start'; end if;

  return query
  select
    t.id,
    count(distinct tm.membership_id) filter (where tmr.role = 'player'::public.app_role),
    count(distinct tm.membership_id) filter (
      where tmr.role = 'player'::public.app_role and not exists (
        select 1 from public.availability_blocks ab
        where ab.membership_id = tm.membership_id
          and ab.starts_at < window_ends_at and ab.ends_at > window_starts_at
      )
    ),
    count(distinct tm.membership_id) filter (where tmr.role = 'coach'::public.app_role),
    count(distinct tm.membership_id) filter (
      where tmr.role = 'coach'::public.app_role and not exists (
        select 1 from public.availability_blocks ab
        where ab.membership_id = tm.membership_id
          and ab.starts_at < window_ends_at and ab.ends_at > window_starts_at
      )
    )
  from public.teams t
  left join public.team_memberships tm on tm.team_id = t.id
  left join public.team_membership_roles tmr on tmr.team_membership_id = tm.id
  where t.club_id = target_club_id and t.id = any(target_team_ids)
  group by t.id;
end;
$$;

create or replace function public.create_team_event(
  target_club_id uuid, target_season_id uuid, target_cohort_id uuid, event_title text,
  target_event_type text, event_starts_at timestamptz, event_ends_at timestamptz,
  event_location text, event_notes text, target_team_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare new_event_id uuid;
begin
  if not public.can_manage_teams(target_club_id, target_team_ids) then raise exception 'insufficient permission'; end if;
  if cardinality(target_team_ids) < 1 then raise exception 'at least one team is required'; end if;
  if exists (
    select 1 from unnest(target_team_ids) team_id
    where not exists (
      select 1 from public.teams t where t.id = team_id and t.club_id = target_club_id and t.cohort_id = target_cohort_id
    )
  ) then raise exception 'team does not belong to selected context'; end if;

  insert into public.events (club_id, season_id, cohort_id, title, event_type, starts_at, ends_at, location, notes, created_by)
  values (target_club_id, target_season_id, target_cohort_id, trim(event_title), target_event_type,
    event_starts_at, event_ends_at, nullif(trim(event_location), ''), nullif(trim(event_notes), ''), auth.uid())
  returning id into new_event_id;
  insert into public.event_teams (event_id, team_id) select new_event_id, team_id from unnest(target_team_ids) team_id;
  return new_event_id;
end;
$$;

alter table public.availability_blocks enable row level security;
create policy availability_blocks_select_club on public.availability_blocks for select to authenticated
using (public.is_club_member(club_id));
create policy availability_blocks_write_own on public.availability_blocks for all to authenticated
using (exists (select 1 from public.memberships m where m.id = membership_id and m.profile_id = auth.uid()))
with check (exists (select 1 from public.memberships m where m.id = membership_id and m.profile_id = auth.uid()));

grant select, insert, update, delete on public.availability_blocks to authenticated;
revoke all on function public.create_availability_block(uuid, timestamptz, timestamptz, text) from public;
grant execute on function public.create_availability_block(uuid, timestamptz, timestamptz, text) to authenticated;
revoke all on function public.delete_availability_block(uuid) from public;
grant execute on function public.delete_availability_block(uuid) to authenticated;
revoke all on function public.plan_team_availability(uuid, uuid[], timestamptz, timestamptz) from public;
grant execute on function public.plan_team_availability(uuid, uuid[], timestamptz, timestamptz) to authenticated;
revoke all on function public.can_manage_teams(uuid, uuid[]) from public;
grant execute on function public.can_manage_teams(uuid, uuid[]) to authenticated;
revoke all on function public.create_team_event(uuid, uuid, uuid, text, text, timestamptz, timestamptz, text, text, uuid[]) from public;
grant execute on function public.create_team_event(uuid, uuid, uuid, text, text, timestamptz, timestamptz, text, text, uuid[]) to authenticated;
