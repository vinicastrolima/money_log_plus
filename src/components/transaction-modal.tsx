"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { RecurrenceEditor } from "@/components/recurrence-editor";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { ToggleField } from "@/components/ui/toggle-field";
import { useData } from "@/components/data-provider";
import type {
  Direction,
  RecurrenceConfig,
  Transaction,
  TxStatus,
  TxType,
} from "@/lib/types";
import {
  alignRecurrenceWithDate,
  recurrenceFromPreset,
} from "@/lib/recurrence";
import { TX_STATUS, TX_STATUS_ORDER, suggestStatusForDate } from "@/lib/transaction-status";
import { toISODate, formatCurrency, formatDateBR } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Transacao existente para edicao; se ausente, cria nova. */
  transaction?: Transaction | null;
  /** Data pre-selecionada (YYYY-MM-DD) ao criar a partir do calendario. */
  defaultDate?: string;
}

export function TransactionModal({
  open,
  onClose,
  transaction,
  defaultDate,
}: Props) {
  if (!open) return null;

  const contentKey = transaction?.id ?? `new-${defaultDate ?? "today"}`;
  return (
    <TransactionModalContent
      key={contentKey}
      onClose={onClose}
      transaction={transaction}
      defaultDate={defaultDate}
    />
  );
}

