create table public.penalty_catalog (
  id uuid primary key default gen_random_uuid(), team_id uuid not null references public.teams(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 120), amount_cents integer not null check (amount_cents between 0 and 1000000),
  active boolean not null default true, created_at timestamptz not null default now()
);
create table public.member_penalties (
  id uuid primary key default gen_random_uuid(), team_id uuid not null references public.teams(id) on delete cascade,
  membership_id uuid not null references public.memberships(id) on delete cascade, catalog_id uuid references public.penalty_catalog(id) on delete set null,
  title text not null, amount_cents integer not null check (amount_cents >= 0), status text not null default 'open' check (status in ('open','paid','waived')),
  note text, assigned_by uuid not null references public.profiles(id), assigned_at timestamptz not null default now(), settled_at timestamptz
);
create table public.team_cash_entries (
  id uuid primary key default gen_random_uuid(), team_id uuid not null references public.teams(id) on delete cascade,
  membership_id uuid references public.memberships(id) on delete set null, penalty_id uuid references public.member_penalties(id) on delete set null,
  entry_type text not null check (entry_type in ('income','expense','penalty_payment')),
  amount_cents integer not null check (amount_cents <> 0), description text not null check (char_length(description) between 2 and 180),
  booked_by uuid not null references public.profiles(id), booked_at timestamptz not null default now()
);
create index member_penalties_team_status_idx on public.member_penalties(team_id,status);
create index team_cash_entries_team_date_idx on public.team_cash_entries(team_id,booked_at);

create or replace function public.create_penalty_catalog_item(target_team_id uuid, item_title text, item_amount_cents integer)
returns uuid language plpgsql security definer set search_path=public as $$
declare target_club_id uuid; new_id uuid; begin
 select club_id into target_club_id from public.teams where id=target_team_id;
 if not public.can_manage_teams(target_club_id,array[target_team_id]) then raise exception 'insufficient permission'; end if;
 insert into public.penalty_catalog(team_id,title,amount_cents) values(target_team_id,trim(item_title),item_amount_cents) returning id into new_id; return new_id;
end; $$;
create or replace function public.assign_member_penalty(target_team_id uuid,target_membership_id uuid,target_catalog_id uuid,penalty_note text)
returns uuid language plpgsql security definer set search_path=public as $$
declare target_club_id uuid; item public.penalty_catalog%rowtype; new_id uuid; begin
 select club_id into target_club_id from public.teams where id=target_team_id;
 if not public.can_manage_teams(target_club_id,array[target_team_id]) then raise exception 'insufficient permission'; end if;
 select * into item from public.penalty_catalog where id=target_catalog_id and team_id=target_team_id and active;
 if item.id is null then raise exception 'catalog item not found'; end if;
 if not exists(select 1 from public.team_memberships where team_id=target_team_id and membership_id=target_membership_id) then raise exception 'member not assigned to team'; end if;
 insert into public.member_penalties(team_id,membership_id,catalog_id,title,amount_cents,note,assigned_by)
 values(target_team_id,target_membership_id,item.id,item.title,item.amount_cents,nullif(trim(penalty_note),''),auth.uid()) returning id into new_id; return new_id;
end; $$;
create or replace function public.settle_member_penalty(target_penalty_id uuid,new_status text)
returns void language plpgsql security definer set search_path=public as $$
declare penalty public.member_penalties%rowtype; target_club_id uuid; begin
 select * into penalty from public.member_penalties where id=target_penalty_id for update;
 select club_id into target_club_id from public.teams where id=penalty.team_id;
 if not public.can_manage_teams(target_club_id,array[penalty.team_id]) then raise exception 'insufficient permission'; end if;
 if penalty.status <> 'open' or new_status not in ('paid','waived') then raise exception 'invalid settlement'; end if;
 update public.member_penalties set status=new_status,settled_at=now() where id=target_penalty_id;
 if new_status='paid' then insert into public.team_cash_entries(team_id,membership_id,penalty_id,entry_type,amount_cents,description,booked_by)
 values(penalty.team_id,penalty.membership_id,penalty.id,'penalty_payment',penalty.amount_cents,penalty.title,auth.uid()); end if;
end; $$;
create or replace function public.book_team_cash_entry(target_team_id uuid,target_entry_type text,target_amount_cents integer,target_description text)
returns uuid language plpgsql security definer set search_path=public as $$
declare target_club_id uuid; new_id uuid; signed_amount integer; begin
 select club_id into target_club_id from public.teams where id=target_team_id;
 if not public.can_manage_teams(target_club_id,array[target_team_id]) then raise exception 'insufficient permission'; end if;
 if target_entry_type not in ('income','expense') then raise exception 'invalid entry type'; end if;
 signed_amount:=case when target_entry_type='expense' then -abs(target_amount_cents) else abs(target_amount_cents) end;
 insert into public.team_cash_entries(team_id,entry_type,amount_cents,description,booked_by) values(target_team_id,target_entry_type,signed_amount,trim(target_description),auth.uid()) returning id into new_id; return new_id;
end; $$;

alter table public.penalty_catalog enable row level security; alter table public.member_penalties enable row level security; alter table public.team_cash_entries enable row level security;
create policy penalty_catalog_select on public.penalty_catalog for select to authenticated using(exists(select 1 from public.teams t where t.id=team_id and public.is_club_member(t.club_id)));
create policy member_penalties_select on public.member_penalties for select to authenticated using(exists(select 1 from public.teams t where t.id=team_id and public.is_club_member(t.club_id)));
create policy team_cash_entries_select on public.team_cash_entries for select to authenticated using(exists(select 1 from public.teams t where t.id=team_id and public.is_club_member(t.club_id)));
grant select on public.penalty_catalog,public.member_penalties,public.team_cash_entries to authenticated;
revoke all on function public.create_penalty_catalog_item(uuid,text,integer),public.assign_member_penalty(uuid,uuid,uuid,text),public.settle_member_penalty(uuid,text),public.book_team_cash_entry(uuid,text,integer,text) from public;
grant execute on function public.create_penalty_catalog_item(uuid,text,integer),public.assign_member_penalty(uuid,uuid,uuid,text),public.settle_member_penalty(uuid,text),public.book_team_cash_entry(uuid,text,integer,text) to authenticated;
