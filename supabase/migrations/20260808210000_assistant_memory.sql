-- Memória e conversas persistentes do assistente financeiro por usuário.

create table if not exists public.assistant_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'Conversa',
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  archived boolean not null default false
);

create index if not exists assistant_conversations_user_last_idx
  on public.assistant_conversations (user_id, last_message_at desc);

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

create index if not exists assistant_messages_conversation_created_idx
  on public.assistant_messages (conversation_id, created_at);

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

create index if not exists assistant_memories_user_active_idx
  on public.assistant_memories (user_id, active, updated_at desc);

alter table public.assistant_conversations enable row level security;
alter table public.assistant_messages enable row level security;
alter table public.assistant_memories enable row level security;

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
