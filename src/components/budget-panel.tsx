"use client";

import { TrendingUp, TrendingDown, Target, Wallet } from "lucide-react";
import type { DailyBudget } from "@/lib/budget";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function BudgetPanel({ budget }: { budget: DailyBudget }) {
  const envelopePositive = budget.envelope >= 0;
  const dynamicVsTarget = budget.dailyDynamic - budget.target;

  return (
    <div className="card p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Wallet size={16} />
        </div>
        <h3 className="font-semibold">Orçamento diário</h3>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Meta fixa */}
        <div className="rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 text-sm text-muted">
            <Target size={15} /> Meta fixa por dia
          </div>
          <p className="mt-1 text-2xl font-semibold">
            {formatCurrency(budget.target)}
          </p>
          <p className="mt-1 text-xs text-muted">
            {formatCurrency(budget.target)} × {budget.daysInMonth} dias ={" "}
            {formatCurrency(budget.target * budget.daysInMonth)} no mês
          </p>
        </div>

        {/* Dinamico */}
        <div className="rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 text-sm text-muted">
            {dynamicVsTarget >= 0 ? (
              <TrendingUp size={15} />
            ) : (
              <TrendingDown size={15} />
            )}
            Disponível por dia (saldo ÷ dias restantes)
          </div>
          <p
            className={cn(
              "mt-1 text-2xl font-semibold",
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
          "mt-3 rounded-lg border p-4",
          envelopePositive
            ? "border-income/30 bg-income-bg"
            : "border-expense/30 bg-expense-bg"
        )}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">
            {envelopePositive ? "Você tem acumulado para gastar" : "Você estourou o limite"}
          </span>
          <span
            className={cn(
              "text-lg font-bold",
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
    </div>
  );
}
