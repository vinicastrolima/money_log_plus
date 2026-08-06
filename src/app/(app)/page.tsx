"use client";

import * as React from "react";
import { Plus, ArrowUpRight, ArrowDownRight, ReceiptText } from "lucide-react";
import { useData } from "@/components/data-provider";
import { MonthSwitcher } from "@/components/month-switcher";
import { BudgetPanel } from "@/components/budget-panel";
import { HideValuesToggle } from "@/components/hide-values-toggle";
import { TransactionModal } from "@/components/transaction-modal";
import { TransactionStatusBadge } from "@/components/transaction-status-badge";
import { Card, CardTitle, CardValue } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import {
  computeDailyBudget,
  filterByMonth,
  summarizeMonth,
} from "@/lib/budget";
import { useHideValues } from "@/lib/hide-values";
import { formatCurrency, formatDateBR } from "@/lib/utils";
import type { Transaction } from "@/lib/types";

export default function DashboardPage() {
  const { loading, transactions, settings, categoryById } = useData();
  const { hidden: hideValues } = useHideValues();
  const [now] = React.useState(() => new Date());
  const [year, setYear] = React.useState(now.getFullYear());
  const [month0, setMonth0] = React.useState(now.getMonth());
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Transaction | null>(null);

  const monthTxs = React.useMemo(
    () => filterByMonth(transactions, year, month0),
    [transactions, year, month0]
  );
  const summary = React.useMemo(() => summarizeMonth(monthTxs), [monthTxs]);
  const budget = React.useMemo(
    () =>
      computeDailyBudget(
        monthTxs,
        year,
        month0,
        settings?.daily_target ?? 50,
        now
      ),
    [monthTxs, year, month0, settings, now]
  );

  const recent = monthTxs.slice(0, 8);

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Painel"
        description="Acompanhe o resumo financeiro e o orçamento do mês."
        actions={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
            <HideValuesToggle />
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

      {loading ? (
        <DashboardSkeleton />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
            <Card className="col-span-2 sm:col-span-1">
              <CardTitle>Saldo do mês</CardTitle>
              <CardValue
                className={`break-words text-xl tabular-nums sm:text-2xl ${
                  summary.balance >= 0 ? "text-income" : "text-expense"
                }`}
              >
                {formatCurrency(summary.balance, hideValues)}
              </CardValue>
            </Card>
            <Card>
              <CardTitle>Entradas</CardTitle>
              <CardValue className="break-words text-xl tabular-nums text-income sm:text-2xl">
                {formatCurrency(summary.income, hideValues)}
              </CardValue>
            </Card>
            <Card>
              <CardTitle>Saídas</CardTitle>
              <CardValue className="break-words text-xl tabular-nums text-expense sm:text-2xl">
                {formatCurrency(summary.expense, hideValues)}
              </CardValue>
            </Card>
          </div>

          <BudgetPanel budget={budget} hideValues={hideValues} />

          <Card className="p-0">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3.5 sm:px-5 sm:py-4">
              <div>
                <h2 className="font-semibold">Últimas transações</h2>
                <p className="text-xs text-muted">Movimentações mais recentes do período</p>
              </div>
              <span className="shrink-0 rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-muted">
                {monthTxs.length} no mês
              </span>
            </div>
            {recent.length === 0 ? (
              <EmptyState
                icon={ReceiptText}
                title="Nenhuma transação neste mês"
                description="Crie uma transação para começar a acompanhar seu resumo financeiro."
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
                {recent.map((t) => {
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
                          <p className="text-xs text-muted">
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
                            {formatCurrency(t.amount, hideValues)}
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

function DashboardSkeleton() {
  return (
    <div className="space-y-5" role="status" aria-label="Carregando painel">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className={`card animate-pulse p-5 ${index === 0 ? "col-span-2 sm:col-span-1" : ""}`}
          >
            <div className="h-3 w-24 rounded-full bg-border" />
            <div className="mt-3 h-7 w-32 rounded-lg bg-border" />
          </div>
        ))}
      </div>
      <div className="card animate-pulse p-5">
        <div className="h-5 w-40 rounded-full bg-border" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="h-28 rounded-xl bg-border" />
          <div className="h-28 rounded-xl bg-border" />
        </div>
      </div>
      <div className="card animate-pulse p-5">
        <div className="h-5 w-44 rounded-full bg-border" />
        <div className="mt-5 space-y-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="h-12 rounded-xl bg-border" />
          ))}
        </div>
      </div>
      <span className="sr-only">Carregando...</span>
    </div>
  );
}
