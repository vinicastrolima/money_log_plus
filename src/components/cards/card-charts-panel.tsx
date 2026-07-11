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
import { MonthSwitcher } from "@/components/month-switcher";
import { Card } from "@/components/ui/card";
import type { CardPurchase, Category, CreditCard } from "@/lib/types";
import {
  paymentsByMonthRange,
  spendingByCategoryInMonth,
} from "@/lib/cards";
import { formatCurrency } from "@/lib/utils";

interface Props {
  creditCards: CreditCard[];
  cardPurchases: CardPurchase[];
  categories: Category[];
  /** null = todos os cartões */
  filterCardId: string | null;
  filterLabel: string;
  year: number;
  month0: number;
  onMonthChange: (year: number, month0: number) => void;
}

export function CardChartsPanel({
  creditCards,
  cardPurchases,
  categories,
  filterCardId,
  filterLabel,
  year,
  month0,
  onMonthChange,
}: Props) {
  const byCategory = React.useMemo(
    () =>
      spendingByCategoryInMonth(
        cardPurchases,
        creditCards,
        categories,
        year,
        month0,
        filterCardId
      ),
    [cardPurchases, creditCards, categories, year, month0, filterCardId]
  );

  const monthly = React.useMemo(
    () =>
      paymentsByMonthRange(
        cardPurchases,
        creditCards,
        year,
        month0,
        6,
        filterCardId
      ),
    [cardPurchases, creditCards, year, month0, filterCardId]
  );

  const totalCategory = byCategory.reduce((s, c) => s + c.total, 0);
  const totalMonthly = monthly.reduce((s, m) => s + m.total, 0);
  const showStacked = !filterCardId && creditCards.length > 1;

  const barData = React.useMemo(() => {
    if (!showStacked) {
      return monthly.map((m) => ({ name: m.label, Fatura: m.total }));
    }
    return monthly.map((m) => {
      const row: Record<string, string | number> = { name: m.label };
      for (const c of m.byCard) row[c.name] = c.amount;
      return row;
    });
  }, [monthly, showStacked]);

  const cardNames = creditCards.map((c) => c.name);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Análise · {filterLabel}</h2>
          <p className="text-sm text-muted">Faturas e gastos por categoria</p>
        </div>
        <MonthSwitcher year={year} month0={month0} onChange={onMonthChange} />
      </div>

      {totalCategory === 0 && totalMonthly === 0 ? (
        <Card className="p-8 text-center text-sm text-muted">
          Sem faturas neste período para este cartão.
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="p-4">
            <h3 className="mb-1 font-semibold">Fatura por categoria</h3>
            <p className="mb-3 text-xs text-muted">Parcelas que vencem no mês selecionado</p>
            {totalCategory === 0 ? (
              <p className="py-12 text-center text-sm text-muted">Sem dados no mês.</p>
            ) : (
              <>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={byCategory}
                        dataKey="total"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        innerRadius={48}
                        paddingAngle={2}
                      >
                        {byCategory.map((c, i) => (
                          <Cell key={i} fill={c.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="mt-2 space-y-1.5">
                  {byCategory.map((c) => (
                    <li key={c.id} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ background: c.color }}
                        />
                        {c.name}
                      </span>
                      <span className="font-medium">
                        {formatCurrency(c.total)}
                        <span className="ml-1 text-muted">
                          ({Math.round((c.total / totalCategory) * 100)}%)
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>

          <Card className="p-4">
            <h3 className="mb-1 font-semibold">Próximas faturas</h3>
            <p className="mb-3 text-xs text-muted">6 meses a partir do mês selecionado</p>
            {totalMonthly === 0 ? (
              <p className="py-12 text-center text-sm text-muted">Sem faturas futuras.</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" fontSize={11} />
                    <YAxis fontSize={10} tickFormatter={(v) => `R$${v}`} width={52} />
                    <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                    {showStacked ? (
                      <>
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        {cardNames.map((name, i) => {
                          const colors = [
                            "#7c3aed",
                            "#f97316",
                            "#0ea5e9",
                            "#16a34a",
                            "#ec4899",
                            "#6366f1",
                          ];
                          return (
                            <Bar
                              key={name}
                              dataKey={name}
                              stackId="a"
                              fill={colors[i % colors.length]}
                              radius={i === cardNames.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                            />
                          );
                        })}
                      </>
                    ) : (
                      <Bar dataKey="Fatura" fill="#6366f1" radius={[6, 6, 0, 0]} />
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
