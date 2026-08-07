create or replace function public.update_member_profile_and_roles(
  target_membership_id uuid,
  new_display_name text,
  new_birth_date date,
  assignments jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_membership public.memberships%rowtype;
  assignment jsonb;
  assignment_team_id uuid;
  assignment_roles public.app_role[];
  new_team_membership_id uuid;
  assignment_type_value text;
begin
  select * into target_membership
  from public.memberships
  where id = target_membership_id;

  if target_membership.id is null then
    raise exception 'membership not found';
  end if;

  if not public.has_club_role(
    target_membership.club_id,
    array['club_admin', 'cohort_admin']::public.app_role[]
  ) then
    raise exception 'insufficient permission';
  end if;

  if char_length(trim(new_display_name)) < 2 then
    raise exception 'display name is required';
  end if;

  if jsonb_typeof(assignments) <> 'array' then
    raise exception 'assignments must be an array';
  end if;

  update public.profiles
  set display_name = trim(new_display_name), birth_date = new_birth_date
  where id = target_membership.profile_id;

  delete from public.team_memberships
  where membership_id = target_membership.id;

  for assignment in select value from jsonb_array_elements(assignments) loop
    assignment_team_id := (assignment ->> 'team_id')::uuid;
    select array_agg(distinct value::public.app_role)
    into assignment_roles
    from jsonb_array_elements_text(assignment -> 'roles');

    if not exists (
      select 1 from public.teams t
      where t.id = assignment_team_id and t.club_id = target_membership.club_id
    ) then
      raise exception 'team does not belong to club';
    end if;

    if cardinality(assignment_roles) < 1 then
      continue;
    end if;

    assignment_type_value := case
      when 'coach'::public.app_role = any(assignment_roles) then 'staff'
      else 'eligible'
    end;

    insert into public.team_memberships (club_id, team_id, membership_id, assignment_type)
    values (target_membership.club_id, assignment_team_id, target_membership.id, assignment_type_value)
    returning id into new_team_membership_id;

    insert into public.team_membership_roles (team_membership_id, role)
    select new_team_membership_id, role
    from unnest(assignment_roles) as role;
  end loop;
end;
$$;

create or replace function public.revoke_member_invitation(target_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation_club_id uuid;
begin
  select club_id into invitation_club_id
  from public.member_invitations
  where id = target_invitation_id and status = 'pending'
  for update;

  if invitation_club_id is null then
    raise exception 'pending invitation not found';
  end if;

  if not public.has_club_role(
    invitation_club_id,
    array['club_admin', 'cohort_admin']::public.app_role[]
  ) then
    raise exception 'insufficient permission';
  end if;

  update public.member_invitations
  set status = 'revoked'
  where id = target_invitation_id;
end;
$$;

revoke all on function public.update_member_profile_and_roles(uuid, text, date, jsonb) from public;
grant execute on function public.update_member_profile_and_roles(uuid, text, date, jsonb) to authenticated;
revoke all on function public.revoke_member_invitation(uuid) from public;
grant execute on function public.revoke_member_invitation(uuid) to authenticated;
