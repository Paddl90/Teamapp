create table public.events (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  cohort_id uuid not null references public.cohorts(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 160),
  event_type text not null check (event_type in ('training', 'match', 'tournament', 'meeting', 'other')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location text,
  notes text,
  status text not null default 'published' check (status in ('draft', 'published', 'cancelled')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table public.event_teams (
  event_id uuid not null references public.events(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, team_id)
);

create table public.event_responses (
  event_id uuid not null references public.events(id) on delete cascade,
  membership_id uuid not null references public.memberships(id) on delete cascade,
  response text not null check (response in ('yes', 'maybe', 'no')),
  note text,
  responded_at timestamptz not null default now(),
  primary key (event_id, membership_id)
);

create index events_cohort_starts_idx on public.events(cohort_id, starts_at);
create index event_teams_team_idx on public.event_teams(team_id);
create index event_responses_membership_idx on public.event_responses(membership_id);

create trigger events_set_updated_at before update on public.events
for each row execute function public.set_updated_at();

create or replace function public.create_team_event(
  target_club_id uuid,
  target_season_id uuid,
  target_cohort_id uuid,
  event_title text,
  target_event_type text,
  event_starts_at timestamptz,
  event_ends_at timestamptz,
  event_location text,
  event_notes text,
  target_team_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_event_id uuid;
begin
  if not public.has_club_role(target_club_id, array['club_admin', 'cohort_admin', 'coach']::public.app_role[]) then
    raise exception 'insufficient permission';
  end if;

  if cardinality(target_team_ids) < 1 then
    raise exception 'at least one team is required';
  end if;

  if exists (
    select 1 from unnest(target_team_ids) team_id
    where not exists (
      select 1 from public.teams t
      where t.id = team_id and t.club_id = target_club_id and t.cohort_id = target_cohort_id
    )
  ) then
    raise exception 'team does not belong to selected context';
  end if;

  insert into public.events (
    club_id, season_id, cohort_id, title, event_type, starts_at, ends_at, location, notes, created_by
  ) values (
    target_club_id, target_season_id, target_cohort_id, trim(event_title), target_event_type,
    event_starts_at, event_ends_at, nullif(trim(event_location), ''), nullif(trim(event_notes), ''), auth.uid()
  ) returning id into new_event_id;

  insert into public.event_teams (event_id, team_id)
  select new_event_id, team_id from unnest(target_team_ids) team_id;

  return new_event_id;
end;
$$;

create or replace function public.respond_to_event(
  target_event_id uuid,
  new_response text,
  response_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_membership_id uuid;
begin
  if new_response not in ('yes', 'maybe', 'no') then
    raise exception 'invalid response';
  end if;

  select m.id into target_membership_id
  from public.events e
  join public.memberships m on m.club_id = e.club_id
  where e.id = target_event_id and m.profile_id = auth.uid() and m.status = 'active';

  if target_membership_id is null then
    raise exception 'membership not found';
  end if;

  if not exists (
    select 1
    from public.event_teams et
    join public.team_memberships tm on tm.team_id = et.team_id
    where et.event_id = target_event_id and tm.membership_id = target_membership_id
  ) and not exists (
    select 1 from public.membership_roles mr
    where mr.membership_id = target_membership_id
      and mr.role in ('club_admin'::public.app_role, 'cohort_admin'::public.app_role)
  ) then
    raise exception 'event is not assigned to this member';
  end if;

  insert into public.event_responses (event_id, membership_id, response, note)
  values (target_event_id, target_membership_id, new_response, nullif(trim(response_note), ''))
  on conflict (event_id, membership_id) do update
  set response = excluded.response, note = excluded.note, responded_at = now();
end;
$$;

alter table public.events enable row level security;
alter table public.event_teams enable row level security;
alter table public.event_responses enable row level security;

create policy events_select_member on public.events for select to authenticated
using (public.is_club_member(club_id));
create policy events_write_manager on public.events for all to authenticated
using (public.has_club_role(club_id, array['club_admin', 'cohort_admin']::public.app_role[]))
with check (public.has_club_role(club_id, array['club_admin', 'cohort_admin']::public.app_role[]));

create policy event_teams_select_member on public.event_teams for select to authenticated
using (exists (select 1 from public.events e where e.id = event_id and public.is_club_member(e.club_id)));
create policy event_teams_write_manager on public.event_teams for all to authenticated
using (exists (select 1 from public.events e where e.id = event_id and public.has_club_role(e.club_id, array['club_admin', 'cohort_admin']::public.app_role[])))
with check (exists (select 1 from public.events e where e.id = event_id and public.has_club_role(e.club_id, array['club_admin', 'cohort_admin']::public.app_role[])));

create policy event_responses_select_member on public.event_responses for select to authenticated
using (exists (select 1 from public.events e where e.id = event_id and public.is_club_member(e.club_id)));
create policy event_responses_write_own on public.event_responses for all to authenticated
using (exists (select 1 from public.memberships m where m.id = membership_id and m.profile_id = auth.uid()))
with check (exists (select 1 from public.memberships m where m.id = membership_id and m.profile_id = auth.uid()));

grant select, insert, update, delete on public.events, public.event_teams, public.event_responses to authenticated;
revoke all on function public.create_team_event(uuid, uuid, uuid, text, text, timestamptz, timestamptz, text, text, uuid[]) from public;
grant execute on function public.create_team_event(uuid, uuid, uuid, text, text, timestamptz, timestamptz, text, text, uuid[]) to authenticated;
revoke all on function public.respond_to_event(uuid, text, text) from public;
grant execute on function public.respond_to_event(uuid, text, text) to authenticated;
