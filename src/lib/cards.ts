import type {
  CardInvoicePrepayment,
  CardPurchase,
  CardSubscription,
  Category,
  CreditCard,
  Direction,
  TxStatus,
} from "./types";
import { MONTH_NAMES_PT, parseISODate, toISODate } from "./utils";

type InvoiceTxRef = {
  credit_card_id: string | null;
  date: string;
  status: TxStatus;
  direction?: Direction;
};

/** Normaliza "2026-08-10" ou ISO datetime para chave YYYY-MM-DD. */
export function invoiceDateKey(value: string): string {
  return value.slice(0, 10);
}

/** Status das faturas geradas (lançamentos com credit_card_id) por vencimento. */
export function cardInvoiceStatusByDate(
  transactions: InvoiceTxRef[],
  cardId: string
): Map<string, TxStatus> {
  const map = new Map<string, TxStatus>();
  for (const tx of transactions) {
    if (tx.credit_card_id !== cardId) continue;
    if (tx.direction != null && tx.direction !== "out") continue;
    map.set(invoiceDateKey(tx.date), tx.status);
  }
  return map;
}

function invoiceIsPaid(
  invoiceStatusByDate: ReadonlyMap<string, TxStatus> | undefined,
  dueDate: string
): boolean {
  return invoiceStatusByDate?.get(invoiceDateKey(dueDate)) === "concluido";
}

function invoiceStatusOnDate(
  invoiceStatusByDate: ReadonlyMap<string, TxStatus> | undefined,
  dueDate: string
): TxStatus | undefined {
  return invoiceStatusByDate?.get(invoiceDateKey(dueDate));
}

export interface InstallmentLine {
  dueDate: string;
  amount: number;
  purchaseId: string;
  installmentNumber: number;
  installmentsTotal: number;
  purchaseDescription: string;
  categoryId?: string | null;
  isSubscription?: boolean;
}

/** Meses futuros gerados para assinaturas recorrentes. */
export const SUBSCRIPTION_HORIZON_MONTHS = 36;

/** Dia de vencimento válido no mês (ajusta 31 → último dia do mês). */
export function dueDateInMonth(year: number, month0: number, dueDay: number): Date {
  const lastDay = new Date(year, month0 + 1, 0).getDate();
  const day = Math.min(dueDay, lastDay);
  return new Date(year, month0, day);
}

/** Primeira data de pagamento após a compra. */
export function firstPaymentDate(purchaseDate: string, dueDay: number): Date {
  const p = parseISODate(purchaseDate);
  let candidate = dueDateInMonth(p.getFullYear(), p.getMonth(), dueDay);
  if (candidate <= p) {
    candidate = dueDateInMonth(p.getFullYear(), p.getMonth() + 1, dueDay);
  }
  return candidate;
}

/** Fechamento padrão: 7 dias antes do vencimento, com volta para o mês anterior. */
export function defaultClosingDay(dueDay: number): number {
  return ((dueDay - 8 + 31) % 31) + 1;
}

export function cardClosingDay(card: CreditCard): number {
  return card.closing_day ?? defaultClosingDay(card.due_day);
}

/** Vencimento da fatura onde a compra entra, considerando o dia de fechamento. */
export function invoiceDueDateForPurchase(
  purchaseDate: string,
  dueDay: number,
  closingDay: number
): Date {
  const purchase = parseISODate(purchaseDate);
  for (let offset = 0; offset < 3; offset++) {
    const dueDate = dueDateInMonth(
      purchase.getFullYear(),
      purchase.getMonth() + offset,
      dueDay
    );
    const closingMonthOffset = closingDay >= dueDay ? offset - 1 : offset;
    const closingDate = dueDateInMonth(
      purchase.getFullYear(),
      purchase.getMonth() + closingMonthOffset,
      closingDay
    );
    if (purchase <= closingDate) return dueDate;
  }

  return dueDateInMonth(purchase.getFullYear(), purchase.getMonth() + 3, dueDay);
}

