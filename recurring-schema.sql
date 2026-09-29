-- Fixed monthly payments, materialized on opening a month. No scheduler needed.
create table public.monthly_payments (
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 source_id uuid not null,
 title text not null check(char_length(trim(title)) between 1 and 120),
 amount bigint not null check(amount between 1 and 999999999999),
 category text not null check(char_length(category)<=80),
 notes text not null default '' check(char_length(notes)<=1000),
 due_day integer check(due_day between 1 and 31),
 start_month text not null check(start_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
 active boolean not null default true,
 primary key(user_id,source_id)
);
alter table public.monthly_payments enable row level security;
revoke all on public.monthly_payments from anon;
grant select,insert,update on public.monthly_payments to authenticated;
create policy "Own invited monthly payments" on public.monthly_payments for all to authenticated
 using(user_id=(select auth.uid()) and exists(select 1 from public.bolsillo_members where user_id=(select auth.uid())))
 with check(user_id=(select auth.uid()) and exists(select 1 from public.bolsillo_members where user_id=(select auth.uid())));

insert into public.monthly_payments(user_id,source_id,title,amount,category,notes,due_day,start_month,active)
select user_id,series,title,amount,category,notes,extract(day from due_date)::integer,first_month,recurring
from (
 select distinct on(user_id,coalesce(source_id,id)) *,coalesce(source_id,id) series,
 min(month) over(partition by user_id,coalesce(source_id,id)) first_month
 from public.entries where kind='expense' and debt_id is null and not is_debt_balance
 order by user_id,coalesce(source_id,id),month desc,created_at desc
) e;

create function public.sync_monthly_payment() returns trigger
language plpgsql security invoker set search_path='' as $$
declare series uuid;
begin
 if TG_OP='DELETE' then
  update public.monthly_payments set active=false where user_id=old.user_id and source_id=coalesce(old.source_id,old.id);
  return old;
 end if;
 if new.kind<>'expense' or new.debt_id is not null or new.is_debt_balance then return new; end if;
 series:=coalesce(new.source_id,new.id);
 -- Generated copies must not overwrite the original day (31 -> 28 -> 31).
 if TG_OP='INSERT' and new.source_id is not null and exists(select 1 from public.monthly_payments where user_id=new.user_id and source_id=series) then return new; end if;
 -- Checking a payment does not edit its recurrence settings.
 if TG_OP='UPDATE' and row(new.title,new.amount,new.category,new.notes,new.due_date,new.recurring)
  is not distinct from row(old.title,old.amount,old.category,old.notes,old.due_date,old.recurring) then return new; end if;
 insert into public.monthly_payments(user_id,source_id,title,amount,category,notes,due_day,start_month,active)
 values(new.user_id,series,new.title,new.amount,new.category,new.notes,extract(day from new.due_date)::integer,new.month,new.recurring)
 on conflict(user_id,source_id) do update set title=excluded.title,amount=excluded.amount,category=excluded.category,
 notes=excluded.notes,active=excluded.active,
 due_day=case when TG_OP='UPDATE' and new.due_date is not distinct from old.due_date then public.monthly_payments.due_day else excluded.due_day end;
 return new;
end $$;
create trigger sync_monthly_payment after insert or update or delete on public.entries for each row execute function public.sync_monthly_payment();
revoke all on function public.sync_monthly_payment() from public,anon,authenticated;

create function public.ensure_monthly_payments(p_month text) returns void
language plpgsql security invoker set search_path='' as $$
declare first_day date; last_day integer;
begin
 if p_month is null or p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' or p_month<'2000-01' or p_month>'2100-12' then raise exception 'Mes inválido.'; end if;
 first_day:=(p_month||'-01')::date;
 last_day:=extract(day from first_day+interval '1 month'-interval '1 day')::integer;
 insert into public.entries(user_id,source_id,month,kind,title,amount,category,notes,paid,recurring,due_date)
 select r.user_id,r.source_id,p_month,'expense',r.title,r.amount,r.category,r.notes,false,true,
 case when r.due_day is null then null else first_day+(least(r.due_day,last_day)-1) end
 from public.monthly_payments r where r.user_id=(select auth.uid()) and r.active and r.start_month<p_month
 and not exists(select 1 from public.entries e where e.user_id=r.user_id and e.month=p_month and coalesce(e.source_id,e.id)=r.source_id)
 on conflict(user_id,month,source_id) do nothing;
end $$;
revoke all on function public.ensure_monthly_payments(text) from public,anon;
grant execute on function public.ensure_monthly_payments(text) to authenticated;
