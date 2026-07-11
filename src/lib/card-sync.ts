import type { SupabaseClient } from "@supabase/supabase-js";
import { aggregateByDueDate } from "./cards";
import type { CardPurchase, CardSubscription, CreditCard } from "./types";
import { toISODate } from "./utils";

export async function syncCreditCardTransactions(
  supabase: SupabaseClient,
  card: CreditCard,
  purchases: CardPurchase[],
  subscriptions: CardSubscription[],
  cartaoCategoryId: string,
  userId: string
) {
  const today = toISODate(new Date());

  await supabase
    .from("transactions")
    .delete()
    .eq("credit_card_id", card.id)
    .eq("user_id", userId)
    .gte("date", today);

  const aggs = aggregateByDueDate(purchases, card, subscriptions).filter(
    (agg) => agg.dueDate >= today
  );
  if (aggs.length === 0) return;

  const rows = aggs.map((agg) => ({
    user_id: userId,
    date: agg.dueDate,
    description: card.name,
    amount: Math.round(agg.total * 100) / 100,
    direction: "out" as const,
    category_id: cartaoCategoryId,
    type: "prevista" as const,
    status: agg.dueDate < today ? ("atrasado" as const) : ("pendente" as const),
    credit_card_id: card.id,
  }));

  const { error } = await supabase.from("transactions").insert(rows);
  if (error) throw error;
}
