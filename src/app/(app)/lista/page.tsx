"use client";

import * as React from "react";
import { Plus, ArrowUpRight, ArrowDownRight, Search } from "lucide-react";
import { useData } from "@/components/data-provider";
import { MonthSwitcher } from "@/components/month-switcher";
import { TransactionModal } from "@/components/transaction-modal";
import { TransactionStatusBadge } from "@/components/transaction-status-badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { filterByMonth, summarizeMonth } from "@/lib/budget";
import { formatCurrency, formatDateBR } from "@/lib/utils";
import type { Direction, Transaction, TxStatus, TxType } from "@/lib/types";

export default function ListPage() {
  const { loading, transactions, categories, categoryById } = useData();
  const now = new Date();
  const [year, setYear] = React.useState(now.getFullYear());
  const [month0, setMonth0] = React.useState(now.getMonth());
  const [direction, setDirection] = React.useState<Direction | "all">("all");
  const [type, setType] = React.useState<TxType | "all">("all");
  const [categoryId, setCategoryId] = React.useState<string>("all");
  const [statusFilter, setStatusFilter] = React.useState<TxStatus | "all">("all");
  const [search, setSearch] = React.useState("");

  const [modalOpen, setModalOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Transaction | null>(null);

  const filtered = React.useMemo(() => {
    let txs = filterByMonth(transactions, year, month0);
    if (direction !== "all") txs = txs.filter((t) => t.direction === direction);
    if (type !== "all") txs = txs.filter((t) => t.type === type);
    if (categoryId !== "all")
      txs = txs.filter((t) => (t.category_id ?? "none") === categoryId);
    if (statusFilter !== "all")
      txs = txs.filter((t) => t.status === statusFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      txs = txs.filter((t) => t.description.toLowerCase().includes(q));
    }
    return txs;
  }, [transactions, year, month0, direction, type, categoryId, statusFilter, search]);

  const summary = summarizeMonth(filtered);

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Lista"
        description="Consulte, filtre e edite todas as transações do mês."
        actions={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
            <MonthSwitcher
              year={year}
              month0={month0}
              onChange={(y, m) => {
                setYear(y);
                setMonth0(m);
              }}
            />
            <Button
              className="flex-1 sm:flex-none"
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
            >
              <Plus size={18} />
              <span className="sm:hidden">Nova</span>
              <span className="hidden sm:inline">Nova transação</span>
            </Button>
          </div>
        }
      />

      {/* Filtros */}
      <Card className="p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Filtros</h2>
            <p className="text-xs text-muted">Refine as movimentações exibidas abaixo</p>
          </div>
          <span className="shrink-0 text-xs font-medium text-muted">
            {filtered.length} resultado{filtered.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="relative sm:col-span-2 xl:col-span-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar descrição..."
            className="pl-9"
            aria-label="Buscar por descrição"
          />
        </div>
        <Select
          aria-label="Filtrar por direção"
          value={direction}
          onChange={(e) => setDirection(e.target.value as Direction | "all")}
        >
          <option value="all">Entradas e saídas</option>
          <option value="in">Só entradas</option>
          <option value="out">Só saídas</option>
        </Select>
        <Select
          aria-label="Filtrar por tipo"
          value={type}
          onChange={(e) => setType(e.target.value as TxType | "all")}
        >
          <option value="all">Prevista e diária</option>
          <option value="prevista">Só previstas</option>
          <option value="diaria">Só diárias</option>
        </Select>
        <Select
          aria-label="Filtrar por categoria"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          <option value="all">Todas categorias</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value="none">Sem categoria</option>
        </Select>
        <Select
          aria-label="Filtrar por status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as TxStatus | "all")}
        >
          <option value="all">Todos os status</option>
          <option value="concluido">Concluído</option>
          <option value="pendente">Pendente</option>
          <option value="atrasado">Atrasado</option>
        </Select>
        </div>
      </Card>

      {loading ? (
        <ListSkeleton />
      ) : (
        <>
          {/* Resumo dos filtrados */}
          <div className="grid grid-cols-2 gap-3 text-left sm:grid-cols-3">
            <Card className="py-3.5 sm:py-4">
              <p className="text-xs text-muted">Entradas</p>
              <p className="mt-1 break-words font-semibold tabular-nums text-income">
                {formatCurrency(summary.income)}
              </p>
            </Card>
            <Card className="py-3.5 sm:py-4">
              <p className="text-xs text-muted">Saídas</p>
              <p className="mt-1 break-words font-semibold tabular-nums text-expense">
                {formatCurrency(summary.expense)}
              </p>
            </Card>
            <Card className="col-span-2 py-3.5 sm:col-span-1 sm:py-4">
              <p className="text-xs text-muted">Saldo</p>
              <p
                className={`mt-1 break-words font-semibold tabular-nums ${
                  summary.balance >= 0 ? "text-income" : "text-expense"
                }`}
              >
                {formatCurrency(summary.balance)}
              </p>
            </Card>
          </div>

          <Card className="p-0">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3.5 sm:px-5">
              <div>
                <h2 className="font-semibold">Transações</h2>
                <p className="text-xs text-muted">Selecione uma linha para editar</p>
              </div>
              <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-muted">
                {filtered.length}
              </span>
            </div>
            {filtered.length === 0 ? (
              <EmptyState
                icon={Search}
                title="Nenhuma transação encontrada"
                description="Ajuste os filtros ou crie uma nova transação para este período."
                action={
                  <Button
                    onClick={() => {
                      setEditing(null);
                      setModalOpen(true);
                    }}
                  >
                    <Plus size={16} /> Nova transação
                  </Button>
                }
                className="border-0 py-10 shadow-none"
              />
            ) : (
              <ul className="divide-y divide-border">
                {filtered.map((t) => {
                  const cat = categoryById(t.category_id);
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(t);
                          setModalOpen(true);
                        }}
                        className="grid w-full grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40 sm:flex sm:px-5 sm:py-4"
                      >
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                            t.direction === "in"
                              ? "bg-income-bg text-income"
                              : "bg-expense-bg text-expense"
                          }`}
                        >
                          {t.direction === "in" ? (
                            <ArrowUpRight size={18} />
                          ) : (
                            <ArrowDownRight size={18} />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{t.description}</p>
                          <p className="truncate text-xs text-muted">
                            {formatDateBR(t.date)}
                            {cat ? ` · ${cat.name}` : ""}
                            {t.type === "diaria" ? " · diário" : ""}
                            {t.recurrence_id ? " · recorrente" : ""}
                          </p>
                        </div>
                        <div className="hidden sm:block">
                          <TransactionStatusBadge status={t.status} />
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span
                            className={`text-sm font-semibold tabular-nums sm:text-base ${
                              t.direction === "in" ? "text-income" : "text-expense"
                            }`}
                          >
                            {t.direction === "in" ? "+" : "−"}
                            {formatCurrency(t.amount)}
                          </span>
                          <TransactionStatusBadge
                            status={t.status}
                            showLabel={false}
                            className="sm:hidden"
                          />
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </>
      )}

      <TransactionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        transaction={editing}
      />
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-5" role="status" aria-label="Carregando transações">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className={`card animate-pulse p-4 ${index === 2 ? "col-span-2 sm:col-span-1" : ""}`}
          >
            <div className="h-3 w-16 rounded-full bg-border" />
            <div className="mt-2 h-5 w-28 rounded-full bg-border" />
          </div>
        ))}
      </div>
      <div className="card animate-pulse overflow-hidden p-0">
        <div className="h-16 border-b border-border p-4">
          <div className="h-5 w-32 rounded-full bg-border" />
        </div>
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="flex items-center gap-3 border-b border-border p-4 last:border-0">
            <div className="h-9 w-9 rounded-full bg-border" />
            <div className="flex-1">
              <div className="h-4 w-2/5 rounded-full bg-border" />
              <div className="mt-2 h-3 w-1/4 rounded-full bg-border" />
            </div>
            <div className="h-5 w-20 rounded-full bg-border" />
          </div>
        ))}
      </div>
      <span className="sr-only">Carregando...</span>
    </div>
  );
}
