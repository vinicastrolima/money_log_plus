"use client";

import { TrendingUp, TrendingDown, Target, Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { DailyBudget } from "@/lib/budget";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function BudgetPanel({ budget }: { budget: DailyBudget }) {
  const envelopePositive = budget.envelope >= 0;
  const dynamicVsTarget = budget.dailyDynamic - budget.target;

  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Wallet size={17} />
        </div>
        <div>
          <h2 className="font-semibold">Orçamento diário</h2>
          <p className="text-xs text-muted">Sua meta e o valor disponível para os próximos dias</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {/* Meta fixa */}
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-sm text-muted">
            <Target size={16} className="shrink-0" />
            <span>Meta fixa por dia</span>
          </div>
          <p className="mt-2 break-words text-2xl font-semibold tabular-nums">
            {formatCurrency(budget.target)}
          </p>
          <p className="mt-1 text-xs text-muted">
            {formatCurrency(budget.target)} × {budget.daysInMonth} dias ={" "}
            {formatCurrency(budget.target * budget.daysInMonth)} no mês
          </p>
        </div>

        {/* Dinamico */}
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-start gap-2 text-sm text-muted">
            {dynamicVsTarget >= 0 ? (
              <TrendingUp size={16} className="mt-0.5 shrink-0" />
            ) : (
              <TrendingDown size={16} className="mt-0.5 shrink-0" />
            )}
            <span>Disponível por dia (saldo ÷ dias restantes)</span>
          </div>
          <p
            className={cn(
              "mt-2 break-words text-2xl font-semibold tabular-nums",
              budget.dailyDynamic >= budget.target
                ? "text-income"
                : "text-expense"
            )}
          >
            {formatCurrency(budget.dailyDynamic)}
          </p>
          <p className="mt-1 text-xs text-muted">
            Saldo {formatCurrency(budget.available)} ÷ {budget.daysRemaining} dias
            restantes
          </p>
        </div>
      </div>

      {/* Envelope com acumulo */}
      <div
        className={cn(
          "mt-3 rounded-xl border p-4",
          envelopePositive
            ? "border-income/30 bg-income-bg"
            : "border-expense/30 bg-expense-bg"
        )}
      >
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <span className="text-sm font-medium">
            {envelopePositive ? "Você tem acumulado para gastar" : "Você estourou o limite"}
          </span>
          <span
            className={cn(
              "break-words text-xl font-bold tabular-nums",
              envelopePositive ? "text-income" : "text-expense"
            )}
          >
            {formatCurrency(budget.envelope)}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted">
          Permitido até hoje ({budget.daysElapsed} {budget.daysElapsed === 1 ? "dia" : "dias"} ×{" "}
          {formatCurrency(budget.target)} = {formatCurrency(budget.allowedSoFar)}) −
          gastos diários {formatCurrency(budget.spentDaily)}. O que não é gasto
          acumula para os próximos dias.
        </p>
      </div>
    </Card>
  );
}
