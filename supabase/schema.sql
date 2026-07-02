-- ============================================================
-- Controle Financeiro Web - Schema Supabase (PostgreSQL)
-- Rode este arquivo no SQL Editor do Supabase.
-- ============================================================

-- Extensao para gerar UUIDs (normalmente ja habilitada no Supabase)
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- Tabelas
-- ------------------------------------------------------------

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  color text not null default '#64748b',
  kind text not null default 'both' check (kind in ('income', 'expense', 'both')),
  created_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  description text not null default '',
  amount numeric(14, 2) not null check (amount >= 0),
  direction text not null check (direction in ('in', 'out')),
  category_id uuid references public.categories (id) on delete set null,
  type text not null default 'prevista' check (type in ('prevista', 'diaria')),
  created_at timestamptz not null default now()
);

create table if not exists public.settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  daily_target numeric(14, 2) not null default 50,
  cycle_days int not null default 30
);

create index if not exists transactions_user_date_idx
  on public.transactions (user_id, date);
create index if not exists categories_user_idx
  on public.categories (user_id);

-- ------------------------------------------------------------
-- Row Level Security (cada usuario ve apenas os proprios dados)
-- ------------------------------------------------------------

alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.settings enable row level security;

-- categories
drop policy if exists "categories_select_own" on public.categories;
create policy "categories_select_own" on public.categories
  for select using (auth.uid() = user_id);
drop policy if exists "categories_insert_own" on public.categories;
create policy "categories_insert_own" on public.categories
  for insert with check (auth.uid() = user_id);
drop policy if exists "categories_update_own" on public.categories;
create policy "categories_update_own" on public.categories
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "categories_delete_own" on public.categories;
create policy "categories_delete_own" on public.categories
  for delete using (auth.uid() = user_id);

-- transactions
drop policy if exists "transactions_select_own" on public.transactions;
create policy "transactions_select_own" on public.transactions
  for select using (auth.uid() = user_id);
drop policy if exists "transactions_insert_own" on public.transactions;
create policy "transactions_insert_own" on public.transactions
  for insert with check (auth.uid() = user_id);
drop policy if exists "transactions_update_own" on public.transactions;
create policy "transactions_update_own" on public.transactions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "transactions_delete_own" on public.transactions;
create policy "transactions_delete_own" on public.transactions
  for delete using (auth.uid() = user_id);

-- settings
drop policy if exists "settings_select_own" on public.settings;
create policy "settings_select_own" on public.settings
  for select using (auth.uid() = user_id);
drop policy if exists "settings_insert_own" on public.settings;
create policy "settings_insert_own" on public.settings
  for insert with check (auth.uid() = user_id);
drop policy if exists "settings_update_own" on public.settings;
create policy "settings_update_own" on public.settings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- Seed automatico ao criar um novo usuario
-- Cria as categorias iniciais (baseadas no print) e settings padrao.
-- ------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.settings (user_id, daily_target, cycle_days)
  values (new.id, 50, 30)
  on conflict (user_id) do nothing;

  insert into public.categories (user_id, name, color, kind) values
    (new.id, 'Salário',       '#16a34a', 'income'),
    (new.id, 'Juros',         '#22c55e', 'income'),
    (new.id, 'Dívida',        '#dc2626', 'expense'),
    (new.id, 'Cartão',        '#f97316', 'expense'),
    (new.id, 'Carro',         '#7c3aed', 'expense'),
    (new.id, 'Casa',          '#0ea5e9', 'expense'),
    (new.id, 'Saúde',         '#ec4899', 'expense'),
    (new.id, 'Investimento',  '#eab308', 'both'),
    (new.id, 'Alimentação',   '#84cc16', 'expense'),
    (new.id, 'Lazer',         '#06b6d4', 'expense')
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
