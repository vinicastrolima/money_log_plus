"use client";

import * as React from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { useData } from "@/components/data-provider";
import type { Direction, Transaction, TxStatus, TxType } from "@/lib/types";
import { TX_STATUS, TX_STATUS_ORDER, suggestStatusForDate } from "@/lib/transaction-status";
import { toISODate } from "@/lib/utils";
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
  const { categories, addTransaction, updateTransaction, deleteTransaction } =
    useData();

  const [date, setDate] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [direction, setDirection] = React.useState<Direction>("out");
  const [categoryId, setCategoryId] = React.useState<string>("");
  const [isDaily, setIsDaily] = React.useState(false);
  const [status, setStatus] = React.useState<TxStatus>("pendente");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    if (transaction) {
      setDate(transaction.date);
      setDescription(transaction.description);
      setAmount(String(transaction.amount).replace(".", ","));
      setDirection(transaction.direction);
      setCategoryId(transaction.category_id ?? "");
      setIsDaily(transaction.type === "diaria");
      setStatus(transaction.status);
    } else {
      const initialDate = defaultDate ?? toISODate(new Date());
      setDate(initialDate);
      setDescription("");
      setAmount("");
      setDirection("out");
      setCategoryId("");
      setIsDaily(false);
      setStatus(suggestStatusForDate(initialDate));
    }
    setError(null);
  }, [open, transaction, defaultDate]);

  React.useEffect(() => {
    if (!open || transaction) return;
    setStatus(suggestStatusForDate(date));
  }, [open, transaction, date]);

  const visibleCategories = categories.filter(
    (c) => c.kind === "both" || (direction === "in" ? c.kind === "income" : c.kind === "expense")
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
    if (!transaction) return;
    if (!confirm("Excluir esta transação?")) return;
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
      open={open}
      onClose={onClose}
      title={transaction ? "Editar transação" : "Nova transação"}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setDirection("in")}
            className={`h-10 rounded-lg border text-sm font-medium transition-colors cursor-pointer ${
              direction === "in"
                ? "border-income bg-income-bg text-income"
                : "border-border text-muted hover:bg-slate-50"
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
                : "border-border text-muted hover:bg-slate-50"
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
          <div>
            <Label htmlFor="tx-amount">Valor (R$)</Label>
            <Input
              id="tx-amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
            />
          </div>
          <div>
            <Label htmlFor="tx-date">Data</Label>
            <Input
              id="tx-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
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
          <label className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-slate-50">
            <input
              type="checkbox"
              checked={isDaily}
              onChange={(e) => setIsDaily(e.target.checked)}
              className="mt-0.5 h-4 w-4 cursor-pointer accent-[var(--primary)]"
            />
            <span className="text-sm">
              <span className="font-medium">É gasto diário?</span>
              <span className="block text-muted">
                Marque se é um gasto do dia a dia (consome o limite de R$/dia).
                Deixe desmarcado para contas já previstas (dívida, cartão...).
              </span>
            </span>
          </label>
        )}

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
                    active ? cfg.badge : "border-border text-muted hover:bg-slate-50"
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
    </Modal>
  );
}
