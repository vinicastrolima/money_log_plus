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
alter table public.credit_cards
  add column if not exists credit_limit numeric(14, 2)
  check (credit_limit is null or credit_limit >= 0);

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
  recurrence_id uuid references public.recurrence_rules (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.transactions
  add column if not exists recurrence_id uuid
  references public.recurrence_rules (id) on delete cascade;

create table if not exists public.card_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  credit_card_id uuid not null references public.credit_cards (id) on delete cascade,
  description text not null,
  total_amount numeric(14, 2) not null check (total_amount > 0),
  installments int not null default 1 check (installments >= 1 and installments <= 48),
  purchase_date date not null,
  category_id uuid references public.categories (id) on delete set null,
  is_shared boolean not null default false,
  own_amount numeric(14, 2),
  created_at timestamptz not null default now()
);

-- Compras divididas: total_amount é o valor cheio da fatura e own_amount é a
-- parte que o dono do cartão realmente paga.
alter table public.card_purchases
  add column if not exists is_shared boolean not null default false;
alter table public.card_purchases
  add column if not exists own_amount numeric(14, 2);
alter table public.card_purchases
  drop constraint if exists card_purchases_own_amount_check;
alter table public.card_purchases
  add constraint card_purchases_own_amount_check
  check (own_amount is null or (own_amount > 0 and own_amount <= total_amount));
alter table public.card_purchases
  drop constraint if exists card_purchases_shared_own_amount_check;
alter table public.card_purchases
  add constraint card_purchases_shared_own_amount_check
  check (not is_shared or own_amount is not null);

create table if not exists public.card_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  credit_card_id uuid not null references public.credit_cards (id) on delete cascade,
  description text not null,
  amount numeric(14, 2) not null check (amount > 0),
  category_id uuid references public.categories (id) on delete set null,
  start_date date not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  daily_target numeric(14, 2) not null default 50,
  cycle_days int not null default 30,
  shared_purchases_enabled boolean not null default false
);

alter table public.settings
  add column if not exists shared_purchases_enabled boolean not null default false;

-- Registra apenas uso do assistente para rate limiting. Não armazena prompts.
create table if not exists public.financial_assistant_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Conversas e memória declarativa do assistente financeiro.
create table if not exists public.assistant_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'Conversa',
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  archived boolean not null default false
);

create table if not exists public.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.assistant_conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  status text,
  highlights jsonb not null default '[]'::jsonb,
  period text,
  created_at timestamptz not null default now()
);

