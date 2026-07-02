"use client";

import * as React from "react";
import { Plus, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useData } from "@/components/data-provider";
import { MonthSwitcher } from "@/components/month-switcher";
import { BudgetPanel } from "@/components/budget-panel";
import { TransactionModal } from "@/components/transaction-modal";
import { Card, CardTitle, CardValue } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  computeDailyBudget,
  filterByMonth,
  summarizeMonth,
} from "@/lib/budget";
import { formatCurrency, formatDateBR } from "@/lib/utils";
import type { Transaction } from "@/lib/types";

export default function DashboardPage() {
  const { loading, transactions, settings, categoryById } = useData();
  const now = new Date();
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Painel</h1>
          <p className="text-sm text-muted">Resumo financeiro do mês</p>
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

      {loading ? (
        <p className="text-sm text-muted">Carregando...</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card>
              <CardTitle>Saldo do mês</CardTitle>
              <CardValue
                className={summary.balance >= 0 ? "text-income" : "text-expense"}
              >
                {formatCurrency(summary.balance)}
              </CardValue>
            </Card>
            <Card>
              <CardTitle>Entradas</CardTitle>
              <CardValue className="text-income">
                {formatCurrency(summary.income)}
              </CardValue>
            </Card>
            <Card>
              <CardTitle>Saídas</CardTitle>
              <CardValue className="text-expense">
                {formatCurrency(summary.expense)}
              </CardValue>
            </Card>
          </div>

          <BudgetPanel budget={budget} />

          <Card className="p-0">
            <div className="flex items-center justify-between border-b border-border p-4">
              <h3 className="font-semibold">Últimas transações</h3>
              <span className="text-sm text-muted">{monthTxs.length} no mês</span>
            </div>
            {recent.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted">
                Nenhuma transação neste mês. Clique em &quot;Nova&quot; para começar.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {recent.map((t) => {
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
