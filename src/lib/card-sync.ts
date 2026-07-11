import type { SupabaseClient } from "@supabase/supabase-js";
import { aggregateByDueDate } from "./cards";
import type { CardPurchase, CreditCard } from "./types";
import { toISODate } from "./utils";

export async function syncCreditCardTransactions(
  supabase: SupabaseClient,
  card: CreditCard,
  purchases: CardPurchase[],
  cartaoCategoryId: string,
  userId: string
) {
  await supabase
    .from("transactions")
    .delete()
    .eq("credit_card_id", card.id)
    .eq("user_id", userId);

  const aggs = aggregateByDueDate(purchases, card);
  if (aggs.length === 0) return;

  const today = toISODate(new Date());
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

export async function syncAllCreditCards(
  supabase: SupabaseClient,
  userId: string,
  cards: CreditCard[],
  purchases: CardPurchase[],
  cartaoCategoryId: string | null
) {
  if (!cartaoCategoryId) return;
  for (const card of cards) {
    const cardPurchases = purchases.filter((p) => p.credit_card_id === card.id);
    await syncCreditCardTransactions(
      supabase,
      card,
      cardPurchases,
      cartaoCategoryId,
      userId
    );
  }
}
