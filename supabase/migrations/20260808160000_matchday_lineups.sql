create table public.match_plans (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  opponent text not null check (char_length(opponent) between 2 and 120),
  venue_side text not null default 'home' check (venue_side in ('home', 'away', 'neutral')),
  formation text not null default '4-3-3' check (formation in ('4-4-2', '4-3-3', '4-2-3-1', '3-5-2')),
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, team_id)
);

create table public.match_squad_entries (
  match_plan_id uuid not null references public.match_plans(id) on delete cascade,
  membership_id uuid not null references public.memberships(id) on delete cascade,
  squad_role text not null check (squad_role in ('starting', 'bench')),
  position_code text check (position_code in ('GK', 'CB', 'FB', 'DM', 'CM', 'AM', 'W', 'ST')),
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  primary key (match_plan_id, membership_id),
  check (squad_role = 'bench' or position_code is not null)
);

create trigger match_plans_set_updated_at before update on public.match_plans
for each row execute function public.set_updated_at();

create or replace function public.save_match_plan(
  target_event_id uuid,
  target_team_id uuid,
  target_opponent text,
  target_venue_side text,
  target_formation text,
  target_status text,
  squad_entries jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_club_id uuid;
  saved_plan_id uuid;
  entry jsonb;
  entry_membership_id uuid;
  entry_role text;
  entry_position text;
  entry_order smallint;
begin
  select e.club_id into target_club_id
  from public.events e
  join public.event_teams et on et.event_id = e.id and et.team_id = target_team_id
  where e.id = target_event_id and e.event_type = 'match';
  if target_club_id is null then raise exception 'match event is not assigned to team'; end if;
  if not public.can_manage_teams(target_club_id, array[target_team_id]) then raise exception 'insufficient permission'; end if;
  if target_venue_side not in ('home', 'away', 'neutral') then raise exception 'invalid venue side'; end if;
  if target_formation not in ('4-4-2', '4-3-3', '4-2-3-1', '3-5-2') then raise exception 'invalid formation'; end if;
  if target_status not in ('draft', 'published') then raise exception 'invalid status'; end if;
  if jsonb_typeof(squad_entries) <> 'array' then raise exception 'squad entries must be an array'; end if;

  insert into public.match_plans (event_id, team_id, opponent, venue_side, formation, status, created_by)
  values (target_event_id, target_team_id, trim(target_opponent), target_venue_side, target_formation, target_status, auth.uid())
  on conflict (event_id, team_id) do update set
    opponent = excluded.opponent, venue_side = excluded.venue_side, formation = excluded.formation, status = excluded.status
  returning id into saved_plan_id;

  delete from public.match_squad_entries where match_plan_id = saved_plan_id;
  for entry in select value from jsonb_array_elements(squad_entries) loop
    entry_membership_id := (entry ->> 'membership_id')::uuid;
    entry_role := entry ->> 'squad_role';
    entry_position := nullif(entry ->> 'position_code', '');
    entry_order := coalesce((entry ->> 'sort_order')::smallint, 0);
    if not exists (
      select 1 from public.team_memberships tm
      join public.team_membership_roles tmr on tmr.team_membership_id = tm.id and tmr.role = 'player'::public.app_role
      where tm.team_id = target_team_id and tm.membership_id = entry_membership_id
    ) then raise exception 'squad member is not a player of this team'; end if;
    insert into public.match_squad_entries (match_plan_id, membership_id, squad_role, position_code, sort_order)
    values (saved_plan_id, entry_membership_id, entry_role, entry_position, entry_order);
  end loop;
  return saved_plan_id;
end;
$$;

alter table public.match_plans enable row level security;
alter table public.match_squad_entries enable row level security;
create policy match_plans_select_club on public.match_plans for select to authenticated
using (exists (select 1 from public.teams t where t.id = team_id and public.is_club_member(t.club_id)));
create policy match_squad_select_club on public.match_squad_entries for select to authenticated
using (exists (select 1 from public.match_plans mp join public.teams t on t.id = mp.team_id where mp.id = match_plan_id and public.is_club_member(t.club_id)));

grant select on public.match_plans, public.match_squad_entries to authenticated;
revoke all on function public.save_match_plan(uuid, uuid, text, text, text, text, jsonb) from public;
grant execute on function public.save_match_plan(uuid, uuid, text, text, text, text, jsonb) to authenticated;