create table if not exists public.assistant_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('perfil', 'meta', 'preferencia', 'restricao', 'contexto')),
  key text not null,
  value text not null,
  confidence numeric(4, 3) not null default 0.5
    check (confidence >= 0 and confidence <= 1),
  source_message_id uuid references public.assistant_messages (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz,
  active boolean not null default true,
  unique (user_id, kind, key)
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
create index if not exists card_subscriptions_card_idx
  on public.card_subscriptions (credit_card_id);
create index if not exists card_subscriptions_user_idx
  on public.card_subscriptions (user_id);
create index if not exists transactions_credit_card_idx
  on public.transactions (credit_card_id) where credit_card_id is not null;
create index if not exists recurrence_rules_user_idx
  on public.recurrence_rules (user_id);
alter table public.transactions
  drop constraint if exists transactions_recurrence_date_key;
alter table public.transactions
  add constraint transactions_recurrence_date_key unique (recurrence_id, date);
create index if not exists financial_assistant_requests_user_created_idx
  on public.financial_assistant_requests (user_id, created_at desc);
create index if not exists assistant_conversations_user_last_idx
  on public.assistant_conversations (user_id, last_message_at desc);
create index if not exists assistant_messages_conversation_created_idx
  on public.assistant_messages (conversation_id, created_at);
create index if not exists assistant_memories_user_active_idx
  on public.assistant_memories (user_id, active, updated_at desc);

-- ------------------------------------------------------------
-- Row Level Security (cada usuario ve apenas os proprios dados)
-- ------------------------------------------------------------

alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.settings enable row level security;
alter table public.credit_cards enable row level security;
alter table public.card_purchases enable row level security;
alter table public.card_subscriptions enable row level security;
alter table public.recurrence_rules enable row level security;
alter table public.financial_assistant_requests enable row level security;
alter table public.assistant_conversations enable row level security;
alter table public.assistant_messages enable row level security;
alter table public.assistant_memories enable row level security;

-- A tabela não é acessível diretamente. O uso passa pela função limitada abaixo.
revoke all on table public.financial_assistant_requests from anon, authenticated;

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

-- recurrence_rules
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

-- card_subscriptions
drop policy if exists "card_subscriptions_select_own" on public.card_subscriptions;
create policy "card_subscriptions_select_own" on public.card_subscriptions
  for select using (auth.uid() = user_id);
drop policy if exists "card_subscriptions_insert_own" on public.card_subscriptions;
create policy "card_subscriptions_insert_own" on public.card_subscriptions
  for insert with check (auth.uid() = user_id);
drop policy if exists "card_subscriptions_update_own" on public.card_subscriptions;
create policy "card_subscriptions_update_own" on public.card_subscriptions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "card_subscriptions_delete_own" on public.card_subscriptions;
create policy "card_subscriptions_delete_own" on public.card_subscriptions
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

-- assistant_conversations
drop policy if exists "assistant_conversations_select_own" on public.assistant_conversations;
create policy "assistant_conversations_select_own" on public.assistant_conversations
  for select using (auth.uid() = user_id);
drop policy if exists "assistant_conversations_insert_own" on public.assistant_conversations;
create policy "assistant_conversations_insert_own" on public.assistant_conversations
  for insert with check (auth.uid() = user_id);
drop policy if exists "assistant_conversations_update_own" on public.assistant_conversations;
create policy "assistant_conversations_update_own" on public.assistant_conversations
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "assistant_conversations_delete_own" on public.assistant_conversations;
create policy "assistant_conversations_delete_own" on public.assistant_conversations
  for delete using (auth.uid() = user_id);

-- assistant_messages
drop policy if exists "assistant_messages_select_own" on public.assistant_messages;
create policy "assistant_messages_select_own" on public.assistant_messages
  for select using (auth.uid() = user_id);
drop policy if exists "assistant_messages_insert_own" on public.assistant_messages;
create policy "assistant_messages_insert_own" on public.assistant_messages
  for insert with check (auth.uid() = user_id);
drop policy if exists "assistant_messages_update_own" on public.assistant_messages;
create policy "assistant_messages_update_own" on public.assistant_messages
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "assistant_messages_delete_own" on public.assistant_messages;
create policy "assistant_messages_delete_own" on public.assistant_messages
  for delete using (auth.uid() = user_id);

-- assistant_memories
drop policy if exists "assistant_memories_select_own" on public.assistant_memories;
create policy "assistant_memories_select_own" on public.assistant_memories
  for select using (auth.uid() = user_id);
drop policy if exists "assistant_memories_insert_own" on public.assistant_memories;
create policy "assistant_memories_insert_own" on public.assistant_memories
  for insert with check (auth.uid() = user_id);
drop policy if exists "assistant_memories_update_own" on public.assistant_memories;
create policy "assistant_memories_update_own" on public.assistant_memories
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "assistant_memories_delete_own" on public.assistant_memories;
create policy "assistant_memories_delete_own" on public.assistant_memories
  for delete using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- Rate limit do assistente financeiro: 20 análises por usuário/hora
-- ------------------------------------------------------------

create or replace function public.consume_financial_assistant_quota()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  recent_requests integer;
begin
  if current_user_id is null then
    return false;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(current_user_id::text, 0)
  );

  delete from public.financial_assistant_requests
  where user_id = current_user_id
    and created_at < pg_catalog.now() - interval '7 days';

  select count(*)
  into recent_requests
  from public.financial_assistant_requests
  where user_id = current_user_id
    and created_at >= pg_catalog.now() - interval '1 hour';

  if recent_requests >= 20 then
    return false;
  end if;

  insert into public.financial_assistant_requests (user_id)
  values (current_user_id);

  return true;
