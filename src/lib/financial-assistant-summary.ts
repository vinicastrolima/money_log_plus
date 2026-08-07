import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { sanitizeFinancialLabel } from "./financial-assistant-scope";

type TransactionRow = {
  date: string;
  amount: number | string;
  direction: "in" | "out";
  category_id: string | null;
  type: "prevista" | "diaria";
  status: "concluido" | "pendente" | "atrasado";
  credit_card_id: string | null;
};

type CategoryRow = {
  id: string;
  name: string;
};

type CardPurchaseRow = {
  purchase_date: string;
  total_amount: number | string;
  category_id: string | null;
  is_shared: boolean | null;
  own_amount: number | string | null;
};

type SubscriptionRow = {
  amount: number | string;
  category_id: string | null;
};

type SettingsRow = {
  daily_target: number | string;
  cycle_days: number;
};

interface MonthlyCashFlow {
  month: string;
  registeredIncome: number;
  registeredExpenses: number;
  projectedBalance: number;
  completedExpenses: number;
  pendingExpenses: number;
  overdueExpenses: number;
  dailyExpenses: number;
  plannedExpenses: number;
}

interface CategorySpending {
  category: string;
  totalRegistered: number;
  nonCardExpenses: number;
  cardPurchases: number;
}

interface CategorySpendingMonth {
  month: string;
  totalRegistered: number;
  categories: CategorySpending[];
}

export interface FinancialSnapshot {
  generatedAt: string;
  currency: "BRL";
  period: {
    today: string;
    todayLabel: string;
    start: string;
    end: string;
    currentMonth: string;
    currentMonthLabel: string;
    previousMonth: string;
    previousMonthLabel: string;
    currentMonthMayBeIncomplete: true;
  };
  cashFlowByMonth: MonthlyCashFlow[];
  categorySpendingByMonth: CategorySpendingMonth[];
  largestRegisteredExpenses: Array<{
    date: string;
    amount: number;
    category: string;
    source: "transaction" | "card_purchase";
    status: "completed" | "pending" | "overdue" | "registered";
  }>;
  activeSubscriptions: {
    count: number;
    estimatedMonthlyTotal: number;
    byCategory: Array<{
      category: string;
      count: number;
      estimatedMonthlyTotal: number;
    }>;
  };
  budget: {
    dailyTarget: number | null;
    cycleDays: number | null;
  };
  adviceAnchors: {
    referenceMonth: string;
    referenceMonthLabel: string;
    registeredIncome: number;
    registeredExpenses: number;
    projectedBalance: number;
    percentOfIncome: {
      p10: number;
      p20: number;
      p25: number;
      p30: number;
    };
  } | null;
  trendInsights: {
    completeMonthsAnalyzed: number;
    averageRegisteredIncome: number;
    averageRegisteredExpenses: number;
    averageProjectedBalance: number;
    negativeBalanceMonths: number;
    topExpenseCategoriesPreviousMonth: Array<{
      category: string;
      total: number;
      shareOfMonthExpenses: number;
    }>;
  };
  dataQuality: {
    transactionCount: number;
    cardPurchaseCount: number;
    monthsWithData: number;
    notes: string[];
  };
}

interface CategoryBucket {
  category: string;
  nonCardExpenses: number;
  cardPurchases: number;
}

interface LargestExpense {
  date: string;
  amount: number;
  category: string;
  source: "transaction" | "card_purchase";
  status: "completed" | "pending" | "overdue" | "registered";
}

const MONTHS_IN_SNAPSHOT = 12;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function monthKey(date: string) {
  return date.slice(0, 7);
}

function shiftMonth(year: number, month0: number, offset: number) {
  const date = new Date(Date.UTC(year, month0 + offset, 1));
  return {
    year: date.getUTCFullYear(),
    month0: date.getUTCMonth(),
  };
}

function monthLabel(year: number, month0: number) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month0, 1)));
}

