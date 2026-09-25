-- Execute once in the SQL editor of your own Supabase project.
create table public.entries (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 month text not null check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
 kind text not null check (kind in ('income','expense','allocation')),
 title text not null check (char_length(trim(title)) between 1 and 120),
 amount bigint not null check (amount between 1 and 999999999999),
 category text not null default 'Otros' check (char_length(category) <= 80),
 notes text not null default '' check (char_length(notes) <= 1000),
 paid boolean not null default false,
 recurring boolean not null default false,
 due_date date,
 source_id uuid,
 version integer not null default 1 check (version > 0),
 created_at timestamptz not null default now(),
 check (due_date is null or to_char(due_date, 'YYYY-MM') = month),
 check (kind = 'expense' or paid = false),
 unique (user_id, month, source_id)
);
create index entries_user_month on public.entries(user_id,month);
alter table public.entries enable row level security;
create policy "Only my entries" on public.entries for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.entries from anon;
grant select,insert,update,delete on public.entries to authenticated;
