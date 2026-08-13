import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  aggregateByDueDate,
  cardAvailableLimit,
  cardClosingDay,
  cardInvoiceStatusByDate,
  cardNextPayment,
  cardOpenTotal,
} from "./cards";
import { sanitizeFinancialLabel } from "./financial-assistant-scope";
import type {
  CardPurchase,
  CardSubscription,
  CreditCard,
  TxStatus,
} from "./types";
import { parseISODate } from "./utils";

type TransactionRow = {
  date: string;
  amount: number | string;
  direction: "in" | "out";
  category_id: string | null;
  type: "prevista" | "diaria";
  status: "concluido" | "pendente" | "atrasado";
  credit_card_id: string | null;
};

type InvoiceTransactionRow = {
  date: string;
  status: TxStatus;
  direction: "in" | "out";
  credit_card_id: string | null;
};

type CategoryRow = {
  id: string;
  name: string;
};

type CreditCardRow = {
  id: string;
  user_id: string;
  name: string;
  due_day: number;
  closing_day: number | null;
  credit_limit: number | string | null;
  created_at: string;
};

type CardPurchaseRow = {
  id: string;
  user_id: string;
  credit_card_id: string;
  purchase_date: string;
  total_amount: number | string;
  installments: number;
  category_id: string | null;
  created_at: string;
};

