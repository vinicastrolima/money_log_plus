"use client";

import * as React from "react";
import { CalendarRange, Layers3, ReceiptText, ShoppingBag } from "lucide-react";
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
  type TooltipContentProps,
  type TooltipValueType,
} from "recharts";
import { MonthSwitcher } from "@/components/month-switcher";
import { Card } from "@/components/ui/card";
import type { CardPurchase, Category, CreditCard } from "@/lib/types";
import {
  ALL_CARDS_CHART_COLOR,
  cardChartColor,
  cardPaymentStatsInMonth,
  paymentsByMonthRange,
  spendingByCategoryInMonth,
} from "@/lib/cards";
import { formatCurrency, MONTH_NAMES_PT } from "@/lib/utils";

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

interface MetricProps {
  label: string;
  value: string;
  detail: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const compactNumber = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function formatAxisCurrency(value: number): string {
  return `R$ ${compactNumber.format(value)}`;
}

function Metric({ label, value, detail, icon: Icon }: MetricProps) {
  return (
    <Card className="min-w-0 p-3.5 shadow-none sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-muted">{label}</p>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon size={16} aria-hidden="true" />
        </span>
      </div>
      <p className="mt-2 truncate text-lg font-semibold tracking-tight sm:text-xl">
        {value}
      </p>
      <p className="mt-1 truncate text-[11px] text-muted sm:text-xs">{detail}</p>
    </Card>
  );
}

function CurrencyTooltip({
  active,
  label,
  payload,
}: TooltipContentProps<TooltipValueType, string | number>) {
  const items = payload.filter((entry) => Number(entry.value ?? 0) > 0);
  if (!active || items.length === 0) return null;

  return (
    <div className="max-w-[min(18rem,calc(100vw-2rem))] rounded-xl border border-border bg-white/95 p-3 text-xs shadow-lg backdrop-blur">
      {label !== undefined && label !== null && (
        <p className="mb-2 font-semibold text-foreground">{String(label)}</p>
      )}
      <ul className="space-y-1.5">
        {items.map((entry, index) => (
          <li
            key={`${String(entry.dataKey)}-${index}`}
            className="flex items-center justify-between gap-4"
          >
            <span className="flex min-w-0 items-center gap-2 text-muted">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: entry.color ?? entry.fill ?? "var(--muted)" }}
                aria-hidden="true"
              />
              <span className="truncate">{String(entry.name ?? "Fatura")}</span>
            </span>
            <span className="shrink-0 font-semibold text-foreground">
              {formatCurrency(Number(entry.value ?? 0))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
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

  const monthStats = React.useMemo(
    () =>
      cardPaymentStatsInMonth(
        cardPurchases,
        creditCards,
        year,
        month0,
        filterCardId
      ),
    [cardPurchases, creditCards, year, month0, filterCardId]
  );

  const series = React.useMemo(
    () =>
      creditCards
        .filter((card) => !filterCardId || card.id === filterCardId)
        .map((card) => ({
          id: card.id,
          name: card.name,
          color: cardChartColor(
            creditCards.findIndex((candidate) => candidate.id === card.id)
          ),
        })),
    [creditCards, filterCardId]
  );

  const scopedPurchases = React.useMemo(
    () =>
      cardPurchases.filter(
        (purchase) => !filterCardId || purchase.credit_card_id === filterCardId
      ),
    [cardPurchases, filterCardId]
  );

  const totalCategory = byCategory.reduce((sum, item) => sum + item.total, 0);
  const totalMonthly = monthly.reduce((sum, item) => sum + item.total, 0);
  const monthlyAverage = monthly.length > 0 ? totalMonthly / monthly.length : 0;
  const topCategory = byCategory[0] ?? null;
  const showStacked = !filterCardId && creditCards.length > 1;

  const barData = React.useMemo(() => {
    if (!showStacked) {
      return monthly.map((item) => ({ name: item.label, total: item.total }));
    }

    return monthly.map((item) => {
      const row: Record<string, string | number> = { name: item.label };
      for (const card of item.byCard) row[card.cardId] = card.amount;
      return row;
    });
  }, [monthly, showStacked]);

  const selectedMonthLabel = `${MONTH_NAMES_PT[month0]} de ${year}`;
  const periodEnd = new Date(year, month0 + Math.max(monthly.length - 1, 0), 1);
  const periodLabel = `${MONTH_NAMES_PT[month0].slice(0, 3)} ${year} – ${MONTH_NAMES_PT[
    periodEnd.getMonth()
  ].slice(0, 3)} ${periodEnd.getFullYear()}`;
  const singleSeriesColor = filterCardId
    ? series[0]?.color ?? ALL_CARDS_CHART_COLOR
    : ALL_CARDS_CHART_COLOR;
  const noPaymentsInRange = totalCategory === 0 && totalMonthly === 0;

  return (
    <section className="space-y-4" aria-labelledby="card-analysis-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
            Visão financeira
          </p>
          <h2 id="card-analysis-title" className="mt-1 truncate text-lg font-semibold sm:text-xl">
            {filterLabel}
          </h2>
          <p className="mt-0.5 text-xs text-muted sm:text-sm">
            Parcelas por vencimento e categoria
          </p>
        </div>
        <div className="self-stretch sm:self-auto">
          <MonthSwitcher year={year} month0={month0} onChange={onMonthChange} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-3">
        <Metric
          label="Fatura do mês"
          value={formatCurrency(monthStats.total)}
          detail={selectedMonthLabel}
          icon={ReceiptText}
        />
        <Metric
          label="Compras na fatura"
          value={String(monthStats.purchaseCount)}
          detail={`${monthStats.installmentCount} parcela${
            monthStats.installmentCount === 1 ? "" : "s"
          } no período`}
          icon={ShoppingBag}
        />
        <Metric
          label="Próximos 6 meses"
          value={formatCurrency(totalMonthly)}
          detail={`Média de ${formatCurrency(monthlyAverage)}`}
          icon={CalendarRange}
        />
        <Metric
          label="Maior categoria"
          value={topCategory ? formatCurrency(topCategory.total) : "—"}
          detail={topCategory?.name ?? "Sem gastos no mês"}
          icon={Layers3}
        />
      </div>

      {noPaymentsInRange ? (
        <Card className="border-dashed bg-card/70 px-5 py-9 text-center shadow-none sm:py-11">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-muted">
            <ReceiptText size={21} aria-hidden="true" />
          </span>
          <h3 className="mt-3 text-sm font-semibold text-foreground">
            {scopedPurchases.length === 0
              ? filterCardId
                ? `${filterLabel} ainda não tem compras`
                : "Seus cartões ainda não têm compras"
              : "Nenhuma parcela vence neste intervalo"}
          </h3>
          <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-muted sm:text-sm">
            {scopedPurchases.length === 0
              ? "Registre uma compra no cartão para acompanhar as próximas faturas e a distribuição por categoria."
              : `Há compras registradas, mas nenhuma fatura entre ${periodLabel}. Navegue para outro mês para consultar períodos anteriores.`}
          </p>
        </Card>
      ) : (
        <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(18rem,0.82fr)_minmax(0,1.18fr)]">
          <Card className="min-w-0 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">Por categoria</h3>
                <p className="mt-0.5 text-xs text-muted">Vencimentos em {selectedMonthLabel}</p>
              </div>
              {totalCategory > 0 && (
                <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-muted">
                  {byCategory.length} categoria{byCategory.length === 1 ? "" : "s"}
                </span>
              )}
            </div>

            {totalCategory === 0 ? (
              <div className="flex min-h-56 flex-col items-center justify-center px-4 text-center">
                <ReceiptText size={22} className="text-muted" aria-hidden="true" />
                <p className="mt-2 text-sm font-medium">Sem vencimentos neste mês</p>
                <p className="mt-1 text-xs text-muted">Escolha outro período para ver as categorias.</p>
              </div>
            ) : (
              <>
                <div className="relative mx-auto mt-2 h-52 w-full max-w-sm sm:h-56">
                  <ResponsiveContainer width="100%" height="100%" debounce={50}>
                    <PieChart accessibilityLayer>
                      <Pie
                        data={byCategory}
                        dataKey="total"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius="82%"
                        innerRadius="59%"
                        paddingAngle={2}
                        cornerRadius={3}
                        isAnimationActive={false}
                      >
                        {byCategory.map((category) => (
                          <Cell key={category.id} fill={category.color} stroke="transparent" />
                        ))}
                      </Pie>
                      <Tooltip
                        content={CurrencyTooltip}
                        cursor={false}
                        allowEscapeViewBox={{ x: false, y: true }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-muted">
                      Total
                    </span>
                    <span className="mt-0.5 text-sm font-semibold sm:text-base">
                      {formatCurrency(totalCategory)}
                    </span>
                  </div>
                </div>

                <ul className="mt-2 divide-y divide-border/70">
                  {byCategory.map((category) => (
                    <li
                      key={category.id}
                      className="flex items-center justify-between gap-3 py-2.5 text-sm"
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ background: category.color }}
                          aria-hidden="true"
                        />
                        <span className="truncate">{category.name}</span>
                      </span>
                      <span className="shrink-0 text-right font-medium">
                        {formatCurrency(category.total)}
                        <span className="ml-1 text-[11px] font-normal text-muted">
                          {Math.round((category.total / totalCategory) * 100)}%
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>

          <Card className="min-w-0 p-4 sm:p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="font-semibold">Evolução das faturas</h3>
                <p className="mt-0.5 text-xs text-muted">{periodLabel}</p>
              </div>
              <span className="w-fit rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
                {formatCurrency(totalMonthly)} no período
              </span>
            </div>

            {showStacked && (
              <div className="mt-4 flex flex-wrap gap-x-3 gap-y-2" aria-label="Legenda dos cartões">
                {series.map((card) => (
                  <span key={card.id} className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: card.color }}
                      aria-hidden="true"
                    />
                    <span className="max-w-28 truncate">{card.name}</span>
                  </span>
                ))}
              </div>
            )}

            <div className="mt-3 h-64 min-w-0 sm:h-72">
              <ResponsiveContainer width="100%" height="100%" debounce={50}>
                <BarChart
                  accessibilityLayer
                  data={barData}
                  margin={{ top: 8, right: 4, bottom: 0, left: -8 }}
                  barCategoryGap="24%"
                >
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "var(--muted)", fontSize: 11 }}
                    dy={8}
                    interval={0}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "var(--muted)", fontSize: 10 }}
                    tickFormatter={formatAxisCurrency}
                    width={54}
                  />
                  <Tooltip
                    content={CurrencyTooltip}
                    cursor={{ fill: "var(--background)", radius: 8 }}
                    allowEscapeViewBox={{ x: false, y: true }}
                  />
                  {showStacked ? (
                    series.map((card, index) => (
                      <Bar
                        key={card.id}
                        dataKey={card.id}
                        name={card.name}
                        stackId="cards"
                        fill={card.color}
                        maxBarSize={42}
                        radius={index === series.length - 1 ? [5, 5, 0, 0] : 0}
                        isAnimationActive={false}
                      />
                    ))
                  ) : (
                    <Bar
                      dataKey="total"
                      name="Fatura"
                      fill={singleSeriesColor}
                      maxBarSize={48}
                      radius={[6, 6, 0, 0]}
                      isAnimationActive={false}
                    />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}
    </section>
  );
}
