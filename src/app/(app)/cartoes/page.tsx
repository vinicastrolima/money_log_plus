"use client";

import * as React from "react";
import { Plus, Pencil, Trash2, CreditCard as CreditCardIcon, ShoppingBag } from "lucide-react";
import { useData } from "@/components/data-provider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import {
  aggregateByDueDate,
  cardOpenTotal,
  splitInstallments,
} from "@/lib/cards";
import { formatCurrency, formatDateBR, toISODate } from "@/lib/utils";
import type { CardPurchase, CreditCard } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function CartoesPage() {
  const {
    loading,
    creditCards,
    cardPurchases,
    addCreditCard,
    updateCreditCard,
    deleteCreditCard,
    addCardPurchase,
    updateCardPurchase,
    deleteCardPurchase,
  } = useData();

  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [cardModalOpen, setCardModalOpen] = React.useState(false);
  const [purchaseModalOpen, setPurchaseModalOpen] = React.useState(false);
  const [editingCard, setEditingCard] = React.useState<CreditCard | null>(null);
  const [editingPurchase, setEditingPurchase] = React.useState<CardPurchase | null>(null);
  const [saving, setSaving] = React.useState(false);

  const [cardName, setCardName] = React.useState("");
  const [dueDay, setDueDay] = React.useState("10");

  const [purchaseDesc, setPurchaseDesc] = React.useState("");
  const [purchaseAmount, setPurchaseAmount] = React.useState("");
  const [purchaseDate, setPurchaseDate] = React.useState(toISODate(new Date()));
  const [paymentType, setPaymentType] = React.useState<"avista" | "parcelado">("avista");
  const [installments, setInstallments] = React.useState("2");

  React.useEffect(() => {
    if (creditCards.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !creditCards.some((c) => c.id === selectedId)) {
      setSelectedId(creditCards[0].id);
    }
  }, [creditCards, selectedId]);

  const selectedCard = creditCards.find((c) => c.id === selectedId) ?? null;
  const selectedPurchases = React.useMemo(
    () =>
      selectedCard
        ? cardPurchases.filter((p) => p.credit_card_id === selectedCard.id)
        : [],
    [cardPurchases, selectedCard]
  );

  const selectedAggs = React.useMemo(
    () => (selectedCard ? aggregateByDueDate(selectedPurchases, selectedCard) : []),
    [selectedCard, selectedPurchases]
  );

  const nextPayment = selectedAggs.find((a) => a.dueDate >= toISODate(new Date()));

  function openNewCard() {
    setEditingCard(null);
    setCardName("");
    setDueDay("10");
    setCardModalOpen(true);
  }

  function openEditCard(card: CreditCard) {
    setEditingCard(card);
    setCardName(card.name);
    setDueDay(String(card.due_day));
    setCardModalOpen(true);
  }

  function openNewPurchase() {
    if (!selectedCard) return;
    setEditingPurchase(null);
    setPurchaseDesc("");
    setPurchaseAmount("");
    setPurchaseDate(toISODate(new Date()));
    setPaymentType("avista");
    setInstallments("2");
    setPurchaseModalOpen(true);
  }

  function openEditPurchase(p: CardPurchase) {
    setEditingPurchase(p);
    setPurchaseDesc(p.description);
    setPurchaseAmount(String(p.total_amount).replace(".", ","));
    setPurchaseDate(p.purchase_date);
    setPaymentType(p.installments > 1 ? "parcelado" : "avista");
    setInstallments(String(p.installments > 1 ? p.installments : 2));
    setPurchaseModalOpen(true);
  }

  async function handleSaveCard(e: React.FormEvent) {
    e.preventDefault();
    const day = Number(dueDay);
    if (!cardName.trim()) return;
    if (!Number.isInteger(day) || day < 1 || day > 31) return;
    setSaving(true);
    try {
      const input = { name: cardName.trim(), due_day: day };
      if (editingCard) await updateCreditCard(editingCard.id, input);
      else await addCreditCard(input);
      setCardModalOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteCard(card: CreditCard) {
    if (!confirm(`Excluir o cartão "${card.name}" e todas as compras vinculadas?`)) return;
    setSaving(true);
    try {
      await deleteCreditCard(card.id);
    } finally {
      setSaving(false);
    }
  }

  async function handleSavePurchase(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCard) return;
    const parsed = Number(purchaseAmount.replace(/\./g, "").replace(",", "."));
    const inst = paymentType === "avista" ? 1 : Number(installments);
    if (!purchaseDesc.trim()) return;
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    if (paymentType === "parcelado" && (!Number.isInteger(inst) || inst < 2 || inst > 48))
      return;

    setSaving(true);
    try {
      const input = {
        credit_card_id: editingPurchase?.credit_card_id ?? selectedCard.id,
        description: purchaseDesc.trim(),
        total_amount: parsed,
        installments: inst,
        purchase_date: purchaseDate,
      };
      if (editingPurchase) await updateCardPurchase(editingPurchase.id, input);
      else await addCardPurchase(input);
      setPurchaseModalOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeletePurchase(p: CardPurchase) {
    if (!confirm(`Excluir a compra "${p.description}"?`)) return;
    setSaving(true);
    try {
      await deleteCardPurchase(p.id);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted">Carregando cartões...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Cartões</h1>
          <p className="text-sm text-muted">
            Cadastre cartões, adicione compras e o calendário é atualizado automaticamente no dia do
            pagamento.
          </p>
        </div>
        <Button onClick={openNewCard}>
          <Plus size={16} />
          Novo cartão
        </Button>
      </div>

      {creditCards.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <CreditCardIcon size={40} className="text-muted" />
          <p className="text-sm text-muted">
            Nenhum cartão cadastrado. Crie um cartão com nome e dia de pagamento.
          </p>
          <Button onClick={openNewCard}>Criar primeiro cartão</Button>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <div className="space-y-2">
            {creditCards.map((card) => {
              const purchases = cardPurchases.filter((p) => p.credit_card_id === card.id);
              const open = cardOpenTotal(purchases, card);
              const active = card.id === selectedId;
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => setSelectedId(card.id)}
                  className={cn(
                    "w-full rounded-xl border p-4 text-left transition-colors cursor-pointer",
                    active
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card hover:bg-slate-50"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{card.name}</p>
                      <p className="text-xs text-muted">Pagamento dia {card.due_day}</p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditCard(card);
                        }}
                        className="rounded p-1 text-muted hover:bg-slate-100 cursor-pointer"
                        aria-label="Editar cartão"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCard(card);
                        }}
                        className="rounded p-1 text-expense hover:bg-expense-bg cursor-pointer"
                        aria-label="Excluir cartão"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <p className="mt-2 text-sm">
                    <span className="text-muted">Em aberto: </span>
                    <span className="font-medium text-expense">{formatCurrency(open)}</span>
                  </p>
                  <p className="text-xs text-muted">{purchases.length} compra(s)</p>
                </button>
              );
            })}
          </div>

          {selectedCard && (
            <div className="space-y-4">
              <Card className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">{selectedCard.name}</h2>
                    <p className="text-sm text-muted">
                      Pagamento todo dia {selectedCard.due_day} ·{" "}
                      {nextPayment
                        ? `Próximo: ${formatDateBR(nextPayment.dueDate)} (${formatCurrency(nextPayment.total)})`
                        : "Sem parcelas futuras"}
                    </p>
                  </div>
                  <Button onClick={openNewPurchase}>
                    <ShoppingBag size={16} />
                    Nova compra
                  </Button>
                </div>
              </Card>

              {selectedPurchases.length === 0 ? (
                <Card className="p-8 text-center text-sm text-muted">
                  Nenhuma compra neste cartão. Adicione uma compra à vista ou parcelada.
                </Card>
              ) : (
                <div className="space-y-2">
                  {selectedPurchases.map((p) => {
                    const perInstallment =
                      p.installments > 1
                        ? splitInstallments(p.total_amount, p.installments)[0]
                        : p.total_amount;
                    return (
                      <Card key={p.id} className="flex items-center justify-between gap-3 p-4">
                        <div>
                          <p className="font-medium">{p.description}</p>
                          <p className="text-sm text-muted">
                            Compra em {formatDateBR(p.purchase_date)} ·{" "}
                            {p.installments === 1
                              ? "À vista"
                              : `${p.installments}x de ${formatCurrency(perInstallment)}`}
                          </p>
                          <p className="text-sm font-medium text-expense">
                            Total {formatCurrency(p.total_amount)}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => openEditPurchase(p)}
                            className="rounded p-2 text-muted hover:bg-slate-100 cursor-pointer"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePurchase(p)}
                            className="rounded p-2 text-expense hover:bg-expense-bg cursor-pointer"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}

              {selectedAggs.length > 0 && (
                <Card className="p-4">
                  <h3 className="mb-3 text-sm font-semibold">Lançamentos no calendário</h3>
                  <div className="space-y-2">
                    {selectedAggs.map((agg) => (
                      <div
                        key={agg.dueDate}
                        className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                      >
                        <span>
                          {formatDateBR(agg.dueDate)} · {selectedCard.name}
                        </span>
                        <span className="font-medium text-expense">
                          {formatCurrency(agg.total)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-muted">
                    Esses valores aparecem automaticamente no calendário com categoria Cartão. Para
                    marcar como pago, edite o status na lista ou no calendário.
                  </p>
                </Card>
              )}
            </div>
          )}
        </div>
      )}

      <Modal
        open={cardModalOpen}
        onClose={() => setCardModalOpen(false)}
        title={editingCard ? "Editar cartão" : "Novo cartão"}
      >
        <form onSubmit={handleSaveCard} className="space-y-4">
          <div>
            <Label htmlFor="card-name">Nome do cartão</Label>
            <Input
              id="card-name"
              value={cardName}
              onChange={(e) => setCardName(e.target.value)}
              placeholder="Ex: Nubank, Itaú..."
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="card-due">Dia do pagamento</Label>
            <Select
              id="card-due"
              value={dueDay}
              onChange={(e) => setDueDay(e.target.value)}
            >
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={String(d)}>
                  Dia {d}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-muted">
              Dia do mês em que você paga a fatura deste cartão.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCardModalOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={purchaseModalOpen}
        onClose={() => setPurchaseModalOpen(false)}
        title={editingPurchase ? "Editar compra" : "Nova compra"}
      >
        <form onSubmit={handleSavePurchase} className="space-y-4">
          <div>
            <Label htmlFor="purchase-desc">Descrição</Label>
            <Input
              id="purchase-desc"
              value={purchaseDesc}
              onChange={(e) => setPurchaseDesc(e.target.value)}
              placeholder="Ex: Notebook, Mercado..."
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="purchase-amount">Valor total (R$)</Label>
              <Input
                id="purchase-amount"
                inputMode="decimal"
                value={purchaseAmount}
                onChange={(e) => setPurchaseAmount(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div>
              <Label htmlFor="purchase-date">Data da compra</Label>
              <Input
                id="purchase-date"
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label>Forma de pagamento</Label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentType("avista")}
                className={cn(
                  "rounded-lg border px-3 py-2 text-sm font-medium cursor-pointer",
                  paymentType === "avista"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted hover:bg-slate-50"
                )}
              >
                À vista
              </button>
              <button
                type="button"
                onClick={() => setPaymentType("parcelado")}
                className={cn(
                  "rounded-lg border px-3 py-2 text-sm font-medium cursor-pointer",
                  paymentType === "parcelado"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted hover:bg-slate-50"
                )}
              >
                Parcelado
              </button>
            </div>
          </div>
          {paymentType === "parcelado" && (
            <div>
              <Label htmlFor="purchase-installments">Parcelas</Label>
              <Select
                id="purchase-installments"
                value={installments}
                onChange={(e) => setInstallments(e.target.value)}
              >
                {Array.from({ length: 47 }, (_, i) => i + 2).map((n) => (
                  <option key={n} value={String(n)}>
                    {n}x
                  </option>
                ))}
              </Select>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPurchaseModalOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
