create extension if not exists pgcrypto;

create type public.app_role as enum (
  'club_admin',
  'cohort_admin',
  'coach',
  'player',
  'guardian',
  'treasurer',
  'medical'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  first_name text,
  last_name text,
  birth_date date,
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  timezone text not null default 'Europe/Berlin',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('invited', 'active', 'inactive', 'left')),
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  unique (club_id, profile_id)
);

create table public.membership_roles (
  membership_id uuid not null references public.memberships(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  primary key (membership_id, role)
);

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  name text not null,
  starts_on date not null,
  ends_on date not null,
  status text not null default 'planning' check (status in ('planning', 'active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on > starts_on),
  unique (club_id, name)
);

create table public.cohorts (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  name text not null,
  sport text not null default 'football',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, name),
  unique (id, club_id)
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  cohort_id uuid not null,
  name text not null,
  short_name text not null,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (cohort_id, club_id) references public.cohorts(id, club_id) on delete cascade,
  unique (cohort_id, name),
  unique (id, club_id)
);

create table public.team_memberships (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  team_id uuid not null,
  membership_id uuid not null references public.memberships(id) on delete cascade,
  assignment_type text not null default 'eligible' check (assignment_type in ('primary', 'eligible', 'staff')),
  valid_from date,
  valid_until date,
  created_at timestamptz not null default now(),
  foreign key (team_id, club_id) references public.teams(id, club_id) on delete cascade,
  unique (team_id, membership_id, assignment_type),
  check (valid_until is null or valid_from is null or valid_until >= valid_from)
);

create index memberships_profile_idx on public.memberships(profile_id);
create index membership_roles_membership_idx on public.membership_roles(membership_id);
create index seasons_club_idx on public.seasons(club_id);
create index cohorts_club_idx on public.cohorts(club_id);
create index teams_club_idx on public.teams(club_id);
create index team_memberships_club_idx on public.team_memberships(club_id);
create index team_memberships_member_idx on public.team_memberships(membership_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger clubs_set_updated_at before update on public.clubs
for each row execute function public.set_updated_at();
create trigger seasons_set_updated_at before update on public.seasons
for each row execute function public.set_updated_at();
create trigger cohorts_set_updated_at before update on public.cohorts
for each row execute function public.set_updated_at();
create trigger teams_set_updated_at before update on public.teams
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, first_name, last_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.email, ''),
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_club_member(target_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    where m.club_id = target_club_id
      and m.profile_id = auth.uid()
      and m.status = 'active'
  );
$$;

create or replace function public.has_club_role(target_club_id uuid, allowed_roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    join public.membership_roles mr on mr.membership_id = m.id
    where m.club_id = target_club_id
      and m.profile_id = auth.uid()
      and m.status = 'active'
      and mr.role = any(allowed_roles)
  );
$$;

create or replace function public.shares_club_with(target_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships mine
    join public.memberships theirs on theirs.club_id = mine.club_id
    where mine.profile_id = auth.uid()
      and mine.status = 'active'
      and theirs.profile_id = target_profile_id
      and theirs.status in ('invited', 'active')
  );
$$;

create or replace function public.create_club_workspace(
  club_name text,
  club_slug text,
  season_name text,
  season_starts_on date,
  season_ends_on date,
  cohort_name text,
  team_names text[] default array[]::text[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_club_id uuid;
  new_membership_id uuid;
  new_season_id uuid;
  new_cohort_id uuid;
  team_name text;
  team_index integer := 0;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if cardinality(team_names) < 1 then
    raise exception 'at least one team is required';
  end if;

  insert into public.clubs (name, slug, created_by)
  values (trim(club_name), lower(trim(club_slug)), auth.uid())
  returning id into new_club_id;

  insert into public.memberships (club_id, profile_id, status, joined_at)
  values (new_club_id, auth.uid(), 'active', now())
  returning id into new_membership_id;

  insert into public.membership_roles (membership_id, role)
  values (new_membership_id, 'club_admin');

  insert into public.seasons (club_id, name, starts_on, ends_on, status)
  values (new_club_id, trim(season_name), season_starts_on, season_ends_on, 'planning')
  returning id into new_season_id;

  insert into public.cohorts (club_id, season_id, name)
  values (new_club_id, new_season_id, trim(cohort_name))
  returning id into new_cohort_id;

  foreach team_name in array team_names loop
    insert into public.teams (club_id, cohort_id, name, short_name, sort_order)
    values (new_club_id, new_cohort_id, trim(team_name), trim(team_name), team_index);
    team_index := team_index + 1;
  end loop;

  return new_club_id;
end;
$$;

revoke all on function public.create_club_workspace(text, text, text, date, date, text, text[]) from public;
grant execute on function public.create_club_workspace(text, text, text, date, date, text, text[]) to authenticated;

alter table public.profiles enable row level security;
alter table public.clubs enable row level security;
alter table public.memberships enable row level security;
alter table public.membership_roles enable row level security;
alter table public.seasons enable row level security;
alter table public.cohorts enable row level security;
alter table public.teams enable row level security;
alter table public.team_memberships enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

create policy profiles_select on public.profiles for select to authenticated
using (id = auth.uid() or public.shares_club_with(id));
create policy profiles_update_own on public.profiles for update to authenticated
using (id = auth.uid()) with check (id = auth.uid());

create policy clubs_select_member on public.clubs for select to authenticated
using (public.is_club_member(id));
create policy clubs_update_admin on public.clubs for update to authenticated
using (public.has_club_role(id, array['club_admin']::public.app_role[]))
with check (public.has_club_role(id, array['club_admin']::public.app_role[]));

create policy memberships_select_club on public.memberships for select to authenticated
using (public.is_club_member(club_id));
create policy memberships_insert_admin on public.memberships for insert to authenticated
with check (public.has_club_role(club_id, array['club_admin', 'cohort_admin']::public.app_role[]));
create policy memberships_update_admin on public.memberships for update to authenticated
using (public.has_club_role(club_id, array['club_admin', 'cohort_admin']::public.app_role[]))
with check (public.has_club_role(club_id, array['club_admin', 'cohort_admin']::public.app_role[]));

create policy membership_roles_select_club on public.membership_roles for select to authenticated
using (exists (
  select 1 from public.memberships m
  where m.id = membership_id and public.is_club_member(m.club_id)
));
create policy membership_roles_write_admin on public.membership_roles for all to authenticated
using (exists (
  select 1 from public.memberships m
  where m.id = membership_id
    and public.has_club_role(m.club_id, array['club_admin', 'cohort_admin']::public.app_role[])
))
with check (exists (
  select 1 from public.memberships m
  where m.id = membership_id
    and public.has_club_role(m.club_id, array['club_admin', 'cohort_admin']::public.app_role[])
));

create policy seasons_select_member on public.seasons for select to authenticated
using (public.is_club_member(club_id));
create policy seasons_write_admin on public.seasons for all to authenticated
using (public.has_club_role(club_id, array['club_admin']::public.app_role[]))
with check (public.has_club_role(club_id, array['club_admin']::public.app_role[]));

create policy cohorts_select_member on public.cohorts for select to authenticated
using (public.is_club_member(club_id));
create policy cohorts_write_admin on public.cohorts for all to authenticated
using (public.has_club_role(club_id, array['club_admin', 'cohort_admin']::public.app_role[]))
with check (public.has_club_role(club_id, array['club_admin', 'cohort_admin']::public.app_role[]));

create policy teams_select_member on public.teams for select to authenticated
using (public.is_club_member(club_id));
create policy teams_write_admin on public.teams for all to authenticated
using (public.has_club_role(club_id, array['club_admin', 'cohort_admin']::public.app_role[]))
with check (public.has_club_role(club_id, array['club_admin', 'cohort_admin']::public.app_role[]));

create policy team_memberships_select_member on public.team_memberships for select to authenticated
using (public.is_club_member(club_id));
create policy team_memberships_write_staff on public.team_memberships for all to authenticated
using (public.has_club_role(club_id, array['club_admin', 'cohort_admin', 'coach']::public.app_role[]))
with check (public.has_club_role(club_id, array['club_admin', 'cohort_admin', 'coach']::public.app_role[]));
