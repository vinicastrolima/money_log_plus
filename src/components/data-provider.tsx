"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { syncCreditCardTransactions } from "@/lib/card-sync";
import type {
  CardPurchase,
  CardPurchaseInput,
  Category,
  CreditCard,
  CreditCardInput,
  Settings,
  Transaction,
  TransactionInput,
} from "@/lib/types";

interface DataContextValue {
  loading: boolean;
  categories: Category[];
  transactions: Transaction[];
  creditCards: CreditCard[];
  cardPurchases: CardPurchase[];
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
  addCreditCard: (input: CreditCardInput) => Promise<void>;
  updateCreditCard: (id: string, input: CreditCardInput) => Promise<void>;
  deleteCreditCard: (id: string) => Promise<void>;
  addCardPurchase: (input: CardPurchaseInput) => Promise<void>;
  updateCardPurchase: (id: string, input: CardPurchaseInput) => Promise<void>;
  deleteCardPurchase: (id: string) => Promise<void>;
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
  const [creditCards, setCreditCards] = React.useState<CreditCard[]>([]);
  const [cardPurchases, setCardPurchases] = React.useState<CardPurchase[]>([]);
  const [settings, setSettings] = React.useState<Settings | null>(null);

  const load = React.useCallback(async () => {
    const [catRes, txRes, cardRes, purchaseRes, setRes, userRes] =
      await Promise.all([
        supabase.from("categories").select("*").order("name"),
        supabase.from("transactions").select("*").order("date", { ascending: false }),
        supabase.from("credit_cards").select("*").order("name"),
        supabase.from("card_purchases").select("*").order("purchase_date", { ascending: false }),
        supabase.from("settings").select("*").maybeSingle(),
        supabase.auth.getUser(),
      ]);

    setCategories((catRes.data as Category[]) ?? []);
    setTransactions((txRes.data as Transaction[]) ?? []);
    setCreditCards((cardRes.data as CreditCard[]) ?? []);
    setCardPurchases((purchaseRes.data as CardPurchase[]) ?? []);

    let s = setRes.data as Settings | null;
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
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const refresh = React.useCallback(async () => {
    await load();
  }, [load]);

  const getUserId = React.useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    return data.user?.id;
  }, [supabase]);

  const getCartaoCategoryId = React.useCallback(() => {
    return categories.find((c) => c.name === "Cartão")?.id ?? null;
  }, [categories]);

  const resyncCard = React.useCallback(
    async (cardId: string, userId: string, purchasesSnapshot?: CardPurchase[]) => {
      const card = creditCards.find((c) => c.id === cardId);
      const catId = getCartaoCategoryId();
      if (!card || !catId) return;
      const purchases =
        purchasesSnapshot?.filter((p) => p.credit_card_id === cardId) ??
        cardPurchases.filter((p) => p.credit_card_id === cardId);
      await syncCreditCardTransactions(supabase, card, purchases, catId, userId);
    },
    [supabase, creditCards, cardPurchases, getCartaoCategoryId]
  );

  const addTransaction = React.useCallback(
    async (input: TransactionInput) => {
      const userId = await getUserId();
      if (!userId) return;
      const { error } = await supabase
        .from("transactions")
        .insert({ ...input, user_id: userId, credit_card_id: null });
      if (error) throw error;
      await load();
    },
    [supabase, getUserId, load]
  );

  const updateTransaction = React.useCallback(
    async (id: string, input: TransactionInput) => {
      const existing = transactions.find((t) => t.id === id);
      if (existing?.credit_card_id) {
        const onlyStatus =
          input.date === existing.date &&
          input.description === existing.description &&
          input.amount === existing.amount &&
          input.direction === existing.direction &&
          input.category_id === existing.category_id &&
          input.type === existing.type;
        if (!onlyStatus) {
          throw new Error(
            "Lançamentos automáticos de cartão devem ser editados na aba Cartões."
          );
        }
      }
      const { error } = await supabase.from("transactions").update(input).eq("id", id);
      if (error) throw error;
      await load();
    },
    [supabase, load, transactions]
  );

  const deleteTransaction = React.useCallback(
    async (id: string) => {
      const existing = transactions.find((t) => t.id === id);
      if (existing?.credit_card_id) {
        throw new Error("Lançamentos automáticos de cartão devem ser removidos na aba Cartões.");
      }
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
      await load();
    },
    [supabase, load, transactions]
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
      const { error } = await supabase.from("categories").update(input).eq("id", id);
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

  const addCreditCard = React.useCallback(
    async (input: CreditCardInput) => {
      const userId = await getUserId();
      if (!userId) return;
      const { error } = await supabase
        .from("credit_cards")
        .insert({ ...input, user_id: userId });
      if (error) throw error;
      await load();
    },
    [supabase, getUserId, load]
  );

  const updateCreditCard = React.useCallback(
    async (id: string, input: CreditCardInput) => {
      const userId = await getUserId();
      if (!userId) return;
      const { error } = await supabase
        .from("credit_cards")
        .update(input)
        .eq("id", id);
      if (error) throw error;
      await load();
      await resyncCard(id, userId);
      await load();
    },
    [supabase, load, resyncCard, getUserId]
  );

  const deleteCreditCard = React.useCallback(
    async (id: string) => {
      const { error } = await supabase.from("credit_cards").delete().eq("id", id);
      if (error) throw error;
      await load();
    },
    [supabase, load]
  );

  const addCardPurchase = React.useCallback(
    async (input: CardPurchaseInput) => {
      const userId = await getUserId();
      if (!userId) return;
      const { data, error } = await supabase
        .from("card_purchases")
        .insert({ ...input, user_id: userId })
        .select()
        .single();
      if (error) throw error;
      const nextPurchases = [data as CardPurchase, ...cardPurchases];
      setCardPurchases(nextPurchases);
      await resyncCard(input.credit_card_id, userId, nextPurchases);
      await load();
    },
    [supabase, getUserId, load, cardPurchases, resyncCard]
  );

  const updateCardPurchase = React.useCallback(
    async (id: string, input: CardPurchaseInput) => {
      const userId = await getUserId();
      if (!userId) return;
      const { data, error } = await supabase
        .from("card_purchases")
        .update(input)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      const nextPurchases = cardPurchases.map((p) =>
        p.id === id ? (data as CardPurchase) : p
      );
      setCardPurchases(nextPurchases);
      await resyncCard(input.credit_card_id, userId, nextPurchases);
      await load();
    },
    [supabase, getUserId, load, cardPurchases, resyncCard]
  );

  const deleteCardPurchase = React.useCallback(
    async (id: string) => {
      const userId = await getUserId();
      if (!userId) return;
      const existing = cardPurchases.find((p) => p.id === id);
      if (!existing) return;
      const { error } = await supabase.from("card_purchases").delete().eq("id", id);
      if (error) throw error;
      const nextPurchases = cardPurchases.filter((p) => p.id !== id);
      setCardPurchases(nextPurchases);
      await resyncCard(existing.credit_card_id, userId, nextPurchases);
      await load();
    },
    [supabase, getUserId, load, cardPurchases, resyncCard]
  );

  const categoryById = React.useCallback(
    (id: string | null) => categories.find((c) => c.id === id) ?? null,
    [categories]
  );

  const value: DataContextValue = {
    loading,
    categories,
    transactions,
    creditCards,
    cardPurchases,
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
    addCreditCard,
    updateCreditCard,
    deleteCreditCard,
    addCardPurchase,
    updateCardPurchase,
    deleteCardPurchase,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
