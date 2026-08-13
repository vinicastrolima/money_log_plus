-- Remove compra dividida
alter table public.card_purchases
  drop constraint if exists card_purchases_own_amount_check;
alter table public.card_purchases
  drop constraint if exists card_purchases_shared_own_amount_check;
alter table public.card_purchases
  drop column if exists is_shared;
alter table public.card_purchases
  drop column if exists own_amount;
alter table public.settings
  drop column if exists shared_purchases_enabled;

-- Antecipação de fatura: abate do valor da fatura alvo sem criar lançamento de caixa
create table if not exists public.card_invoice_prepayments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  credit_card_id uuid not null references public.credit_cards (id) on delete cascade,
  invoice_due_date date not null,
  amount numeric(14, 2) not null check (amount > 0),
  payment_date date not null default current_date,
  description text not null default 'Antecipação de fatura',
  created_at timestamptz not null default now()
);

create index if not exists card_invoice_prepayments_card_due_idx
  on public.card_invoice_prepayments (credit_card_id, invoice_due_date);
create index if not exists card_invoice_prepayments_user_idx
  on public.card_invoice_prepayments (user_id);

alter table public.card_invoice_prepayments enable row level security;

drop policy if exists "card_invoice_prepayments_select_own" on public.card_invoice_prepayments;
create policy "card_invoice_prepayments_select_own" on public.card_invoice_prepayments
  for select using (auth.uid() = user_id);
drop policy if exists "card_invoice_prepayments_insert_own" on public.card_invoice_prepayments;
create policy "card_invoice_prepayments_insert_own" on public.card_invoice_prepayments
  for insert with check (auth.uid() = user_id);
drop policy if exists "card_invoice_prepayments_update_own" on public.card_invoice_prepayments;
create policy "card_invoice_prepayments_update_own" on public.card_invoice_prepayments
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "card_invoice_prepayments_delete_own" on public.card_invoice_prepayments;
create policy "card_invoice_prepayments_delete_own" on public.card_invoice_prepayments
  for delete using (auth.uid() = user_id);
