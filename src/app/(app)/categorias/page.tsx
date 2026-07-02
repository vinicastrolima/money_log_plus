"use client";

import * as React from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useData } from "@/components/data-provider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
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
  "#6366f1", "#64748b",
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

  const [target, setTarget] = React.useState("");
  React.useEffect(() => {
    if (settings) setTarget(String(settings.daily_target));
  }, [settings]);

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
    const val = Number(target.replace(",", "."));
    if (!Number.isFinite(val) || val < 0) return;
    await updateSettings({ daily_target: val });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Categorias</h1>
          <p className="text-sm text-muted">Organize e configure seu orçamento</p>
        </div>
        <Button onClick={openNew}>
          <Plus size={18} /> Nova categoria
        </Button>
      </div>

      {/* Meta diaria */}
      <Card>
        <Label htmlFor="target">Meta de gasto diário (R$)</Label>
        <p className="mb-2 text-xs text-muted">
          Valor que você quer poder gastar por dia. O que não gastar acumula para
          os próximos dias.
        </p>
        <div className="flex items-center gap-2">
          <Input
            id="target"
            inputMode="decimal"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="max-w-40"
          />
          <Button variant="secondary" onClick={handleSaveTarget}>
            Salvar
          </Button>
          {settings && (
            <span className="text-sm text-muted">
              Atual: {formatCurrency(settings.daily_target)}/dia
            </span>
          )}
        </div>
      </Card>

      {loading ? (
        <p className="text-sm text-muted">Carregando...</p>
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-border">
            {categories.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-3 p-4"
              >
                <span
                  className="h-4 w-4 shrink-0 rounded-full"
                  style={{ background: c.color }}
                />
                <span className="flex-1 font-medium">{c.name}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                  {KIND_LABEL[c.kind]}
                </span>
                <button
                  onClick={() => openEdit(c)}
                  className="rounded-md p-2 text-muted hover:bg-slate-100 cursor-pointer"
                  aria-label="Editar"
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={() => handleDelete(c)}
                  className="rounded-md p-2 text-muted hover:bg-expense-bg hover:text-expense cursor-pointer"
                  aria-label="Excluir"
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
            {categories.length === 0 && (
              <li className="p-6 text-center text-sm text-muted">
                Nenhuma categoria ainda.
              </li>
            )}
          </ul>
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
              autoFocus
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
            <div className="flex flex-wrap gap-2">
              {PALETTE.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setColor(p)}
                  className={`h-8 w-8 rounded-full transition-transform cursor-pointer ${
                    color === p ? "ring-2 ring-offset-2 ring-slate-400 scale-110" : ""
                  }`}
                  style={{ background: p }}
                  aria-label={`Cor ${p}`}
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
