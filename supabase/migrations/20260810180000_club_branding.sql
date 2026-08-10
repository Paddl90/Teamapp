alter table public.clubs add column primary_color text not null default '#2563eb' check(primary_color ~ '^#[0-9A-Fa-f]{6}$');
alter table public.clubs add column accent_color text not null default '#16865b' check(accent_color ~ '^#[0-9A-Fa-f]{6}$');

create or replace function public.update_club_branding(target_club_id uuid,new_primary_color text,new_accent_color text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.has_club_role(target_club_id,array['club_admin']::public.app_role[]) then raise exception 'insufficient permission'; end if;
  if new_primary_color !~ '^#[0-9A-Fa-f]{6}$' or new_accent_color !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'invalid color'; end if;
  update public.clubs set primary_color=lower(new_primary_color),accent_color=lower(new_accent_color) where id=target_club_id;
end;
$$;

revoke all on function public.update_club_branding(uuid,text,text) from public;
grant execute on function public.update_club_branding(uuid,text,text) to authenticated;
