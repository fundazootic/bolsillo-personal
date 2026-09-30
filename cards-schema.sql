-- Card purchases increase debt, while repayments remain cash expenses.
alter table public.debt_accounts add column account_type text not null default 'debt' check(account_type in ('debt','card'));
alter table public.debt_accounts drop constraint debt_accounts_amount_check;
alter table public.debt_accounts add constraint debt_accounts_amount_check check(amount between 0 and 999999999999);
create table public.card_charges (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 debt_id uuid not null,
 amount bigint not null check(amount between 1 and 999999999999),
 charge_date date not null check(charge_date>=date '2000-01-01'),
 description text not null check(char_length(trim(description)) between 1 and 120),
 charge_type text not null default 'purchase' check(charge_type in ('purchase','fee')),
 version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(),
 foreign key(debt_id,user_id) references public.debt_accounts(id,user_id)
);
create index card_charges_owner_debt on public.card_charges(user_id,debt_id);
create index card_charges_debt on public.card_charges(debt_id);
alter table public.card_charges enable row level security;
revoke all on public.card_charges from anon;
grant select,insert,update on public.card_charges to authenticated;
create policy "Own invited card charges" on public.card_charges for all to authenticated
 using(user_id=(select auth.uid()) and exists(select 1 from public.bolsillo_members where user_id=(select auth.uid())))
 with check(user_id=(select auth.uid()) and exists(select 1 from public.bolsillo_members where user_id=(select auth.uid())));

create function public.validate_card_charge() returns trigger
language plpgsql security invoker set search_path='' as $$
declare d public.debt_accounts; charged bigint; paid bigint;
begin
 if TG_OP='UPDATE' and (new.debt_id<>old.debt_id or new.user_id<>old.user_id) then raise exception 'No se puede cambiar la tarjeta de una compra.'; end if;
 select * into d from public.debt_accounts where id=new.debt_id and user_id=new.user_id for update;
 if not found or d.account_type<>'card' then raise exception 'Tarjeta no disponible.'; end if;
 if new.charge_date>(now() at time zone 'America/Bogota')::date then raise exception 'La fecha no puede ser futura.'; end if;
 select coalesce(sum(amount),0) into charged from public.card_charges where debt_id=d.id and id<>new.id;
 select coalesce(sum(amount),0) into paid from public.entries where debt_id=d.id and not is_debt_balance;
 if d.amount+charged+new.amount<paid then raise exception 'La corrección dejaría los abonos por encima de la deuda.'; end if;
 return new;
end $$;
create trigger validate_card_charge before insert or update on public.card_charges for each row execute function public.validate_card_charge();
revoke all on function public.validate_card_charge() from public,anon,authenticated;

create or replace function public.validate_debt_amount() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if new.amount+(select coalesce(sum(amount),0) from public.card_charges where debt_id=new.id)
 <(select coalesce(sum(amount),0) from public.entries where debt_id=new.id and not is_debt_balance) then
 raise exception 'El total no puede ser menor que los abonos registrados.'; end if;
 if new.account_type<>'card' and exists(select 1 from public.card_charges where debt_id=new.id) then raise exception 'Esta tarjeta ya tiene compras registradas.'; end if;
 return new;
end $$;

create or replace function public.validate_debt_entry() returns trigger
language plpgsql security invoker set search_path='' as $$
declare d public.debt_accounts; used bigint; charged bigint;
begin
 if TG_OP='UPDATE' and (old.debt_id is distinct from new.debt_id or old.is_debt_balance is distinct from new.is_debt_balance) then raise exception 'No se puede cambiar el vínculo de una deuda.'; end if;
 if new.is_debt_balance then
  if TG_OP='INSERT' then raise exception 'Registro reservado.'; end if;
  return new;
 end if;
 if new.debt_id is null then return new; end if;
 select * into d from public.debt_accounts where id=new.debt_id and user_id=new.user_id for update;
 if not found then raise exception 'Deuda no disponible.'; end if;
 if new.kind<>'expense' or not new.paid or new.recurring or new.category<>'Deudas'
 or new.payment_date is null or new.payment_date<date '2000-01-01'
 or new.payment_date>(now() at time zone 'America/Bogota')::date
 or to_char(new.payment_date,'YYYY-MM')<>new.month then raise exception 'Abono inválido.'; end if;
 select coalesce(sum(amount),0) into used from public.entries where debt_id=new.debt_id and not is_debt_balance and id<>new.id;
 select coalesce(sum(amount),0) into charged from public.card_charges where debt_id=new.debt_id;
 if used+new.amount>d.amount+charged then raise exception 'El abono supera el saldo pendiente.'; end if;
 return new;
end $$;

create function public.add_card_charge(p_id uuid,p_debt uuid,p_amount bigint,p_date date,p_description text,p_type text default 'purchase') returns uuid
language plpgsql security invoker set search_path='' as $$
declare d public.debt_accounts; previous public.card_charges;
begin
 select * into d from public.debt_accounts where id=p_debt and user_id=(select auth.uid()) for update;
 if not found or d.account_type<>'card' then raise exception 'Tarjeta no disponible.'; end if;
 select * into previous from public.card_charges where id=p_id;
 if found then
  if previous.debt_id=p_debt and previous.amount=p_amount and previous.charge_date=p_date and previous.description=p_description and previous.charge_type=p_type then return p_id; end if;
  raise exception 'Solicitud distinta: actualiza antes de reintentar.';
 end if;
 insert into public.card_charges(id,user_id,debt_id,amount,charge_date,description,charge_type)
 values(p_id,auth.uid(),p_debt,p_amount,p_date,p_description,p_type);
 return p_id;
end $$;
revoke all on function public.add_card_charge(uuid,uuid,bigint,date,text,text) from public,anon;
grant execute on function public.add_card_charge(uuid,uuid,bigint,date,text,text) to authenticated;
