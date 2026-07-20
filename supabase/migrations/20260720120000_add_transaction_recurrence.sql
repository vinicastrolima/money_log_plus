-- Regras de recorrência para entradas e saídas.
create table if not exists public.recurrence_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  start_date date not null,
  generated_until date,
  active boolean not null default true,
  description text not null default '',
  amount numeric(14, 2) not null check (amount > 0),
  direction text not null check (direction in ('in', 'out')),
  category_id uuid references public.categories (id) on delete set null,
  type text not null default 'prevista' check (type in ('prevista', 'diaria')),
  rule jsonb not null check (jsonb_typeof(rule) = 'object'),
  created_at timestamptz not null default now()
);

alter table public.transactions
  add column if not exists recurrence_id uuid
  references public.recurrence_rules (id) on delete cascade;

create index if not exists recurrence_rules_user_idx
  on public.recurrence_rules (user_id);

create unique index if not exists transactions_recurrence_date_idx
  on public.transactions (recurrence_id, date) where recurrence_id is not null;

alter table public.recurrence_rules enable row level security;

drop policy if exists "recurrence_rules_select_own" on public.recurrence_rules;
create policy "recurrence_rules_select_own" on public.recurrence_rules
  for select using (auth.uid() = user_id);

drop policy if exists "recurrence_rules_insert_own" on public.recurrence_rules;
create policy "recurrence_rules_insert_own" on public.recurrence_rules
  for insert with check (auth.uid() = user_id);

drop policy if exists "recurrence_rules_update_own" on public.recurrence_rules;
create policy "recurrence_rules_update_own" on public.recurrence_rules
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "recurrence_rules_delete_own" on public.recurrence_rules;
create policy "recurrence_rules_delete_own" on public.recurrence_rules
  for delete using (auth.uid() = user_id);
