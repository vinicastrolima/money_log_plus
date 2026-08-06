"use client";

import * as React from "react";
import {
  CalendarClock,
  Pencil,
  Plus,
  ReceiptText,
  Repeat2,
  ShoppingBag,
  Trash2,
  Users,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { DateInput, Input, Label, Select } from "@/components/ui/input";
import { ToggleField } from "@/components/ui/toggle-field";
import { WalletCardVisual } from "@/components/cards/wallet-stack";
import {
  CARD_GRADIENTS,
  cardAvailableLimit,
  cardClosingDay,
  cardInvoiceStatusByDate,
  cardNextPayment,
  cardOpenTotals,
  purchaseOwnAmount,
  splitInstallments,
} from "@/lib/cards";
import { cn, formatCurrency, formatDateBR, toISODate } from "@/lib/utils";
import type {
  CardPurchase,
  CardSubscription,
  Category,
  CreditCard,
  CreditCardInput,
  Transaction,
} from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  card: CreditCard;
  gradientIndex: number;
  purchases: CardPurchase[];
  subscriptions: CardSubscription[];
  transactions?: Transaction[];
  categories: Category[];
  openPurchaseOnMount?: boolean;
  sharedPurchasesEnabled?: boolean;
  onSaveCard: (input: CreditCardInput) => Promise<void>;
  onDeleteCard: () => Promise<void>;
  onSavePurchase: (input: {
    id?: string;
    description: string;
    total_amount: number;
    installments: number;
    purchase_date: string;
    category_id: string | null;
    is_shared: boolean;
    own_amount: number | null;
  }) => Promise<void>;
  onDeletePurchase: (id: string) => Promise<void>;
  onSaveSubscription: (input: {
    id?: string;
    description: string;
    amount: number;
    start_date: string;
    category_id: string | null;
    active: boolean;
  }) => Promise<void>;
  onDeleteSubscription: (id: string) => Promise<void>;
}

