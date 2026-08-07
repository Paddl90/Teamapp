create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.memberships(id) on delete cascade,
  category text not null check (category in ('event','lineup','training','penalty')),
  title text not null check (char_length(title) between 2 and 160),
  body text not null check (char_length(body) between 2 and 500),
  href text not null check (href in ('/events','/matchday','/training','/funds')),
  dedupe_key text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (membership_id,dedupe_key)
);
create index notifications_member_unread_idx on public.notifications(membership_id,read_at,created_at desc);

create or replace function public.notify_event_team() returns trigger language plpgsql security definer set search_path=public as $$
declare event_row public.events%rowtype; begin
  select * into event_row from public.events where id=new.event_id;
  insert into public.notifications(membership_id,category,title,body,href,dedupe_key,created_at)
  select distinct tm.membership_id,'event','Neuer Termin',event_row.title||' · '||to_char(event_row.starts_at at time zone 'Europe/Berlin','DD.MM.YYYY HH24:MI'),'/events','event:'||event_row.id,event_row.created_at
  from public.team_memberships tm where tm.team_id=new.team_id
  on conflict(membership_id,dedupe_key) do nothing;
  return new;
end; $$;

create or replace function public.notify_lineup_entry() returns trigger language plpgsql security definer set search_path=public as $$
declare plan public.match_plans%rowtype; event_title text; begin
  select * into plan from public.match_plans where id=new.match_plan_id;
  if plan.status='published' then
    select title into event_title from public.events where id=plan.event_id;
    insert into public.notifications(membership_id,category,title,body,href,dedupe_key)
    values(new.membership_id,'lineup','Neue Nominierung',event_title||' · '||plan.opponent,'/matchday','lineup:'||plan.id)
    on conflict(membership_id,dedupe_key) do nothing;
  end if; return new;
end; $$;

create or replace function public.notify_training_task() returns trigger language plpgsql security definer set search_path=public as $$ begin
  insert into public.notifications(membership_id,category,title,body,href,dedupe_key,created_at)
  values(new.membership_id,'training','Neue Trainingsvorgabe',new.title||' · fällig bis '||to_char(new.due_on,'DD.MM.YYYY'),'/training','training:'||new.id,new.created_at)
  on conflict(membership_id,dedupe_key) do nothing; return new;
end; $$;

create or replace function public.notify_member_penalty() returns trigger language plpgsql security definer set search_path=public as $$ begin
  insert into public.notifications(membership_id,category,title,body,href,dedupe_key,created_at)
  values(new.membership_id,'penalty','Neue Strafe',new.title||' · '||to_char(new.amount_cents/100.0,'FM999990D00')||' €','/funds','penalty:'||new.id,new.assigned_at)
  on conflict(membership_id,dedupe_key) do nothing; return new;
end; $$;

create trigger event_team_notification after insert on public.event_teams for each row execute function public.notify_event_team();
create trigger lineup_entry_notification after insert on public.match_squad_entries for each row execute function public.notify_lineup_entry();
create trigger training_task_notification after insert on public.training_tasks for each row execute function public.notify_training_task();
create trigger member_penalty_notification after insert on public.member_penalties for each row execute function public.notify_member_penalty();

create or replace function public.mark_notification_read(target_notification_id uuid)
returns void language plpgsql security definer set search_path=public as $$ begin
  update public.notifications n set read_at=coalesce(read_at,now())
  where n.id=target_notification_id and exists(select 1 from public.memberships m where m.id=n.membership_id and m.profile_id=auth.uid());
end; $$;
create or replace function public.mark_all_notifications_read(target_club_id uuid)
returns void language plpgsql security definer set search_path=public as $$ begin
  update public.notifications n set read_at=coalesce(read_at,now()) where exists(
    select 1 from public.memberships m where m.id=n.membership_id and m.club_id=target_club_id and m.profile_id=auth.uid()
  );
end; $$;

alter table public.notifications enable row level security;
create policy notifications_select_own on public.notifications for select to authenticated using(exists(select 1 from public.memberships m where m.id=membership_id and m.profile_id=auth.uid()));
grant select on public.notifications to authenticated;
revoke all on function public.mark_notification_read(uuid) from public;
revoke all on function public.mark_all_notifications_read(uuid) from public;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.mark_all_notifications_read(uuid) to authenticated;

insert into public.notifications(membership_id,category,title,body,href,dedupe_key,created_at)
select tt.membership_id,'training','Neue Trainingsvorgabe',tt.title||' · fällig bis '||to_char(tt.due_on,'DD.MM.YYYY'),'/training','training:'||tt.id,tt.created_at from public.training_tasks tt on conflict do nothing;
insert into public.notifications(membership_id,category,title,body,href,dedupe_key,created_at)
select mpse.membership_id,'lineup','Neue Nominierung',e.title||' · '||mp.opponent,'/matchday','lineup:'||mp.id,mp.created_at from public.match_squad_entries mpse join public.match_plans mp on mp.id=mpse.match_plan_id join public.events e on e.id=mp.event_id where mp.status='published' on conflict do nothing;
insert into public.notifications(membership_id,category,title,body,href,dedupe_key,created_at)
select p.membership_id,'penalty','Neue Strafe',p.title||' · '||to_char(p.amount_cents/100.0,'FM999990D00')||' €','/funds','penalty:'||p.id,p.assigned_at from public.member_penalties p on conflict do nothing;
insert into public.notifications(membership_id,category,title,body,href,dedupe_key,created_at)
select distinct tm.membership_id,'event','Neuer Termin',e.title||' · '||to_char(e.starts_at at time zone 'Europe/Berlin','DD.MM.YYYY HH24:MI'),'/events','event:'||e.id,e.created_at from public.events e join public.event_teams et on et.event_id=e.id join public.team_memberships tm on tm.team_id=et.team_id on conflict do nothing;
