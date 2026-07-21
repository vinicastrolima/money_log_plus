"use client";

import * as React from "react";
import { Plus, Pencil, Trash2, Tags, Target } from "lucide-react";
import { useData } from "@/components/data-provider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Label, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { formatCurrency } from "@/lib/utils";
import type { Category, CategoryKind } from "@/lib/types";

const KIND_LABEL: Record<CategoryKind, string> = {
  income: "Entrada",
  expense: "Saída",
  both: "Ambos",
};

const PALETTE = [
  "#16a34a", "#22c55e", "#dc2626", "#f97316", "#7c3aed",
  "#0ea5e9", "#ec4899", "#eab308", "#84cc16", "#06b6d4",
  "#6366f1", "#64748b", "#9A6B3F",
];

export default function CategoriesPage() {
  const {
    loading,
    categories,
    settings,
    transactions,
    addCategory,
    updateCategory,
    deleteCategory,
    updateSettings,
  } = useData();

  const [modalOpen, setModalOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Category | null>(null);
  const [name, setName] = React.useState("");
  const [color, setColor] = React.useState(PALETTE[0]);
  const [kind, setKind] = React.useState<CategoryKind>("expense");
  const [saving, setSaving] = React.useState(false);

  const [target, setTarget] = React.useState<string | null>(null);
  const targetValue = target ?? (settings ? String(settings.daily_target) : "");

  function openNew() {
    setEditing(null);
    setName("");
    setColor(PALETTE[0]);
    setKind("expense");
    setModalOpen(true);
  }

  function openEdit(c: Category) {
    setEditing(c);
    setName(c.name);
    setColor(c.color);
    setKind(c.kind);
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (editing) await updateCategory(editing.id, { name: name.trim(), color, kind });
      else await addCategory({ name: name.trim(), color, kind });
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(c: Category) {
    const count = transactions.filter((t) => t.category_id === c.id).length;
    const msg =
      count > 0
        ? `Excluir "${c.name}"? ${count} transação(ões) ficarão sem categoria.`
        : `Excluir "${c.name}"?`;
    if (!confirm(msg)) return;
    await deleteCategory(c.id);
  }

  async function handleSaveTarget() {
    const val = Number(targetValue.replace(",", "."));
    if (!Number.isFinite(val) || val < 0) return;
    await updateSettings({ daily_target: val });
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Categorias"
        description="Organize suas movimentações e configure a meta diária."
        actions={
          <Button className="w-full sm:w-auto" onClick={openNew}>
            <Plus size={18} /> Nova categoria
          </Button>
        }
      />

      {/* Meta diaria */}
      <Card className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Target size={17} />
          </div>
          <div className="min-w-0 flex-1">
            <Label htmlFor="target" className="mb-0">Meta de gasto diário (R$)</Label>
            <p className="mt-1 text-xs text-muted">
              O valor não utilizado fica disponível para os próximos dias.
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="w-full sm:max-w-48">
            <span className="mb-1.5 block text-xs font-medium text-muted">Valor por dia</span>
            <Input
              id="target"
              inputMode="decimal"
              value={targetValue}
              onChange={(e) => setTarget(e.target.value)}
              aria-describedby={settings ? "target-current" : undefined}
            />
          </div>
          <Button className="w-full sm:w-auto" variant="secondary" onClick={handleSaveTarget}>
            Salvar meta
          </Button>
          {settings && (
            <span
              id="target-current"
              className="rounded-lg bg-surface px-3 py-2 text-sm text-muted sm:ml-auto"
            >
              Atual: <strong className="font-semibold tabular-nums text-foreground">
                {formatCurrency(settings.daily_target)}/dia
              </strong>
            </span>
          )}
        </div>
      </Card>

      {loading ? (
        <CategoriesSkeleton />
      ) : (
        <Card className="p-0">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3.5 sm:px-5">
            <div>
              <h2 className="font-semibold">Suas categorias</h2>
              <p className="text-xs text-muted">Cores e tipos usados nos lançamentos</p>
            </div>
            <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-muted">
              {categories.length}
            </span>
          </div>
          {categories.length === 0 ? (
            <EmptyState
              icon={Tags}
              title="Nenhuma categoria criada"
              description="Crie categorias para organizar melhor suas entradas e saídas."
              action={
                <Button onClick={openNew}>
                  <Plus size={16} /> Nova categoria
                </Button>
              }
              className="border-0 py-10 shadow-none"
            />
          ) : (
            <ul className="divide-y divide-border">
              {categories.map((c) => (
                <li key={c.id} className="flex items-center gap-3 px-4 py-3 sm:px-5 sm:py-4">
                  <span
                    className="h-3.5 w-3.5 shrink-0 rounded-full ring-4 ring-card"
                    style={{ background: c.color }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{c.name}</p>
                    <span className="mt-1 inline-flex rounded-full bg-surface px-2 py-0.5 text-xs text-muted sm:hidden">
                      {KIND_LABEL[c.kind]}
                    </span>
                  </div>
                  <span className="hidden rounded-full bg-surface px-2.5 py-1 text-xs text-muted sm:inline-flex">
                    {KIND_LABEL[c.kind]}
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11"
                      onClick={() => openEdit(c)}
                      aria-label={`Editar ${c.name}`}
                    >
                      <Pencil size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(c)}
                      className="h-11 w-11 text-expense hover:bg-expense-bg"
                      aria-label={`Excluir ${c.name}`}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Editar categoria" : "Nova categoria"}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <Label htmlFor="cat-name">Nome</Label>
            <Input
              id="cat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Alimentação"
              data-autofocus
            />
          </div>
          <div>
            <Label htmlFor="cat-kind">Tipo</Label>
            <Select
              id="cat-kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as CategoryKind)}
            >
              <option value="expense">Saída</option>
              <option value="income">Entrada</option>
              <option value="both">Ambos</option>
            </Select>
          </div>
          <div>
            <Label>Cor</Label>
            <div className="flex flex-wrap gap-2.5">
              {PALETTE.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setColor(p)}
                  className={`h-10 w-10 rounded-full transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                    color === p ? "scale-105 ring-2 ring-primary ring-offset-2" : ""
                  }`}
                  style={{ background: p }}
                  aria-label={`Cor ${p}`}
                  aria-pressed={color === p}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalOpen(false)}
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

function CategoriesSkeleton() {
  return (
    <div className="card animate-pulse overflow-hidden p-0" role="status" aria-label="Carregando categorias">
      <div className="border-b border-border p-4 sm:p-5">
        <div className="h-5 w-36 rounded-full bg-border" />
        <div className="mt-2 h-3 w-52 max-w-full rounded-full bg-border" />
      </div>
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className="flex items-center gap-3 border-b border-border p-4 last:border-0 sm:p-5">
          <div className="h-4 w-4 rounded-full bg-border" />
          <div className="h-4 w-32 rounded-full bg-border" />
          <div className="ml-auto h-7 w-16 rounded-full bg-border" />
          <div className="h-9 w-20 rounded-lg bg-border" />
        </div>
      ))}
      <span className="sr-only">Carregando...</span>
    </div>
  );
}
