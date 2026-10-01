create table public.budget_settings (
 user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
 start_day integer not null default 1 check(start_day between 1 and 31)
);
alter table public.budget_settings enable row level security;
revoke all on public.budget_settings from anon;
grant select,insert,update on public.budget_settings to authenticated;
create policy "Own invited budget settings" on public.budget_settings for all to authenticated
 using(user_id=(select auth.uid()) and exists(select 1 from public.bolsillo_members where user_id=(select auth.uid())))
 with check(user_id=(select auth.uid()) and exists(select 1 from public.bolsillo_members where user_id=(select auth.uid())));
create function public.budget_date_at(p_month text,p_day integer) returns date language sql immutable security invoker set search_path='' as $$
 select (p_month||'-01')::date + (least(p_day,extract(day from (p_month||'-01')::date+interval '1 month'-interval '1 day')::integer)-1);
$$;
create function public.budget_month(p_date date,p_day integer) returns text language sql immutable security invoker set search_path='' as $$
 select case when p_day=1 or p_date<public.budget_date_at(to_char(p_date,'YYYY-MM'),p_day) then to_char(p_date,'YYYY-MM') else to_char(p_date+interval '1 month','YYYY-MM') end;
$$;
alter table public.entries add column budget_date date check(budget_date>=date '2000-01-01' and budget_date<=date '2100-12-31');
alter table public.entries drop constraint entries_check;
update public.entries set budget_date=payment_date where debt_id is not null and not is_debt_balance;
create function public.assign_budget_period() returns trigger language plpgsql security invoker set search_path='' as $$
declare day integer;
begin
 select coalesce((select start_day from public.budget_settings where user_id=new.user_id),1) into day;
 if new.debt_id is not null and not new.is_debt_balance then new.budget_date:=new.payment_date; end if;
 if new.budget_date is not null then new.month:=public.budget_month(new.budget_date,day); end if;
 return new;
end $$;
create trigger a_assign_budget_period before insert or update on public.entries for each row execute function public.assign_budget_period();
revoke all on function public.assign_budget_period() from public,anon,authenticated;
create function public.set_budget_start_day(p_day integer) returns void language plpgsql security invoker set search_path='' as $$
declare links jsonb; item jsonb;
begin
 if p_day is null or p_day<1 or p_day>31 then raise exception 'Día inválido.';end if;
 insert into public.budget_settings(user_id,start_day) values(auth.uid(),p_day) on conflict(user_id) do update set start_day=excluded.start_day;
 perform 1 from public.entries where user_id=(select auth.uid()) for update;
 if exists(select 1 from public.entries where user_id=(select auth.uid()) group by coalesce(source_id,id),case when coalesce(budget_date,case when kind='expense' and not paid then due_date end) is null then month else public.budget_month(coalesce(budget_date,case when kind='expense' and not paid then due_date end),p_day) end having count(*)>1) then
 raise exception 'Dos copias de un pago fijo quedarían en el mismo período. Revisa sus fechas antes de cambiar el corte.';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'source',source_id)),'[]'::jsonb) into links from public.entries where user_id=(select auth.uid()) and source_id is not null and (budget_date is not null or (kind='expense' and not paid and due_date is not null));
 update public.entries set source_id=null,version=version+1 where user_id=(select auth.uid()) and source_id is not null and (budget_date is not null or (kind='expense' and not paid and due_date is not null));
 update public.entries set budget_date=due_date,version=version+1 where user_id=(select auth.uid()) and budget_date is null and kind='expense' and not paid and due_date is not null;
 update public.entries set month=public.budget_month(budget_date,p_day),version=version+1 where user_id=(select auth.uid()) and budget_date is not null and month<>public.budget_month(budget_date,p_day);
 for item in select value from jsonb_array_elements(links) loop
 update public.entries set source_id=(item->>'source')::uuid where id=(item->>'id')::uuid;
 end loop;
end $$;
revoke all on function public.set_budget_start_day(integer) from public,anon;
grant execute on function public.set_budget_start_day(integer) to authenticated;

create or replace function public.ensure_monthly_payments(p_month text) returns void
language plpgsql security invoker set search_path='' as $$
declare day integer; start_date date; next_date date;
begin
 if p_month is null or p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' or p_month<'2000-01' or p_month>'2100-12' then raise exception 'Mes inválido.'; end if;
 select coalesce((select start_day from public.budget_settings where user_id=(select auth.uid())),1) into day;
 start_date:=case when day=1 then (p_month||'-01')::date else public.budget_date_at(to_char((p_month||'-01')::date-interval '1 month','YYYY-MM'),day) end;
 next_date:=case when day=1 then (p_month||'-01')::date+interval '1 month' else public.budget_date_at(p_month,day) end;
 insert into public.entries(user_id,source_id,month,kind,title,amount,category,notes,paid,recurring,due_date,budget_date)
 select r.user_id,r.source_id,p_month,'expense',r.title,r.amount,r.category,r.notes,false,true,x.due,coalesce(x.due,start_date)
 from public.monthly_payments r cross join lateral (select case when r.due_day is null then null when public.budget_date_at(p_month,r.due_day)<next_date then public.budget_date_at(p_month,r.due_day) else public.budget_date_at(to_char(start_date,'YYYY-MM'),r.due_day) end due) x
 where r.user_id=(select auth.uid()) and r.active and r.start_month<p_month
 and not exists(select 1 from public.entries e where e.user_id=r.user_id and e.month=p_month and coalesce(e.source_id,e.id)=r.source_id)
 on conflict(user_id,month,source_id) do nothing;
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
 or public.budget_month(new.payment_date,coalesce((select start_day from public.budget_settings where user_id=new.user_id),1))<>new.month then raise exception 'Abono inválido.'; end if;
 select coalesce(sum(amount),0) into used from public.entries where debt_id=new.debt_id and not is_debt_balance and id<>new.id;
 select coalesce(sum(amount),0) into charged from public.card_charges where debt_id=new.debt_id;
 if used+new.amount>d.amount+charged then raise exception 'El abono supera el saldo pendiente.'; end if;
 return new;
end $$;
