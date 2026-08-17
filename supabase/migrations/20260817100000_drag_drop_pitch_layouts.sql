alter table public.match_squad_entries add column x_percent numeric(5,2) check(x_percent between 0 and 100);
alter table public.match_squad_entries add column y_percent numeric(5,2) check(y_percent between 0 and 100);

create table public.team_player_layouts(
  team_id uuid not null references public.teams(id) on delete cascade,
  membership_id uuid not null references public.memberships(id) on delete cascade,
  x_percent numeric(5,2) not null check(x_percent between 0 and 100),
  y_percent numeric(5,2) not null check(y_percent between 0 and 100),
  updated_at timestamptz not null default now(),
  primary key(team_id,membership_id)
);
create trigger team_player_layouts_set_updated_at before update on public.team_player_layouts for each row execute function public.set_updated_at();

create or replace function public.save_team_player_layout(target_team_id uuid,player_layout jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare target_club_id uuid;entry jsonb;entry_membership_id uuid;entry_x numeric;entry_y numeric;
begin
  select club_id into target_club_id from public.teams where id=target_team_id;
  if target_club_id is null then raise exception 'team not found'; end if;
  if not public.can_manage_teams(target_club_id,array[target_team_id]) then raise exception 'insufficient permission'; end if;
  if jsonb_typeof(player_layout)<>'array' then raise exception 'layout must be an array'; end if;
  delete from public.team_player_layouts where team_id=target_team_id;
  for entry in select value from jsonb_array_elements(player_layout) loop
    entry_membership_id=(entry->>'membership_id')::uuid;entry_x=(entry->>'x_percent')::numeric;entry_y=(entry->>'y_percent')::numeric;
    if entry_x not between 0 and 100 or entry_y not between 0 and 100 then raise exception 'invalid coordinates'; end if;
    if not exists(select 1 from public.team_memberships tm join public.team_membership_roles tmr on tmr.team_membership_id=tm.id and tmr.role='player' where tm.team_id=target_team_id and tm.membership_id=entry_membership_id) then raise exception 'member is not a player of this team'; end if;
    insert into public.team_player_layouts(team_id,membership_id,x_percent,y_percent) values(target_team_id,entry_membership_id,entry_x,entry_y);
  end loop;
end;
$$;

create or replace function public.save_match_plan(target_event_id uuid,target_team_id uuid,target_opponent text,target_venue_side text,target_formation text,target_status text,squad_entries jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare target_club_id uuid;saved_plan_id uuid;entry jsonb;entry_membership_id uuid;entry_role text;entry_position text;entry_order smallint;entry_x numeric;entry_y numeric;
begin
  select e.club_id into target_club_id from public.events e join public.event_teams et on et.event_id=e.id and et.team_id=target_team_id where e.id=target_event_id and e.event_type='match';
  if target_club_id is null then raise exception 'match event is not assigned to team'; end if;
  if not public.can_manage_teams(target_club_id,array[target_team_id]) then raise exception 'insufficient permission'; end if;
  if target_venue_side not in ('home','away','neutral') then raise exception 'invalid venue side'; end if;
  if target_formation not in ('4-4-2','4-3-3','4-2-3-1','3-5-2') then raise exception 'invalid formation'; end if;
  if target_status not in ('draft','published') then raise exception 'invalid status'; end if;
  if jsonb_typeof(squad_entries)<>'array' then raise exception 'squad entries must be an array'; end if;
  insert into public.match_plans(event_id,team_id,opponent,venue_side,formation,status,created_by) values(target_event_id,target_team_id,trim(target_opponent),target_venue_side,target_formation,target_status,auth.uid())
  on conflict(event_id,team_id) do update set opponent=excluded.opponent,venue_side=excluded.venue_side,formation=excluded.formation,status=excluded.status returning id into saved_plan_id;
  delete from public.match_squad_entries where match_plan_id=saved_plan_id;
  for entry in select value from jsonb_array_elements(squad_entries) loop
    entry_membership_id=(entry->>'membership_id')::uuid;entry_role=entry->>'squad_role';entry_position=nullif(entry->>'position_code','');entry_order=coalesce((entry->>'sort_order')::smallint,0);entry_x=nullif(entry->>'x_percent','')::numeric;entry_y=nullif(entry->>'y_percent','')::numeric;
    if not exists(select 1 from public.team_memberships tm join public.team_membership_roles tmr on tmr.team_membership_id=tm.id and tmr.role='player' where tm.team_id=target_team_id and tm.membership_id=entry_membership_id) then raise exception 'squad member is not a player of this team'; end if;
    if entry_role='starting' and (entry_x is null or entry_y is null) then raise exception 'starting player needs pitch coordinates'; end if;
    insert into public.match_squad_entries(match_plan_id,membership_id,squad_role,position_code,sort_order,x_percent,y_percent) values(saved_plan_id,entry_membership_id,entry_role,entry_position,entry_order,entry_x,entry_y);
  end loop;return saved_plan_id;
end;
$$;

alter table public.team_player_layouts enable row level security;
create policy team_player_layouts_select_club on public.team_player_layouts for select to authenticated using(exists(select 1 from public.teams t where t.id=team_id and public.is_club_member(t.club_id)));
grant select on public.team_player_layouts to authenticated;
revoke all on function public.save_team_player_layout(uuid,jsonb) from public;
grant execute on function public.save_team_player_layout(uuid,jsonb) to authenticated;
