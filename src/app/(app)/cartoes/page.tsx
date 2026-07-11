"use client";

import * as React from "react";
import { Plus, CreditCard as CreditCardIcon } from "lucide-react";
import { useData } from "@/components/data-provider";
import { WalletCarousel, type WalletSlide } from "@/components/cards/wallet-carousel";
import { CardChartsPanel } from "@/components/cards/card-charts-panel";
import { CardDetailModal } from "@/components/cards/card-detail-modal";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { allCardsOpenTotal, cardOpenTotal } from "@/lib/cards";

export default function CartoesPage() {
  const {
    loading,
    creditCards,
    cardPurchases,
    categories,
    addCreditCard,
    updateCreditCard,
    deleteCreditCard,
    addCardPurchase,
    updateCardPurchase,
    deleteCardPurchase,
  } = useData();

  const now = new Date();
  const [year, setYear] = React.useState(now.getFullYear());
  const [month0, setMonth0] = React.useState(now.getMonth());
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [detailCardId, setDetailCardId] = React.useState<string | null>(null);
  const [newCardOpen, setNewCardOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const [cardName, setCardName] = React.useState("");
  const [dueDay, setDueDay] = React.useState("10");

  const slides = React.useMemo((): WalletSlide[] => {
    const allSlide: WalletSlide = {
      type: "all",
      openTotal: allCardsOpenTotal(cardPurchases, creditCards),
      cardCount: creditCards.length,
    };
    const cardSlides: WalletSlide[] = creditCards.map((card, i) => ({
      type: "card",
      card,
      openTotal: cardOpenTotal(
        cardPurchases.filter((p) => p.credit_card_id === card.id),
        card
      ),
      purchaseCount: cardPurchases.filter((p) => p.credit_card_id === card.id).length,
      gradientIndex: i,
    }));
    return [allSlide, ...cardSlides];
  }, [creditCards, cardPurchases]);

  const activeSlide = slides[activeIndex];
  const filterCardId =
    activeSlide?.type === "card" ? activeSlide.card.id : null;
  const filterLabel =
    activeSlide?.type === "card" ? activeSlide.card.name : "Todos os cartões";

  const detailCard = detailCardId
    ? creditCards.find((c) => c.id === detailCardId) ?? null
    : null;
  const detailGradientIndex = detailCard
    ? creditCards.findIndex((c) => c.id === detailCard.id)
    : 0;

  function handleCardClick(slide: WalletSlide, index: number) {
    setActiveIndex(index);
    if (slide.type === "card") setDetailCardId(slide.card.id);
  }

  async function handleCreateCard(e: React.FormEvent) {
    e.preventDefault();
    const day = Number(dueDay);
    if (!cardName.trim() || !Number.isInteger(day) || day < 1 || day > 31) return;
    setSaving(true);
    try {
      await addCreditCard({ name: cardName.trim(), due_day: day });
      setNewCardOpen(false);
      setCardName("");
      setDueDay("10");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted">Carregando cartões...</p>;
  }

  return (
    <div className="space-y-8 pb-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Cartões</h1>
          <p className="text-sm text-muted">
            Deslize entre os cartões · Toque para configurar · Gráficos atualizam ao arrastar
          </p>
        </div>
        <Button onClick={() => setNewCardOpen(true)}>
          <Plus size={16} />
          Novo cartão
        </Button>
      </div>

      {creditCards.length === 0 ? (
        <Card className="flex flex-col items-center gap-4 p-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
            <CreditCardIcon size={32} className="text-muted" />
          </div>
          <div>
            <p className="font-medium">Sua carteira está vazia</p>
            <p className="mt-1 text-sm text-muted">
              Adicione um cartão para começar a registrar compras e ver as faturas no calendário.
            </p>
          </div>
          <Button onClick={() => setNewCardOpen(true)}>Criar primeiro cartão</Button>
        </Card>
      ) : (
        <>
          <WalletCarousel
            slides={slides}
            activeIndex={activeIndex}
            onActiveIndexChange={setActiveIndex}
            onCardClick={handleCardClick}
          />

          <p className="-mt-4 text-center text-xs text-muted">
            Toque no cartão para configurar e adicionar compras
          </p>

          <CardChartsPanel
            creditCards={creditCards}
            cardPurchases={cardPurchases}
            categories={categories}
            filterCardId={filterCardId}
            filterLabel={filterLabel}
            year={year}
            month0={month0}
            onMonthChange={(y, m) => {
              setYear(y);
              setMonth0(m);
            }}
          />
        </>
      )}

      {detailCard && (
        <CardDetailModal
          open={Boolean(detailCardId)}
          onClose={() => setDetailCardId(null)}
          card={detailCard}
          gradientIndex={detailGradientIndex}
          purchases={cardPurchases.filter((p) => p.credit_card_id === detailCard.id)}
          categories={categories}
          onSaveCard={async (input) => {
            await updateCreditCard(detailCard.id, input);
          }}
          onDeleteCard={async () => {
            await deleteCreditCard(detailCard.id);
            setDetailCardId(null);
          }}
          onSavePurchase={async (input) => {
            const payload = {
              credit_card_id: detailCard.id,
              description: input.description,
              total_amount: input.total_amount,
              installments: input.installments,
              purchase_date: input.purchase_date,
              category_id: input.category_id,
            };
            if (input.id) await updateCardPurchase(input.id, payload);
            else await addCardPurchase(payload);
          }}
          onDeletePurchase={deleteCardPurchase}
        />
      )}

      <Modal
        open={newCardOpen}
        onClose={() => setNewCardOpen(false)}
        title="Novo cartão"
      >
        <form onSubmit={handleCreateCard} className="space-y-4">
          <div>
            <Label htmlFor="new-name">Nome do cartão</Label>
            <Input
              id="new-name"
              value={cardName}
              onChange={(e) => setCardName(e.target.value)}
              placeholder="Ex: Nubank, Itaú..."
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="new-due">Dia do pagamento</Label>
            <Select
              id="new-due"
              value={dueDay}
              onChange={(e) => setDueDay(e.target.value)}
            >
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={String(d)}>
                  Dia {d}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setNewCardOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando..." : "Criar cartão"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
