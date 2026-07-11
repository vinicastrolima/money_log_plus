"use client";

import * as React from "react";
import { Plus, ArrowUpRight, ArrowDownRight, CalendarDays } from "lucide-react";
import { useData } from "@/components/data-provider";
import { MonthSwitcher } from "@/components/month-switcher";
import { TransactionModal } from "@/components/transaction-modal";
import { TransactionStatusBadge } from "@/components/transaction-status-badge";
import { dominantStatus, TX_STATUS } from "@/lib/transaction-status";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { filterByMonth } from "@/lib/budget";
import {
  daysInMonth,
  formatCurrency,
  parseISODate,
  toISODate,
  WEEKDAYS_PT,
  formatDateBR,
  cn,
} from "@/lib/utils";
import type { Transaction } from "@/lib/types";

interface DayAgg {
  income: number;
  expense: number;
  daily: number;
  txs: Transaction[];
}

export default function CalendarPage() {
  const { loading, transactions, categoryById } = useData();
  const now = new Date();
  const [year, setYear] = React.useState(now.getFullYear());
  const [month0, setMonth0] = React.useState(now.getMonth());

  const [selectedDate, setSelectedDate] = React.useState<string | null>(null);
  const [txModalOpen, setTxModalOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Transaction | null>(null);

  const monthTxs = React.useMemo(
    () => filterByMonth(transactions, year, month0),
    [transactions, year, month0]
  );

  const byDay = React.useMemo(() => {
    const map = new Map<number, DayAgg>();
    for (const t of monthTxs) {
      const day = parseISODate(t.date).getDate();
      const agg =
        map.get(day) ?? { income: 0, expense: 0, daily: 0, txs: [] };
      if (t.direction === "in") agg.income += t.amount;
      else {
        agg.expense += t.amount;
        if (t.type === "diaria") agg.daily += t.amount;
      }
      agg.txs.push(t);
      map.set(day, agg);
    }
    return map;
  }, [monthTxs]);

  const totalDays = daysInMonth(year, month0);
  const firstWeekday = new Date(year, month0, 1).getDay();
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const todayStr = toISODate(now);
  const selectedAgg = selectedDate
    ? byDay.get(parseISODate(selectedDate).getDate())
    : undefined;

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Calendário"
        description="Visualize entradas, saídas e compromissos em cada dia do mês."
        actions={
          <MonthSwitcher
            year={year}
            month0={month0}
            onChange={(y, m) => {
              setYear(y);
              setMonth0(m);
            }}
          />
        }
      />

      {loading ? (
        <CalendarSkeleton />
      ) : (
        <div>
          <p className="mb-2 text-xs text-muted lg:hidden">
            Arraste horizontalmente para visualizar todos os dias.
          </p>
          <div className="card overflow-hidden p-0 shadow-sm">
            <div className="overflow-x-auto overscroll-x-contain">
              <div className="min-w-[700px] lg:min-w-0">
                <div className="grid grid-cols-7 border-b border-border bg-surface">
                  {WEEKDAYS_PT.map((w) => (
                    <div
                      key={w}
                      className="py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-muted"
                    >
                      {w}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {cells.map((day, i) => {
                    if (day === null)
                      return (
                        <div
                          key={i}
                          className="min-h-[96px] border-b border-r border-border bg-surface/60"
                        />
                      );
                    const iso = toISODate(new Date(year, month0, day));
                    const agg = byDay.get(day);
                    const isToday = iso === todayStr;
                    const dayStatus = agg
                      ? dominantStatus(agg.txs.map((t) => t.status))
                      : null;
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setSelectedDate(iso)}
                        aria-label={`${formatDateBR(iso)}${
                          agg ? `, ${agg.txs.length} transação(ões)` : ", sem transações"
                        }`}
                        aria-current={isToday ? "date" : undefined}
                        className={cn(
                          "min-h-[96px] border-b border-r border-border p-2 text-left align-top transition-colors hover:bg-surface focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40",
                          dayStatus && `border-l-[3px] ${TX_STATUS[dayStatus].border}`
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={cn(
                              "inline-flex h-7 min-w-7 items-center justify-center rounded-full px-1 text-xs font-semibold",
                              isToday ? "bg-primary text-white" : "text-foreground"
                            )}
                          >
                            {day}
                          </span>
                          {agg?.daily ? (
                            <span
                              className="h-2 w-2 rounded-full bg-amber-500"
                              title="Tem gasto diário"
                            />
                          ) : null}
                        </div>
                        {agg && (
                          <div className="mt-2 space-y-1">
                            {agg.income > 0 && (
                              <p className="truncate text-[11px] font-semibold tabular-nums text-income">
                                +{formatCurrency(agg.income)}
                              </p>
                            )}
                            {agg.expense > 0 && (
                              <p className="truncate text-[11px] font-semibold tabular-nums text-expense">
                                −{formatCurrency(agg.expense)}
                              </p>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Legenda */}
      <div
        className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border bg-card px-4 py-3 text-xs text-muted"
        aria-label="Legenda do calendário"
      >
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500" /> concluído
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-400" /> pendente
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-red-500" /> atrasado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-500" /> gasto diário
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-primary" /> hoje
        </span>
      </div>

      {/* Modal do dia */}
      <Modal
        open={!!selectedDate}
        onClose={() => setSelectedDate(null)}
        title={selectedDate ? formatDateBR(selectedDate) : ""}
      >
        <div className="space-y-3">
          {selectedAgg && selectedAgg.txs.length > 0 ? (
            <ul className="divide-y divide-border">
              {selectedAgg.txs.map((t) => {
                const cat = categoryById(t.category_id);
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(t);
                        setTxModalOpen(true);
                      }}
                      className="grid w-full grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-2 py-3 text-left transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:flex"
                    >
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                          t.direction === "in"
                            ? "bg-income-bg text-income"
                            : "bg-expense-bg text-expense"
                        }`}
                      >
                        {t.direction === "in" ? (
                          <ArrowUpRight size={16} />
                        ) : (
                          <ArrowDownRight size={16} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {t.description}
                        </p>
                        <p className="text-xs text-muted">
                          {cat ? cat.name : "Sem categoria"}
                          {t.type === "diaria" ? " · diário" : ""}
                        </p>
                      </div>
                      <div className="hidden sm:block">
                        <TransactionStatusBadge status={t.status} />
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span
                          className={`text-sm font-semibold tabular-nums ${
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
          ) : (
            <EmptyState
              icon={CalendarDays}
              title="Nenhuma transação neste dia"
              description="Adicione uma movimentação para acompanhar este dia no calendário."
              className="py-5"
            />
          )}

          <Button
            className="w-full"
            onClick={() => {
              setEditing(null);
              setTxModalOpen(true);
            }}
          >
            <Plus size={18} /> Adicionar neste dia
          </Button>
        </div>
      </Modal>

      <TransactionModal
        open={txModalOpen}
        onClose={() => setTxModalOpen(false)}
        transaction={editing}
        defaultDate={selectedDate ?? undefined}
      />
    </div>
  );
}

function CalendarSkeleton() {
  return (
    <div
      className="card animate-pulse overflow-hidden p-0"
      role="status"
      aria-label="Carregando calendário"
    >
      <div className="overflow-x-auto">
        <div className="min-w-[700px] lg:min-w-0">
          <div className="grid grid-cols-7 border-b border-border bg-surface">
            {Array.from({ length: 7 }, (_, index) => (
              <div key={index} className="p-3">
                <div className="mx-auto h-3 w-8 rounded-full bg-border" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: 35 }, (_, index) => (
              <div key={index} className="min-h-[96px] border-b border-r border-border p-2">
                <div className="h-7 w-7 rounded-full bg-border" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <span className="sr-only">Carregando...</span>
    </div>
  );
}