type SubscriptionRow = {
  id: string;
  user_id: string;
  credit_card_id: string;
  amount: number | string;
  category_id: string | null;
  start_date: string;
  active: boolean;
  created_at: string;
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
  incomeByCategoryByMonth: Array<{
    month: string;
    totalRegistered: number;
    salaryIncome: number;
    extraIncome: number;
    categories: Array<{
      category: string;
      total: number;
      isSalary: boolean;
    }>;
  }>;
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
  cardsSummary: {
    count: number;
    totalCreditLimit: number | null;
    totalOpen: number;
    totalAvailable: number | null;
    cards: Array<{
      name: string;
      dueDay: number;
      closingDay: number;
      creditLimit: number | null;
      openTotal: number;
      availableLimit: number | null;
      nextInvoice: {
        dueDate: string;
        dueDateLabel: string;
        amount: number;
        status: "pendente" | "atrasado" | "futura";
      } | null;
      upcomingInvoices: Array<{
        dueDate: string;
        dueDateLabel: string;
        amount: number;
        status: "pendente" | "atrasado" | "futura" | "pago";
      }>;
      activeSubscriptionsCount: number;
      activeSubscriptionsMonthlyTotal: number;
      purchasesInPeriod: number;
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
    salaryIncome: number;
    extraIncome: number;
    registeredExpenses: number;
    projectedBalance: number;
    percentOfIncome: {
      p10: number;
      p20: number;
      p25: number;
      p30: number;
      p50: number;
    };
    percentOfSalary: {
      p10: number;
      p20: number;
      p25: number;
      p30: number;
      p50: number;
    } | null;
    rule502030OnSalary: {
      needs: number;
      wants: number;
      savingsOrDebt: number;
    } | null;
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

interface IncomeCategoryBucket {
  category: string;
  total: number;
  isSalary: boolean;
}

function isSalaryCategoryName(name: string) {
  const normalized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  return normalized === "salario" || normalized.startsWith("salario ");
}

function percentBuckets(base: number) {
  return {
    p10: roundMoney(base * 0.1),
    p20: roundMoney(base * 0.2),
    p25: roundMoney(base * 0.25),
    p30: roundMoney(base * 0.3),
    p50: roundMoney(base * 0.5),
  };
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

  const [
    categoriesResult,
    transactionsResult,
    purchasesResult,
    subscriptionsResult,
    settingsResult,
    cardsResult,
    invoiceTxResult,
  ] = await Promise.all([
    supabase.from("categories").select("id,name").eq("user_id", userId),
    supabase
      .from("transactions")
      .select("date,amount,direction,category_id,type,status,credit_card_id")
      .eq("user_id", userId)
      .gte("date", dateContext.start)
      .lte("date", dateContext.end),
    supabase
      .from("card_purchases")
      .select(
        "id,user_id,credit_card_id,purchase_date,total_amount,installments,category_id,created_at"
      )
      .eq("user_id", userId),
    supabase
      .from("card_subscriptions")
      .select(
        "id,user_id,credit_card_id,amount,category_id,start_date,active,created_at"
      )
      .eq("user_id", userId)
      .eq("active", true),
    supabase
      .from("settings")
      .select("daily_target,cycle_days")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("credit_cards")
      .select("id,user_id,name,due_day,closing_day,credit_limit,created_at")
      .eq("user_id", userId)
      .order("name"),
    supabase
      .from("transactions")
      .select("date,status,direction,credit_card_id")
      .eq("user_id", userId)
      .not("credit_card_id", "is", null),
  ]);

  const firstError = [
    categoriesResult.error,
    transactionsResult.error,
    purchasesResult.error,
    subscriptionsResult.error,
    settingsResult.error,
    cardsResult.error,
    invoiceTxResult.error,
  ].find(Boolean);
  if (firstError) throw new Error("Não foi possível montar o resumo financeiro.");

  const categories = (categoriesResult.data ?? []) as CategoryRow[];
  const transactions = (transactionsResult.data ?? []) as TransactionRow[];
  const purchases = (purchasesResult.data ?? []) as CardPurchaseRow[];
  const subscriptions = (subscriptionsResult.data ?? []) as SubscriptionRow[];
  const settings = settingsResult.data as SettingsRow | null;
  const creditCards = (cardsResult.data ?? []) as CreditCardRow[];
  const invoiceTransactions = (invoiceTxResult.data ?? []) as InvoiceTransactionRow[];
  const todayDate = parseISODate(dateContext.today);
  const purchasesInPeriodCount = purchases.filter((purchase) => {
    const month = monthKey(purchase.purchase_date);
    return month >= dateContext.start.slice(0, 7) && month <= dateContext.currentMonth;
  }).length;
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
  const incomeBuckets = new Map<string, IncomeCategoryBucket>();
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

  function getIncomeBucket(month: string, categoryId: string | null) {
    const key = `${month}:${categoryId ?? "none"}`;
    const existing = incomeBuckets.get(key);
    if (existing) return existing;

    const category = categoryName(categoryId);
    const created: IncomeCategoryBucket = {
      category,
      total: 0,
      isSalary: isSalaryCategoryName(category),
    };
    incomeBuckets.set(key, created);
    return created;
  }

  for (const transaction of transactions) {
    const month = monthKey(transaction.date);
    const monthly = cashFlowMap.get(month);
    if (!monthly) continue;
    const value = amount(transaction.amount);

    if (transaction.direction === "in") {
      monthly.registeredIncome += value;
      getIncomeBucket(month, transaction.category_id).total += value;
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
    const value = amount(purchase.total_amount);
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

  const incomeByCategoryByMonth = monthKeys.map((month) => {
    const categoriesForMonth = [...incomeBuckets.entries()]
      .filter(([key]) => key.startsWith(`${month}:`))
      .map(([, bucket]) => ({
        category: bucket.category,
        total: roundMoney(bucket.total),
        isSalary: bucket.isSalary,
      }))
      .filter((category) => category.total > 0)
      .sort((a, b) => b.total - a.total);

    const salaryIncome = roundMoney(
      categoriesForMonth
        .filter((category) => category.isSalary)
        .reduce((total, category) => total + category.total, 0)
    );
    const totalRegistered = roundMoney(
      categoriesForMonth.reduce((total, category) => total + category.total, 0)
    );

    return {
      month,
      totalRegistered,
      salaryIncome,
      extraIncome: roundMoney(totalRegistered - salaryIncome),
      categories: categoriesForMonth,
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

  const previousIncomeBreakdown = incomeByCategoryByMonth.find(
    (month) => month.month === dateContext.previousMonth
  );
  const previousSalaryIncome = previousIncomeBreakdown?.salaryIncome ?? 0;
  const previousExtraIncome = previousIncomeBreakdown?.extraIncome ?? 0;
  const adviceAnchors = previousCashFlow
    ? {
        referenceMonth: dateContext.previousMonth,
        referenceMonthLabel: dateContext.previousMonthLabel,
        registeredIncome: previousCashFlow.registeredIncome,
        salaryIncome: previousSalaryIncome,
        extraIncome: previousExtraIncome,
        registeredExpenses: previousCashFlow.registeredExpenses,
        projectedBalance: previousCashFlow.projectedBalance,
        percentOfIncome: percentBuckets(previousCashFlow.registeredIncome),
        percentOfSalary:
          previousSalaryIncome > 0 ? percentBuckets(previousSalaryIncome) : null,
        rule502030OnSalary:
          previousSalaryIncome > 0
            ? {
                needs: roundMoney(previousSalaryIncome * 0.5),
                wants: roundMoney(previousSalaryIncome * 0.2),
                savingsOrDebt: roundMoney(previousSalaryIncome * 0.3),
              }
            : null,
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

  const typedPurchases: CardPurchase[] = purchases.map((purchase) => ({
    id: purchase.id,
    user_id: purchase.user_id,
    credit_card_id: purchase.credit_card_id,
    description: "",
    total_amount: amount(purchase.total_amount),
    installments: purchase.installments,
    purchase_date: purchase.purchase_date,
    category_id: purchase.category_id,
    created_at: purchase.created_at,
  }));
  const typedSubscriptions: CardSubscription[] = subscriptions.map(
    (subscription) => ({
      id: subscription.id,
      user_id: subscription.user_id,
      credit_card_id: subscription.credit_card_id,
      description: "",
      amount: amount(subscription.amount),
      category_id: subscription.category_id,
      start_date: subscription.start_date,
      active: subscription.active,
      created_at: subscription.created_at,
    })
  );

  function invoiceDueLabel(dueDate: string) {
    const [year, month] = dueDate.split("-").map(Number);
    const day = Number(dueDate.slice(8, 10));
    return `${pad(day)}/${pad(month)}/${year} (${monthLabel(year, month - 1)})`;
  }

  function invoiceStatusLabel(
    status: TxStatus | undefined,
    dueDate: string
  ): "pendente" | "atrasado" | "futura" | "pago" {
    if (status === "concluido") return "pago";
    if (status === "atrasado") return "atrasado";
    if (status === "pendente") return "pendente";
    return dueDate < dateContext.today ? "atrasado" : "futura";
  }

  const cardSummaries = creditCards.map((cardRow) => {
    const card: CreditCard = {
      id: cardRow.id,
      user_id: cardRow.user_id,
      name: cardRow.name,
      due_day: cardRow.due_day,
      closing_day: cardRow.closing_day,
      credit_limit:
        cardRow.credit_limit == null ? null : amount(cardRow.credit_limit),
      created_at: cardRow.created_at,
    };
    const cardPurchases = typedPurchases.filter(
      (purchase) => purchase.credit_card_id === card.id
    );
    const cardSubscriptions = typedSubscriptions.filter(
      (subscription) => subscription.credit_card_id === card.id
    );
    const invoiceStatus = cardInvoiceStatusByDate(invoiceTransactions, card.id);
    const openTotal = cardOpenTotal(
      cardPurchases,
      card,
      todayDate,
      invoiceStatus
    );
    const creditLimit =
      card.credit_limit == null ? null : roundMoney(card.credit_limit);
    const availableLimit = cardAvailableLimit(creditLimit, openTotal);
    const next = cardNextPayment(
      cardPurchases,
      card,
      cardSubscriptions,
      todayDate,
      invoiceStatus
    );
    const upcomingInvoices = aggregateByDueDate(
      cardPurchases,
      card,
      cardSubscriptions
    )
      .filter((payment) => payment.dueDate >= dateContext.today)
      .slice(0, 4)
      .map((payment) => ({
        dueDate: payment.dueDate,
        dueDateLabel: invoiceDueLabel(payment.dueDate),
        amount: roundMoney(payment.total),
        status: invoiceStatusLabel(
          invoiceStatus.get(payment.dueDate),
          payment.dueDate
        ),
      }));
    const activeSubscriptionsMonthlyTotal = roundMoney(
      cardSubscriptions.reduce(
        (total, subscription) => total + subscription.amount,
        0
      )
    );

    return {
      name: sanitizeFinancialLabel(card.name),
      dueDay: card.due_day,
      closingDay: cardClosingDay(card),
      creditLimit,
      openTotal: roundMoney(openTotal),
      availableLimit:
        availableLimit == null ? null : roundMoney(availableLimit),
      nextInvoice: next
        ? {
            dueDate: next.dueDate,
            dueDateLabel: invoiceDueLabel(next.dueDate),
            amount: roundMoney(next.total),
            status: invoiceStatusLabel(
              invoiceStatus.get(next.dueDate),
              next.dueDate
            ) as "pendente" | "atrasado" | "futura",
          }
        : null,
      upcomingInvoices,
      activeSubscriptionsCount: cardSubscriptions.length,
      activeSubscriptionsMonthlyTotal,
      purchasesInPeriod: cardPurchases.filter((purchase) => {
        const month = monthKey(purchase.purchase_date);
        return (
          month >= dateContext.start.slice(0, 7) &&
          month <= dateContext.currentMonth
        );
      }).length,
    };
  });

  const cardsWithLimit = cardSummaries.filter(
    (card) => card.creditLimit != null
  );
  const totalCreditLimit = cardsWithLimit.length
    ? roundMoney(
        cardsWithLimit.reduce((total, card) => total + (card.creditLimit ?? 0), 0)
      )
    : null;
  const totalOpen = roundMoney(
    cardSummaries.reduce((total, card) => total + card.openTotal, 0)
  );
  const cardsSummary = {
    count: cardSummaries.length,
    totalCreditLimit,
    totalOpen,
    totalAvailable:
      totalCreditLimit == null
        ? null
        : roundMoney(Math.max(totalCreditLimit - totalOpen, 0)),
    cards: cardSummaries,
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
    incomeByCategoryByMonth,
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
    cardsSummary,
    budget: {
      dailyTarget: settings ? roundMoney(amount(settings.daily_target)) : null,
      cycleDays: settings?.cycle_days ?? null,
    },
    adviceAnchors,
    trendInsights,
    dataQuality: {
      transactionCount: transactions.length,
      cardPurchaseCount: purchasesInPeriodCount,
      monthsWithData,
      notes: [
        `Hoje é ${dateContext.todayLabel}. Mês atual: ${dateContext.currentMonthLabel} (pode estar incompleto). Mês passado: ${dateContext.previousMonthLabel}.`,
        "Fluxo de caixa usa os lançamentos registrados e inclui faturas de cartão geradas pelo aplicativo.",
        "Gastos por categoria excluem essas faturas agregadas e usam as compras de cartão na data e no valor total da compra, evitando dupla contagem.",
        "cardsSummary traz cada cartão: nome, fechamento, vencimento, limite, aberto, disponível, próxima fatura e próximas faturas.",
        "incomeByCategoryByMonth quebra entradas por categoria; isSalary=true marca categoria Salário. O restante é extra.",
        "Para regras tipo 50/20/30 sobre salário, use adviceAnchors.rule502030OnSalary e percentOfSalary.",
        "percentOfIncome usa a renda total; percentOfSalary usa só a categoria Salário.",
        "trendInsights resume média dos últimos meses completos e maiores categorias do mês passado — use para avaliar viabilidade de metas.",
        "Descrições de transações, compras e assinaturas não são enviadas ao modelo.",
      ],
    },
  };
}
