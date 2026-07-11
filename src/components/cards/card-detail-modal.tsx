"use client";

import * as React from "react";
import {
  CalendarClock,
  Pencil,
  Plus,
  ReceiptText,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { WalletCardVisual } from "@/components/cards/wallet-stack";
import {
  CARD_GRADIENTS,
  aggregateByDueDate,
  cardClosingDay,
  cardOpenTotal,
  splitInstallments,
} from "@/lib/cards";
import { cn, formatCurrency, formatDateBR, toISODate } from "@/lib/utils";
import type { CardPurchase, Category, CreditCard } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  card: CreditCard;
  gradientIndex: number;
  purchases: CardPurchase[];
  categories: Category[];
  openPurchaseOnMount?: boolean;
  onSaveCard: (input: {
    name: string;
    due_day: number;
    closing_day: number;
    color_start: string;
    color_end: string;
  }) => Promise<void>;
  onDeleteCard: () => Promise<void>;
  onSavePurchase: (input: {
    id?: string;
    description: string;
    total_amount: number;
    installments: number;
    purchase_date: string;
    category_id: string | null;
  }) => Promise<void>;
  onDeletePurchase: (id: string) => Promise<void>;
}

export function CardDetailModal(props: Props) {
  const mode = props.openPurchaseOnMount ? "purchase" : "manage";
  const visibility = props.open ? "open" : "closed";

  return (
    <CardDetailModalContent
      key={`${props.card.id}:${visibility}:${mode}`}
      {...props}
    />
  );
}

