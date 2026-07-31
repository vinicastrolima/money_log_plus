-- Compras divididas: o valor cheio continua entrando na fatura do cartão,
-- mas own_amount guarda quanto o dono do cartão realmente vai pagar.
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

-- Feature em beta, liberada por usuário.
alter table public.settings
  add column if not exists shared_purchases_enabled boolean not null default false;

update public.settings s
set shared_purchases_enabled = true
from auth.users u
where u.id = s.user_id
  and u.email in ('vinciusc.dev@gmail.com', 'barbosabeaa@gmail.com');
