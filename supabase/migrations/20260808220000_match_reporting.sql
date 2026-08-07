create table public.match_results (
  match_plan_id uuid primary key references public.match_plans(id) on delete cascade,
  goals_for smallint not null check (goals_for between 0 and 99),
  goals_against smallint not null check (goals_against between 0 and 99),
  match_minutes smallint not null default 90 check (match_minutes between 1 and 180),
  status text not null default 'completed' check (status in ('completed','abandoned')),
  recorded_by uuid not null references public.profiles(id),
  recorded_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.match_incidents (
  id uuid primary key default gen_random_uuid(),
  match_plan_id uuid not null references public.match_plans(id) on delete cascade,
  incident_type text not null check (incident_type in ('goal','yellow_card','red_card','substitution')),
  minute smallint not null check (minute between 0 and 180),
  membership_id uuid not null references public.memberships(id) on delete cascade,
  related_membership_id uuid references public.memberships(id) on delete set null,
  note text check (note is null or char_length(note) <= 500),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  check (related_membership_id is null or related_membership_id <> membership_id)
);

create index match_incidents_plan_minute_idx on public.match_incidents(match_plan_id,minute);
create trigger match_results_set_updated_at before update on public.match_results for each row execute function public.set_updated_at();

create or replace function public.save_match_result(target_match_plan_id uuid, target_goals_for integer, target_goals_against integer, target_match_minutes integer, target_status text)
returns void language plpgsql security definer set search_path=public as $$
declare plan public.match_plans%rowtype; target_club_id uuid; begin
  select * into plan from public.match_plans where id=target_match_plan_id and status='published';
  if plan.id is null then raise exception 'published match plan not found'; end if;
  select club_id into target_club_id from public.teams where id=plan.team_id;
  if not public.can_manage_teams(target_club_id,array[plan.team_id]) then raise exception 'insufficient permission'; end if;
  insert into public.match_results(match_plan_id,goals_for,goals_against,match_minutes,status,recorded_by)
  values(plan.id,target_goals_for,target_goals_against,target_match_minutes,target_status,auth.uid())
  on conflict(match_plan_id) do update set goals_for=excluded.goals_for,goals_against=excluded.goals_against,match_minutes=excluded.match_minutes,status=excluded.status,recorded_by=auth.uid(),recorded_at=now();
end; $$;

create or replace function public.add_match_incident(target_match_plan_id uuid, target_incident_type text, target_minute integer, target_membership_id uuid, target_related_membership_id uuid, incident_note text)
returns uuid language plpgsql security definer set search_path=public as $$
declare plan public.match_plans%rowtype; target_club_id uuid; new_id uuid; begin
  select * into plan from public.match_plans where id=target_match_plan_id and status='published';
  if plan.id is null then raise exception 'published match plan not found'; end if;
  select club_id into target_club_id from public.teams where id=plan.team_id;
  if not public.can_manage_teams(target_club_id,array[plan.team_id]) then raise exception 'insufficient permission'; end if;
  if target_incident_type not in ('goal','yellow_card','red_card','substitution') then raise exception 'invalid incident type'; end if;
  if not exists(select 1 from public.match_squad_entries where match_plan_id=plan.id and membership_id=target_membership_id) then raise exception 'player is not nominated'; end if;
  if target_incident_type='substitution' and (target_related_membership_id is null or not exists(select 1 from public.match_squad_entries where match_plan_id=plan.id and membership_id=target_related_membership_id)) then raise exception 'incoming player is not nominated'; end if;
  if target_related_membership_id is not null and target_incident_type<>'substitution' and not exists(select 1 from public.match_squad_entries where match_plan_id=plan.id and membership_id=target_related_membership_id) then raise exception 'related player is not nominated'; end if;
  insert into public.match_incidents(match_plan_id,incident_type,minute,membership_id,related_membership_id,note,created_by)
  values(plan.id,target_incident_type,target_minute,target_membership_id,target_related_membership_id,nullif(trim(incident_note),''),auth.uid()) returning id into new_id;
  return new_id;
end; $$;

create or replace function public.delete_match_incident(target_incident_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare incident public.match_incidents%rowtype; target_club_id uuid; target_team_id uuid; begin
  select * into incident from public.match_incidents where id=target_incident_id;
  select mp.team_id,t.club_id into target_team_id,target_club_id from public.match_plans mp join public.teams t on t.id=mp.team_id where mp.id=incident.match_plan_id;
  if incident.id is null or not public.can_manage_teams(target_club_id,array[target_team_id]) then raise exception 'insufficient permission'; end if;
  delete from public.match_incidents where id=target_incident_id;
end; $$;

alter table public.match_results enable row level security;
alter table public.match_incidents enable row level security;
create policy match_results_select_club on public.match_results for select to authenticated using(exists(select 1 from public.match_plans mp join public.teams t on t.id=mp.team_id where mp.id=match_plan_id and public.is_club_member(t.club_id)));
create policy match_incidents_select_club on public.match_incidents for select to authenticated using(exists(select 1 from public.match_plans mp join public.teams t on t.id=mp.team_id where mp.id=match_plan_id and public.is_club_member(t.club_id)));
grant select on public.match_results,public.match_incidents to authenticated;
revoke all on function public.save_match_result(uuid,integer,integer,integer,text) from public;
revoke all on function public.add_match_incident(uuid,text,integer,uuid,uuid,text) from public;
revoke all on function public.delete_match_incident(uuid) from public;
grant execute on function public.save_match_result(uuid,integer,integer,integer,text) to authenticated;
grant execute on function public.add_match_incident(uuid,text,integer,uuid,uuid,text) to authenticated;
grant execute on function public.delete_match_incident(uuid) to authenticated;
