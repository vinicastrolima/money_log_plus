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

create table if not exists public.credit_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  due_day int not null check (due_day >= 1 and due_day <= 31),
  closing_day int check (closing_day is null or (closing_day >= 1 and closing_day <= 31)),
  color_start text not null default '#7c3aed',
  color_end text not null default '#4c1d95',
  created_at timestamptz not null default now()
);

alter table public.credit_cards
  add column if not exists closing_day int check (closing_day is null or (closing_day >= 1 and closing_day <= 31));
alter table public.credit_cards
  add column if not exists color_start text not null default '#7c3aed';
alter table public.credit_cards
  add column if not exists color_end text not null default '#4c1d95';

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  description text not null default '',
  amount numeric(14, 2) not null check (amount >= 0),
  direction text not null check (direction in ('in', 'out')),
  category_id uuid references public.categories (id) on delete set null,
  type text not null default 'prevista' check (type in ('prevista', 'diaria')),
  status text not null default 'pendente' check (status in ('concluido', 'pendente', 'atrasado')),
  credit_card_id uuid references public.credit_cards (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.card_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  credit_card_id uuid not null references public.credit_cards (id) on delete cascade,
  description text not null,
  total_amount numeric(14, 2) not null check (total_amount > 0),
  installments int not null default 1 check (installments >= 1 and installments <= 48),
  purchase_date date not null,
  category_id uuid references public.categories (id) on delete set null,
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
create index if not exists credit_cards_user_idx
  on public.credit_cards (user_id);
create index if not exists card_purchases_card_idx
  on public.card_purchases (credit_card_id);
create index if not exists card_purchases_category_idx
  on public.card_purchases (category_id) where category_id is not null;
create index if not exists transactions_credit_card_idx
  on public.transactions (credit_card_id) where credit_card_id is not null;

-- ------------------------------------------------------------
-- Row Level Security (cada usuario ve apenas os proprios dados)
-- ------------------------------------------------------------

alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.settings enable row level security;
alter table public.credit_cards enable row level security;
alter table public.card_purchases enable row level security;

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

-- credit_cards
drop policy if exists "credit_cards_select_own" on public.credit_cards;
create policy "credit_cards_select_own" on public.credit_cards
  for select using (auth.uid() = user_id);
drop policy if exists "credit_cards_insert_own" on public.credit_cards;
create policy "credit_cards_insert_own" on public.credit_cards
  for insert with check (auth.uid() = user_id);
drop policy if exists "credit_cards_update_own" on public.credit_cards;
create policy "credit_cards_update_own" on public.credit_cards
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "credit_cards_delete_own" on public.credit_cards;
create policy "credit_cards_delete_own" on public.credit_cards
  for delete using (auth.uid() = user_id);

-- card_purchases
drop policy if exists "card_purchases_select_own" on public.card_purchases;
create policy "card_purchases_select_own" on public.card_purchases
  for select using (auth.uid() = user_id);
drop policy if exists "card_purchases_insert_own" on public.card_purchases;
create policy "card_purchases_insert_own" on public.card_purchases
  for insert with check (auth.uid() = user_id);
drop policy if exists "card_purchases_update_own" on public.card_purchases;
create policy "card_purchases_update_own" on public.card_purchases
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "card_purchases_delete_own" on public.card_purchases;
create policy "card_purchases_delete_own" on public.card_purchases
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
  -- Confirma email automaticamente (evita bloqueio sem SMTP configurado)
  update auth.users
  set email_confirmed_at = coalesce(email_confirmed_at, now()),
      updated_at = now()
  where id = new.id;

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
