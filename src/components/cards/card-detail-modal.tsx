"use client";

import * as React from "react";
import { Pencil, Trash2, ShoppingBag, Plus } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { WalletCardVisual } from "@/components/cards/wallet-carousel";
import {
  aggregateByDueDate,
  cardOpenTotal,
  splitInstallments,
} from "@/lib/cards";
import { formatCurrency, formatDateBR, toISODate } from "@/lib/utils";
import type { CardPurchase, Category, CreditCard } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  card: CreditCard;
  gradientIndex: number;
  purchases: CardPurchase[];
  categories: Category[];
  onSaveCard: (input: { name: string; due_day: number }) => Promise<void>;
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

export function CardDetailModal({
  open,
  onClose,
  card,
  gradientIndex,
  purchases,
  categories,
  onSaveCard,
  onDeleteCard,
  onSavePurchase,
  onDeletePurchase,
}: Props) {
  const [editingSettings, setEditingSettings] = React.useState(false);
  const [cardName, setCardName] = React.useState(card.name);
  const [dueDay, setDueDay] = React.useState(String(card.due_day));
  const [purchaseModalOpen, setPurchaseModalOpen] = React.useState(false);
  const [editingPurchase, setEditingPurchase] = React.useState<CardPurchase | null>(null);
  const [saving, setSaving] = React.useState(false);

  const [purchaseDesc, setPurchaseDesc] = React.useState("");
  const [purchaseAmount, setPurchaseAmount] = React.useState("");
  const [purchaseDate, setPurchaseDate] = React.useState(toISODate(new Date()));
  const [categoryId, setCategoryId] = React.useState("");
  const [paymentType, setPaymentType] = React.useState<"avista" | "parcelado">("avista");
  const [installments, setInstallments] = React.useState("2");

  const expenseCategories = categories.filter(
    (c) => c.kind === "expense" || c.kind === "both"
  );

  React.useEffect(() => {
    if (!open) return;
    setCardName(card.name);
    setDueDay(String(card.due_day));
    setEditingSettings(false);
    setPurchaseModalOpen(false);
  }, [open, card]);

  const openTotal = cardOpenTotal(purchases, card);
  const aggs = aggregateByDueDate(purchases, card);
  const nextPayment = aggs.find((a) => a.dueDate >= toISODate(new Date()));

  function openNewPurchase() {
    setEditingPurchase(null);
    setPurchaseDesc("");
    setPurchaseAmount("");
    setPurchaseDate(toISODate(new Date()));
    setCategoryId("");
    setPaymentType("avista");
    setInstallments("2");
    setPurchaseModalOpen(true);
  }

  function openEditPurchase(p: CardPurchase) {
    setEditingPurchase(p);
    setPurchaseDesc(p.description);
    setPurchaseAmount(String(p.total_amount).replace(".", ","));
    setPurchaseDate(p.purchase_date);
    setCategoryId(p.category_id ?? "");
    setPaymentType(p.installments > 1 ? "parcelado" : "avista");
    setInstallments(String(p.installments > 1 ? p.installments : 2));
    setPurchaseModalOpen(true);
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    const day = Number(dueDay);
    if (!cardName.trim() || !Number.isInteger(day) || day < 1 || day > 31) return;
    setSaving(true);
    try {
      await onSaveCard({ name: cardName.trim(), due_day: day });
      setEditingSettings(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleSavePurchase(e: React.FormEvent) {
    e.preventDefault();
    const parsed = Number(purchaseAmount.replace(/\./g, "").replace(",", "."));
    const inst = paymentType === "avista" ? 1 : Number(installments);
    if (!purchaseDesc.trim() || !Number.isFinite(parsed) || parsed <= 0) return;
    if (paymentType === "parcelado" && (!Number.isInteger(inst) || inst < 2 || inst > 48))
      return;

    setSaving(true);
    try {
      await onSavePurchase({
        id: editingPurchase?.id,
        description: purchaseDesc.trim(),
        total_amount: parsed,
        installments: inst,
        purchase_date: purchaseDate,
        category_id: categoryId || null,
      });
      setPurchaseModalOpen(false);
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
        className="max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <div className="space-y-5">
          <WalletCardVisual
            slide={{
              type: "card",
              card,
              openTotal,
              purchaseCount: purchases.length,
              gradientIndex,
            }}
            compact
          />

          <div className="rounded-xl border border-border bg-slate-50/80 p-3 text-sm">
            <p className="text-muted">
              Próximo pagamento:{" "}
              <span className="font-medium text-foreground">
                {nextPayment
                  ? `${formatDateBR(nextPayment.dueDate)} · ${formatCurrency(nextPayment.total)}`
                  : "Nenhum"}
              </span>
            </p>
          </div>

          {!editingSettings ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditingSettings(true)}>
                <Pencil size={14} />
                Configurar cartão
              </Button>
              <Button size="sm" onClick={openNewPurchase}>
                <ShoppingBag size={14} />
                Nova compra
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSaveSettings} className="space-y-3 rounded-xl border border-border p-4">
              <p className="text-sm font-medium">Configurações do cartão</p>
              <div>
                <Label htmlFor="detail-name">Nome</Label>
                <Input
                  id="detail-name"
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="detail-due">Dia do pagamento</Label>
                <Select
                  id="detail-due"
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
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={saving}>
                  Salvar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingSettings(false)}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          )}

          <div>
            <h3 className="mb-2 text-sm font-semibold">Compras ({purchases.length})</h3>
            {purchases.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-6 text-center">
                <p className="text-sm text-muted">Nenhuma compra ainda.</p>
                <Button className="mt-3" size="sm" onClick={openNewPurchase}>
                  <Plus size={14} />
                  Adicionar primeira compra
                </Button>
              </div>
            ) : (
              <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {purchases.map((p) => {
                  const cat = categories.find((c) => c.id === p.category_id);
                  const perInstallment =
                    p.installments > 1
                      ? splitInstallments(p.total_amount, p.installments)[0]
                      : p.total_amount;
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border p-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{p.description}</p>
                        <p className="text-xs text-muted">
                          {formatDateBR(p.purchase_date)} ·{" "}
                          {p.installments === 1
                            ? "À vista"
                            : `${p.installments}x ${formatCurrency(perInstallment)}`}
                          {cat && (
                            <>
                              {" "}
                              ·{" "}
                              <span
                                className="inline-flex items-center gap-1"
                                style={{ color: cat.color }}
                              >
                                <span
                                  className="inline-block h-2 w-2 rounded-full"
                                  style={{ background: cat.color }}
                                />
                                {cat.name}
                              </span>
                            </>
                          )}
                        </p>
                        <p className="text-sm font-medium text-expense">
                          {formatCurrency(p.total_amount)}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          onClick={() => openEditPurchase(p)}
                          className="rounded p-1.5 text-muted hover:bg-slate-100 cursor-pointer"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!confirm(`Excluir "${p.description}"?`)) return;
                            setSaving(true);
                            try {
                              await onDeletePurchase(p.id);
                            } finally {
                              setSaving(false);
                            }
                          }}
                          className="rounded p-1.5 text-expense hover:bg-expense-bg cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={async () => {
              if (!confirm(`Excluir o cartão "${card.name}" e todas as compras?`)) return;
              setSaving(true);
              try {
                await onDeleteCard();
                onClose();
              } finally {
                setSaving(false);
              }
            }}
            className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-sm text-expense hover:bg-expense-bg cursor-pointer"
          >
            <Trash2 size={14} />
            Excluir cartão
          </button>
        </div>
      </Modal>

      <Modal
        open={purchaseModalOpen}
        onClose={() => setPurchaseModalOpen(false)}
        title={editingPurchase ? "Editar compra" : "Nova compra"}
      >
        <form onSubmit={handleSavePurchase} className="space-y-4">
          <div>
            <Label htmlFor="p-desc">Descrição</Label>
            <Input
              id="p-desc"
              value={purchaseDesc}
              onChange={(e) => setPurchaseDesc(e.target.value)}
              placeholder="Ex: Notebook, Mercado..."
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="p-cat">Categoria</Label>
            <Select
              id="p-cat"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">Sem categoria</option>
              {expenseCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="p-amount">Valor total (R$)</Label>
              <Input
                id="p-amount"
                inputMode="decimal"
                value={purchaseAmount}
                onChange={(e) => setPurchaseAmount(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="p-date">Data da compra</Label>
              <Input
                id="p-date"
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label>Pagamento</Label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(["avista", "parcelado"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setPaymentType(t)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm font-medium cursor-pointer",
                    paymentType === t
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted hover:bg-slate-50"
                  )}
                >
                  {t === "avista" ? "À vista" : "Parcelado"}
                </button>
              ))}
            </div>
          </div>
          {paymentType === "parcelado" && (
            <div>
              <Label htmlFor="p-inst">Parcelas</Label>
              <Select
                id="p-inst"
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
    </>
  );
}
