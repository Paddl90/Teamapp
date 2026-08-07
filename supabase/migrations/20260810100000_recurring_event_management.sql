alter table public.events add column response_deadline timestamptz;
alter table public.events add column meeting_at timestamptz;
alter table public.events add column meeting_location text;
alter table public.events add column recurrence_group_id uuid;
alter table public.events add constraint events_response_deadline_before_start check(response_deadline is null or response_deadline<=starts_at);
alter table public.events add constraint events_meeting_before_start check(meeting_at is null or meeting_at<=starts_at);
create index events_recurrence_group_idx on public.events(recurrence_group_id) where recurrence_group_id is not null;

create or replace function public.notify_event_change(target_event_id uuid, change_title text, change_body text)
returns void language plpgsql security definer set search_path=public as $$ begin
  insert into public.notifications(membership_id,category,title,body,href,dedupe_key)
  select distinct tm.membership_id,'event',change_title,change_body,'/events',
    'event-change:'||target_event_id||':'||extract(epoch from clock_timestamp())::bigint
  from public.event_teams et join public.team_memberships tm on tm.team_id=et.team_id
  where et.event_id=target_event_id on conflict do nothing;
end; $$;

create or replace function public.create_event_series(
  target_club_id uuid, target_season_id uuid, target_cohort_id uuid, event_title text,
  target_event_type text, event_starts_at timestamptz, event_ends_at timestamptz,
  event_location text, event_notes text, target_team_ids uuid[],
  target_response_deadline timestamptz, target_meeting_at timestamptz, target_meeting_location text,
  recurrence text default 'none', recurrence_ends_on date default null
)
returns uuid[] language plpgsql security definer set search_path=public as $$
declare created_ids uuid[]:=array[]::uuid[]; occurrence_start timestamptz:=event_starts_at;
  occurrence_end timestamptz:=event_ends_at; occurrence_deadline timestamptz:=target_response_deadline;
  occurrence_meeting timestamptz:=target_meeting_at; new_event_id uuid; series_id uuid;
begin
  if recurrence not in ('none','weekly') then raise exception 'invalid recurrence'; end if;
  if cardinality(target_team_ids)<1 then raise exception 'at least one team is required'; end if;
  if not public.can_manage_teams(target_club_id,target_team_ids) then raise exception 'insufficient permission'; end if;
  if event_ends_at<=event_starts_at then raise exception 'end must be after start'; end if;
  if recurrence='weekly' and (recurrence_ends_on is null or recurrence_ends_on<event_starts_at::date) then raise exception 'valid recurrence end required'; end if;
  if recurrence='weekly' and recurrence_ends_on>event_starts_at::date+interval '2 years' then raise exception 'recurrence is too long'; end if;
  if recurrence='weekly' then series_id:=gen_random_uuid(); end if;
  loop
    insert into public.events(club_id,season_id,cohort_id,title,event_type,starts_at,ends_at,location,notes,created_by,response_deadline,meeting_at,meeting_location,recurrence_group_id)
    values(target_club_id,target_season_id,target_cohort_id,trim(event_title),target_event_type,occurrence_start,occurrence_end,
      nullif(trim(event_location),''),nullif(trim(event_notes),''),auth.uid(),occurrence_deadline,occurrence_meeting,nullif(trim(target_meeting_location),''),series_id)
    returning id into new_event_id;
    insert into public.event_teams(event_id,team_id) select new_event_id,team_id from unnest(target_team_ids) team_id;
    created_ids:=array_append(created_ids,new_event_id);
    exit when recurrence='none' or occurrence_start::date+7>recurrence_ends_on;
    occurrence_start:=occurrence_start+interval '7 days'; occurrence_end:=occurrence_end+interval '7 days';
    if occurrence_deadline is not null then occurrence_deadline:=occurrence_deadline+interval '7 days'; end if;
    if occurrence_meeting is not null then occurrence_meeting:=occurrence_meeting+interval '7 days'; end if;
  end loop;
  return created_ids;
end; $$;

