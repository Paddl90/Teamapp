create table public.event_attendance (
  event_id uuid not null references public.events(id) on delete cascade,
  membership_id uuid not null references public.memberships(id) on delete cascade,
  status text not null check(status in ('present','excused','unexcused','injured')),
  source text not null default 'manual' check(source in ('response','manual')),
  penalty_id uuid references public.member_penalties(id) on delete set null,
  marked_by uuid not null references public.profiles(id),
  marked_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(event_id,membership_id)
);

create table public.event_attendance_history (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  membership_id uuid not null references public.memberships(id) on delete cascade,
  previous_status text,
  new_status text not null,
  changed_by uuid not null references public.profiles(id),
  changed_at timestamptz not null default now()
);
create index event_attendance_member_idx on public.event_attendance(membership_id,status);
create index event_attendance_history_event_idx on public.event_attendance_history(event_id,changed_at desc);
create trigger event_attendance_set_updated_at before update on public.event_attendance for each row execute function public.set_updated_at();

create or replace function public.initialize_event_attendance(target_event_id uuid)
returns integer language plpgsql security definer set search_path=public as $$
declare event_row public.events%rowtype; team_ids uuid[]; inserted_count integer; begin
  select * into event_row from public.events where id=target_event_id and status='published';
  select array_agg(team_id) into team_ids from public.event_teams where event_id=target_event_id;
  if event_row.id is null then raise exception 'event not found'; end if;
  if not public.can_manage_teams(event_row.club_id,team_ids) then raise exception 'insufficient permission'; end if;
  insert into public.event_attendance(event_id,membership_id,status,source,marked_by)
  select target_event_id,er.membership_id,case er.response when 'yes' then 'present' else 'excused' end,'response',auth.uid()
  from public.event_responses er where er.event_id=target_event_id and er.response in ('yes','no')
  on conflict(event_id,membership_id) do nothing;
  get diagnostics inserted_count=row_count; return inserted_count;
end; $$;

create or replace function public.set_event_attendance(
  target_event_id uuid,target_membership_id uuid,new_status text,target_penalty_catalog_id uuid default null
)
returns void language plpgsql security definer set search_path=public as $$
declare event_row public.events%rowtype; team_ids uuid[]; old_row public.event_attendance%rowtype;
  catalog public.penalty_catalog%rowtype; new_penalty_id uuid; begin
  if new_status not in ('present','excused','unexcused','injured') then raise exception 'invalid attendance status'; end if;
  select * into event_row from public.events where id=target_event_id and status='published';
  select array_agg(team_id) into team_ids from public.event_teams where event_id=target_event_id;
  if event_row.id is null then raise exception 'event not found'; end if;
  if not public.can_manage_teams(event_row.club_id,team_ids) then raise exception 'insufficient permission'; end if;
  if not exists(select 1 from public.event_teams et join public.team_memberships tm on tm.team_id=et.team_id
    where et.event_id=target_event_id and tm.membership_id=target_membership_id) then raise exception 'member is not assigned to event'; end if;
  select * into old_row from public.event_attendance where event_id=target_event_id and membership_id=target_membership_id for update;

  if new_status='unexcused' and target_penalty_catalog_id is not null then
    select * into catalog from public.penalty_catalog where id=target_penalty_catalog_id and active and team_id=any(team_ids);
    if catalog.id is null then raise exception 'penalty catalog item not valid for event'; end if;
    if old_row.penalty_id is null then
      insert into public.member_penalties(team_id,membership_id,catalog_id,title,amount_cents,note,assigned_by)
      values(catalog.team_id,target_membership_id,catalog.id,catalog.title,catalog.amount_cents,'Automatisch aus Anwesenheit: '||event_row.title,auth.uid())
      returning id into new_penalty_id;
    else
      new_penalty_id:=old_row.penalty_id;
      update public.member_penalties set status='open',settled_at=null where id=new_penalty_id and status='waived';
    end if;
  elsif old_row.penalty_id is not null and new_status<>'unexcused' then
    update public.member_penalties set status='waived',settled_at=now() where id=old_row.penalty_id and status='open';
    new_penalty_id:=old_row.penalty_id;
  else new_penalty_id:=old_row.penalty_id; end if;

  insert into public.event_attendance(event_id,membership_id,status,source,penalty_id,marked_by)
  values(target_event_id,target_membership_id,new_status,'manual',new_penalty_id,auth.uid())
  on conflict(event_id,membership_id) do update set status=excluded.status,source='manual',penalty_id=coalesce(excluded.penalty_id,event_attendance.penalty_id),marked_by=auth.uid();
  insert into public.event_attendance_history(event_id,membership_id,previous_status,new_status,changed_by)
  values(target_event_id,target_membership_id,old_row.status,new_status,auth.uid());
end; $$;

alter table public.event_attendance enable row level security;
alter table public.event_attendance_history enable row level security;
create policy event_attendance_select_member on public.event_attendance for select to authenticated using(
  exists(select 1 from public.events e where e.id=event_id and public.is_club_member(e.club_id))
);
create policy event_attendance_history_select_manager on public.event_attendance_history for select to authenticated using(
  exists(select 1 from public.events e join public.event_teams et on et.event_id=e.id where e.id=event_id and public.can_manage_teams(e.club_id,array[et.team_id]))
);
grant select on public.event_attendance,public.event_attendance_history to authenticated;
revoke all on function public.initialize_event_attendance(uuid) from public;
grant execute on function public.initialize_event_attendance(uuid) to authenticated;
revoke all on function public.set_event_attendance(uuid,uuid,text,uuid) from public;
grant execute on function public.set_event_attendance(uuid,uuid,text,uuid) to authenticated;

