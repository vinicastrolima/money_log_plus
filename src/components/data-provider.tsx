"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  Category,
  Settings,
  Transaction,
  TransactionInput,
} from "@/lib/types";

interface DataContextValue {
  loading: boolean;
  categories: Category[];
  transactions: Transaction[];
  settings: Settings | null;
  categoryById: (id: string | null) => Category | null;
  refresh: () => Promise<void>;
  addTransaction: (input: TransactionInput) => Promise<void>;
  updateTransaction: (id: string, input: TransactionInput) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  addCategory: (input: Omit<Category, "id" | "user_id" | "created_at">) => Promise<void>;
  updateCategory: (
    id: string,
    input: Partial<Omit<Category, "id" | "user_id" | "created_at">>
  ) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  updateSettings: (input: Partial<Omit<Settings, "user_id">>) => Promise<void>;
}

const DataContext = React.createContext<DataContextValue | null>(null);

export function useData() {
  const ctx = React.useContext(DataContext);
  if (!ctx) throw new Error("useData deve ser usado dentro de <DataProvider>");
  return ctx;
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const supabase = React.useMemo(() => createClient(), []);
  const [loading, setLoading] = React.useState(true);
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [transactions, setTransactions] = React.useState<Transaction[]>([]);
  const [settings, setSettings] = React.useState<Settings | null>(null);

  const load = React.useCallback(async () => {
    const [catRes, txRes, setRes, userRes] = await Promise.all([
      supabase.from("categories").select("*").order("name"),
      supabase.from("transactions").select("*").order("date", { ascending: false }),
      supabase.from("settings").select("*").maybeSingle(),
      supabase.auth.getUser(),
    ]);

    setCategories((catRes.data as Category[]) ?? []);
    setTransactions((txRes.data as Transaction[]) ?? []);

    let s = setRes.data as Settings | null;
    // Garante que exista uma linha de settings (fallback caso o trigger nao rode).
    if (!s && userRes.data.user) {
      const { data: created } = await supabase
        .from("settings")
        .upsert({ user_id: userRes.data.user.id, daily_target: 50, cycle_days: 30 })
        .select()
        .maybeSingle();
      s = created as Settings | null;
    }
    setSettings(s);
    setLoading(false);
  }, [supabase]);

  React.useEffect(() => {
    load();
  }, [load]);

  const refresh = React.useCallback(async () => {
    await load();
  }, [load]);

  const getUserId = React.useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    return data.user?.id;
  }, [supabase]);

  const addTransaction = React.useCallback(
    async (input: TransactionInput) => {
      const userId = await getUserId();
      if (!userId) return;
      const { error } = await supabase
        .from("transactions")
        .insert({ ...input, user_id: userId });
      if (error) throw error;
      await load();
    },
    [supabase, getUserId, load]
  );

  const updateTransaction = React.useCallback(
    async (id: string, input: TransactionInput) => {
      const { error } = await supabase
        .from("transactions")
        .update(input)
        .eq("id", id);
      if (error) throw error;
      await load();
    },
    [supabase, load]
  );

  const deleteTransaction = React.useCallback(
    async (id: string) => {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
      await load();
    },
    [supabase, load]
  );

  const addCategory = React.useCallback(
    async (input: Omit<Category, "id" | "user_id" | "created_at">) => {
      const userId = await getUserId();
      if (!userId) return;
      const { error } = await supabase
        .from("categories")
        .insert({ ...input, user_id: userId });
      if (error) throw error;
      await load();
    },
    [supabase, getUserId, load]
  );

  const updateCategory = React.useCallback(
    async (
      id: string,
      input: Partial<Omit<Category, "id" | "user_id" | "created_at">>
    ) => {
      const { error } = await supabase
        .from("categories")
        .update(input)
        .eq("id", id);
      if (error) throw error;
      await load();
    },
    [supabase, load]
  );

  const deleteCategory = React.useCallback(
    async (id: string) => {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
      await load();
    },
    [supabase, load]
  );

  const updateSettings = React.useCallback(
    async (input: Partial<Omit<Settings, "user_id">>) => {
      const userId = await getUserId();
      if (!userId) return;
      const { error } = await supabase
        .from("settings")
        .upsert({ user_id: userId, ...settings, ...input });
      if (error) throw error;
      await load();
    },
    [supabase, getUserId, load, settings]
  );

  const categoryById = React.useCallback(
    (id: string | null) => categories.find((c) => c.id === id) ?? null,
    [categories]
  );

  const value: DataContextValue = {
    loading,
    categories,
    transactions,
    settings,
    categoryById,
    refresh,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    addCategory,
    updateCategory,
    deleteCategory,
    updateSettings,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
