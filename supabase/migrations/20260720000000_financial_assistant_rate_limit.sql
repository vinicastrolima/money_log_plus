-- Rate limit persistente do assistente financeiro.
-- Não armazena perguntas, respostas ou qualquer dado financeiro.

create table if not exists public.financial_assistant_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists financial_assistant_requests_user_created_idx
  on public.financial_assistant_requests (user_id, created_at desc);

alter table public.financial_assistant_requests enable row level security;

revoke all on table public.financial_assistant_requests from anon, authenticated;

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