/** Calcula valor de cada parcela (última absorve centavos). */
export function splitInstallments(total: number, count: number): number[] {
  const base = Math.floor((total / count) * 100) / 100;
  const amounts = Array.from({ length: count }, () => base);
  const sum = base * count;
  const remainder = Math.round((total - sum) * 100) / 100;
  amounts[count - 1] = Math.round((amounts[count - 1] + remainder) * 100) / 100;
  return amounts;
}

/** Soma das antecipações de um cartão para um vencimento. */
export function prepaymentTotalForDueDate(
  prepayments: CardInvoicePrepayment[],
  cardId: string,
  dueDate: string
): number {
  const key = invoiceDateKey(dueDate);
  let total = 0;
  for (const prepayment of prepayments) {
    if (prepayment.credit_card_id !== cardId) continue;
    if (invoiceDateKey(prepayment.invoice_due_date) !== key) continue;
    total += prepayment.amount;
  }
  return Math.round(total * 100) / 100;
}

/** Valor líquido da fatura após antecipações. */
export function invoiceNetTotal(gross: number, prepaid: number): number {
  return Math.max(0, Math.round((gross - prepaid) * 100) / 100);
}

/** Gera todas as parcelas de uma compra para um cartão. */
export function installmentsForPurchaseWithCard(
  purchase: CardPurchase,
  card: CreditCard
): InstallmentLine[] {
  const amounts = splitInstallments(purchase.total_amount, purchase.installments);
  const first = invoiceDueDateForPurchase(
    purchase.purchase_date,
    card.due_day,
    cardClosingDay(card)
  );

  return amounts.map((amount, i) => {
    const monthDate = dueDateInMonth(
      first.getFullYear(),
      first.getMonth() + i,
      card.due_day
    );
    return {
      dueDate: toISODate(monthDate),
      amount,
      purchaseId: purchase.id,
      installmentNumber: i + 1,
      installmentsTotal: purchase.installments,
      purchaseDescription: purchase.description,
      categoryId: purchase.category_id,
      isSubscription: false,
    };
  });
}

/** Gera cobranças mensais de uma assinatura recorrente. */
export function installmentsForSubscription(
  subscription: CardSubscription,
  card: CreditCard,
  horizonMonths = SUBSCRIPTION_HORIZON_MONTHS
): InstallmentLine[] {
  if (!subscription.active) return [];

  const first = invoiceDueDateForPurchase(
    subscription.start_date,
    card.due_day,
    cardClosingDay(card)
  );

  return Array.from({ length: horizonMonths }, (_, i) => {
    const monthDate = dueDateInMonth(
      first.getFullYear(),
      first.getMonth() + i,
      card.due_day
    );
    return {
      dueDate: toISODate(monthDate),
      amount: subscription.amount,
      purchaseId: subscription.id,
      installmentNumber: i + 1,
      installmentsTotal: 0,
      purchaseDescription: subscription.description,
      categoryId: subscription.category_id,
      isSubscription: true,
    };
  });
}

/** Todas as linhas de fatura (compras + assinaturas). */
export function allInstallmentLines(
  purchases: CardPurchase[],
  subscriptions: CardSubscription[],
  card: CreditCard
): InstallmentLine[] {
  const lines: InstallmentLine[] = [];
  for (const purchase of purchases) {
    lines.push(...installmentsForPurchaseWithCard(purchase, card));
  }
  for (const subscription of subscriptions) {
    if (subscription.credit_card_id !== card.id) continue;
    lines.push(...installmentsForSubscription(subscription, card));
  }
  return lines;
}

export interface AggregatedCardPayment {
  dueDate: string;
  total: number;
  /** Total bruto antes das antecipações (igual a total quando não há abatimento). */
  grossTotal: number;
  prepaidTotal: number;
  lines: InstallmentLine[];
}

