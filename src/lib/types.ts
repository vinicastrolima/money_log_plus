export type Direction = "in" | "out";
export type TxType = "prevista" | "diaria";
export type TxStatus = "concluido" | "pendente" | "atrasado";
export type CategoryKind = "income" | "expense" | "both";

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
  created_at: string;
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
}
