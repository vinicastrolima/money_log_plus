"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { syncCreditCardTransactions } from "@/lib/card-sync";
import { suggestStatusForDate } from "@/lib/transaction-status";
import {
  buildRecurrenceDates,
  getRecurrenceHorizon,
  nextDate,
} from "@/lib/recurrence";
import type {
  CardInvoicePrepayment,
  CardInvoicePrepaymentInput,
  CardPurchase,
  CardPurchaseInput,
  CardSubscription,
  CardSubscriptionInput,
  Category,
  CreditCard,
  CreditCardInput,
  RecurrenceRule,
  Settings,
  Transaction,
  TransactionInput,
  TxStatus,
} from "@/lib/types";

interface DataContextValue {
  loading: boolean;
  categories: Category[];
  transactions: Transaction[];
  recurrenceRules: RecurrenceRule[];
  creditCards: CreditCard[];
  cardPurchases: CardPurchase[];
  cardSubscriptions: CardSubscription[];
  cardPrepayments: CardInvoicePrepayment[];
  settings: Settings | null;
  categoryById: (id: string | null) => Category | null;
  recurrenceById: (id: string | null) => RecurrenceRule | null;
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
  addCardSubscription: (input: CardSubscriptionInput) => Promise<void>;
  updateCardSubscription: (id: string, input: CardSubscriptionInput) => Promise<void>;
  deleteCardSubscription: (id: string) => Promise<void>;
  addCardPrepayment: (input: CardInvoicePrepaymentInput) => Promise<void>;
  updateCardPrepayment: (id: string, input: CardInvoicePrepaymentInput) => Promise<void>;
  deleteCardPrepayment: (id: string) => Promise<void>;
}

interface MaterializeOptions {
  startAt?: string;
  firstStatus?: TxStatus;
  includeStart?: boolean;
}

