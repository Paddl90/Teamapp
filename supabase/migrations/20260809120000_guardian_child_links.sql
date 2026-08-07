create table public.guardian_child_links (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  guardian_membership_id uuid not null references public.memberships(id) on delete cascade,
  child_membership_id uuid not null references public.memberships(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (guardian_membership_id, child_membership_id),
  check (guardian_membership_id <> child_membership_id)
);

create index guardian_child_links_guardian_idx on public.guardian_child_links(guardian_membership_id);
create index guardian_child_links_child_idx on public.guardian_child_links(child_membership_id);

create or replace function public.can_act_for_membership(target_membership_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.memberships m
    where m.id=target_membership_id and m.profile_id=auth.uid() and m.status='active'
  ) or exists(
    select 1
    from public.guardian_child_links gcl
    join public.memberships guardian on guardian.id=gcl.guardian_membership_id
    join public.memberships child on child.id=gcl.child_membership_id
    where child.id=target_membership_id
      and guardian.profile_id=auth.uid()
      and guardian.status='active' and child.status='active'
  );
$$;

create or replace function public.set_guardian_child_link(
  target_guardian_membership_id uuid,
  target_child_membership_id uuid,
  should_link boolean
)
returns void language plpgsql security definer set search_path=public as $$
declare guardian public.memberships%rowtype; child public.memberships%rowtype; begin
  select * into guardian from public.memberships where id=target_guardian_membership_id;
  select * into child from public.memberships where id=target_child_membership_id;
  if guardian.id is null or child.id is null or guardian.club_id<>child.club_id then
    raise exception 'members must belong to the same club';
  end if;
  if guardian.id=child.id then raise exception 'a member cannot supervise themselves'; end if;
  if not public.has_club_role(guardian.club_id,array['club_admin','cohort_admin']::public.app_role[]) then
    raise exception 'insufficient permission';
  end if;
  if not exists(
    select 1 from public.team_memberships tm
    join public.team_membership_roles tmr on tmr.team_membership_id=tm.id
    where tm.membership_id=child.id and tmr.role='player'::public.app_role
  ) then raise exception 'child must have a player role'; end if;

  if should_link then
    insert into public.guardian_child_links(club_id,guardian_membership_id,child_membership_id,created_by)
    values(guardian.club_id,guardian.id,child.id,auth.uid()) on conflict do nothing;
    insert into public.membership_roles(membership_id,role)
    values(guardian.id,'guardian') on conflict do nothing;
  else
    delete from public.guardian_child_links
    where guardian_membership_id=guardian.id and child_membership_id=child.id;
  end if;
end; $$;

drop function if exists public.respond_to_event(uuid,text,text);
create function public.respond_to_event(
  target_event_id uuid,
  new_response text,
  response_note text default null,
  target_membership_id uuid default null
)
returns void language plpgsql security definer set search_path=public as $$
declare acting_membership_id uuid; begin
  if new_response not in ('yes','maybe','no') then raise exception 'invalid response'; end if;
  if target_membership_id is null then
    select m.id into acting_membership_id from public.events e
    join public.memberships m on m.club_id=e.club_id
    where e.id=target_event_id and m.profile_id=auth.uid() and m.status='active';
  else acting_membership_id:=target_membership_id; end if;
  if acting_membership_id is null or not public.can_act_for_membership(acting_membership_id) then
    raise exception 'membership not permitted';
  end if;
  if not exists(
    select 1 from public.event_teams et join public.team_memberships tm on tm.team_id=et.team_id
    where et.event_id=target_event_id and tm.membership_id=acting_membership_id
  ) then raise exception 'event is not assigned to this member'; end if;
  insert into public.event_responses(event_id,membership_id,response,note)
  values(target_event_id,acting_membership_id,new_response,nullif(trim(response_note),''))
  on conflict(event_id,membership_id) do update
  set response=excluded.response,note=excluded.note,responded_at=now();
end; $$;

alter table public.guardian_child_links enable row level security;
create policy guardian_child_links_select on public.guardian_child_links for select to authenticated using(
  public.has_club_role(club_id,array['club_admin','cohort_admin']::public.app_role[])
  or exists(select 1 from public.memberships m where m.id=guardian_membership_id and m.profile_id=auth.uid())
  or exists(select 1 from public.memberships m where m.id=child_membership_id and m.profile_id=auth.uid())
);

drop policy if exists event_responses_write_own on public.event_responses;
create policy event_responses_write_actor on public.event_responses for all to authenticated
using(public.can_act_for_membership(membership_id))
with check(public.can_act_for_membership(membership_id));

drop policy if exists training_tasks_select on public.training_tasks;
create policy training_tasks_select on public.training_tasks for select to authenticated using(
  public.can_act_for_membership(membership_id)
  or exists(select 1 from public.teams t where t.id=team_id and public.can_manage_teams(t.club_id,array[t.id]))
);

create or replace function public.set_training_task_status(target_task_id uuid, new_status text)
returns void language plpgsql security definer set search_path=public as $$
declare task public.training_tasks%rowtype; target_club_id uuid; begin
  select * into task from public.training_tasks where id=target_task_id for update;
  if task.id is null then raise exception 'task not found'; end if;
  if new_status not in ('open','partial','completed','unable') then raise exception 'invalid status'; end if;
  select club_id into target_club_id from public.teams where id=task.team_id;
  if not public.can_act_for_membership(task.membership_id)
    and not public.can_manage_teams(target_club_id,array[task.team_id]) then
    raise exception 'insufficient permission';
  end if;
  update public.training_tasks set status=new_status where id=target_task_id;
end; $$;

grant select on public.guardian_child_links to authenticated;
revoke all on function public.can_act_for_membership(uuid) from public;
grant execute on function public.can_act_for_membership(uuid) to authenticated;
revoke all on function public.set_guardian_child_link(uuid,uuid,boolean) from public;
grant execute on function public.set_guardian_child_link(uuid,uuid,boolean) to authenticated;
revoke all on function public.respond_to_event(uuid,text,text,uuid) from public;
grant execute on function public.respond_to_event(uuid,text,text,uuid) to authenticated;
revoke all on function public.set_training_task_status(uuid,text) from public;
grant execute on function public.set_training_task_status(uuid,text) to authenticated;
