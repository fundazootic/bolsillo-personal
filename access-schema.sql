-- Invitation-based username accounts. No real email addresses or mail provider.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;
create table private.bolsillo_access (
 code_hash text primary key check (code_hash ~ '^[a-f0-9]{64}$'),
 username text unique check (username ~ '^[a-z0-9_]{3,30}$'),
 user_id uuid unique references auth.users(id) on delete cascade,
 claim uuid,
 claimed_at timestamptz,
 created_at timestamptz not null default now()
);
alter table private.bolsillo_access enable row level security;
grant all on private.bolsillo_access to service_role;
create table public.bolsillo_members (
 user_id uuid primary key references auth.users(id) on delete cascade,
 username text unique not null
);
alter table public.bolsillo_members enable row level security;
revoke all on public.bolsillo_members from anon,authenticated;
grant select on public.bolsillo_members to authenticated;
grant all on public.bolsillo_members to service_role;
create policy "Read own membership" on public.bolsillo_members for select to authenticated using (user_id=(select auth.uid()));

create function public.bolsillo_claim(p_hash text,p_username text,p_claim uuid) returns void
language plpgsql security invoker set search_path='' as $$
declare v private.bolsillo_access;
begin
 select * into v from private.bolsillo_access where code_hash=p_hash for update;
 if not found or v.user_id is not null then raise exception 'INVALID_CODE'; end if;
 if v.claim is not null and v.claimed_at > now()-interval '5 minutes' then raise exception 'BUSY'; end if;
 update private.bolsillo_access set username=p_username,claim=p_claim,claimed_at=now() where code_hash=p_hash;
end $$;
create function public.bolsillo_finish(p_hash text,p_claim uuid,p_user uuid) returns void
language plpgsql security invoker set search_path='' as $$
declare v private.bolsillo_access;
begin
 select * into v from private.bolsillo_access where code_hash=p_hash and claim=p_claim and user_id is null for update;
 if not found then raise exception 'INVALID_CLAIM'; end if;
 insert into public.bolsillo_members(user_id,username) values(p_user,v.username);
 update private.bolsillo_access set user_id=p_user,claim=null,claimed_at=null where code_hash=p_hash;
end $$;
create function public.bolsillo_release(p_hash text,p_claim uuid) returns void
language sql security invoker set search_path='' as $$
 update private.bolsillo_access set username=null,claim=null,claimed_at=null where code_hash=p_hash and claim=p_claim and user_id is null;
$$;
create function public.bolsillo_recovery(p_hash text) returns table(user_id uuid,username text)
language sql security invoker set search_path='' as $$
 select a.user_id,a.username from private.bolsillo_access a where a.code_hash=p_hash and a.user_id is not null;
$$;
revoke all on function public.bolsillo_claim(text,text,uuid),public.bolsillo_finish(text,uuid,uuid),public.bolsillo_release(text,uuid),public.bolsillo_recovery(text) from public,anon,authenticated;
grant execute on function public.bolsillo_claim(text,text,uuid),public.bolsillo_finish(text,uuid,uuid),public.bolsillo_release(text,uuid),public.bolsillo_recovery(text) to service_role;

drop policy "Only my entries" on public.entries;
create policy "Only invited owner" on public.entries for all to authenticated
 using ((select auth.uid())=user_id and exists(select 1 from public.bolsillo_members where user_id=(select auth.uid())))
 with check ((select auth.uid())=user_id and exists(select 1 from public.bolsillo_members where user_id=(select auth.uid())));
create policy "No browser access" on private.bolsillo_access for all to authenticated using (false) with check (false);
