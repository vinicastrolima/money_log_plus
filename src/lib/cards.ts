import type { CardPurchase, Category, CreditCard } from "./types";
import { MONTH_NAMES_PT, parseISODate, toISODate } from "./utils";

export interface InstallmentLine {
  dueDate: string;
  amount: number;
  purchaseId: string;
  installmentNumber: number;
  installmentsTotal: number;
  purchaseDescription: string;
}

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
    };
  });
}

export interface AggregatedCardPayment {
  dueDate: string;
  total: number;
  lines: InstallmentLine[];
}

/** Agrupa parcelas por data de vencimento (para gerar 1 lançamento por dia no calendário). */
export function aggregateByDueDate(
  purchases: CardPurchase[],
  card: CreditCard
): AggregatedCardPayment[] {
  const map = new Map<string, AggregatedCardPayment>();
  for (const p of purchases) {
    for (const line of installmentsForPurchaseWithCard(p, card)) {
      const cur = map.get(line.dueDate) ?? {
        dueDate: line.dueDate,
        total: 0,
        lines: [],
      };
      cur.total += line.amount;
      cur.lines.push(line);
      map.set(line.dueDate, cur);
    }
  }
  return Array.from(map.values()).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

/** Total de parcelas pendentes (futuras) de um cartão. */
export function cardOpenTotal(
  purchases: CardPurchase[],
  card: CreditCard,
  today: Date = new Date()
): number {
  const todayStr = toISODate(today);
  let total = 0;
  for (const p of purchases) {
    for (const line of installmentsForPurchaseWithCard(p, card)) {
      if (line.dueDate >= todayStr) total += line.amount;
    }
  }
  return total;
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
  purchaseCount: number;
  installmentCount: number;
}

/** Resumo das parcelas que vencem no mês, considerando o escopo de cartões. */
export function cardPaymentStatsInMonth(
  purchases: CardPurchase[],
  cards: CreditCard[],
  year: number,
  month0: number,
  filterCardId?: string | null
): CardPaymentStats {
  const cardMap = new Map(cards.map((card) => [card.id, card]));
  const purchaseIds = new Set<string>();
  let installmentCount = 0;
  let total = 0;

  for (const purchase of purchases) {
    if (filterCardId && purchase.credit_card_id !== filterCardId) continue;
    const card = cardMap.get(purchase.credit_card_id);
    if (!card) continue;

    for (const line of installmentsForPurchaseWithCard(purchase, card)) {
      const dueDate = parseISODate(line.dueDate);
      if (dueDate.getFullYear() !== year || dueDate.getMonth() !== month0) {
        continue;
      }
      purchaseIds.add(purchase.id);
      installmentCount += 1;
      total += line.amount;
    }
  }

  return {
    total: Math.round(total * 100) / 100,
    purchaseCount: purchaseIds.size,
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
  filterCardId?: string | null
): CategorySpend[] {
  const cardMap = new Map(cards.map((c) => [c.id, c]));
  const catById = new Map(categories.map((c) => [c.id, c]));
  const totals = new Map<string, number>();

  for (const p of purchases) {
    if (filterCardId && p.credit_card_id !== filterCardId) continue;
    const card = cardMap.get(p.credit_card_id);
    if (!card) continue;
    for (const line of installmentsForPurchaseWithCard(p, card)) {
      const d = parseISODate(line.dueDate);
      if (d.getFullYear() !== year || d.getMonth() !== month0) continue;
      const key = p.category_id ?? "none";
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
  byCard: { cardId: string; name: string; color: string; amount: number }[];
}

/** Fatura por mês a partir de um mês de referência. */
export function paymentsByMonthRange(
  purchases: CardPurchase[],
  cards: CreditCard[],
  startYear: number,
  startMonth0: number,
  monthCount: number,
  filterCardId?: string | null
): MonthlyPaymentPoint[] {
  const cardMap = new Map(cards.map((c) => [c.id, c]));
  const points: MonthlyPaymentPoint[] = [];

  for (let i = 0; i < monthCount; i++) {
    const d = new Date(startYear, startMonth0 + i, 1);
    const year = d.getFullYear();
    const month0 = d.getMonth();
    const key = `${year}-${String(month0 + 1).padStart(2, "0")}`;
    const byCard = new Map<string, number>();

    for (const p of purchases) {
      if (filterCardId && p.credit_card_id !== filterCardId) continue;
      const card = cardMap.get(p.credit_card_id);
      if (!card) continue;
      for (const line of installmentsForPurchaseWithCard(p, card)) {
        const ld = parseISODate(line.dueDate);
        if (ld.getFullYear() === year && ld.getMonth() === month0) {
          byCard.set(card.id, (byCard.get(card.id) ?? 0) + line.amount);
        }
      }
    }

    const byCardArr = Array.from(byCard.entries()).map(([cardId, amount]) => {
      const card = cardMap.get(cardId)!;
      return {
        cardId,
        name: card.name,
        color: cardChartColor(card, cards.findIndex((c) => c.id === cardId)),
        amount: Math.round(amount * 100) / 100,
      };
    });

    points.push({
      key,
      label: `${MONTH_NAMES_PT[month0].slice(0, 3)}`,
      total: Math.round(byCardArr.reduce((s, c) => s + c.amount, 0) * 100) / 100,
      byCard: byCardArr,
    });
  }
  return points;
}

/** Total em aberto de todos os cartões. */
export function allCardsOpenTotal(
  purchases: CardPurchase[],
  cards: CreditCard[],
  today: Date = new Date()
): number {
  return cards.reduce(
    (sum, card) =>
      sum + cardOpenTotal(
        purchases.filter((p) => p.credit_card_id === card.id),
        card,
        today
      ),
    0
  );
}