function TransactionModalContent({
  onClose,
  transaction,
  defaultDate,
}: Omit<Props, "open">) {
  const {
    categories,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    recurrenceById,
  } = useData();

  const initialDate = transaction?.date ?? defaultDate ?? toISODate(new Date());
  const existingRecurrence = recurrenceById(transaction?.recurrence_id ?? null);
  const [date, setDate] = React.useState(initialDate);
  const [description, setDescription] = React.useState(
    transaction?.description ?? ""
  );
  const [amount, setAmount] = React.useState(
    transaction ? String(transaction.amount).replace(".", ",") : ""
  );
  const [direction, setDirection] = React.useState<Direction>(
    transaction?.direction ?? "out"
  );
  const [categoryId, setCategoryId] = React.useState<string>(
    transaction?.category_id ?? ""
  );
  const [isDaily, setIsDaily] = React.useState(
    transaction?.type === "diaria"
  );
  const [status, setStatus] = React.useState<TxStatus>(
    transaction?.status ?? suggestStatusForDate(initialDate)
  );
  const [isRecurring, setIsRecurring] = React.useState(
    Boolean(existingRecurrence?.active)
  );
  const [recurrence, setRecurrence] = React.useState<RecurrenceConfig>(
    existingRecurrence?.rule ?? recurrenceFromPreset("monthly", initialDate)
  );
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const visibleCategories = categories.filter(
    (c) => c.kind === "both" || (direction === "in" ? c.kind === "income" : c.kind === "expense")
  );

  const isAutoCard = Boolean(transaction?.credit_card_id);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isAutoCard) return;
    setError(null);
    const parsed = Number(amount.replace(/\./g, "").replace(",", "."));
    if (!description.trim()) return setError("Informe uma descrição.");
    if (!Number.isFinite(parsed) || parsed <= 0)
      return setError("Informe um valor válido.");

    const input = {
      date,
      description: description.trim(),
      amount: parsed,
      direction,
      category_id: categoryId || null,
      type: (isDaily ? "diaria" : "prevista") as TxType,
      status,
      recurrence: isRecurring ? recurrence : null,
    };

    setSaving(true);
    try {
      if (transaction) await updateTransaction(transaction.id, input);
      else await addTransaction(input);
      onClose();
    } catch {
      setError("Erro ao salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!transaction || isAutoCard) return;
    const message = transaction.recurrence_id
      ? "Excluir apenas este lançamento? A recorrência continuará ativa."
      : "Excluir esta transação?";
    if (!confirm(message)) return;
    setSaving(true);
    try {
      await deleteTransaction(transaction.id);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={
        transaction
          ? existingRecurrence?.active
            ? "Editar recorrência"
            : "Editar transação"
          : "Nova transação"
      }
    >
      {isAutoCard ? (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Este lançamento foi gerado automaticamente a partir de compras no cartão. Para alterar
            valor ou data, edite as compras na aba{" "}
            <Link href="/cartoes" className="font-medium text-primary underline">
              Cartões
            </Link>
            . Você ainda pode marcar o status como concluído abaixo.
          </p>
          <div className="rounded-lg border border-border p-3 text-sm">
            <p className="font-medium">{transaction?.description}</p>
            <p className="text-expense">{transaction && formatCurrency(transaction.amount)}</p>
            <p className="text-muted">{transaction && formatDateBR(transaction.date)}</p>
          </div>
          <div>
            <Label>Status</Label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {TX_STATUS_ORDER.map((s) => {
                const cfg = TX_STATUS[s];
                const active = status === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={cn(
                      "flex items-center justify-center gap-2 rounded-lg border px-2 py-2.5 text-xs font-medium transition-colors cursor-pointer",
                      active ? cfg.badge : "border-border text-muted hover:bg-surface"
                    )}
                  >
                    <span className={cn("h-2.5 w-2.5 rounded-full", cfg.dot)} />
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Fechar
            </Button>
            <Button
              disabled={saving}
              onClick={async () => {
                if (!transaction) return;
                setSaving(true);
                try {
                  await updateTransaction(transaction.id, {
                    date: transaction.date,
                    description: transaction.description,
                    amount: transaction.amount,
                    direction: transaction.direction,
                    category_id: transaction.category_id,
                    type: transaction.type,
                    status,
                  });
                  onClose();
                } catch {
                  setError("Erro ao salvar status.");
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? "Salvando..." : "Salvar status"}
            </Button>
          </div>
        </div>
      ) : (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setDirection("in")}
            className={`h-10 rounded-lg border text-sm font-medium transition-colors cursor-pointer ${
              direction === "in"
                ? "border-income bg-income-bg text-income"
                : "border-border text-muted hover:bg-surface"
            }`}
          >
            Entrou (+)
          </button>
          <button
            type="button"
            onClick={() => setDirection("out")}
            className={`h-10 rounded-lg border text-sm font-medium transition-colors cursor-pointer ${
              direction === "out"
                ? "border-expense bg-expense-bg text-expense"
                : "border-border text-muted hover:bg-surface"
            }`}
          >
            Saiu (−)
          </button>
        </div>

        <div>
          <Label htmlFor="tx-desc">Descrição</Label>
          <Input
            id="tx-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex: Mercado, Salário, Nubank..."
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <Label htmlFor="tx-amount">Valor (R$)</Label>
            <Input
              id="tx-amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
            />
          </div>
          <div className="min-w-0">
            <Label htmlFor="tx-date">Data</Label>
            <Input
              id="tx-date"
              type="date"
              value={date}
              className="min-w-0 max-w-full"
              onChange={(e) => {
                const nextDate = e.target.value;
                setRecurrence((current) =>
                  alignRecurrenceWithDate(current, date, nextDate)
                );
                setDate(nextDate);
                if (!transaction) setStatus(suggestStatusForDate(nextDate));
              }}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="tx-cat">Categoria</Label>
          <Select
            id="tx-cat"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">Sem categoria</option>
            {visibleCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>

        {direction === "out" && (
          <ToggleField
            checked={isDaily}
            onCheckedChange={setIsDaily}
            icon={CalendarDays}
            title="Gasto diário"
            description="Conta no limite diário."
            ariaLabel="Ativar gasto diário"
          />
        )}

        <RecurrenceEditor
          enabled={isRecurring}
          value={recurrence}
          startDate={date}
          editingSeries={Boolean(existingRecurrence?.active)}
          onEnabledChange={setIsRecurring}
          onChange={setRecurrence}
        />

        <div>
          <Label>Status</Label>
          <p className="mb-2 text-xs text-muted">
            Verde = concluído · Amarelo = pendente (na margem) · Vermelho = atrasado
          </p>
          <div className="grid grid-cols-3 gap-2">
            {TX_STATUS_ORDER.map((s) => {
              const cfg = TX_STATUS[s];
              const active = status === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-lg border px-2 py-2.5 text-xs font-medium transition-colors cursor-pointer",
                    active ? cfg.badge : "border-border text-muted hover:bg-surface"
                  )}
                >
                  <span className={cn("h-2.5 w-2.5 rounded-full", cfg.dot)} />
                  {cfg.label}
                </button>
              );
            })}
          </div>
        </div>

        {error && <p className="text-sm text-expense">{error}</p>}

        <div className="flex items-center justify-between pt-1">
          {transaction ? (
            <Button
              type="button"
              variant="ghost"
              className="text-expense hover:bg-expense-bg"
              onClick={handleDelete}
              disabled={saving}
            >
              Excluir
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </form>
      )}
    </Modal>
  );
}
