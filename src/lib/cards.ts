import type { CardPurchase, CreditCard } from "./types";
import { parseISODate, toISODate } from "./utils";

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
  const first = firstPaymentDate(purchase.purchase_date, card.due_day);

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
