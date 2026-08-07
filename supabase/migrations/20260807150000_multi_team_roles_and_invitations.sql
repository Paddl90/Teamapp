create table public.team_membership_roles (
  team_membership_id uuid not null references public.team_memberships(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  primary key (team_membership_id, role)
);

create table public.member_invitations (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  email text not null check (position('@' in email) > 1),
  code text not null unique default upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 10)),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  invited_by uuid not null references public.profiles(id),
  accepted_by uuid references public.profiles(id),
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.invitation_team_assignments (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.member_invitations(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  roles public.app_role[] not null,
  created_at timestamptz not null default now(),
  unique (invitation_id, team_id),
  check (cardinality(roles) > 0)
);

create unique index member_invitations_pending_email_idx
on public.member_invitations (club_id, lower(email))
where status = 'pending';

create index team_membership_roles_role_idx on public.team_membership_roles(role);
create index member_invitations_club_idx on public.member_invitations(club_id);
create index invitation_team_assignments_invitation_idx on public.invitation_team_assignments(invitation_id);

create trigger member_invitations_set_updated_at before update on public.member_invitations
for each row execute function public.set_updated_at();

create or replace function public.has_team_role(
  target_team_id uuid,
  allowed_roles public.app_role[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_memberships tm
    join public.memberships m on m.id = tm.membership_id
    join public.team_membership_roles tmr on tmr.team_membership_id = tm.id
    where tm.team_id = target_team_id
      and m.profile_id = auth.uid()
      and m.status = 'active'
      and tmr.role = any(allowed_roles)
  );
$$;

create or replace function public.create_member_invitation(
  target_club_id uuid,
  invite_email text,
  assignments jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  new_invitation_id uuid;
  new_code text;
  assignment jsonb;
  assignment_team_id uuid;
  assignment_roles public.app_role[];
begin
  if not public.has_club_role(
    target_club_id,
    array['club_admin', 'cohort_admin']::public.app_role[]
  ) then
    raise exception 'insufficient permission';
  end if;

  if position('@' in trim(invite_email)) <= 1 then
    raise exception 'valid email required';
  end if;

  if jsonb_typeof(assignments) <> 'array' or jsonb_array_length(assignments) < 1 then
    raise exception 'at least one team assignment is required';
  end if;

  update public.member_invitations
  set status = 'revoked'
  where club_id = target_club_id
    and lower(email) = lower(trim(invite_email))
    and status = 'pending';

  insert into public.member_invitations (club_id, email, invited_by)
  values (target_club_id, lower(trim(invite_email)), auth.uid())
  returning id, code into new_invitation_id, new_code;

  for assignment in select value from jsonb_array_elements(assignments) loop
    assignment_team_id := (assignment ->> 'team_id')::uuid;
    select array_agg(value::public.app_role)
    into assignment_roles
    from jsonb_array_elements_text(assignment -> 'roles');

    if not exists (
      select 1 from public.teams t
      where t.id = assignment_team_id and t.club_id = target_club_id
    ) then
      raise exception 'team does not belong to club';
    end if;

    if cardinality(assignment_roles) < 1 then
      raise exception 'at least one role per team is required';
    end if;

    insert into public.invitation_team_assignments (invitation_id, team_id, roles)
    values (new_invitation_id, assignment_team_id, assignment_roles);
  end loop;

  return new_code;
end;
$$;

create or replace function public.accept_member_invitation(invitation_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation public.member_invitations%rowtype;
  accepted_membership_id uuid;
  assignment record;
  new_team_membership_id uuid;
  assignment_type_value text;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  select * into invitation
  from public.member_invitations i
  where i.code = upper(trim(invitation_code))
    and i.status = 'pending'
  for update;

  if invitation.id is null then
    raise exception 'invitation not found';
  end if;

  if invitation.expires_at <= now() then
    update public.member_invitations set status = 'expired' where id = invitation.id;
    raise exception 'invitation expired';
  end if;

  if lower(invitation.email) <> lower(coalesce(auth.jwt() ->> 'email', '')) then
    raise exception 'invitation belongs to another email address';
  end if;

  insert into public.memberships (club_id, profile_id, status, joined_at)
  values (invitation.club_id, auth.uid(), 'active', now())
  on conflict (club_id, profile_id) do update
  set status = 'active', joined_at = coalesce(public.memberships.joined_at, now())
  returning id into accepted_membership_id;

  for assignment in
    select ita.team_id, ita.roles
    from public.invitation_team_assignments ita
    where ita.invitation_id = invitation.id
  loop
    assignment_type_value := case
      when 'coach'::public.app_role = any(assignment.roles) then 'staff'
      else 'eligible'
    end;

    insert into public.team_memberships (
      club_id,
      team_id,
      membership_id,
      assignment_type
    )
    values (
      invitation.club_id,
      assignment.team_id,
      accepted_membership_id,
      assignment_type_value
    )
    on conflict (team_id, membership_id, assignment_type) do update
    set club_id = excluded.club_id
    returning id into new_team_membership_id;

    insert into public.team_membership_roles (team_membership_id, role)
    select new_team_membership_id, role
    from unnest(assignment.roles) as role
    on conflict do nothing;
  end loop;

  update public.member_invitations
  set status = 'accepted', accepted_by = auth.uid(), accepted_at = now()
  where id = invitation.id;

  return accepted_membership_id;
end;
$$;

alter table public.team_membership_roles enable row level security;
alter table public.member_invitations enable row level security;
alter table public.invitation_team_assignments enable row level security;

create policy team_membership_roles_select_club on public.team_membership_roles
for select to authenticated
using (exists (
  select 1
  from public.team_memberships tm
  where tm.id = team_membership_id and public.is_club_member(tm.club_id)
));

create policy team_membership_roles_write_admin on public.team_membership_roles
for all to authenticated
using (exists (
  select 1
  from public.team_memberships tm
  where tm.id = team_membership_id
    and public.has_club_role(tm.club_id, array['club_admin', 'cohort_admin']::public.app_role[])
))
with check (exists (
  select 1
  from public.team_memberships tm
  where tm.id = team_membership_id
    and public.has_club_role(tm.club_id, array['club_admin', 'cohort_admin']::public.app_role[])
));

create policy member_invitations_select_admin on public.member_invitations
for select to authenticated
using (public.has_club_role(club_id, array['club_admin', 'cohort_admin']::public.app_role[]));

create policy member_invitations_write_admin on public.member_invitations
for all to authenticated
using (public.has_club_role(club_id, array['club_admin', 'cohort_admin']::public.app_role[]))
with check (public.has_club_role(club_id, array['club_admin', 'cohort_admin']::public.app_role[]));

create policy invitation_assignments_select_admin on public.invitation_team_assignments
for select to authenticated
using (exists (
  select 1 from public.member_invitations i
  where i.id = invitation_id
    and public.has_club_role(i.club_id, array['club_admin', 'cohort_admin']::public.app_role[])
));

create policy invitation_assignments_write_admin on public.invitation_team_assignments
for all to authenticated
using (exists (
  select 1 from public.member_invitations i
  where i.id = invitation_id
    and public.has_club_role(i.club_id, array['club_admin', 'cohort_admin']::public.app_role[])
))
with check (exists (
  select 1 from public.member_invitations i
  where i.id = invitation_id
    and public.has_club_role(i.club_id, array['club_admin', 'cohort_admin']::public.app_role[])
));

grant select, insert, update, delete on public.team_membership_roles to authenticated;
grant select, insert, update, delete on public.member_invitations to authenticated;
grant select, insert, update, delete on public.invitation_team_assignments to authenticated;

revoke all on function public.create_member_invitation(uuid, text, jsonb) from public;
grant execute on function public.create_member_invitation(uuid, text, jsonb) to authenticated;
revoke all on function public.accept_member_invitation(text) from public;
grant execute on function public.accept_member_invitation(text) to authenticated;