function dayLabel(year: number, month: number, day: number) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function getDateContext() {
  const timeZone = process.env.FINANCIAL_ASSISTANT_TIME_ZONE || "America/Maceio";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  const year = read("year");
  const month = read("month");
  const day = read("day");
  const current = shiftMonth(year, month - 1, 0);
  const previous = shiftMonth(year, month - 1, -1);
  const first = shiftMonth(year, month - 1, -(MONTHS_IN_SNAPSHOT - 1));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return {
    today: `${year}-${pad(month)}-${pad(day)}`,
    todayLabel: dayLabel(year, month, day),
    start: `${first.year}-${pad(first.month0 + 1)}-01`,
    end: `${year}-${pad(month)}-${pad(lastDay)}`,
    currentMonth: `${current.year}-${pad(current.month0 + 1)}`,
    currentMonthLabel: monthLabel(current.year, current.month0),
    previousMonth: `${previous.year}-${pad(previous.month0 + 1)}`,
    previousMonthLabel: monthLabel(previous.year, previous.month0),
    year,
    month0: month - 1,
  };
}

function createMonthKeys(year: number, month0: number) {
  return Array.from({ length: MONTHS_IN_SNAPSHOT }, (_, index) => {
    const shifted = shiftMonth(
      year,
      month0,
      index - (MONTHS_IN_SNAPSHOT - 1)
    );
    return `${shifted.year}-${pad(shifted.month0 + 1)}`;
  });
}

