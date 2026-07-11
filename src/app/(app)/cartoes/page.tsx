"use client";

import * as React from "react";
import { Plus, CreditCard as CreditCardIcon } from "lucide-react";
import { useData } from "@/components/data-provider";
import {
  WalletDeck,
  type ChartScope,
  type WalletCardData,
} from "@/components/cards/wallet-stack";
import { CardChartsPanel } from "@/components/cards/card-charts-panel";
import { CardDetailModal } from "@/components/cards/card-detail-modal";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Label, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { CARD_GRADIENTS, DEFAULT_CARD_GRADIENT, cardOpenTotal, defaultClosingDay } from "@/lib/cards";

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
  const [chartScope, setChartScope] = React.useState<ChartScope>("all");
  const [detailCardId, setDetailCardId] = React.useState<string | null>(null);
  const [openPurchaseOnDetail, setOpenPurchaseOnDetail] = React.useState(false);
  const [newCardOpen, setNewCardOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const [cardName, setCardName] = React.useState("");
  const [dueDay, setDueDay] = React.useState("10");
  const [closingDay, setClosingDay] = React.useState(String(defaultClosingDay(10)));
  const [cardColors, setCardColors] = React.useState(DEFAULT_CARD_GRADIENT);

  const effectiveChartScope =
    chartScope === "all" || creditCards.some((card) => card.id === chartScope)
      ? chartScope
      : "all";

  const walletCards = React.useMemo((): WalletCardData[] => {
    return creditCards.map((card, i) => ({
      card,
      openTotal: cardOpenTotal(
        cardPurchases.filter((p) => p.credit_card_id === card.id),
        card
      ),
      purchaseCount: cardPurchases.filter((p) => p.credit_card_id === card.id).length,
      gradientIndex: i,
    }));
  }, [creditCards, cardPurchases]);

  const filterCardId = effectiveChartScope === "all" ? null : effectiveChartScope;
  const filterLabel =
    effectiveChartScope === "all"
      ? "Todos os cartões"
      : creditCards.find((c) => c.id === effectiveChartScope)?.name ?? "Cartão";

  const detailCard = detailCardId
    ? creditCards.find((c) => c.id === detailCardId) ?? null
    : null;
  const detailGradientIndex = detailCard
    ? creditCards.findIndex((c) => c.id === detailCard.id)
    : 0;

  function openManage(cardId: string) {
    setDetailCardId(cardId);
    setOpenPurchaseOnDetail(false);
  }

  function openPurchase(cardId: string) {
    setDetailCardId(cardId);
    setOpenPurchaseOnDetail(true);
  }

  async function handleCreateCard(e: React.FormEvent) {
    e.preventDefault();
    const day = Number(dueDay);
    const closeDay = Number(closingDay);
    if (!cardName.trim() || !Number.isInteger(day) || day < 1 || day > 31) return;
    if (!Number.isInteger(closeDay) || closeDay < 1 || closeDay > 31) return;
    setSaving(true);
    try {
      await addCreditCard({
        name: cardName.trim(),
        due_day: day,
        closing_day: closeDay,
        color_start: cardColors[0],
        color_end: cardColors[1],
      });
      setNewCardOpen(false);
      setCardName("");
      setDueDay("10");
      setClosingDay(String(defaultClosingDay(10)));
      setCardColors(DEFAULT_CARD_GRADIENT);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 pb-4 lg:space-y-8">
      <PageHeader
        title="Cartões"
        description="Acompanhe sua carteira, compras e próximas faturas."
        actions={
          <Button className="shrink-0" onClick={() => setNewCardOpen(true)}>
            <Plus size={17} />
            <span className="hidden sm:inline">Novo cartão</span>
            <span className="sm:hidden">Novo</span>
          </Button>
        }
      />

      {loading ? (
        <CardsPageSkeleton />
      ) : creditCards.length === 0 ? (
        <EmptyState
          icon={CreditCardIcon}
          title="Sua carteira está vazia"
          description="Adicione seu primeiro cartão para registrar compras, acompanhar parcelas e visualizar as faturas no calendário."
          action={
            <Button onClick={() => setNewCardOpen(true)}>
              <Plus size={17} />
              Criar primeiro cartão
            </Button>
          }
          className="min-h-[360px]"
        />
      ) : (
        <>
          <WalletDeck
            cards={walletCards}
            chartScope={effectiveChartScope}
            onChartScopeChange={setChartScope}
            onManageCard={openManage}
            onNewPurchase={openPurchase}
          />

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
          onClose={() => {
            setDetailCardId(null);
            setOpenPurchaseOnDetail(false);
          }}
          card={detailCard}
          gradientIndex={detailGradientIndex}
          purchases={cardPurchases.filter((p) => p.credit_card_id === detailCard.id)}
          categories={categories}
          openPurchaseOnMount={openPurchaseOnDetail}
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
              onChange={(e) => {
                setDueDay(e.target.value);
                setClosingDay(String(defaultClosingDay(Number(e.target.value))));
              }}
            >
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={String(d)}>
                  Dia {d}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="new-closing">Dia do fechamento</Label>
            <Select
              id="new-closing"
              value={closingDay}
              onChange={(e) => setClosingDay(e.target.value)}
            >
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={String(d)}>
                  Dia {d}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Cores do cartão</Label>
            <div className="grid grid-cols-4 gap-2">
              {CARD_GRADIENTS.map((colors) => (
                <button
                  key={colors.join("-")}
                  type="button"
                  aria-pressed={cardColors[0] === colors[0] && cardColors[1] === colors[1]}
                  onClick={() => setCardColors(colors)}
                  className="h-11 rounded-xl border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:ring-2 aria-pressed:ring-primary"
                  style={{
                    background: `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 100%)`,
                  }}
                >
                  <span className="sr-only">Selecionar cor</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setNewCardOpen(false)}
              className="w-full sm:w-auto"
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type="submit" className="w-full sm:w-auto" disabled={saving}>
              {saving ? "Salvando..." : "Criar cartão"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function CardsPageSkeleton() {
  return (
    <div className="space-y-5" aria-label="Carregando cartões" aria-busy="true">
      <div className="animate-pulse rounded-[24px] bg-slate-200/80 p-4 sm:p-6 lg:p-8">
        <div className="grid items-center gap-8 lg:grid-cols-[minmax(320px,440px)_1fr]">
          <div className="mx-auto aspect-[1.586/1] w-full max-w-[420px] rounded-[22px] bg-slate-300/80" />
          <div className="hidden space-y-4 lg:block">
            <div className="h-3 w-28 rounded-full bg-slate-300" />
            <div className="h-9 w-48 rounded-lg bg-slate-300" />
            <div className="h-12 w-64 rounded-lg bg-slate-300" />
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="h-24 rounded-2xl bg-slate-300" />
              <div className="h-24 rounded-2xl bg-slate-300" />
            </div>
          </div>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-72 animate-pulse rounded-2xl border border-border bg-card" />
        <div className="h-72 animate-pulse rounded-2xl border border-border bg-card" />
      </div>
    </div>
  );
}
