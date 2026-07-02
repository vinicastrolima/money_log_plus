"use client";

import * as React from "react";
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
import { filterByMonth } from "@/lib/budget";
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

  // Gastos por categoria (apenas saidas)
  const byCategory = React.useMemo(() => {
    const map = new Map<string, { name: string; color: string; total: number }>();
    for (const t of monthTxs) {
      if (t.direction !== "out") continue;
      const cat = categories.find((c) => c.id === t.category_id);
      const key = cat?.id ?? "none";
      const name = cat?.name ?? "Sem categoria";
      const color = cat?.color ?? "#94a3b8";
      const cur = map.get(key) ?? { name, color, total: 0 };
      cur.total += t.amount;
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [monthTxs, categories]);

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

  // Prevista x diaria (saidas)
  const prevVsDaily = React.useMemo(() => {
    let prevista = 0;
    let diaria = 0;
    for (const t of monthTxs) {
      if (t.direction !== "out") continue;
      if (t.type === "diaria") diaria += t.amount;
      else prevista += t.amount;
    }
    return [
      { name: "Prevista", valor: prevista, color: "#6366f1" },
      { name: "Diária", valor: diaria, color: "#f59e0b" },
    ];
  }, [monthTxs]);

  const totalExpense = byCategory.reduce((s, c) => s + c.total, 0);
  const hasExpenses = totalExpense > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Gráficos</h1>
          <p className="text-sm text-muted">Para onde está indo seu dinheiro</p>
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
      ) : !hasExpenses ? (
        <Card>
          <p className="py-8 text-center text-sm text-muted">
            Sem saídas neste mês para gerar gráficos.
          </p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Pizza por categoria */}
            <Card>
              <h3 className="mb-3 font-semibold">Gastos por categoria</h3>
              <div className="h-72">
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
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-2 space-y-1.5">
                {byCategory.map((c, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ background: c.color }}
                      />
                      {c.name}
                    </span>
                    <span className="font-medium">
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
            <Card>
              <h3 className="mb-3 font-semibold">Prevista x Diária</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={prevVsDaily}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" fontSize={12} />
                    <YAxis
                      fontSize={11}
                      tickFormatter={(v) => `R$${v}`}
                      width={60}
                    />
                    <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                    <Bar dataKey="valor" radius={[6, 6, 0, 0]}>
                      {prevVsDaily.map((d, i) => (
                        <Cell key={i} fill={d.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-xs text-muted">
                Gastos &quot;previstos&quot; (contas fixas) vs &quot;diários&quot; (dia a dia).
              </p>
            </Card>
          </div>

          {/* Barras por dia */}
          <Card>
            <h3 className="mb-3 font-semibold">Movimentação por dia</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byDay}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="dia" fontSize={11} interval={2} />
                  <YAxis fontSize={11} tickFormatter={(v) => `R$${v}`} width={60} />
                  <Tooltip
                    formatter={(v) => formatCurrency(Number(v))}
                    labelFormatter={(l) => `Dia ${l}`}
                  />
                  <Legend />
                  <Bar dataKey="Entradas" fill="#16a34a" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Saídas" fill="#dc2626" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