function parseAmount(value: string): number {
  return Number(value.replace(/\./g, "").replace(",", "."));
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
  subscriptions,
  transactions = [],
  categories,
  openPurchaseOnMount,
  sharedPurchasesEnabled = false,
  onSaveCard,
  onDeleteCard,
  onSavePurchase,
  onDeletePurchase,
  onSaveSubscription,
  onDeleteSubscription,
}: Props) {
  const [editingSettings, setEditingSettings] = React.useState(false);
  const [cardName, setCardName] = React.useState(card.name);
  const [dueDay, setDueDay] = React.useState(String(card.due_day));
  const [closingDay, setClosingDay] = React.useState(String(cardClosingDay(card)));
  const [cardLimit, setCardLimit] = React.useState(
    card.credit_limit != null ? String(card.credit_limit).replace(".", ",") : ""
  );
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
  const [isShared, setIsShared] = React.useState(false);
  const [ownAmount, setOwnAmount] = React.useState("");

  const [subscriptionModalOpen, setSubscriptionModalOpen] = React.useState(false);
  const [editingSubscription, setEditingSubscription] = React.useState<CardSubscription | null>(null);
  const [subscriptionDesc, setSubscriptionDesc] = React.useState("");
  const [subscriptionAmount, setSubscriptionAmount] = React.useState("");
  const [subscriptionDate, setSubscriptionDate] = React.useState(toISODate(new Date()));
  const [subscriptionCategoryId, setSubscriptionCategoryId] = React.useState("");
  const [subscriptionActive, setSubscriptionActive] = React.useState(true);
  const nestedModalOpen = purchaseModalOpen || subscriptionModalOpen;

  const expenseCategories = React.useMemo(
    () => categories.filter((category) => category.kind === "expense" || category.kind === "both"),
    [categories]
  );

  const defaultSubscriptionCategoryId = React.useMemo(() => {
    const match = categories.find((category) =>
      category.name.toLowerCase().includes("assinatur")
    );
    return match?.id ?? "";
  }, [categories]);

  const resetPurchaseForm = React.useCallback(() => {
    setEditingPurchase(null);
    setPurchaseDesc("");
    setPurchaseAmount("");
    setPurchaseDate(toISODate(new Date()));
    setCategoryId("");
    setPaymentType("avista");
    setInstallments("2");
    setIsShared(false);
    setOwnAmount("");
  }, []);

  const resetSubscriptionForm = React.useCallback(() => {
    setEditingSubscription(null);
    setSubscriptionDesc("");
    setSubscriptionAmount("");
    setSubscriptionDate(toISODate(new Date()));
    setSubscriptionCategoryId(defaultSubscriptionCategoryId);
    setSubscriptionActive(true);
  }, [defaultSubscriptionCategoryId]);

  const invoiceStatus = cardInvoiceStatusByDate(transactions, card.id);
  const { total: openTotal, ownTotal: openOwnTotal } = cardOpenTotals(
    purchases,
    card,
    new Date(),
    invoiceStatus
  );
  const nextPayment = cardNextPayment(
    purchases,
    card,
    subscriptions,
    new Date(),
    invoiceStatus
  );
  const creditLimit = card.credit_limit ?? null;
  const availableLimit = cardAvailableLimit(creditLimit, openTotal);
  const showOwnTotals = sharedPurchasesEnabled && openOwnTotal < openTotal - 0.005;

  const purchaseTotalParsed = parseAmount(purchaseAmount);
  const ownAmountParsed = parseAmount(ownAmount);
  const sharedActive = sharedPurchasesEnabled && isShared;
  const ownAmountError =
    sharedActive && ownAmount.trim() !== ""
      ? !Number.isFinite(ownAmountParsed) || ownAmountParsed <= 0
        ? "Informe um valor maior que zero."
        : Number.isFinite(purchaseTotalParsed) && ownAmountParsed > purchaseTotalParsed
          ? "Sua parte não pode ser maior que o valor total."
          : null
      : null;
  const otherPersonShare =
    sharedActive &&
    !ownAmountError &&
    Number.isFinite(purchaseTotalParsed) &&
    Number.isFinite(ownAmountParsed) &&
    ownAmountParsed > 0
      ? Math.round((purchaseTotalParsed - ownAmountParsed) * 100) / 100
      : null;

  function openNewPurchase() {
    resetPurchaseForm();
    setPurchaseModalOpen(true);
  }

  function openNewSubscription() {
    resetSubscriptionForm();
    setSubscriptionModalOpen(true);
  }

  function openEditSubscription(subscription: CardSubscription) {
    setEditingSubscription(subscription);
    setSubscriptionDesc(subscription.description);
    setSubscriptionAmount(String(subscription.amount).replace(".", ","));
    setSubscriptionDate(subscription.start_date);
    setSubscriptionCategoryId(subscription.category_id ?? defaultSubscriptionCategoryId);
    setSubscriptionActive(subscription.active);
    setSubscriptionModalOpen(true);
  }

  function openEditPurchase(purchase: CardPurchase) {
    setEditingPurchase(purchase);
    setPurchaseDesc(purchase.description);
    setPurchaseAmount(String(purchase.total_amount).replace(".", ","));
    setPurchaseDate(purchase.purchase_date);
    setCategoryId(purchase.category_id ?? "");
    setPaymentType(purchase.installments > 1 ? "parcelado" : "avista");
    setInstallments(String(purchase.installments > 1 ? purchase.installments : 2));
    setIsShared(purchase.is_shared);
    setOwnAmount(
      purchase.own_amount != null ? String(purchase.own_amount).replace(".", ",") : ""
    );
    setPurchaseModalOpen(true);
  }

  async function handleSaveSettings(event: React.FormEvent) {
    event.preventDefault();
    const day = Number(dueDay);
    const closeDay = Number(closingDay);
    const limitRaw = cardLimit.trim();
    const limitParsed = limitRaw
      ? Number(limitRaw.replace(/\./g, "").replace(",", "."))
      : null;
    if (!cardName.trim() || !Number.isInteger(day) || day < 1 || day > 31) return;
    if (!Number.isInteger(closeDay) || closeDay < 1 || closeDay > 31) return;
    if (limitParsed !== null && (!Number.isFinite(limitParsed) || limitParsed < 0)) return;

    setSaving(true);
    try {
      await onSaveCard({
        name: cardName.trim(),
        due_day: day,
        closing_day: closeDay,
        color_start: cardColors[0],
        color_end: cardColors[1],
        credit_limit: limitParsed,
      });
      setEditingSettings(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleSavePurchase(event: React.FormEvent) {
    event.preventDefault();
    const parsed = parseAmount(purchaseAmount);
    const installmentCount = paymentType === "avista" ? 1 : Number(installments);
    if (!purchaseDesc.trim() || !Number.isFinite(parsed) || parsed <= 0) return;
    if (
      paymentType === "parcelado" &&
      (!Number.isInteger(installmentCount) || installmentCount < 2 || installmentCount > 48)
    ) {
      return;
    }
    if (sharedActive) {
      if (ownAmountError) return;
      if (!Number.isFinite(ownAmountParsed) || ownAmountParsed <= 0) return;
      if (ownAmountParsed > parsed) return;
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
        is_shared: sharedActive,
        own_amount: sharedActive ? ownAmountParsed : null,
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

  async function handleSaveSubscription(event: React.FormEvent) {
    event.preventDefault();
    const parsed = Number(subscriptionAmount.replace(/\./g, "").replace(",", "."));
    if (!subscriptionDesc.trim() || !Number.isFinite(parsed) || parsed <= 0) return;

    setSaving(true);
    try {
      await onSaveSubscription({
        id: editingSubscription?.id,
        description: subscriptionDesc.trim(),
        amount: parsed,
        start_date: subscriptionDate,
        category_id: subscriptionCategoryId || null,
        active: subscriptionActive,
      });
      setSubscriptionModalOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteSubscription(subscription: CardSubscription) {
    if (!confirm(`Excluir a assinatura "${subscription.description}"?`)) return;
    setSaving(true);
    try {
      await onDeleteSubscription(subscription.id);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleSubscription(subscription: CardSubscription) {
    setSaving(true);
    try {
      await onSaveSubscription({
        id: subscription.id,
        description: subscription.description,
        amount: subscription.amount,
        start_date: subscription.start_date,
        category_id: subscription.category_id,
        active: !subscription.active,
      });
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
        inactive={nestedModalOpen}
        className="max-w-2xl"
        contentClassName="px-4 pt-4 sm:px-6 sm:pt-6"
      >
        <div className="space-y-5">
          <div className="mx-auto w-full max-w-sm">
            <WalletCardVisual
              data={{
                card,
                openTotal,
                nextPaymentTotal: nextPayment?.total ?? 0,
                nextPaymentDate: nextPayment?.dueDate ?? null,
                purchaseCount: purchases.length,
                gradientIndex,
              }}
            />
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3.5 sm:p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-card text-primary shadow-sm">
              <CalendarClock size={19} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted">
                {showOwnTotals ? "Em aberto no cartão" : "Em aberto"}
              </p>
              <p className="mt-0.5 truncate text-sm font-semibold tabular-nums sm:text-base">
                {formatCurrency(openTotal)}
                {nextPayment ? (
                  <span className="font-normal text-muted">
                    {" "}
                    · próxima {formatDateBR(nextPayment.dueDate)}
                  </span>
                ) : null}
              </p>
              {showOwnTotals ? (
                <p className="mt-0.5 truncate text-xs font-medium text-primary tabular-nums">
                  Sua parte {formatCurrency(openOwnTotal)}
                </p>
              ) : null}
              {creditLimit != null ? (
                <p className="mt-1 text-xs text-muted">
                  Limite {formatCurrency(creditLimit)}
                  {availableLimit != null ? (
                    <> · disponível {formatCurrency(availableLimit)}</>
                  ) : null}
                </p>
              ) : null}
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
              className="space-y-4 rounded-2xl border border-border bg-surface p-4"
            >
              <div>
                <p className="text-sm font-semibold">Configurações do cartão</p>
                <p className="mt-0.5 text-xs text-muted">
                  Atualize nome, fechamento, vencimento, limite e cores.
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
                <Label htmlFor="detail-limit">Limite do cartão</Label>
                <Input
                  id="detail-limit"
                  className="h-11"
                  inputMode="decimal"
                  value={cardLimit}
                  onChange={(event) => setCardLimit(event.target.value)}
                  placeholder="Opcional — ex: 5000"
                  disabled={saving}
                />
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
                <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-medium text-muted">
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
                <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-surface text-muted">
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
                  const own = purchaseOwnAmount(purchase);
                  const shared = sharedPurchasesEnabled && purchase.is_shared;

                  return (
                    <li key={purchase.id} className="p-3.5 sm:p-4">
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-semibold">{purchase.description}</p>
                            {shared && (
                              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                                <Users size={11} aria-hidden="true" />
                                Dividida
                              </span>
                            )}
                          </div>
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
                            {shared && (
                              <span className="ml-1.5 text-xs font-medium text-primary">
                                · sua parte {formatCurrency(own)}
                              </span>
                            )}
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

          <section aria-labelledby="card-subscriptions-title">
            <div className="mb-2.5 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <h3 id="card-subscriptions-title" className="text-sm font-semibold">
                  Assinaturas recorrentes
                </h3>
                <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-medium text-muted">
                  {subscriptions.length}
                </span>
              </div>
              {subscriptions.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-10 shrink-0 px-2 text-primary hover:bg-primary/10 hover:text-primary"
                  onClick={openNewSubscription}
                >
                  <Plus size={15} aria-hidden="true" />
                  Adicionar
                </Button>
              )}
            </div>

            {subscriptions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border px-5 py-8 text-center">
                <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-surface text-muted">
                  <Repeat2 size={20} aria-hidden="true" />
                </span>
                <p className="mt-3 text-sm font-medium">Nenhuma assinatura neste cartão</p>
                <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-muted">
                  Cadastre serviços como ChatGPT, streaming ou planos mensais que repetem na fatura.
                </p>
                <Button className="mt-4 min-h-11" onClick={openNewSubscription}>
                  <Plus size={16} aria-hidden="true" />
                  Adicionar assinatura
                </Button>
              </div>
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border sm:max-h-72 sm:overflow-y-auto">
                {subscriptions.map((subscription) => {
                  const category = categories.find((item) => item.id === subscription.category_id);

                  return (
                    <li
                      key={subscription.id}
                      className={cn(
                        "p-3.5 sm:p-4",
                        !subscription.active && "bg-surface"
                      )}
                    >
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-semibold">{subscription.description}</p>
                            {!subscription.active && (
                              <span className="rounded-full bg-surface-strong px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
                                Pausada
                              </span>
                            )}
                          </div>
                          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted">
                            <span>Mensal · desde {formatDateBR(subscription.start_date)}</span>
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
                            {formatCurrency(subscription.amount)}
                            <span className="ml-1 text-xs font-normal text-muted">/ mês</span>
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-11 w-11 text-muted"
                            onClick={() => openEditSubscription(subscription)}
                            disabled={saving}
                            aria-label={`Editar ${subscription.description}`}
                          >
                            <Pencil size={16} aria-hidden="true" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-11 px-2 text-xs text-muted"
                            onClick={() => void handleToggleSubscription(subscription)}
                            disabled={saving}
                          >
                            {subscription.active ? "Pausar" : "Ativar"}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-11 w-11 text-expense hover:bg-expense-bg hover:text-expense"
                            onClick={() => void handleDeleteSubscription(subscription)}
                            disabled={saving}
                            aria-label={`Excluir ${subscription.description}`}
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
        open={open && purchaseModalOpen}
        onClose={() => setPurchaseModalOpen(false)}
        title={editingPurchase ? "Editar compra" : "Nova compra"}
        className="max-w-xl"
        contentClassName="px-4 pt-4 sm:px-6 sm:pt-6"
      >
        <form onSubmit={handleSavePurchase} className="w-full min-w-0 max-w-full space-y-4">
          <div>
            <Label htmlFor="p-desc">Descrição</Label>
            <Input
              id="p-desc"
              className="h-11"
              value={purchaseDesc}
              onChange={(event) => setPurchaseDesc(event.target.value)}
              placeholder="Ex: Notebook, mercado..."
              disabled={saving}
              data-autofocus
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
            <div className="min-w-0">
              <Label htmlFor="p-amount">
                {sharedActive ? "Valor total da compra (R$)" : "Valor total (R$)"}
              </Label>
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
            <div className="min-w-0">
              <Label htmlFor="p-date">Data da compra</Label>
              <DateInput
                id="p-date"
                className="h-11"
                value={purchaseDate}
                onChange={(event) => setPurchaseDate(event.target.value)}
                disabled={saving}
                required
              />
            </div>
          </div>
          {sharedPurchasesEnabled && (
            <ToggleField
              checked={isShared}
              onCheckedChange={(checked) => {
                setIsShared(checked);
                if (!checked) setOwnAmount("");
              }}
              icon={Users}
              title="Compra dividida"
              description="O cartão recebe o valor cheio, mas você paga só a sua parte."
              ariaLabel="Marcar compra como dividida"
            >
              <div className="border-t border-primary/20 p-3">
                <Label htmlFor="p-own-amount">Valor que irei pagar (R$)</Label>
                <Input
                  id="p-own-amount"
                  className="h-11"
                  inputMode="decimal"
                  value={ownAmount}
                  onChange={(event) => setOwnAmount(event.target.value)}
                  placeholder="0,00"
                  disabled={saving}
                  aria-invalid={ownAmountError ? true : undefined}
                  aria-describedby="p-own-amount-hint"
                  required={sharedActive}
                />
                <p
                  id="p-own-amount-hint"
                  className={cn(
                    "mt-1.5 text-xs",
                    ownAmountError ? "text-expense" : "text-muted"
                  )}
                >
                  {ownAmountError ??
                    (otherPersonShare !== null
                      ? `Parte da outra pessoa: ${formatCurrency(otherPersonShare)}`
                      : "Quanto dessa compra sai do seu bolso.")}
                </p>
              </div>
            </ToggleField>
          )}
          <fieldset disabled={saving}>
            <legend className="text-sm font-medium text-foreground/85">Pagamento</legend>
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
                      : "border-border text-muted hover:bg-surface"
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

      <Modal
        open={open && subscriptionModalOpen}
        onClose={() => setSubscriptionModalOpen(false)}
        title={editingSubscription ? "Editar assinatura" : "Nova assinatura"}
        className="max-w-xl"
        contentClassName="px-4 pt-4 sm:px-6 sm:pt-6"
      >
        <form onSubmit={handleSaveSubscription} className="w-full min-w-0 max-w-full space-y-4">
          <p className="text-xs leading-relaxed text-muted">
            A cobrança se repete todo mês na fatura, com o mesmo valor, a partir da data de início.
          </p>
          <div>
            <Label htmlFor="s-desc">Serviço</Label>
            <Input
              id="s-desc"
              className="h-11"
              value={subscriptionDesc}
              onChange={(event) => setSubscriptionDesc(event.target.value)}
              placeholder="Ex: ChatGPT, HBO Max..."
              disabled={saving}
              data-autofocus
              required
            />
          </div>
          <div>
            <Label htmlFor="s-cat">Categoria</Label>
            <Select
              id="s-cat"
              className="h-11"
              value={subscriptionCategoryId}
              onChange={(event) => setSubscriptionCategoryId(event.target.value)}
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
            <div className="min-w-0">
              <Label htmlFor="s-amount">Valor mensal (R$)</Label>
              <Input
                id="s-amount"
                className="h-11"
                inputMode="decimal"
                value={subscriptionAmount}
                onChange={(event) => setSubscriptionAmount(event.target.value)}
                placeholder="0,00"
                disabled={saving}
                required
              />
            </div>
            <div className="min-w-0">
              <Label htmlFor="s-date">Primeira cobrança</Label>
              <DateInput
                id="s-date"
                className="h-11"
                value={subscriptionDate}
                onChange={(event) => setSubscriptionDate(event.target.value)}
                disabled={saving}
                required
              />
            </div>
          </div>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border px-3.5 py-2.5">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
              checked={subscriptionActive}
              onChange={(event) => setSubscriptionActive(event.target.checked)}
              disabled={saving}
            />
            <span className="text-sm">
              Assinatura ativa
              <span className="mt-0.5 block text-xs text-muted">
                Desmarque para pausar sem excluir o histórico.
              </span>
            </span>
          </label>
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => setSubscriptionModalOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type="submit" className="min-h-11" disabled={saving}>
              {saving ? "Salvando..." : editingSubscription ? "Salvar assinatura" : "Adicionar"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