end;
$$;

revoke all on function public.consume_financial_assistant_quota() from public, anon;
grant execute on function public.consume_financial_assistant_quota() to authenticated;

-- ------------------------------------------------------------
-- Memória do assistente: upsert com teto e purge completo
-- ------------------------------------------------------------

create or replace function public.upsert_assistant_memories(facts jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  fact jsonb;
  inserted_count integer := 0;
  fact_kind text;
  fact_key text;
  fact_value text;
  fact_confidence numeric;
  fact_ttl_days integer;
  fact_source_message_id uuid;
  fact_expires_at timestamptz;
begin
  if current_user_id is null then
    return 0;
  end if;

  if facts is null or pg_catalog.jsonb_typeof(facts) <> 'array' then
    return 0;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(current_user_id::text || ':assistant-memory', 0)
  );

  for fact in
    select value
    from pg_catalog.jsonb_array_elements(facts)
  loop
    fact_kind := nullif(pg_catalog.btrim(fact->>'kind'), '');
    fact_key := nullif(pg_catalog.btrim(fact->>'key'), '');
    fact_value := nullif(pg_catalog.btrim(fact->>'value'), '');

    if fact_kind is null
      or fact_key is null
      or fact_value is null
      or fact_kind not in ('perfil', 'meta', 'preferencia', 'restricao', 'contexto')
    then
      continue;
    end if;

    fact_confidence := coalesce((fact->>'confidence')::numeric, 0.5);
    if fact_confidence < 0 or fact_confidence > 1 then
      fact_confidence := 0.5;
    end if;

    fact_ttl_days := nullif(fact->>'ttlDays', '')::integer;
    if fact_ttl_days is not null and fact_ttl_days > 0 then
      fact_expires_at := pg_catalog.now() + pg_catalog.make_interval(days => fact_ttl_days);
    else
      fact_expires_at := null;
    end if;

    fact_source_message_id := nullif(fact->>'sourceMessageId', '')::uuid;

    insert into public.assistant_memories as m (
      user_id,
      kind,
      key,
      value,
      confidence,
      source_message_id,
      expires_at,
      active,
      updated_at
    )
    values (
      current_user_id,
      fact_kind,
      pg_catalog.left(fact_key, 64),
      pg_catalog.left(fact_value, 280),
      fact_confidence,
      fact_source_message_id,
      fact_expires_at,
      true,
      pg_catalog.now()
    )
    on conflict (user_id, kind, key) do update
      set value = excluded.value,
          confidence = excluded.confidence,
          source_message_id = coalesce(excluded.source_message_id, m.source_message_id),
          expires_at = excluded.expires_at,
          active = true,
          updated_at = pg_catalog.now();

    inserted_count := inserted_count + 1;
  end loop;

  delete from public.assistant_memories mem
  where mem.user_id = current_user_id
    and mem.id in (
      select older.id
      from public.assistant_memories older
      where older.user_id = current_user_id
        and older.active = true
      order by older.updated_at desc
      offset 40
    );

  return inserted_count;
end;
$$;

revoke all on function public.upsert_assistant_memories(jsonb) from public, anon;
grant execute on function public.upsert_assistant_memories(jsonb) to authenticated;

create or replace function public.purge_assistant_memory()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    return false;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(current_user_id::text || ':assistant-memory', 0)
  );

  delete from public.assistant_memories
  where user_id = current_user_id;

  delete from public.assistant_conversations
  where user_id = current_user_id;

  return true;
end;
$$;

revoke all on function public.purge_assistant_memory() from public, anon;
grant execute on function public.purge_assistant_memory() to authenticated;

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

-- Só o trigger deve executar a função; ninguém pode chamá-la via /rest/v1/rpc.
revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to supabase_auth_admin;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
