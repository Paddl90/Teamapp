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
