import type {
  CardPurchase,
  CardSubscription,
  Category,
  CreditCard,
  Transaction,
} from "./types";

export function makeCard(overrides: Partial<CreditCard> = {}): CreditCard {
  return {
    id: "card-1",
    user_id: "user-1",
    name: "C6 Bank",
    due_day: 10,
    closing_day: 3,
    color_start: "#262626",
    color_end: "#000000",
    credit_limit: 1124,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

export function makePurchase(
  overrides: Partial<CardPurchase> = {}
): CardPurchase {
  return {
    id: "purchase-1",
    user_id: "user-1",
    credit_card_id: "card-1",
    description: "Compra",
    total_amount: 100,
    installments: 1,
    purchase_date: "2026-07-15",
    category_id: null,
    is_shared: false,
    own_amount: null,
    created_at: "2026-07-15T00:00:00Z",
    ...overrides,
  };
}

export function makeSubscription(
  overrides: Partial<CardSubscription> = {}
): CardSubscription {
  return {
    id: "sub-1",
    user_id: "user-1",
    credit_card_id: "card-1",
    description: "Streaming",
    amount: 30,
    start_date: "2026-07-01",
    category_id: null,
    active: true,
    created_at: "2026-07-01T00:00:00Z",
    ...overrides,
  };
}

export function makeTransaction(
  overrides: Partial<Transaction> = {}
): Transaction {
  return {
    id: "tx-1",
    user_id: "user-1",
    date: "2026-08-10",
    description: "C6 Bank",
    amount: 100,
    direction: "out",
    category_id: null,
    type: "prevista",
    status: "pendente",
    credit_card_id: "card-1",
    recurrence_id: null,
    created_at: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

export function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: "cat-1",
    user_id: "user-1",
    name: "Alimentação",
    color: "#22c55e",
    kind: "expense",
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}
