create table public.individual_training_entries (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.memberships(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  activity_type text not null check (activity_type in ('running','stability','strength','mobility','recovery','rehab','ball')),
  performed_on date not null,
  duration_minutes integer not null check (duration_minutes between 1 and 1440),
  distance_km numeric(6,2) check (distance_km is null or distance_km between 0 and 1000),
  exertion smallint check (exertion is null or exertion between 1 and 10),
  note text check (note is null or char_length(note) <= 1000),
  share_with_coaches boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.training_tasks (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  membership_id uuid not null references public.memberships(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 160),
  activity_type text not null check (activity_type in ('running','stability','strength','mobility','recovery','rehab','ball')),
  instructions text check (instructions is null or char_length(instructions) <= 1500),
  due_on date not null,
  repetitions integer not null default 1 check (repetitions between 1 and 100),
  status text not null default 'open' check (status in ('open','partial','completed','unable')),
  assigned_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index individual_training_entries_member_date_idx on public.individual_training_entries(membership_id, performed_on desc);
create index training_tasks_member_status_idx on public.training_tasks(membership_id, status);
create trigger training_tasks_set_updated_at before update on public.training_tasks for each row execute function public.set_updated_at();

create or replace function public.log_individual_training(
  target_club_id uuid, target_season_id uuid, target_activity_type text, target_performed_on date,
  target_duration_minutes integer, target_distance_km numeric, target_exertion smallint,
  target_note text, target_share_with_coaches boolean
)
returns uuid language plpgsql security definer set search_path=public as $$
declare target_membership_id uuid; new_id uuid; begin
  select id into target_membership_id from public.memberships
  where club_id=target_club_id and profile_id=auth.uid() and status='active';
  if target_membership_id is null then raise exception 'membership not found'; end if;
  if not exists(select 1 from public.seasons where id=target_season_id and club_id=target_club_id) then raise exception 'season not found'; end if;
  insert into public.individual_training_entries(membership_id,season_id,activity_type,performed_on,duration_minutes,distance_km,exertion,note,share_with_coaches)
  values(target_membership_id,target_season_id,target_activity_type,target_performed_on,target_duration_minutes,target_distance_km,target_exertion,nullif(trim(target_note),''),target_share_with_coaches)
  returning id into new_id; return new_id;
end; $$;

create or replace function public.create_training_task(
  target_team_id uuid, target_membership_id uuid, task_title text, target_activity_type text,
  task_instructions text, target_due_on date, target_repetitions integer
)
returns uuid language plpgsql security definer set search_path=public as $$
declare target_club_id uuid; new_id uuid; begin
  select club_id into target_club_id from public.teams where id=target_team_id;
  if not public.can_manage_teams(target_club_id,array[target_team_id]) then raise exception 'insufficient permission'; end if;
  if not exists(
    select 1 from public.team_memberships tm join public.team_membership_roles tmr on tmr.team_membership_id=tm.id
    where tm.team_id=target_team_id and tm.membership_id=target_membership_id and tmr.role='player'::public.app_role
  ) then raise exception 'member is not a player of this team'; end if;
  insert into public.training_tasks(team_id,membership_id,title,activity_type,instructions,due_on,repetitions,assigned_by)
  values(target_team_id,target_membership_id,trim(task_title),target_activity_type,nullif(trim(task_instructions),''),target_due_on,target_repetitions,auth.uid())
  returning id into new_id; return new_id;
end; $$;

create or replace function public.set_training_task_status(target_task_id uuid, new_status text)
returns void language plpgsql security definer set search_path=public as $$
declare task public.training_tasks%rowtype; target_club_id uuid; is_owner boolean; begin
  select * into task from public.training_tasks where id=target_task_id for update;
  if task.id is null then raise exception 'task not found'; end if;
  if new_status not in ('open','partial','completed','unable') then raise exception 'invalid status'; end if;
  select club_id into target_club_id from public.teams where id=task.team_id;
  select exists(select 1 from public.memberships where id=task.membership_id and profile_id=auth.uid()) into is_owner;
  if not is_owner and not public.can_manage_teams(target_club_id,array[task.team_id]) then raise exception 'insufficient permission'; end if;
  update public.training_tasks set status=new_status where id=target_task_id;
end; $$;

alter table public.individual_training_entries enable row level security;
alter table public.training_tasks enable row level security;
create policy individual_training_select on public.individual_training_entries for select to authenticated using (
  exists(select 1 from public.memberships m where m.id=membership_id and m.profile_id=auth.uid())
  or (share_with_coaches and exists(
    select 1 from public.team_memberships tm join public.teams t on t.id=tm.team_id
    where tm.membership_id=membership_id and public.can_manage_teams(t.club_id,array[t.id])
  ))
);
create policy training_tasks_select on public.training_tasks for select to authenticated using (
  exists(select 1 from public.memberships m where m.id=membership_id and m.profile_id=auth.uid())
  or exists(select 1 from public.teams t where t.id=team_id and public.can_manage_teams(t.club_id,array[t.id]))
);
grant select on public.individual_training_entries,public.training_tasks to authenticated;
revoke all on function public.log_individual_training(uuid,uuid,text,date,integer,numeric,smallint,text,boolean) from public;
revoke all on function public.create_training_task(uuid,uuid,text,text,text,date,integer) from public;
revoke all on function public.set_training_task_status(uuid,text) from public;
grant execute on function public.log_individual_training(uuid,uuid,text,date,integer,numeric,smallint,text,boolean) to authenticated;
grant execute on function public.create_training_task(uuid,uuid,text,text,text,date,integer) to authenticated;
grant execute on function public.set_training_task_status(uuid,text) to authenticated;
