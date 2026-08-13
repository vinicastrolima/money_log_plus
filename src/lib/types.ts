export type Direction = "in" | "out";
export type TxType = "prevista" | "diaria";
export type TxStatus = "concluido" | "pendente" | "atrasado";
export type CategoryKind = "income" | "expense" | "both";
export type RecurrenceFrequency = "daily" | "weekly" | "monthly" | "yearly";
export type MonthlyRecurrenceMode = "days" | "ordinal";
export type MonthlyOrdinalTarget =
  | "day"
  | "weekday"
  | "weekend"
  | 0
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6;

export interface RecurrenceConfig {
  frequency: RecurrenceFrequency;
  interval: number;
  week_days?: number[];
  month_mode?: MonthlyRecurrenceMode;
  month_days?: number[];
  month_ordinal?: 1 | 2 | 3 | 4 | -1;
  month_ordinal_target?: MonthlyOrdinalTarget;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  color: string;
  kind: CategoryKind;
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  description: string;
  amount: number; // sempre positivo
  direction: Direction;
  category_id: string | null;
  type: TxType;
  status: TxStatus;
  credit_card_id: string | null;
  recurrence_id: string | null;
  created_at: string;
}

export interface RecurrenceRule {
  id: string;
  user_id: string;
  start_date: string;
  generated_until: string | null;
  active: boolean;
  description: string;
  amount: number;
  direction: Direction;
  category_id: string | null;
  type: TxType;
  rule: RecurrenceConfig;
  created_at: string;
}

export interface CreditCard {
  id: string;
  user_id: string;
  name: string;
  due_day: number;
  closing_day?: number | null;
  color_start?: string | null;
  color_end?: string | null;
  credit_limit?: number | null;
  created_at: string;
}

export interface CardPurchase {
  id: string;
  user_id: string;
  credit_card_id: string;
  description: string;
  total_amount: number;
  installments: number;
  purchase_date: string;
  category_id: string | null;
  created_at: string;
}

export interface CreditCardInput {
  name: string;
  due_day: number;
  closing_day: number;
  color_start: string;
  color_end: string;
  credit_limit?: number | null;
}

export interface CardPurchaseInput {
  credit_card_id: string;
  description: string;
  total_amount: number;
  installments: number;
  purchase_date: string;
  category_id: string | null;
}

export interface CardInvoicePrepayment {
  id: string;
  user_id: string;
  credit_card_id: string;
  /** Vencimento da fatura que a antecipação abate. */
  invoice_due_date: string;
  amount: number;
  payment_date: string;
  description: string;
  created_at: string;
}

export interface CardInvoicePrepaymentInput {
  credit_card_id: string;
  invoice_due_date: string;
  amount: number;
  payment_date: string;
  description: string;
}

export interface CardSubscription {
  id: string;
  user_id: string;
  credit_card_id: string;
  description: string;
  amount: number;
  category_id: string | null;
  start_date: string;
  active: boolean;
  created_at: string;
}

export interface CardSubscriptionInput {
  credit_card_id: string;
  description: string;
  amount: number;
  category_id: string | null;
  start_date: string;
  active?: boolean;
}

export interface TransactionWithCategory extends Transaction {
  category: Category | null;
}

export interface Settings {
  user_id: string;
  daily_target: number;
  cycle_days: number;
}

export interface TransactionInput {
  date: string;
  description: string;
  amount: number;
  direction: Direction;
  category_id: string | null;
  type: TxType;
  status: TxStatus;
  recurrence?: RecurrenceConfig | null;
}