/** Agrupa parcelas por data de vencimento (para gerar 1 lançamento por dia no calendário). */
export function aggregateByDueDate(
  purchases: CardPurchase[],
  card: CreditCard,
  subscriptions: CardSubscription[] = [],
  prepayments: CardInvoicePrepayment[] = []
): AggregatedCardPayment[] {
  const map = new Map<string, AggregatedCardPayment>();
  for (const line of allInstallmentLines(purchases, subscriptions, card)) {
    const cur = map.get(line.dueDate) ?? {
      dueDate: line.dueDate,
      total: 0,
      grossTotal: 0,
      prepaidTotal: 0,
      lines: [],
    };
    cur.grossTotal += line.amount;
    cur.lines.push(line);
    map.set(line.dueDate, cur);
  }

  return Array.from(map.values())
    .map((agg) => {
      const prepaidTotal = prepaymentTotalForDueDate(
        prepayments,
        card.id,
        agg.dueDate
      );
      const grossTotal = Math.round(agg.grossTotal * 100) / 100;
      return {
        ...agg,
        grossTotal,
        prepaidTotal,
        total: invoiceNetTotal(grossTotal, prepaidTotal),
      };
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

/**
 * Totais em aberto: parcelas de compras que ainda consomem limite
 * (sem assinaturas). Faturas com status `concluido` liberam o valor.
 * Parcelas vencidas só entram se a fatura correspondente ainda estiver
 * pendente/atrasada.
 */
export function cardOpenTotals(
  purchases: CardPurchase[],
  card: CreditCard,
  today: Date = new Date(),
  invoiceStatusByDate?: ReadonlyMap<string, TxStatus>,
  prepayments: CardInvoicePrepayment[] = []
): { total: number } {
  const todayStr = toISODate(today);
  const prepaidByDue = new Map<string, number>();
  for (const prepayment of prepayments) {
    if (prepayment.credit_card_id !== card.id) continue;
    const key = invoiceDateKey(prepayment.invoice_due_date);
    prepaidByDue.set(key, (prepaidByDue.get(key) ?? 0) + prepayment.amount);
  }

  // Em aberto por vencimento (só compras), depois abate antecipações daquele dia.
  const openByDue = new Map<string, number>();
  for (const purchase of purchases) {
    if (purchase.credit_card_id !== card.id) continue;
    for (const line of installmentsForPurchaseWithCard(purchase, card)) {
      if (invoiceIsPaid(invoiceStatusByDate, line.dueDate)) continue;

      if (line.dueDate < todayStr) {
        const status = invoiceStatusOnDate(invoiceStatusByDate, line.dueDate);
        if (status !== "pendente" && status !== "atrasado") continue;
      }

      const key = invoiceDateKey(line.dueDate);
      openByDue.set(key, (openByDue.get(key) ?? 0) + line.amount);
    }
  }

  let total = 0;
  for (const [dueKey, gross] of openByDue) {
    const prepaid = prepaidByDue.get(dueKey) ?? 0;
    total += invoiceNetTotal(gross, prepaid);
  }
  return {
    total: Math.round(total * 100) / 100,
  };
}

/** Total em aberto pelo valor cheio da fatura. */
export function cardOpenTotal(
  purchases: CardPurchase[],
  card: CreditCard,
  today: Date = new Date(),
  invoiceStatusByDate?: ReadonlyMap<string, TxStatus>,
  prepayments: CardInvoicePrepayment[] = []
): number {
  return cardOpenTotals(purchases, card, today, invoiceStatusByDate, prepayments)
    .total;
}

/** Limite disponível = limite cadastrado − valor em aberto (após pagamentos). */
export function cardAvailableLimit(
  creditLimit: number | null | undefined,
  openTotal: number
): number | null {
  if (creditLimit == null || !Number.isFinite(creditLimit)) return null;
  return Math.max(Math.round((creditLimit - openTotal) * 100) / 100, 0);
}

/**
 * Próxima fatura em aberto.
 * Assim que uma fatura é marcada como `concluido`, ela deixa de ser a
 * "próxima" — sem esperar o vencimento passar — e o app aponta para a
 * seguinte pendente/atrasada.
 */
export function cardNextPayment(
  purchases: CardPurchase[],
  card: CreditCard,
  subscriptions: CardSubscription[] = [],
  today: Date = new Date(),
  invoiceStatusByDate?: ReadonlyMap<string, TxStatus>,
  prepayments: CardInvoicePrepayment[] = []
): AggregatedCardPayment | null {
  const todayStr = toISODate(today);
  return (
    aggregateByDueDate(purchases, card, subscriptions, prepayments).find(
      (payment) => {
        if (invoiceIsPaid(invoiceStatusByDate, payment.dueDate)) return false;
        // Fatura 100% antecipada não aparece mais como próxima.
        if (payment.total <= 0.005) return false;

        if (payment.dueDate < todayStr) {
          const status = invoiceStatusOnDate(invoiceStatusByDate, payment.dueDate);
          // Vencida só continua como "próxima" se ainda estiver em aberto.
          return status === "pendente" || status === "atrasado";
        }

        return true;
      }
    ) ?? null
  );
}

export const CARD_GRADIENTS: [string, string][] = [
  ["#262626", "#000000"],
  ["#7c3aed", "#4c1d95"],
  ["#f97316", "#c2410c"],
  ["#0ea5e9", "#0369a1"],
  ["#16a34a", "#14532d"],
  ["#ec4899", "#9d174d"],
  ["#6366f1", "#3730a3"],
  ["#14b8a6", "#0f766e"],
  ["#e11d48", "#881337"],
  ["#eab308", "#a16207"],
];

/** Gradiente padrão ao criar um cartão novo (roxo). */
export const DEFAULT_CARD_GRADIENT: [string, string] = ["#7c3aed", "#4c1d95"];

export const ALL_CARDS_GRADIENT: [string, string] = ["#1e293b", "#0f172a"];
export const CARD_CHART_COLORS = CARD_GRADIENTS.map(([color]) => color);
export const ALL_CARDS_CHART_COLOR = ALL_CARDS_GRADIENT[0];
export const UNCATEGORIZED_CHART_COLOR = "#94a3b8";

function normalizedPaletteIndex(index: number, length: number): number {
  return ((index % length) + length) % length;
}

export function cardGradient(index: number): [string, string] {
  return CARD_GRADIENTS[normalizedPaletteIndex(index, CARD_GRADIENTS.length)];
}

export function creditCardGradient(
  card: CreditCard,
  index: number
): [string, string] {
  const fallback = cardGradient(index);
  return [card.color_start ?? fallback[0], card.color_end ?? fallback[1]];
}

export function cardChartColor(card: CreditCard, index: number): string {
  return card.color_start ?? CARD_CHART_COLORS[
    normalizedPaletteIndex(index, CARD_CHART_COLORS.length)
  ];
}

export interface CardPaymentStats {
  total: number;
  grossTotal: number;
  prepaidTotal: number;
  purchaseCount: number;
  installmentCount: number;
}

export interface ScopedInstallmentLine extends InstallmentLine {
  cardId: string;
  cardName: string;
}

export type InvoiceListFilter =
  | { kind: "month"; year: number; month0: number }
  | { kind: "range"; year: number; month0: number; monthCount: number }
  | { kind: "category"; year: number; month0: number; categoryId: string };

function lineMatchesFilter(line: InstallmentLine, filter: InvoiceListFilter): boolean {
  const due = parseISODate(line.dueDate);
  const dueYear = due.getFullYear();
  const dueMonth = due.getMonth();

  if (filter.kind === "month" || filter.kind === "category") {
    if (dueYear !== filter.year || dueMonth !== filter.month0) return false;
    if (filter.kind === "category") {
      const key = line.categoryId ?? "none";
      return key === filter.categoryId;
    }
    return true;
  }

  const start = filter.year * 12 + filter.month0;
  const end = start + filter.monthCount - 1;
  const point = dueYear * 12 + dueMonth;
  return point >= start && point <= end;
}

/** Parcelas no escopo (mês, intervalo ou categoria) para listagem. */
export function installmentLinesForList(
  purchases: CardPurchase[],
  cards: CreditCard[],
  subscriptions: CardSubscription[],
  filterCardId: string | null | undefined,
  filter: InvoiceListFilter
): ScopedInstallmentLine[] {
  const lines: ScopedInstallmentLine[] = [];

  for (const card of cards) {
    if (filterCardId && card.id !== filterCardId) continue;
    const cardPurchases = purchases.filter((p) => p.credit_card_id === card.id);
    const cardSubs = subscriptions.filter((s) => s.credit_card_id === card.id);
    for (const line of allInstallmentLines(cardPurchases, cardSubs, card)) {
      if (!lineMatchesFilter(line, filter)) continue;
      lines.push({
        ...line,
        cardId: card.id,
        cardName: card.name,
      });
    }
  }

  return lines.sort((a, b) => {
    if (a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    return a.purchaseDescription.localeCompare(b.purchaseDescription, "pt-BR");
  });
}

/** Resumo das parcelas que vencem no mês, considerando o escopo de cartões. */
export function cardPaymentStatsInMonth(
  purchases: CardPurchase[],
  cards: CreditCard[],
  year: number,
  month0: number,
  filterCardId?: string | null,
  subscriptions: CardSubscription[] = [],
  prepayments: CardInvoicePrepayment[] = []
): CardPaymentStats {
  const purchaseIds = new Set<string>();
  const subscriptionIds = new Set<string>();
  let installmentCount = 0;
  let grossTotal = 0;
  let prepaidTotal = 0;
  const countedDueDates = new Set<string>();

  for (const card of cards) {
    if (filterCardId && card.id !== filterCardId) continue;
    const cardPurchases = purchases.filter((p) => p.credit_card_id === card.id);
    const cardSubs = subscriptions.filter((s) => s.credit_card_id === card.id);
    for (const line of allInstallmentLines(cardPurchases, cardSubs, card)) {
      const dueDate = parseISODate(line.dueDate);
      if (dueDate.getFullYear() !== year || dueDate.getMonth() !== month0) continue;
      if (line.isSubscription) subscriptionIds.add(line.purchaseId);
      else purchaseIds.add(line.purchaseId);
      installmentCount += 1;
      grossTotal += line.amount;
      const dueKey = `${card.id}:${line.dueDate}`;
      if (!countedDueDates.has(dueKey)) {
        countedDueDates.add(dueKey);
        prepaidTotal += prepaymentTotalForDueDate(prepayments, card.id, line.dueDate);
      }
    }
  }

  const roundedGross = Math.round(grossTotal * 100) / 100;
  const roundedPrepaid = Math.round(prepaidTotal * 100) / 100;
  return {
    total: invoiceNetTotal(roundedGross, roundedPrepaid),
    grossTotal: roundedGross,
    prepaidTotal: roundedPrepaid,
    purchaseCount: purchaseIds.size + subscriptionIds.size,
    installmentCount,
  };
}

export interface CategorySpend {
  id: string;
  name: string;
  color: string;
  total: number;
}

/** Gastos por categoria com base nas parcelas que vencem no mês. */
export function spendingByCategoryInMonth(
  purchases: CardPurchase[],
  cards: CreditCard[],
  categories: Category[],
  year: number,
  month0: number,
  filterCardId?: string | null,
  subscriptions: CardSubscription[] = []
): CategorySpend[] {
  const catById = new Map(categories.map((c) => [c.id, c]));
  const totals = new Map<string, number>();

  for (const card of cards) {
    if (filterCardId && card.id !== filterCardId) continue;
    const cardPurchases = purchases.filter((p) => p.credit_card_id === card.id);
    const cardSubs = subscriptions.filter((s) => s.credit_card_id === card.id);
    for (const line of allInstallmentLines(cardPurchases, cardSubs, card)) {
      const d = parseISODate(line.dueDate);
      if (d.getFullYear() !== year || d.getMonth() !== month0) continue;
      const key = line.categoryId ?? "none";
      totals.set(key, (totals.get(key) ?? 0) + line.amount);
    }
  }

  const result: CategorySpend[] = [];
  for (const [id, total] of totals) {
    if (total <= 0) continue;
    const cat = id === "none" ? null : catById.get(id);
    result.push({
      id,
      name: cat?.name ?? "Sem categoria",
      color: cat?.color ?? UNCATEGORIZED_CHART_COLOR,
      total: Math.round(total * 100) / 100,
    });
  }
  return result.sort((a, b) => b.total - a.total);
}

export interface MonthlyPaymentPoint {
  key: string;
  label: string;
  total: number;
  grossTotal: number;
  prepaidTotal: number;
  byCard: { cardId: string; name: string; color: string; amount: number }[];
}

/** Fatura por mês a partir de um mês de referência. */
export function paymentsByMonthRange(
  purchases: CardPurchase[],
  cards: CreditCard[],
  startYear: number,
  startMonth0: number,
  monthCount: number,
  filterCardId?: string | null,
  subscriptions: CardSubscription[] = [],
  prepayments: CardInvoicePrepayment[] = []
): MonthlyPaymentPoint[] {
  const cardMap = new Map(cards.map((c) => [c.id, c]));
  const points: MonthlyPaymentPoint[] = [];

  for (let i = 0; i < monthCount; i++) {
    const d = new Date(startYear, startMonth0 + i, 1);
    const year = d.getFullYear();
    const month0 = d.getMonth();
    const key = `${year}-${String(month0 + 1).padStart(2, "0")}`;
    const byCardGross = new Map<string, number>();
    const byCardPrepaid = new Map<string, number>();
    const countedDueDates = new Set<string>();

    for (const card of cards) {
      if (filterCardId && card.id !== filterCardId) continue;
      const cardPurchases = purchases.filter((p) => p.credit_card_id === card.id);
      const cardSubs = subscriptions.filter((s) => s.credit_card_id === card.id);
      for (const line of allInstallmentLines(cardPurchases, cardSubs, card)) {
        const ld = parseISODate(line.dueDate);
        if (ld.getFullYear() !== year || ld.getMonth() !== month0) continue;
        byCardGross.set(card.id, (byCardGross.get(card.id) ?? 0) + line.amount);
        const dueKey = `${card.id}:${line.dueDate}`;
        if (!countedDueDates.has(dueKey)) {
          countedDueDates.add(dueKey);
          const prepaid = prepaymentTotalForDueDate(
            prepayments,
            card.id,
            line.dueDate
          );
          byCardPrepaid.set(card.id, (byCardPrepaid.get(card.id) ?? 0) + prepaid);
        }
      }
    }

    const byCardArr = Array.from(byCardGross.entries()).map(([cardId, gross]) => {
      const card = cardMap.get(cardId)!;
      const prepaid = byCardPrepaid.get(cardId) ?? 0;
      return {
        cardId,
        name: card.name,
        color: cardChartColor(card, cards.findIndex((c) => c.id === cardId)),
        amount: invoiceNetTotal(gross, prepaid),
      };
    });

    const grossTotal = Math.round(
      Array.from(byCardGross.values()).reduce((s, v) => s + v, 0) * 100
    ) / 100;
    const prepaidTotal = Math.round(
      Array.from(byCardPrepaid.values()).reduce((s, v) => s + v, 0) * 100
    ) / 100;

    points.push({
      key,
      label: `${MONTH_NAMES_PT[month0].slice(0, 3)}`,
      total: invoiceNetTotal(grossTotal, prepaidTotal),
      grossTotal,
      prepaidTotal,
      byCard: byCardArr,
    });
  }
  return points;
}

/** Total em aberto de todos os cartões (somente parcelas de compras). */
export function allCardsOpenTotal(
  purchases: CardPurchase[],
  cards: CreditCard[],
  today: Date = new Date(),
  invoiceStatusByDate?: ReadonlyMap<string, TxStatus>,
  prepayments: CardInvoicePrepayment[] = []
): number {
  return cards.reduce(
    (sum, card) =>
      sum +
      cardOpenTotal(
        purchases.filter((p) => p.credit_card_id === card.id),
        card,
        today,
        invoiceStatusByDate,
        prepayments.filter((p) => p.credit_card_id === card.id)
      ),
    0
  );
}