function transactionRow(input: TransactionInput) {
  const row = { ...input };
  delete row.recurrence;
  return row;
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
  const [recurrenceRules, setRecurrenceRules] = React.useState<RecurrenceRule[]>([]);
  const [creditCards, setCreditCards] = React.useState<CreditCard[]>([]);
  const [cardPurchases, setCardPurchases] = React.useState<CardPurchase[]>([]);
  const [cardSubscriptions, setCardSubscriptions] = React.useState<CardSubscription[]>([]);
  const [cardPrepayments, setCardPrepayments] = React.useState<CardInvoicePrepayment[]>([]);
  const [settings, setSettings] = React.useState<Settings | null>(null);

  const materializeRule = React.useCallback(
    async (rule: RecurrenceRule, userId: string, options: MaterializeOptions = {}) => {
      const horizon = getRecurrenceHorizon(rule.start_date);
      const startAt =
        options.startAt ??
        (rule.generated_until ? nextDate(rule.generated_until) : rule.start_date);
      if (startAt > horizon) return;

      const scheduledDates = buildRecurrenceDates(
        startAt,
        horizon,
        rule.rule,
        rule.start_date
      );
      const dates = options.includeStart
        ? [...new Set([startAt, ...scheduledDates])].sort()
        : scheduledDates;
      const rows = dates.map((date) => ({
        user_id: userId,
        date,
        description: rule.description,
        amount: rule.amount,
        direction: rule.direction,
        category_id: rule.category_id,
        type: rule.type,
        status:
          options.firstStatus && date === startAt
            ? options.firstStatus
            : suggestStatusForDate(date),
        credit_card_id: null,
        recurrence_id: rule.id,
      }));

      if (rows.length) {
        const { error } = await supabase.from("transactions").upsert(rows, {
          onConflict: "recurrence_id,date",
          ignoreDuplicates: true,
        });
        if (error) throw error;
      }

      const { error: ruleError } = await supabase
        .from("recurrence_rules")
        .update({ generated_until: horizon })
        .eq("id", rule.id);
      if (ruleError) throw ruleError;
    },
    [supabase]
  );

  const load = React.useCallback(async () => {
    const [
      catRes,
      ruleRes,
      cardRes,
      purchaseRes,
      subRes,
      prepayRes,
      setRes,
      userRes,
    ] = await Promise.all([
        supabase.from("categories").select("*").order("name"),
        supabase.from("recurrence_rules").select("*").order("created_at"),
        supabase.from("credit_cards").select("*").order("name"),
        supabase.from("card_purchases").select("*").order("purchase_date", { ascending: false }),
        supabase.from("card_subscriptions").select("*").order("description"),
        supabase
          .from("card_invoice_prepayments")
          .select("*")
          .order("payment_date", { ascending: false }),
        supabase.from("settings").select("*").maybeSingle(),
        supabase.auth.getUser(),
      ]);

    const rules = (ruleRes.data as RecurrenceRule[]) ?? [];
    const userId = userRes.data.user?.id;
    if (userId) {
      await Promise.allSettled(
        rules
          .filter(
            (rule) =>
              rule.active &&
              (!rule.generated_until ||
                rule.generated_until < getRecurrenceHorizon(rule.start_date))
          )
          .map((rule) => materializeRule(rule, userId))
      );
    }

    const txRes = await supabase
      .from("transactions")
      .select("*")
      .order("date", { ascending: false });

    setCategories((catRes.data as Category[]) ?? []);
    setTransactions((txRes.data as Transaction[]) ?? []);
    setRecurrenceRules(rules);
    setCreditCards((cardRes.data as CreditCard[]) ?? []);
    setCardPurchases((purchaseRes.data as CardPurchase[]) ?? []);
    setCardSubscriptions((subRes.data as CardSubscription[]) ?? []);
    setCardPrepayments((prepayRes.data as CardInvoicePrepayment[]) ?? []);

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
  }, [supabase, materializeRule]);

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
    async (
      cardId: string,
      userId: string,
      purchasesSnapshot?: CardPurchase[],
      cardSnapshot?: CreditCard,
      subscriptionsSnapshot?: CardSubscription[],
      prepaymentsSnapshot?: CardInvoicePrepayment[]
    ) => {
      const card = cardSnapshot ?? creditCards.find((c) => c.id === cardId);
      const catId = getCartaoCategoryId();
      if (!card || !catId) return;
      const purchases =
        purchasesSnapshot?.filter((p) => p.credit_card_id === cardId) ??
        cardPurchases.filter((p) => p.credit_card_id === cardId);
      const subscriptions =
        subscriptionsSnapshot?.filter((s) => s.credit_card_id === cardId) ??
        cardSubscriptions.filter((s) => s.credit_card_id === cardId);
      const prepayments =
        prepaymentsSnapshot?.filter((p) => p.credit_card_id === cardId) ??
        cardPrepayments.filter((p) => p.credit_card_id === cardId);
      await syncCreditCardTransactions(
        supabase,
        card,
        purchases,
        subscriptions,
        catId,
        userId,
        prepayments
      );
    },
    [
      supabase,
      creditCards,
      cardPurchases,
      cardSubscriptions,
      cardPrepayments,
      getCartaoCategoryId,
    ]
  );

  const addTransaction = React.useCallback(
    async (input: TransactionInput) => {
      const userId = await getUserId();
      if (!userId) return;
      const row = transactionRow(input);

      if (!input.recurrence) {
        const { error } = await supabase
          .from("transactions")
          .insert({ ...row, user_id: userId, credit_card_id: null, recurrence_id: null });
        if (error) throw error;
        await load();
        return;
      }

      const { data, error } = await supabase
        .from("recurrence_rules")
        .insert({
          user_id: userId,
          start_date: input.date,
          generated_until: null,
          active: true,
          description: input.description,
          amount: input.amount,
          direction: input.direction,
          category_id: input.category_id,
          type: input.type,
          rule: input.recurrence,
        })
        .select()
        .single();
      if (error) throw error;

      try {
        await materializeRule(data as RecurrenceRule, userId, {
          startAt: input.date,
          firstStatus: input.status,
          includeStart: true,
        });
      } catch (materializeError) {
        await supabase.from("recurrence_rules").delete().eq("id", data.id);
        throw materializeError;
      }
      await load();
    },
    [supabase, getUserId, load, materializeRule]
  );

  const updateTransaction = React.useCallback(
    async (id: string, input: TransactionInput) => {
      const existing = transactions.find((t) => t.id === id);
      const row = transactionRow(input);
      if (existing?.credit_card_id) {
        const onlyStatus =
          row.date === existing.date &&
          row.description === existing.description &&
          row.amount === existing.amount &&
          row.direction === existing.direction &&
          row.category_id === existing.category_id &&
          row.type === existing.type;
        if (!onlyStatus) {
          throw new Error(
            "Lançamentos automáticos de cartão devem ser editados na aba Cartões."
          );
        }
      }

      const currentRule = existing?.recurrence_id
        ? recurrenceRules.find((rule) => rule.id === existing.recurrence_id)
        : null;

      if (existing && currentRule) {
        if (!input.recurrence) {
          const { error: ruleError } = await supabase
            .from("recurrence_rules")
            .update({ active: false, generated_until: existing.date })
            .eq("id", currentRule.id);
          if (ruleError) throw ruleError;

          const { error: futureError } = await supabase
            .from("transactions")
            .delete()
            .eq("recurrence_id", currentRule.id)
            .gt("date", existing.date);
          if (futureError) throw futureError;

          const { error: updateError } = await supabase
            .from("transactions")
            .update({ ...row, recurrence_id: null })
            .eq("id", id);
          if (updateError) throw updateError;
          await load();
          return;
        }

        const onlyThisOccurrenceChanged =
          input.date === existing.date &&
          input.description === currentRule.description &&
          input.amount === currentRule.amount &&
          input.direction === currentRule.direction &&
          input.category_id === currentRule.category_id &&
          input.type === currentRule.type &&
          JSON.stringify(input.recurrence) === JSON.stringify(currentRule.rule);
        if (onlyThisOccurrenceChanged) {
          const { error: occurrenceError } = await supabase
            .from("transactions")
            .update(row)
            .eq("id", id);
          if (occurrenceError) throw occurrenceError;
          await load();
          return;
        }

        const userId = await getUserId();
        if (!userId) return;
        const cutoff = input.date < existing.date ? input.date : existing.date;
        const { error: deleteError } = await supabase
          .from("transactions")
          .delete()
          .eq("recurrence_id", currentRule.id)
          .gte("date", cutoff);
        if (deleteError) throw deleteError;

        const { data: updatedRule, error: ruleError } = await supabase
          .from("recurrence_rules")
          .update({
            start_date: input.date,
            generated_until: null,
            active: true,
            description: input.description,
            amount: input.amount,
            direction: input.direction,
            category_id: input.category_id,
            type: input.type,
            rule: input.recurrence,
          })
          .eq("id", currentRule.id)
          .select()
          .single();
        if (ruleError) throw ruleError;

        await materializeRule(updatedRule as RecurrenceRule, userId, {
          startAt: input.date,
          firstStatus: input.status,
          includeStart: true,
        });
        await load();
        return;
      }

      if (existing && input.recurrence) {
        const userId = await getUserId();
        if (!userId) return;
        const { data: createdRule, error: ruleError } = await supabase
          .from("recurrence_rules")
          .insert({
            user_id: userId,
            start_date: input.date,
            generated_until: null,
            active: true,
            description: input.description,
            amount: input.amount,
            direction: input.direction,
            category_id: input.category_id,
            type: input.type,
            rule: input.recurrence,
          })
          .select()
          .single();
        if (ruleError) throw ruleError;

        const { error: updateError } = await supabase
          .from("transactions")
          .update({ ...row, recurrence_id: createdRule.id })
          .eq("id", id);
        if (updateError) throw updateError;

        try {
          await materializeRule(createdRule as RecurrenceRule, userId, {
            startAt: input.date,
            firstStatus: input.status,
            includeStart: true,
          });
        } catch (materializeError) {
          await supabase
            .from("transactions")
            .update({ ...row, recurrence_id: null })
            .eq("id", id);
          await supabase.from("recurrence_rules").delete().eq("id", createdRule.id);
          throw materializeError;
        }
        await load();
        return;
      }

      const { error } = await supabase.from("transactions").update(row).eq("id", id);
      if (error) throw error;
      await load();
    },
    [
      supabase,
      load,
      transactions,
      recurrenceRules,
      getUserId,
      materializeRule,
    ]
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
      const { data, error } = await supabase
        .from("credit_cards")
        .update(input)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      await resyncCard(id, userId, undefined, data as CreditCard);
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

  const addCardSubscription = React.useCallback(
    async (input: CardSubscriptionInput) => {
      const userId = await getUserId();
      if (!userId) return;
      const { data, error } = await supabase
        .from("card_subscriptions")
        .insert({ ...input, user_id: userId, active: input.active ?? true })
        .select()
        .single();
      if (error) throw error;
      const nextSubs = [data as CardSubscription, ...cardSubscriptions];
      setCardSubscriptions(nextSubs);
      await resyncCard(input.credit_card_id, userId, undefined, undefined, nextSubs);
      await load();
    },
    [supabase, getUserId, load, cardSubscriptions, resyncCard]
  );

  const updateCardSubscription = React.useCallback(
    async (id: string, input: CardSubscriptionInput) => {
      const userId = await getUserId();
      if (!userId) return;
      const { data, error } = await supabase
        .from("card_subscriptions")
        .update({ ...input, active: input.active ?? true })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      const nextSubs = cardSubscriptions.map((s) =>
        s.id === id ? (data as CardSubscription) : s
      );
      setCardSubscriptions(nextSubs);
      await resyncCard(input.credit_card_id, userId, undefined, undefined, nextSubs);
      await load();
    },
    [supabase, getUserId, load, cardSubscriptions, resyncCard]
  );

  const deleteCardSubscription = React.useCallback(
    async (id: string) => {
      const userId = await getUserId();
      if (!userId) return;
      const existing = cardSubscriptions.find((s) => s.id === id);
      if (!existing) return;
      const { error } = await supabase.from("card_subscriptions").delete().eq("id", id);
      if (error) throw error;
      const nextSubs = cardSubscriptions.filter((s) => s.id !== id);
      setCardSubscriptions(nextSubs);
      await resyncCard(existing.credit_card_id, userId, undefined, undefined, nextSubs);
      await load();
    },
    [supabase, getUserId, load, cardSubscriptions, resyncCard]
  );

  const addCardPrepayment = React.useCallback(
    async (input: CardInvoicePrepaymentInput) => {
      const userId = await getUserId();
      if (!userId) return;
      const { data, error } = await supabase
        .from("card_invoice_prepayments")
        .insert({ ...input, user_id: userId })
        .select()
        .single();
      if (error) throw error;
      const nextPrepayments = [data as CardInvoicePrepayment, ...cardPrepayments];
      setCardPrepayments(nextPrepayments);
      await resyncCard(
        input.credit_card_id,
        userId,
        undefined,
        undefined,
        undefined,
        nextPrepayments
      );
      await load();
    },
    [supabase, getUserId, load, cardPrepayments, resyncCard]
  );

  const updateCardPrepayment = React.useCallback(
    async (id: string, input: CardInvoicePrepaymentInput) => {
      const userId = await getUserId();
      if (!userId) return;
      const existing = cardPrepayments.find((p) => p.id === id);
      const { data, error } = await supabase
        .from("card_invoice_prepayments")
        .update(input)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      const nextPrepayments = cardPrepayments.map((p) =>
        p.id === id ? (data as CardInvoicePrepayment) : p
      );
      setCardPrepayments(nextPrepayments);
      const cardIds = new Set(
        [existing?.credit_card_id, input.credit_card_id].filter(Boolean) as string[]
      );
      for (const cardId of cardIds) {
        await resyncCard(cardId, userId, undefined, undefined, undefined, nextPrepayments);
      }
      await load();
    },
    [supabase, getUserId, load, cardPrepayments, resyncCard]
  );

  const deleteCardPrepayment = React.useCallback(
    async (id: string) => {
      const userId = await getUserId();
      if (!userId) return;
      const existing = cardPrepayments.find((p) => p.id === id);
      if (!existing) return;
      const { error } = await supabase
        .from("card_invoice_prepayments")
        .delete()
        .eq("id", id);
      if (error) throw error;
      const nextPrepayments = cardPrepayments.filter((p) => p.id !== id);
      setCardPrepayments(nextPrepayments);
      await resyncCard(
        existing.credit_card_id,
        userId,
        undefined,
        undefined,
        undefined,
        nextPrepayments
      );
      await load();
    },
    [supabase, getUserId, load, cardPrepayments, resyncCard]
  );

  const categoryById = React.useCallback(
    (id: string | null) => categories.find((c) => c.id === id) ?? null,
    [categories]
  );

  const recurrenceById = React.useCallback(
    (id: string | null) => recurrenceRules.find((rule) => rule.id === id) ?? null,
    [recurrenceRules]
  );

  const value: DataContextValue = {
    loading,
    categories,
    transactions,
    recurrenceRules,
    creditCards,
    cardPurchases,
    cardSubscriptions,
    cardPrepayments,
    settings,
    categoryById,
    recurrenceById,
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
    addCardSubscription,
    updateCardSubscription,
    deleteCardSubscription,
    addCardPrepayment,
    updateCardPrepayment,
    deleteCardPrepayment,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