function CardDetailModalContent({
  open,
  onClose,
  card,
  gradientIndex,
  purchases,
  categories,
  openPurchaseOnMount,
  onSaveCard,
  onDeleteCard,
  onSavePurchase,
  onDeletePurchase,
}: Props) {
  const [editingSettings, setEditingSettings] = React.useState(false);
  const [cardName, setCardName] = React.useState(card.name);
  const [dueDay, setDueDay] = React.useState(String(card.due_day));
  const [closingDay, setClosingDay] = React.useState(String(cardClosingDay(card)));
  const [cardColors, setCardColors] = React.useState<[string, string]>(() => {
    const fallback = CARD_GRADIENTS[gradientIndex % CARD_GRADIENTS.length];
    return [card.color_start ?? fallback[0], card.color_end ?? fallback[1]];
  });
  const [purchaseModalOpen, setPurchaseModalOpen] = React.useState(
    Boolean(openPurchaseOnMount)
  );
  const [editingPurchase, setEditingPurchase] = React.useState<CardPurchase | null>(null);
  const [saving, setSaving] = React.useState(false);

  const [purchaseDesc, setPurchaseDesc] = React.useState("");
  const [purchaseAmount, setPurchaseAmount] = React.useState("");
  const [purchaseDate, setPurchaseDate] = React.useState(toISODate(new Date()));
  const [categoryId, setCategoryId] = React.useState("");
  const [paymentType, setPaymentType] = React.useState<"avista" | "parcelado">("avista");
  const [installments, setInstallments] = React.useState("2");

  const expenseCategories = React.useMemo(
    () => categories.filter((category) => category.kind === "expense" || category.kind === "both"),
    [categories]
  );

  const resetPurchaseForm = React.useCallback(() => {
    setEditingPurchase(null);
    setPurchaseDesc("");
    setPurchaseAmount("");
    setPurchaseDate(toISODate(new Date()));
    setCategoryId("");
    setPaymentType("avista");
    setInstallments("2");
  }, []);

  const openTotal = cardOpenTotal(purchases, card);
  const aggs = aggregateByDueDate(purchases, card);
  const nextPayment = aggs.find((payment) => payment.dueDate >= toISODate(new Date()));

  function openNewPurchase() {
    resetPurchaseForm();
    setPurchaseModalOpen(true);
  }

  function openEditPurchase(purchase: CardPurchase) {
    setEditingPurchase(purchase);
    setPurchaseDesc(purchase.description);
    setPurchaseAmount(String(purchase.total_amount).replace(".", ","));
    setPurchaseDate(purchase.purchase_date);
    setCategoryId(purchase.category_id ?? "");
    setPaymentType(purchase.installments > 1 ? "parcelado" : "avista");
    setInstallments(String(purchase.installments > 1 ? purchase.installments : 2));
    setPurchaseModalOpen(true);
  }

  async function handleSaveSettings(event: React.FormEvent) {
    event.preventDefault();
    const day = Number(dueDay);
    const closeDay = Number(closingDay);
    if (!cardName.trim() || !Number.isInteger(day) || day < 1 || day > 31) return;
    if (!Number.isInteger(closeDay) || closeDay < 1 || closeDay > 31) return;

    setSaving(true);
    try {
      await onSaveCard({
        name: cardName.trim(),
        due_day: day,
        closing_day: closeDay,
        color_start: cardColors[0],
        color_end: cardColors[1],
      });
      setEditingSettings(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleSavePurchase(event: React.FormEvent) {
    event.preventDefault();
    const parsed = Number(purchaseAmount.replace(/\./g, "").replace(",", "."));
    const installmentCount = paymentType === "avista" ? 1 : Number(installments);
    if (!purchaseDesc.trim() || !Number.isFinite(parsed) || parsed <= 0) return;
    if (
      paymentType === "parcelado" &&
      (!Number.isInteger(installmentCount) || installmentCount < 2 || installmentCount > 48)
    ) {
      return;
    }

    setSaving(true);
    try {
      await onSavePurchase({
        id: editingPurchase?.id,
        description: purchaseDesc.trim(),
        total_amount: parsed,
        installments: installmentCount,
        purchase_date: purchaseDate,
        category_id: categoryId || null,
      });
      setPurchaseModalOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeletePurchase(purchase: CardPurchase) {
    if (!confirm(`Excluir "${purchase.description}"?`)) return;
    setSaving(true);
    try {
      await onDeletePurchase(purchase.id);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteCard() {
    if (!confirm(`Excluir o cartão "${card.name}" e todas as compras?`)) return;
    setSaving(true);
    try {
      await onDeleteCard();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={card.name}
        className="max-w-2xl p-4 sm:max-h-[calc(100dvh-2rem)] sm:p-6"
      >
        <div className="space-y-5">
          <div className="mx-auto w-full max-w-sm">
            <WalletCardVisual
              data={{
                card,
                openTotal,
                purchaseCount: purchases.length,
                gradientIndex,
              }}
            />
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-border bg-slate-50/80 p-3.5 sm:p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-primary shadow-sm">
              <CalendarClock size={19} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted">Próximo pagamento</p>
              {nextPayment ? (
                <p className="mt-0.5 truncate text-sm font-semibold sm:text-base">
                  {formatCurrency(nextPayment.total)}
                  <span className="font-normal text-muted"> · {formatDateBR(nextPayment.dueDate)}</span>
                </p>
              ) : (
                <p className="mt-0.5 text-sm font-medium">Nenhuma parcela futura</p>
              )}
            </div>
          </div>

          {!editingSettings ? (
            <div className="grid grid-cols-2 gap-2.5">
              <Button
                variant="outline"
                className="min-h-11 px-2 sm:px-4"
                onClick={() => setEditingSettings(true)}
              >
                <Pencil size={16} aria-hidden="true" />
                <span className="truncate">Configurar</span>
              </Button>
              <Button className="min-h-11 px-2 sm:px-4" onClick={openNewPurchase}>
                <ShoppingBag size={16} aria-hidden="true" />
                <span className="truncate">Nova compra</span>
              </Button>
            </div>
          ) : (
            <form
              onSubmit={handleSaveSettings}
              className="space-y-4 rounded-2xl border border-border bg-slate-50/60 p-4"
            >
              <div>
                <p className="text-sm font-semibold">Configurações do cartão</p>
                <p className="mt-0.5 text-xs text-muted">
                  Atualize nome, fechamento, vencimento e cores.
                </p>
              </div>
              <div>
                <Label htmlFor="detail-name">Nome</Label>
                <Input
                  id="detail-name"
                  className="h-11"
                  value={cardName}
                  onChange={(event) => setCardName(event.target.value)}
                  disabled={saving}
                  required
                />
              </div>
              <div>
                <Label htmlFor="detail-due">Dia do pagamento</Label>
                <Select
                  id="detail-due"
                  className="h-11"
                  value={dueDay}
                  onChange={(event) => setDueDay(event.target.value)}
                  disabled={saving}
                >
                  {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
                    <option key={day} value={String(day)}>
                      Dia {day}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="detail-closing">Dia do fechamento</Label>
                <Select
                  id="detail-closing"
                  className="h-11"
                  value={closingDay}
                  onChange={(event) => setClosingDay(event.target.value)}
                  disabled={saving}
                >
                  {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
                    <option key={day} value={String(day)}>
                      Dia {day}
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
                      aria-pressed={
                        cardColors[0] === colors[0] && cardColors[1] === colors[1]
                      }
                      onClick={() => setCardColors(colors)}
                      disabled={saving}
                      className="h-11 rounded-xl border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 aria-pressed:ring-2 aria-pressed:ring-primary"
                      style={{
                        background: `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 100%)`,
                      }}
                    >
                      <span className="sr-only">Selecionar cor</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <Button type="submit" className="min-h-11" disabled={saving}>
                  {saving ? "Salvando..." : "Salvar"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  onClick={() => setEditingSettings(false)}
                  disabled={saving}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          )}

          <section aria-labelledby="card-purchases-title">
            <div className="mb-2.5 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <h3 id="card-purchases-title" className="text-sm font-semibold">
                  Compras
                </h3>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-muted">
                  {purchases.length}
                </span>
              </div>
              {purchases.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-10 shrink-0 px-2 text-primary hover:bg-primary/10 hover:text-primary"
                  onClick={openNewPurchase}
                >
                  <Plus size={15} aria-hidden="true" />
                  Adicionar
                </Button>
              )}
            </div>

            {purchases.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border px-5 py-8 text-center">
                <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-muted">
                  <ReceiptText size={20} aria-hidden="true" />
                </span>
                <p className="mt-3 text-sm font-medium">Nenhuma compra neste cartão</p>
                <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-muted">
                  Adicione a primeira compra para gerar as próximas faturas automaticamente.
                </p>
                <Button className="mt-4 min-h-11" onClick={openNewPurchase}>
                  <Plus size={16} aria-hidden="true" />
                  Adicionar primeira compra
                </Button>
              </div>
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border sm:max-h-80 sm:overflow-y-auto">
                {purchases.map((purchase) => {
                  const category = categories.find((item) => item.id === purchase.category_id);
                  const perInstallment =
                    purchase.installments > 1
                      ? splitInstallments(purchase.total_amount, purchase.installments)[0]
                      : purchase.total_amount;

                  return (
                    <li key={purchase.id} className="p-3.5 sm:p-4">
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{purchase.description}</p>
                          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted">
                            <span>{formatDateBR(purchase.purchase_date)}</span>
                            <span aria-hidden="true">·</span>
                            <span>
                              {purchase.installments === 1
                                ? "À vista"
                                : `${purchase.installments}x de ${formatCurrency(perInstallment)}`}
                            </span>
                            {category && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="inline-flex min-w-0 items-center gap-1.5">
                                  <span
                                    className="h-2 w-2 shrink-0 rounded-full"
                                    style={{ background: category.color }}
                                    aria-hidden="true"
                                  />
                                  <span className="max-w-32 truncate">{category.name}</span>
                                </span>
                              </>
                            )}
                          </p>
                          <p className="mt-1.5 text-sm font-semibold text-expense">
                            {formatCurrency(purchase.total_amount)}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-11 w-11 text-muted"
                            onClick={() => openEditPurchase(purchase)}
                            disabled={saving}
                            aria-label={`Editar ${purchase.description}`}
                          >
                            <Pencil size={16} aria-hidden="true" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-11 w-11 text-expense hover:bg-expense-bg hover:text-expense"
                            onClick={() => void handleDeletePurchase(purchase)}
                            disabled={saving}
                            aria-label={`Excluir ${purchase.description}`}
                          >
                            <Trash2 size={16} aria-hidden="true" />
                          </Button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <div className="border-t border-border pt-4">
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 w-full text-expense hover:bg-expense-bg hover:text-expense"
              onClick={() => void handleDeleteCard()}
              disabled={saving}
            >
              <Trash2 size={16} aria-hidden="true" />
              Excluir cartão
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={purchaseModalOpen}
        onClose={() => setPurchaseModalOpen(false)}
        title={editingPurchase ? "Editar compra" : "Nova compra"}
        className="max-w-xl p-4 sm:p-6"
      >
        <form onSubmit={handleSavePurchase} className="space-y-4">
          <div>
            <Label htmlFor="p-desc">Descrição</Label>
            <Input
              id="p-desc"
              className="h-11"
              value={purchaseDesc}
              onChange={(event) => setPurchaseDesc(event.target.value)}
              placeholder="Ex: Notebook, mercado..."
              disabled={saving}
              autoFocus
              required
            />
          </div>
          <div>
            <Label htmlFor="p-cat">Categoria</Label>
            <Select
              id="p-cat"
              className="h-11"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              disabled={saving}
            >
              <option value="">Sem categoria</option>
              {expenseCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="p-amount">Valor total (R$)</Label>
              <Input
                id="p-amount"
                className="h-11"
                inputMode="decimal"
                value={purchaseAmount}
                onChange={(event) => setPurchaseAmount(event.target.value)}
                placeholder="0,00"
                disabled={saving}
                required
              />
            </div>
            <div>
              <Label htmlFor="p-date">Data da compra</Label>
              <Input
                id="p-date"
                className="h-11"
                type="date"
                value={purchaseDate}
                onChange={(event) => setPurchaseDate(event.target.value)}
                disabled={saving}
                required
              />
            </div>
          </div>
          <fieldset disabled={saving}>
            <legend className="text-sm font-medium text-slate-700">Pagamento</legend>
            <div className="mt-2 grid grid-cols-2 gap-2.5">
              {(["avista", "parcelado"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setPaymentType(type)}
                  aria-pressed={paymentType === type}
                  className={cn(
                    "min-h-11 touch-manipulation rounded-xl border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                    paymentType === type
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted hover:bg-slate-50"
                  )}
                >
                  {type === "avista" ? "À vista" : "Parcelado"}
                </button>
              ))}
            </div>
          </fieldset>
          {paymentType === "parcelado" && (
            <div>
              <Label htmlFor="p-inst">Parcelas</Label>
              <Select
                id="p-inst"
                className="h-11"
                value={installments}
                onChange={(event) => setInstallments(event.target.value)}
                disabled={saving}
              >
                {Array.from({ length: 47 }, (_, index) => index + 2).map((count) => (
                  <option key={count} value={String(count)}>
                    {count}x
                  </option>
                ))}
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => setPurchaseModalOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type="submit" className="min-h-11" disabled={saving}>
              {saving ? "Salvando..." : editingPurchase ? "Salvar compra" : "Adicionar"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
