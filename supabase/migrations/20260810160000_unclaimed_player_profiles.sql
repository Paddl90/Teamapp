alter table public.memberships alter column profile_id drop not null;
alter table public.memberships add column display_name text;
alter table public.memberships add column birth_date date;

update public.memberships m
set display_name = p.display_name, birth_date = p.birth_date
from public.profiles p
where p.id = m.profile_id;

alter table public.memberships add constraint memberships_display_name_check
check (profile_id is not null or char_length(trim(display_name)) >= 2);

create table public.player_claims (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.memberships(id) on delete cascade,
  code text not null unique default upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 10)),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  created_by uuid not null references public.profiles(id),
  accepted_by uuid references public.profiles(id),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index player_claims_pending_membership_idx on public.player_claims(membership_id) where status='pending';

create or replace function public.create_unclaimed_player(
  target_club_id uuid,
  player_name text,
  player_birth_date date,
  target_team_ids uuid[]
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  new_membership_id uuid;
  new_team_membership_id uuid;
  new_code text;
  target_team_id uuid;
begin
  if not public.has_club_role(target_club_id,array['club_admin','cohort_admin']::public.app_role[]) then raise exception 'insufficient permission'; end if;
  if char_length(trim(player_name)) < 2 then raise exception 'player name is required'; end if;
  if coalesce(cardinality(target_team_ids),0) < 1 then raise exception 'at least one team is required'; end if;
  foreach target_team_id in array target_team_ids loop
    if not exists(select 1 from public.teams t where t.id=target_team_id and t.club_id=target_club_id) then raise exception 'team does not belong to club'; end if;
  end loop;

  insert into public.memberships(club_id,profile_id,status,joined_at,display_name,birth_date)
  values(target_club_id,null,'active',now(),trim(player_name),player_birth_date)
  returning id into new_membership_id;

  insert into public.membership_roles(membership_id,role) values(new_membership_id,'player');
  foreach target_team_id in array target_team_ids loop
    insert into public.team_memberships(club_id,team_id,membership_id,assignment_type)
    values(target_club_id,target_team_id,new_membership_id,'eligible') returning id into new_team_membership_id;
    insert into public.team_membership_roles(team_membership_id,role) values(new_team_membership_id,'player');
  end loop;

  insert into public.player_claims(membership_id,created_by) values(new_membership_id,auth.uid()) returning code into new_code;
  return jsonb_build_object('membership_id',new_membership_id,'code',new_code);
end;
$$;

create or replace function public.create_player_claim(target_membership_id uuid) returns text
language plpgsql security definer set search_path=public as $$
declare target_club_id uuid; new_code text;
begin
  select club_id into target_club_id from public.memberships where id=target_membership_id and profile_id is null;
  if target_club_id is null then raise exception 'unconnected player not found'; end if;
  if not public.has_club_role(target_club_id,array['club_admin','cohort_admin']::public.app_role[]) then raise exception 'insufficient permission'; end if;
  update public.player_claims set status='revoked' where membership_id=target_membership_id and status='pending';
  insert into public.player_claims(membership_id,created_by) values(target_membership_id,auth.uid()) returning code into new_code;
  return new_code;
end;
$$;

create or replace function public.accept_player_claim(claim_code text) returns uuid
language plpgsql security definer set search_path=public as $$
declare claim public.player_claims%rowtype; target_membership public.memberships%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into claim from public.player_claims where code=upper(trim(claim_code)) and status='pending' for update;
  if claim.id is null then raise exception 'player claim not found'; end if;
  select * into target_membership from public.memberships where id=claim.membership_id for update;
  if target_membership.profile_id is not null then raise exception 'player already connected'; end if;
  if exists(select 1 from public.memberships where club_id=target_membership.club_id and profile_id=auth.uid()) then raise exception 'account already belongs to this club'; end if;

  update public.memberships set profile_id=auth.uid() where id=target_membership.id;
  update public.profiles set
    display_name=coalesce(nullif(target_membership.display_name,''),display_name),
    birth_date=coalesce(target_membership.birth_date,birth_date)
  where id=auth.uid();
  update public.player_claims set status='accepted',accepted_by=auth.uid(),accepted_at=now() where id=claim.id;
  return target_membership.id;
end;
$$;

create or replace function public.update_member_profile_and_roles(target_membership_id uuid,new_display_name text,new_birth_date date,assignments jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare target_membership public.memberships%rowtype; assignment jsonb; assignment_team_id uuid; assignment_roles public.app_role[]; new_team_membership_id uuid; assignment_type_value text;
begin
  select * into target_membership from public.memberships where id=target_membership_id;
  if target_membership.id is null then raise exception 'membership not found'; end if;
  if not public.has_club_role(target_membership.club_id,array['club_admin','cohort_admin']::public.app_role[]) then raise exception 'insufficient permission'; end if;
  if char_length(trim(new_display_name)) < 2 then raise exception 'display name is required'; end if;
  if jsonb_typeof(assignments) <> 'array' then raise exception 'assignments must be an array'; end if;
  update public.memberships set display_name=trim(new_display_name),birth_date=new_birth_date where id=target_membership.id;
  if target_membership.profile_id is not null then update public.profiles set display_name=trim(new_display_name),birth_date=new_birth_date where id=target_membership.profile_id; end if;
  delete from public.team_memberships where membership_id=target_membership.id;
  for assignment in select value from jsonb_array_elements(assignments) loop
    assignment_team_id := (assignment->>'team_id')::uuid;
    select array_agg(distinct value::public.app_role) into assignment_roles from jsonb_array_elements_text(assignment->'roles');
    if not exists(select 1 from public.teams where id=assignment_team_id and club_id=target_membership.club_id) then raise exception 'team does not belong to club'; end if;
    if cardinality(assignment_roles)<1 then continue; end if;
    assignment_type_value := case when 'coach'::public.app_role=any(assignment_roles) then 'staff' else 'eligible' end;
    insert into public.team_memberships(club_id,team_id,membership_id,assignment_type) values(target_membership.club_id,assignment_team_id,target_membership.id,assignment_type_value) returning id into new_team_membership_id;
    insert into public.team_membership_roles(team_membership_id,role) select new_team_membership_id,role from unnest(assignment_roles) role;
  end loop;
end;
$$;

alter table public.player_claims enable row level security;
create policy player_claims_admin_select on public.player_claims for select to authenticated using(exists(select 1 from public.memberships m where m.id=membership_id and public.has_club_role(m.club_id,array['club_admin','cohort_admin']::public.app_role[])));
grant select on public.player_claims to authenticated;
revoke all on function public.create_unclaimed_player(uuid,text,date,uuid[]) from public;
grant execute on function public.create_unclaimed_player(uuid,text,date,uuid[]) to authenticated;
revoke all on function public.create_player_claim(uuid) from public;
grant execute on function public.create_player_claim(uuid) to authenticated;
revoke all on function public.accept_player_claim(text) from public;
grant execute on function public.accept_player_claim(text) to authenticated;
