import type { TxStatus } from "./types";

export const TX_STATUS: Record<
  TxStatus,
  { label: string; dot: string; badge: string; ring: string; border: string }
> = {
  concluido: {
    label: "Concluído",
    dot: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    ring: "ring-emerald-400",
    border: "border-l-emerald-500",
  },
  pendente: {
    label: "Pendente",
    dot: "bg-amber-400",
    badge: "bg-amber-50 text-amber-800 border-amber-200",
    ring: "ring-amber-400",
    border: "border-l-amber-400",
  },
  atrasado: {
    label: "Atrasado",
    dot: "bg-red-500",
    badge: "bg-red-50 text-red-700 border-red-200",
    ring: "ring-red-400",
    border: "border-l-red-500",
  },
};

export const TX_STATUS_ORDER: TxStatus[] = [
  "concluido",
  "pendente",
  "atrasado",
];

/** Status mais crítico do dia (atrasado > pendente > concluído). */
export function dominantStatus(
  statuses: TxStatus[]
): TxStatus | null {
  if (!statuses.length) return null;
  if (statuses.includes("atrasado")) return "atrasado";
  if (statuses.includes("pendente")) return "pendente";
  return "concluido";
}

/** Status sugerido ao criar: passado = atrasado, hoje/futuro = pendente. */
export function suggestStatusForDate(date: string): TxStatus {
  const [y, m, d] = date.split("-").map(Number);
  const txDate = new Date(y, (m ?? 1) - 1, d ?? 1);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  txDate.setHours(0, 0, 0, 0);
  return txDate < today ? "atrasado" : "pendente";
}
