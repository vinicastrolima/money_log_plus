-- PostgREST on_conflict precisa de UNIQUE constraint (índice parcial não serve).
drop index if exists public.transactions_recurrence_date_idx;

alter table public.transactions
  drop constraint if exists transactions_recurrence_date_key;

alter table public.transactions
  add constraint transactions_recurrence_date_key unique (recurrence_id, date);
