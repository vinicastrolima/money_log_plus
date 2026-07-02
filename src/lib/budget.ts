import type { Transaction } from "./types";
import { daysInMonth, parseISODate } from "./utils";

export interface MonthSummary {
  income: number;
  expense: number;
  balance: number;
}

export interface DailyBudget {
  target: number; // meta fixa por dia (ex: 50)
  dailyDynamic: number; // saldo disponivel / dias restantes
  available: number; // saldo do mes (entradas - saidas)
  daysInMonth: number;
  daysElapsed: number; // dias decorridos ate hoje (dentro do mes)
  daysRemaining: number; // dias restantes incluindo hoje
  spentDaily: number; // total gasto marcado como 'diaria' (saidas) no mes ate hoje
  allowedSoFar: number; // target * daysElapsed
  envelope: number; // allowedSoFar - spentDaily (positivo = acumulou, negativo = estourou)
  todayRemaining: number; // quanto ainda pode gastar hoje considerando acumulo
}

export function summarizeMonth(txs: Transaction[]): MonthSummary {
  let income = 0;
  let expense = 0;
  for (const t of txs) {
    if (t.direction === "in") income += t.amount;
    else expense += t.amount;
  }
  return { income, expense, balance: income - expense };
}

/**
 * Calcula o orcamento diario para um determinado mes.
 * @param txs transacoes JA filtradas para o mes de referencia
 * @param year ano do mes de referencia
 * @param month0 mes (0-11)
 * @param target meta diaria (ex: 50)
 * @param today data de referencia "hoje" (default: agora)
 */
export function computeDailyBudget(
  txs: Transaction[],
  year: number,
  month0: number,
  target: number,
  today: Date = new Date()
): DailyBudget {
  const totalDays = daysInMonth(year, month0);
  const summary = summarizeMonth(txs);

  // Determina o "dia de hoje" relativo ao mes de referencia.
  const isCurrentMonth =
    today.getFullYear() === year && today.getMonth() === month0;
  const isPastMonth =
    today.getFullYear() > year ||
    (today.getFullYear() === year && today.getMonth() > month0);

  let daysElapsed: number;
  if (isCurrentMonth) daysElapsed = today.getDate();
  else if (isPastMonth) daysElapsed = totalDays;
  else daysElapsed = 0; // mes futuro

  const daysRemaining = Math.max(totalDays - daysElapsed + (isCurrentMonth ? 1 : 0), 0);

  // Gastos "diaria" (apenas saidas) do dia 1 ate hoje.
  let spentDaily = 0;
  for (const t of txs) {
    if (t.type !== "diaria" || t.direction !== "out") continue;
    const day = parseISODate(t.date).getDate();
    if (day <= daysElapsed || !isCurrentMonth) spentDaily += t.amount;
  }

  const allowedSoFar = target * Math.max(daysElapsed, 0);
  const envelope = allowedSoFar - spentDaily;

  const denomDays = isCurrentMonth ? Math.max(daysRemaining, 1) : Math.max(totalDays, 1);
  const dailyDynamic = summary.balance / denomDays;

  // Quanto pode gastar hoje = acumulo (envelope de ontem) + meta de hoje.
  // Simplificacao: envelope ja inclui o dia de hoje na conta allowedSoFar.
  const todayRemaining = envelope;

  return {
    target,
    dailyDynamic,
    available: summary.balance,
    daysInMonth: totalDays,
    daysElapsed,
    daysRemaining,
    spentDaily,
    allowedSoFar,
    envelope,
    todayRemaining,
  };
}

export function filterByMonth(
  txs: Transaction[],
  year: number,
  month0: number
): Transaction[] {
  return txs.filter((t) => {
    const d = parseISODate(t.date);
    return d.getFullYear() === year && d.getMonth() === month0;
  });
}

export interface CategoryTotal {
  categoryId: string | null;
  name: string;
  color: string;
  total: number;
}
