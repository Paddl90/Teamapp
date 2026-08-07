create or replace function public.respond_to_event(
  target_event_id uuid,
  new_response text,
  response_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_membership_id uuid;
begin
  if new_response not in ('yes', 'maybe', 'no') then
    raise exception 'invalid response';
  end if;

  select m.id into target_membership_id
  from public.events e
  join public.memberships m on m.club_id = e.club_id
  where e.id = target_event_id and m.profile_id = auth.uid() and m.status = 'active';

  if target_membership_id is null then
    raise exception 'membership not found';
  end if;

  if not exists (
    select 1
    from public.event_teams et
    join public.team_memberships tm on tm.team_id = et.team_id
    where et.event_id = target_event_id and tm.membership_id = target_membership_id
  ) then
    raise exception 'event is not assigned to this member';
  end if;

  insert into public.event_responses (event_id, membership_id, response, note)
  values (target_event_id, target_membership_id, new_response, nullif(trim(response_note), ''))
  on conflict (event_id, membership_id) do update
  set response = excluded.response, note = excluded.note, responded_at = now();
end;
$$;

revoke all on function public.respond_to_event(uuid, text, text) from public;
grant execute on function public.respond_to_event(uuid, text, text) to authenticated;
