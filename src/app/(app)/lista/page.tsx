"use client";

import * as React from "react";
import { Plus, ArrowUpRight, ArrowDownRight, Search } from "lucide-react";
import { useData } from "@/components/data-provider";
import { MonthSwitcher } from "@/components/month-switcher";
import { TransactionModal } from "@/components/transaction-modal";
import { TransactionStatusBadge } from "@/components/transaction-status-badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Lista</h1>
          <p className="text-sm text-muted">Todas as transações do mês</p>
        </div>
        <div className="flex items-center gap-2">
          <MonthSwitcher
            year={year}
            month0={month0}
            onChange={(y, m) => {
              setYear(y);
              setMonth0(m);
            }}
          />
          <Button
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            <Plus size={18} /> Nova
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar descrição..."
            className="pl-9"
          />
        </div>
        <Select
          value={direction}
          onChange={(e) => setDirection(e.target.value as Direction | "all")}
        >
          <option value="all">Entradas e saídas</option>
          <option value="in">Só entradas</option>
          <option value="out">Só saídas</option>
        </Select>
        <Select value={type} onChange={(e) => setType(e.target.value as TxType | "all")}>
          <option value="all">Prevista e diária</option>
          <option value="prevista">Só previstas</option>
          <option value="diaria">Só diárias</option>
        </Select>
        <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="all">Todas categorias</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value="none">Sem categoria</option>
        </Select>
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as TxStatus | "all")}
        >
          <option value="all">Todos os status</option>
          <option value="concluido">Concluído</option>
          <option value="pendente">Pendente</option>
          <option value="atrasado">Atrasado</option>
        </Select>
      </div>

      {/* Resumo dos filtrados */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <Card className="py-3">
          <p className="text-xs text-muted">Entradas</p>
          <p className="font-semibold text-income">{formatCurrency(summary.income)}</p>
        </Card>
        <Card className="py-3">
          <p className="text-xs text-muted">Saídas</p>
          <p className="font-semibold text-expense">{formatCurrency(summary.expense)}</p>
        </Card>
        <Card className="py-3">
          <p className="text-xs text-muted">Saldo</p>
          <p
            className={`font-semibold ${
              summary.balance >= 0 ? "text-income" : "text-expense"
            }`}
          >
            {formatCurrency(summary.balance)}
          </p>
        </Card>
      </div>

      {loading ? (
        <p className="text-sm text-muted">Carregando...</p>
      ) : (
        <Card className="p-0">
          {filtered.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted">
              Nenhuma transação encontrada.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((t) => {
                const cat = categoryById(t.category_id);
                return (
                  <li key={t.id}>
                    <button
                      onClick={() => {
                        setEditing(t);
                        setModalOpen(true);
                      }}
                      className="flex w-full items-center gap-3 p-4 text-left hover:bg-slate-50 cursor-pointer"
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
                        <p className="text-xs text-muted">
                          {formatDateBR(t.date)}
                          {cat ? ` · ${cat.name}` : ""}
                          {t.type === "diaria" ? " · diário" : ""}
                        </p>
                      </div>
                      <TransactionStatusBadge status={t.status} />
                      <span
                        className={`font-semibold ${
                          t.direction === "in" ? "text-income" : "text-expense"
                        }`}
                      >
                        {t.direction === "in" ? "+" : "−"}
                        {formatCurrency(t.amount)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}

      <TransactionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        transaction={editing}
      />
    </div>
  );
}