create or replace function public.update_team_event(
  target_event_id uuid, event_title text, target_event_type text, event_starts_at timestamptz,
  event_ends_at timestamptz, event_location text, event_notes text, target_team_ids uuid[],
  target_response_deadline timestamptz, target_meeting_at timestamptz, target_meeting_location text
)
returns void language plpgsql security definer set search_path=public as $$
declare event_row public.events%rowtype; previous_team_ids uuid[]; begin
  select * into event_row from public.events where id=target_event_id for update;
  select array_agg(team_id) into previous_team_ids from public.event_teams where event_id=target_event_id;
  if event_row.id is null then raise exception 'event not found'; end if;
  if not public.can_manage_teams(event_row.club_id,previous_team_ids) or not public.can_manage_teams(event_row.club_id,target_team_ids) then raise exception 'insufficient permission'; end if;
  if event_ends_at<=event_starts_at then raise exception 'end must be after start'; end if;
  perform public.notify_event_change(target_event_id,'Termin geändert',trim(event_title)||' · '||to_char(event_starts_at at time zone 'Europe/Berlin','DD.MM.YYYY HH24:MI'));
  update public.events set title=trim(event_title),event_type=target_event_type,starts_at=event_starts_at,ends_at=event_ends_at,
    location=nullif(trim(event_location),''),notes=nullif(trim(event_notes),''),response_deadline=target_response_deadline,
    meeting_at=target_meeting_at,meeting_location=nullif(trim(target_meeting_location),'') where id=target_event_id;
  delete from public.event_teams where event_id=target_event_id and team_id<>all(target_team_ids);
  insert into public.event_teams(event_id,team_id) select target_event_id,team_id from unnest(target_team_ids) team_id on conflict do nothing;
end; $$;

create or replace function public.cancel_team_event(target_event_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare event_row public.events%rowtype; team_ids uuid[]; begin
  select * into event_row from public.events where id=target_event_id for update;
  select array_agg(team_id) into team_ids from public.event_teams where event_id=target_event_id;
  if event_row.id is null then raise exception 'event not found'; end if;
  if not public.can_manage_teams(event_row.club_id,team_ids) then raise exception 'insufficient permission'; end if;
  perform public.notify_event_change(target_event_id,'Termin abgesagt',event_row.title||' · '||to_char(event_row.starts_at at time zone 'Europe/Berlin','DD.MM.YYYY HH24:MI'));
  update public.events set status='cancelled' where id=target_event_id;
end; $$;

create or replace function public.respond_to_event(target_event_id uuid,new_response text,response_note text default null,target_membership_id uuid default null)
returns void language plpgsql security definer set search_path=public as $$
declare acting_membership_id uuid; event_deadline timestamptz; begin
  if new_response not in ('yes','maybe','no') then raise exception 'invalid response'; end if;
  select response_deadline into event_deadline from public.events where id=target_event_id and status='published';
  if not found then raise exception 'event not found'; end if;
  if event_deadline is not null and now()>event_deadline then raise exception 'response deadline has passed'; end if;
  if target_membership_id is null then
    select m.id into acting_membership_id from public.events e join public.memberships m on m.club_id=e.club_id
    where e.id=target_event_id and m.profile_id=auth.uid() and m.status='active';
  else acting_membership_id:=target_membership_id; end if;
  if acting_membership_id is null or not public.can_act_for_membership(acting_membership_id) then raise exception 'membership not permitted'; end if;
  if not exists(select 1 from public.event_teams et join public.team_memberships tm on tm.team_id=et.team_id
    where et.event_id=target_event_id and tm.membership_id=acting_membership_id) then raise exception 'event is not assigned to this member'; end if;
  insert into public.event_responses(event_id,membership_id,response,note)
  values(target_event_id,acting_membership_id,new_response,nullif(trim(response_note),''))
  on conflict(event_id,membership_id) do update set response=excluded.response,note=excluded.note,responded_at=now();
end; $$;

revoke all on function public.create_event_series(uuid,uuid,uuid,text,text,timestamptz,timestamptz,text,text,uuid[],timestamptz,timestamptz,text,text,date) from public;
grant execute on function public.create_event_series(uuid,uuid,uuid,text,text,timestamptz,timestamptz,text,text,uuid[],timestamptz,timestamptz,text,text,date) to authenticated;
revoke all on function public.update_team_event(uuid,text,text,timestamptz,timestamptz,text,text,uuid[],timestamptz,timestamptz,text) from public;
grant execute on function public.update_team_event(uuid,text,text,timestamptz,timestamptz,text,text,uuid[],timestamptz,timestamptz,text) to authenticated;
revoke all on function public.cancel_team_event(uuid) from public;
grant execute on function public.cancel_team_event(uuid) to authenticated;
revoke all on function public.respond_to_event(uuid,text,text,uuid) from public;
grant execute on function public.respond_to_event(uuid,text,text,uuid) to authenticated;
