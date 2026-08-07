create table public.member_positions (
  membership_id uuid not null references public.memberships(id) on delete cascade,
  position_code text not null check (position_code in ('GK', 'CB', 'FB', 'DM', 'CM', 'AM', 'W', 'ST')),
  priority text not null check (priority in ('primary', 'secondary')),
  created_at timestamptz not null default now(),
  primary key (membership_id, position_code),
  unique (membership_id, priority) deferrable initially immediate
);

create table public.team_position_targets (
  team_id uuid not null references public.teams(id) on delete cascade,
  position_code text not null check (position_code in ('GK', 'CB', 'FB', 'DM', 'CM', 'AM', 'W', 'ST')),
  target_count smallint not null default 1 check (target_count between 0 and 20),
  updated_at timestamptz not null default now(),
  primary key (team_id, position_code)
);

create trigger team_position_targets_set_updated_at before update on public.team_position_targets
for each row execute function public.set_updated_at();

create or replace function public.update_member_positions(
  target_membership_id uuid,
  primary_position text,
  secondary_position text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare target_club_id uuid;
begin
  select club_id into target_club_id from public.memberships where id = target_membership_id;
  if target_club_id is null then raise exception 'membership not found'; end if;
  if not public.has_club_role(target_club_id, array['club_admin', 'cohort_admin']::public.app_role[])
    and not exists (
      select 1 from public.team_memberships tm
      where tm.membership_id = target_membership_id
        and public.has_team_role(tm.team_id, array['coach']::public.app_role[])
    ) then raise exception 'insufficient permission'; end if;
  if primary_position not in ('GK', 'CB', 'FB', 'DM', 'CM', 'AM', 'W', 'ST') then raise exception 'invalid primary position'; end if;
  if secondary_position is not null and secondary_position not in ('GK', 'CB', 'FB', 'DM', 'CM', 'AM', 'W', 'ST') then raise exception 'invalid secondary position'; end if;
  if secondary_position = primary_position then secondary_position := null; end if;

  delete from public.member_positions where membership_id = target_membership_id;
  insert into public.member_positions (membership_id, position_code, priority)
  values (target_membership_id, primary_position, 'primary');
  if secondary_position is not null then
    insert into public.member_positions (membership_id, position_code, priority)
    values (target_membership_id, secondary_position, 'secondary');
  end if;
end;
$$;

create or replace function public.set_team_position_target(
  target_team_id uuid,
  target_position_code text,
  new_target_count smallint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare target_club_id uuid;
begin
  select club_id into target_club_id from public.teams where id = target_team_id;
  if target_club_id is null then raise exception 'team not found'; end if;
  if not public.can_manage_teams(target_club_id, array[target_team_id]) then raise exception 'insufficient permission'; end if;
  if target_position_code not in ('GK', 'CB', 'FB', 'DM', 'CM', 'AM', 'W', 'ST') then raise exception 'invalid position'; end if;
  if new_target_count < 0 or new_target_count > 20 then raise exception 'invalid target'; end if;
  insert into public.team_position_targets (team_id, position_code, target_count)
  values (target_team_id, target_position_code, new_target_count)
  on conflict (team_id, position_code) do update set target_count = excluded.target_count;
end;
$$;

alter table public.member_positions enable row level security;
alter table public.team_position_targets enable row level security;
create policy member_positions_select_club on public.member_positions for select to authenticated
using (exists (select 1 from public.memberships m where m.id = membership_id and public.is_club_member(m.club_id)));
create policy team_position_targets_select_club on public.team_position_targets for select to authenticated
using (exists (select 1 from public.teams t where t.id = team_id and public.is_club_member(t.club_id)));

grant select on public.member_positions, public.team_position_targets to authenticated;
revoke all on function public.update_member_positions(uuid, text, text) from public;
grant execute on function public.update_member_positions(uuid, text, text) to authenticated;
revoke all on function public.set_team_position_target(uuid, text, smallint) from public;
grant execute on function public.set_team_position_target(uuid, text, smallint) to authenticated;
