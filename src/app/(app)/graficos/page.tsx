"use client";

import * as React from "react";
import { ChartNoAxesColumn } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import { useData } from "@/components/data-provider";
import { MonthSwitcher } from "@/components/month-switcher";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { filterByMonth, getExpenseByCategory, getExpenseTransactions } from "@/lib/budget";
import { daysInMonth, formatCurrency, parseISODate } from "@/lib/utils";

export default function ChartsPage() {
  const { loading, transactions, categories } = useData();
  const now = new Date();
  const [year, setYear] = React.useState(now.getFullYear());
  const [month0, setMonth0] = React.useState(now.getMonth());

  const monthTxs = React.useMemo(
    () => filterByMonth(transactions, year, month0),
    [transactions, year, month0]
  );

  const expenseTxs = React.useMemo(
    () => getExpenseTransactions(monthTxs),
    [monthTxs]
  );

  const byCategory = React.useMemo(
    () => getExpenseByCategory(monthTxs, categories),
    [monthTxs, categories]
  );

  // Gastos por dia (saidas)
  const byDay = React.useMemo(() => {
    const total = daysInMonth(year, month0);
    const arr = Array.from({ length: total }, (_, i) => ({
      dia: i + 1,
      Saídas: 0,
      Entradas: 0,
    }));
    for (const t of monthTxs) {
      const d = parseISODate(t.date).getDate();
      if (t.direction === "out") arr[d - 1].Saídas += t.amount;
      else arr[d - 1].Entradas += t.amount;
    }
    return arr;
  }, [monthTxs, year, month0]);

  // Prevista x diaria (apenas saidas)
  const prevVsDaily = React.useMemo(() => {
    let prevista = 0;
    let diaria = 0;
    for (const t of expenseTxs) {
      if (t.type === "diaria") diaria += t.amount;
      else prevista += t.amount;
    }
    return [
      { name: "Prevista", valor: prevista, color: "#6366f1" },
      { name: "Diária", valor: diaria, color: "#f59e0b" },
    ];
  }, [expenseTxs]);

  const totalExpense = byCategory.reduce((s, c) => s + c.total, 0);
  const hasExpenses = totalExpense > 0;

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Gráficos"
        description="Entenda a distribuição e a evolução das suas movimentações."
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
        <ChartsSkeleton />
      ) : !hasExpenses ? (
        <Card className="p-0">
          <EmptyState
            icon={ChartNoAxesColumn}
            title="Ainda não há dados para analisar"
            description="Registre saídas neste mês para visualizar categorias e tendências."
            className="border-0 py-12 shadow-none"
          />
        </Card>
      ) : (
        <>
          <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Pizza por categoria */}
            <Card className="min-w-0 p-4 sm:p-5">
              <div className="mb-3">
                <h2 className="font-semibold">Gastos por categoria</h2>
                <p className="text-xs text-muted">Participação de cada categoria nas saídas</p>
              </div>
              <div className="h-60 min-w-0 sm:h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={byCategory}
                      dataKey="total"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      innerRadius={50}
                      paddingAngle={2}
                    >
                      {byCategory.map((c, i) => (
                        <Cell key={i} fill={c.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v) => formatCurrency(Number(v))}
                      contentStyle={TOOLTIP_STYLE}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-2 space-y-2">
                {byCategory.map((c, i) => (
                  <li
                    key={i}
                    className="flex min-w-0 items-center justify-between gap-3 text-sm"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: c.color }}
                      />
                      <span className="truncate">{c.name}</span>
                    </span>
                    <span className="shrink-0 font-medium tabular-nums">
                      {formatCurrency(c.total)}{" "}
                      <span className="text-muted">
                        ({Math.round((c.total / totalExpense) * 100)}%)
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>

            {/* Prevista x diaria */}
            <Card className="min-w-0 p-4 sm:p-5">
              <div className="mb-3">
                <h2 className="font-semibold">Prevista x diária</h2>
                <p className="text-xs text-muted">Contas planejadas comparadas aos gastos do dia a dia</p>
              </div>
              <div className="h-60 min-w-0 sm:h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={prevVsDaily} margin={{ left: 0, right: 8 }}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" fontSize={12} />
                    <YAxis
                      fontSize={11}
                      tickFormatter={formatAxisCurrency}
                      width={52}
                    />
                    <Tooltip
                      formatter={(v) => formatCurrency(Number(v))}
                      contentStyle={TOOLTIP_STYLE}
                    />
                    <Bar dataKey="valor" radius={[6, 6, 0, 0]}>
                      {prevVsDaily.map((d, i) => (
                        <Cell key={i} fill={d.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {/* Barras por dia */}
          <Card className="min-w-0 p-4 sm:p-5">
            <div className="mb-3">
              <h2 className="font-semibold">Movimentação por dia</h2>
              <p className="text-xs text-muted">Entradas e saídas ao longo do mês</p>
              <p className="mt-1 text-xs text-muted lg:hidden">
                Arraste horizontalmente para visualizar todos os dias.
              </p>
            </div>
            <div className="overflow-x-auto overscroll-x-contain">
              <div className="h-72 min-w-[680px] lg:min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byDay} margin={{ left: 0, right: 8 }}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="dia" fontSize={11} interval={2} />
                    <YAxis fontSize={11} tickFormatter={formatAxisCurrency} width={52} />
                    <Tooltip
                      formatter={(v) => formatCurrency(Number(v))}
                      labelFormatter={(l) => `Dia ${l}`}
                      contentStyle={TOOLTIP_STYLE}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Entradas" fill="#16a34a" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Saídas" fill="#dc2626" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

const TOOLTIP_STYLE: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  boxShadow: "0 8px 24px rgb(15 23 42 / 0.12)",
  fontSize: 12,
};

function formatAxisCurrency(value: number) {
  if (Math.abs(value) >= 1000) return `R$${Math.round(value / 1000)}k`;
  return `R$${Math.round(value)}`;
}

function ChartsSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Carregando gráficos">
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }, (_, index) => (
          <div key={index} className="card animate-pulse p-5">
            <div className="h-5 w-40 rounded-full bg-border" />
            <div className="mt-2 h-3 w-56 max-w-full rounded-full bg-border" />
            <div className="mt-5 h-60 rounded-xl bg-border sm:h-72" />
          </div>
        ))}
      </div>
      <div className="card animate-pulse p-5">
        <div className="h-5 w-44 rounded-full bg-border" />
        <div className="mt-5 h-72 rounded-xl bg-border" />
      </div>
      <span className="sr-only">Carregando...</span>
    </div>
  );
}