function amount(value: number | string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function statusLabel(status: TransactionRow["status"]): LargestExpense["status"] {
  if (status === "concluido") return "completed";
  if (status === "atrasado") return "overdue";
  return "pending";
}

export async function buildFinancialSnapshot(
  supabase: SupabaseClient,
  userId: string
): Promise<FinancialSnapshot> {
  const dateContext = getDateContext();
  const monthKeys = createMonthKeys(dateContext.year, dateContext.month0);

  const [categoriesResult, transactionsResult, purchasesResult, subscriptionsResult, settingsResult] =
    await Promise.all([
      supabase.from("categories").select("id,name").eq("user_id", userId),
      supabase
        .from("transactions")
        .select("date,amount,direction,category_id,type,status,credit_card_id")
        .eq("user_id", userId)
        .gte("date", dateContext.start)
        .lte("date", dateContext.end),
      supabase
        .from("card_purchases")
        .select("purchase_date,total_amount,category_id,is_shared,own_amount")
        .eq("user_id", userId)
        .gte("purchase_date", dateContext.start)
        .lte("purchase_date", dateContext.end),
      supabase
        .from("card_subscriptions")
        .select("amount,category_id")
        .eq("user_id", userId)
        .eq("active", true),
      supabase
        .from("settings")
        .select("daily_target,cycle_days")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

  const firstError = [
    categoriesResult.error,
    transactionsResult.error,
    purchasesResult.error,
    subscriptionsResult.error,
    settingsResult.error,
  ].find(Boolean);
  if (firstError) throw new Error("Não foi possível montar o resumo financeiro.");

  const categories = (categoriesResult.data ?? []) as CategoryRow[];
  const transactions = (transactionsResult.data ?? []) as TransactionRow[];
  const purchases = (purchasesResult.data ?? []) as CardPurchaseRow[];
  const subscriptions = (subscriptionsResult.data ?? []) as SubscriptionRow[];
  const settings = settingsResult.data as SettingsRow | null;
  const categoryNames = new Map(
    categories.map((category) => [
      category.id,
      sanitizeFinancialLabel(category.name),
    ])
  );
  const categoryName = (id: string | null) =>
    id ? categoryNames.get(id) ?? "Categoria removida" : "Sem categoria";

  const cashFlowMap = new Map<string, MonthlyCashFlow>(
    monthKeys.map((month) => [
      month,
      {
        month,
        registeredIncome: 0,
        registeredExpenses: 0,
        projectedBalance: 0,
        completedExpenses: 0,
        pendingExpenses: 0,
        overdueExpenses: 0,
        dailyExpenses: 0,
        plannedExpenses: 0,
      },
    ])
  );
  const categoryBuckets = new Map<string, CategoryBucket>();
  const largestExpenses: LargestExpense[] = [];

  function getCategoryBucket(month: string, categoryId: string | null) {
    const key = `${month}:${categoryId ?? "none"}`;
    const existing = categoryBuckets.get(key);
    if (existing) return existing;

    const created: CategoryBucket = {
      category: categoryName(categoryId),
      nonCardExpenses: 0,
      cardPurchases: 0,
    };
    categoryBuckets.set(key, created);
    return created;
  }

  for (const transaction of transactions) {
    const month = monthKey(transaction.date);
    const monthly = cashFlowMap.get(month);
    if (!monthly) continue;
    const value = amount(transaction.amount);

    if (transaction.direction === "in") {
      monthly.registeredIncome += value;
      continue;
    }

    monthly.registeredExpenses += value;
    if (transaction.status === "concluido") monthly.completedExpenses += value;
    if (transaction.status === "pendente") monthly.pendingExpenses += value;
    if (transaction.status === "atrasado") monthly.overdueExpenses += value;
    if (transaction.type === "diaria") monthly.dailyExpenses += value;
    if (transaction.type === "prevista") monthly.plannedExpenses += value;

    if (!transaction.credit_card_id) {
      const bucket = getCategoryBucket(month, transaction.category_id);
      bucket.nonCardExpenses += value;
      largestExpenses.push({
        date: transaction.date,
        amount: value,
        category: categoryName(transaction.category_id),
        source: "transaction",
        status: statusLabel(transaction.status),
      });
    }
  }

  for (const purchase of purchases) {
    const month = monthKey(purchase.purchase_date);
    if (!cashFlowMap.has(month)) continue;
    // Em compras divididas só a parte do usuário conta como gasto dele.
    const value =
      purchase.is_shared && purchase.own_amount != null
        ? amount(purchase.own_amount)
        : amount(purchase.total_amount);
    const bucket = getCategoryBucket(month, purchase.category_id);
    bucket.cardPurchases += value;
    largestExpenses.push({
      date: purchase.purchase_date,
      amount: value,
      category: categoryName(purchase.category_id),
      source: "card_purchase",
      status: "registered",
    });
  }

  const cashFlowByMonth = monthKeys.map((month) => {
    const monthly = cashFlowMap.get(month)!;
    return {
      ...monthly,
      registeredIncome: roundMoney(monthly.registeredIncome),
      registeredExpenses: roundMoney(monthly.registeredExpenses),
      projectedBalance: roundMoney(
        monthly.registeredIncome - monthly.registeredExpenses
      ),
      completedExpenses: roundMoney(monthly.completedExpenses),
      pendingExpenses: roundMoney(monthly.pendingExpenses),
      overdueExpenses: roundMoney(monthly.overdueExpenses),
      dailyExpenses: roundMoney(monthly.dailyExpenses),
      plannedExpenses: roundMoney(monthly.plannedExpenses),
    };
  });

  const categorySpendingByMonth = monthKeys.map((month) => {
    const allCategoriesForMonth = [...categoryBuckets.entries()]
      .filter(([key]) => key.startsWith(`${month}:`))
      .map(([, bucket]) => ({
        category: bucket.category,
        totalRegistered: roundMoney(
          bucket.nonCardExpenses + bucket.cardPurchases
        ),
        nonCardExpenses: roundMoney(bucket.nonCardExpenses),
        cardPurchases: roundMoney(bucket.cardPurchases),
      }))
      .sort((a, b) => b.totalRegistered - a.totalRegistered);

    return {
      month,
      totalRegistered: roundMoney(
        allCategoriesForMonth.reduce(
          (total, category) => total + category.totalRegistered,
          0
        )
      ),
      categories: allCategoriesForMonth.slice(0, 6),
    };
  });

  const subscriptionBuckets = new Map<
    string,
    { category: string; count: number; estimatedMonthlyTotal: number }
  >();
  for (const subscription of subscriptions) {
    const name = categoryName(subscription.category_id);
    const bucket = subscriptionBuckets.get(name) ?? {
      category: name,
      count: 0,
      estimatedMonthlyTotal: 0,
    };
    bucket.count += 1;
    bucket.estimatedMonthlyTotal += amount(subscription.amount);
    subscriptionBuckets.set(name, bucket);
  }
  const subscriptionsByCategory = [...subscriptionBuckets.values()]
    .map((bucket) => ({
      ...bucket,
      estimatedMonthlyTotal: roundMoney(bucket.estimatedMonthlyTotal),
    }))
    .sort((a, b) => b.estimatedMonthlyTotal - a.estimatedMonthlyTotal);

  const monthsWithData = cashFlowByMonth.filter(
    (month) => month.registeredIncome > 0 || month.registeredExpenses > 0
  ).length;

  const previousCashFlow = cashFlowByMonth.find(
    (month) => month.month === dateContext.previousMonth
  );
  const completeMonths = cashFlowByMonth.filter(
    (month) =>
      month.month !== dateContext.currentMonth &&
      (month.registeredIncome > 0 || month.registeredExpenses > 0)
  );
  const recentCompleteMonths = completeMonths.slice(-3);
  const averageOrZero = (values: number[]) =>
    values.length
      ? roundMoney(values.reduce((total, value) => total + value, 0) / values.length)
      : 0;
  const previousCategoryMonth = categorySpendingByMonth.find(
    (month) => month.month === dateContext.previousMonth
  );
  const previousExpenseTotal = previousCategoryMonth?.totalRegistered ?? 0;
  const topExpenseCategoriesPreviousMonth = (previousCategoryMonth?.categories ?? [])
    .slice(0, 5)
    .map((category) => ({
      category: category.category,
      total: category.totalRegistered,
      shareOfMonthExpenses:
        previousExpenseTotal > 0
          ? roundMoney((category.totalRegistered / previousExpenseTotal) * 100)
          : 0,
    }));

  const adviceAnchors = previousCashFlow
    ? {
        referenceMonth: dateContext.previousMonth,
        referenceMonthLabel: dateContext.previousMonthLabel,
        registeredIncome: previousCashFlow.registeredIncome,
        registeredExpenses: previousCashFlow.registeredExpenses,
        projectedBalance: previousCashFlow.projectedBalance,
        percentOfIncome: {
          p10: roundMoney(previousCashFlow.registeredIncome * 0.1),
          p20: roundMoney(previousCashFlow.registeredIncome * 0.2),
          p25: roundMoney(previousCashFlow.registeredIncome * 0.25),
          p30: roundMoney(previousCashFlow.registeredIncome * 0.3),
        },
      }
    : null;

  const trendInsights = {
    completeMonthsAnalyzed: recentCompleteMonths.length,
    averageRegisteredIncome: averageOrZero(
      recentCompleteMonths.map((month) => month.registeredIncome)
    ),
    averageRegisteredExpenses: averageOrZero(
      recentCompleteMonths.map((month) => month.registeredExpenses)
    ),
    averageProjectedBalance: averageOrZero(
      recentCompleteMonths.map((month) => month.projectedBalance)
    ),
    negativeBalanceMonths: recentCompleteMonths.filter(
      (month) => month.projectedBalance < 0
    ).length,
    topExpenseCategoriesPreviousMonth,
  };

  return {
    generatedAt: dateContext.today,
    currency: "BRL",
    period: {
      today: dateContext.today,
      todayLabel: dateContext.todayLabel,
      start: dateContext.start,
      end: dateContext.end,
      currentMonth: dateContext.currentMonth,
      currentMonthLabel: dateContext.currentMonthLabel,
      previousMonth: dateContext.previousMonth,
      previousMonthLabel: dateContext.previousMonthLabel,
      currentMonthMayBeIncomplete: true,
    },
    cashFlowByMonth,
    categorySpendingByMonth,
    largestRegisteredExpenses: largestExpenses
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8)
      .map((expense) => ({ ...expense, amount: roundMoney(expense.amount) })),
    activeSubscriptions: {
      count: subscriptions.length,
      estimatedMonthlyTotal: roundMoney(
        subscriptions.reduce(
          (total, subscription) => total + amount(subscription.amount),
          0
        )
      ),
      byCategory: subscriptionsByCategory,
    },
    budget: {
      dailyTarget: settings ? roundMoney(amount(settings.daily_target)) : null,
      cycleDays: settings?.cycle_days ?? null,
    },
    adviceAnchors,
    trendInsights,
    dataQuality: {
      transactionCount: transactions.length,
      cardPurchaseCount: purchases.length,
      monthsWithData,
      notes: [
        `Hoje é ${dateContext.todayLabel}. Mês atual: ${dateContext.currentMonthLabel} (pode estar incompleto). Mês passado: ${dateContext.previousMonthLabel}.`,
        "Fluxo de caixa usa os lançamentos registrados e inclui faturas de cartão geradas pelo aplicativo.",
        "Gastos por categoria excluem essas faturas agregadas e usam as compras de cartão na data e no valor total da compra, evitando dupla contagem.",
        "Para percentuais da renda (ex.: 25%), use adviceAnchors.percentOfIncome — valores já calculados.",
        "trendInsights resume média dos últimos meses completos e maiores categorias do mês passado — use para avaliar viabilidade de metas.",
        "Descrições de transações, compras e assinaturas não são enviadas ao modelo.",
      ],
    },
  };
}
