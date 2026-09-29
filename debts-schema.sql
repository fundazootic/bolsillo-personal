-- Persistent debts; payments are ordinary paid entries, counted once in their month.
create table public.debt_accounts (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 title text not null check(char_length(trim(title)) between 1 and 120),
 amount bigint not null check(amount between 1 and 999999999999),
 monthly_payment bigint check(monthly_payment between 1 and 999999999999),
 notes text not null default '' check(char_length(notes)<=1000),
 version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(),
 unique(id,user_id)
);
create index debt_accounts_owner on public.debt_accounts(user_id);
alter table public.debt_accounts enable row level security;
revoke all on public.debt_accounts from anon;
grant select,insert,update on public.debt_accounts to authenticated;
create policy "Own invited debts" on public.debt_accounts for all to authenticated
 using(user_id=(select auth.uid()) and exists(select 1 from public.bolsillo_members where user_id=(select auth.uid())))
 with check(user_id=(select auth.uid()) and exists(select 1 from public.bolsillo_members where user_id=(select auth.uid())));
alter table public.entries add column debt_id uuid,
 add column is_debt_balance boolean not null default false,
 add column payment_date date;
alter table public.entries add constraint entries_debt_owner foreign key(debt_id,user_id) references public.debt_accounts(id,user_id);
create index entries_debt on public.entries(debt_id) where debt_id is not null;
-- Preserve all existing debt records. Pending principal is retained as an archive,
-- not a monthly outgoing payment; already-paid debt entries remain counted.
insert into public.debt_accounts(id,user_id,title,amount,notes,created_at)
 select id,user_id,title,amount,notes,created_at from public.entries where kind='expense' and category='Deudas';
update public.entries set debt_id=id,is_debt_balance=not paid,recurring=false,
 payment_date=case when paid then coalesce(due_date,(month||'-01')::date) else null end
 where kind='expense' and category='Deudas';
create function public.validate_debt_entry() returns trigger
 language plpgsql security invoker set search_path='' as $$
 declare d public.debt_accounts; used bigint;
 begin
 if TG_OP='UPDATE' and (old.debt_id is distinct from new.debt_id or old.is_debt_balance is distinct from new.is_debt_balance) then
 raise exception 'No se puede cambiar el vínculo de una deuda.'; end if;
 if new.is_debt_balance then
 if TG_OP='INSERT' then raise exception 'Registro reservado.'; end if;
 return new; end if;
 if new.debt_id is null then return new; end if;
 select * into d from public.debt_accounts where id=new.debt_id and user_id=new.user_id for update;
 if not found then raise exception 'Deuda no disponible.'; end if;
 if new.kind<>'expense' or not new.paid or new.recurring or new.category<>'Deudas'
 or new.payment_date is null or new.payment_date < date '2000-01-01'
 or new.payment_date > (now() at time zone 'America/Bogota')::date
 or to_char(new.payment_date,'YYYY-MM')<>new.month then
 raise exception 'Abono inválido.'; end if;
 select coalesce(sum(amount),0) into used from public.entries where debt_id=new.debt_id and not is_debt_balance and id<>new.id;
 if used+new.amount>d.amount then raise exception 'El abono supera el saldo pendiente.'; end if;
 return new;
 end $$;
create trigger validate_debt_entry before insert or update on public.entries for each row execute function public.validate_debt_entry();
create function public.validate_debt_amount() returns trigger
 language plpgsql security invoker set search_path='' as $$
 begin
 if new.amount < (select coalesce(sum(amount),0) from public.entries where debt_id=new.id and not is_debt_balance) then
 raise exception 'El total no puede ser menor que los abonos registrados.'; end if;
 return new;
 end $$;
create trigger validate_debt_amount before update on public.debt_accounts for each row execute function public.validate_debt_amount();
revoke all on function public.validate_debt_entry(), public.validate_debt_amount() from public,anon,authenticated;
create function public.add_debt_payment(p_id uuid,p_debt uuid,p_amount bigint,p_date date,p_notes text default '') returns uuid
 language plpgsql security invoker set search_path='' as $$
 declare d public.debt_accounts; previous public.entries;
 begin
 select * into d from public.debt_accounts where id=p_debt and user_id=(select auth.uid()) for update;
 if not found then raise exception 'Deuda no disponible.'; end if;
 select * into previous from public.entries where id=p_id;
 if found then
 if previous.debt_id=p_debt and previous.amount=p_amount and previous.payment_date=p_date and previous.notes=p_notes then return p_id; end if;
 raise exception 'Solicitud distinta: actualiza antes de reintentar.';
 end if;
 insert into public.entries(id,user_id,month,kind,title,amount,category,paid,recurring,notes,debt_id,payment_date)
 values(p_id,auth.uid(),to_char(p_date,'YYYY-MM'),'expense',d.title,p_amount,'Deudas',true,false,p_notes,p_debt,p_date);
 return p_id;
 end $$;
revoke all on function public.add_debt_payment(uuid,uuid,bigint,date,text) from public,anon;
grant execute on function public.add_debt_payment(uuid,uuid,bigint,date,text) to authenticated;
