"use client";

import * as React from "react";
import { Plus, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useData } from "@/components/data-provider";
import { MonthSwitcher } from "@/components/month-switcher";
import { TransactionModal } from "@/components/transaction-modal";
import { TransactionStatusBadge } from "@/components/transaction-status-badge";
import { dominantStatus, TX_STATUS } from "@/lib/transaction-status";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Calendário</h1>
          <p className="text-sm text-muted">Clique em um dia para ver ou adicionar</p>
        </div>
        <MonthSwitcher
          year={year}
          month0={month0}
          onChange={(y, m) => {
            setYear(y);
            setMonth0(m);
          }}
        />
      </div>

      {loading ? (
        <p className="text-sm text-muted">Carregando...</p>
      ) : (
        <div className="card overflow-hidden p-0 shadow-sm">
          <div className="grid grid-cols-7 border-b border-border bg-slate-50">
            {WEEKDAYS_PT.map((w) => (
              <div
                key={w}
                className="py-2 text-center text-xs font-semibold text-muted"
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
                    className="min-h-[84px] border-b border-r border-border bg-slate-50/40"
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
                  onClick={() => setSelectedDate(iso)}
                  className={cn(
                    "min-h-[84px] border-b border-r border-border p-1.5 text-left align-top transition-colors hover:bg-slate-50 cursor-pointer",
                    dayStatus && `border-l-[3px] ${TX_STATUS[dayStatus].border}`
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-medium ${
                        isToday ? "bg-primary text-white" : "text-slate-700"
                      }`}
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
                    <div className="mt-1 space-y-0.5">
                      {agg.income > 0 && (
                        <p className="truncate text-[11px] font-medium text-income">
                          +{formatCurrency(agg.income)}
                        </p>
                      )}
                      {agg.expense > 0 && (
                        <p className="truncate text-[11px] font-medium text-expense">
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
      )}

      {/* Legenda */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted">
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
                      onClick={() => {
                        setEditing(t);
                        setTxModalOpen(true);
                      }}
                      className="flex w-full items-center gap-3 py-3 text-left hover:bg-slate-50 cursor-pointer"
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
                      <TransactionStatusBadge status={t.status} />
                      <span
                        className={`text-sm font-semibold ${
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
          ) : (
            <p className="py-6 text-center text-sm text-muted">
              Nenhuma transação neste dia.
            </p>
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
