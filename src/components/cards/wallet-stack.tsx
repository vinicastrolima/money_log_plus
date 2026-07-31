"use client";

import * as React from "react";
import {
  CalendarClock,
  CreditCard as CreditCardIcon,
  Layers3,
  Settings2,
  ShoppingBag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cardClosingDay, creditCardGradient } from "@/lib/cards";
import type { CreditCard } from "@/lib/types";
import { cn, formatCurrency, formatDateBR } from "@/lib/utils";

const CARD_RATIO = 1.586;
const CARD_PEEK = 18;
const MAX_VISIBLE_CARDS = 3;

export interface WalletCardData {
  card: CreditCard;
  openTotal: number;
  /** Parte em aberto que o dono do cartão paga, descontando compras divididas. */
  openOwnTotal?: number;
  nextPaymentTotal: number;
  nextPaymentDate: string | null;
  purchaseCount: number;
  gradientIndex: number;
}

/** Só mostra o segundo total quando alguma compra dividida muda o valor. */
function ownTotalToShow(total: number, ownTotal: number | undefined): number | null {
  if (ownTotal == null) return null;
  return ownTotal < total - 0.005 ? ownTotal : null;
}

interface WalletCardVisualProps {
  data: WalletCardData;
  isFront?: boolean;
  onClick?: () => void;
  className?: string;
}

export function WalletCardVisual({
  data,
  isFront = true,
  onClick,
  className,
}: WalletCardVisualProps) {
  const [start, end] = creditCardGradient(data.card, data.gradientIndex);
  const sharedClassName = cn(
    "relative block aspect-[1.586/1] w-full overflow-hidden rounded-[22px] text-left text-white",
    "border border-white/15 shadow-[0_18px_50px_-24px_rgba(2,6,23,0.85)] transition duration-300",
    onClick &&
      "cursor-pointer touch-manipulation hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-inset active:translate-y-0 active:scale-[0.99]",
    !isFront && "shadow-[0_10px_28px_-20px_rgba(2,6,23,0.7)]",
    className
  );

  const content = (
    <>
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(255,255,255,0.24),transparent_42%)]" />
      <span className="absolute -right-10 -top-14 h-40 w-40 rounded-full border border-white/10 bg-white/10" />
      <span className="absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-black/10" />
      <span className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/25 to-transparent" />

      <span className="relative flex h-full flex-col justify-between p-5 sm:p-6">
        <span className="flex items-start justify-between gap-4">
          <span className="min-w-0">
            <span className="block text-[10px] font-semibold uppercase tracking-[0.22em] text-white/75">
              Money Log
            </span>
            <span className="mt-1 block truncate text-xl font-semibold leading-tight sm:text-2xl">
              {data.card.name}
            </span>
          </span>
          <span className="flex h-9 w-11 shrink-0 items-center justify-center rounded-lg border border-white/25 bg-white/15 shadow-inner">
            <span className="h-4 w-6 rounded border border-white/55 bg-gradient-to-br from-white/35 to-white/10" />
          </span>
        </span>

        <span className="flex items-end justify-between gap-4">
          <span className="min-w-0">
            <span className="block text-[11px] font-medium text-white/75">
              Próxima fatura
            </span>
            <span className="mt-0.5 block truncate text-[1.65rem] font-semibold leading-none tracking-tight tabular-nums sm:text-[1.85rem]">
              {formatCurrency(data.nextPaymentTotal)}
            </span>
            <span className="mt-2 block text-[11px] font-medium text-white/70 sm:text-xs">
              Em aberto {formatCurrency(data.openTotal)}
              <span className="mx-1.5 text-white/40">•</span>
              Vence dia {data.card.due_day}
              <span className="mx-1.5 text-white/40">•</span>
              {data.purchaseCount} compra{data.purchaseCount !== 1 ? "s" : ""}
            </span>
          </span>
          <CreditCardIcon
            aria-hidden="true"
            className="mb-0.5 shrink-0 text-white/75"
            size={25}
            strokeWidth={1.5}
          />
        </span>
      </span>
    </>
  );

  const style = {
    background: `linear-gradient(135deg, ${start} 0%, ${end} 100%)`,
  };

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={sharedClassName}
        style={style}
        aria-label={isFront ? `Gerenciar cartão ${data.card.name}` : `Selecionar cartão ${data.card.name}`}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={sharedClassName} style={style}>
      {content}
    </div>
  );
}

export type ChartScope = "all" | string;

interface WalletDeckProps {
  cards: WalletCardData[];
  chartScope: ChartScope;
  onChartScopeChange: (scope: ChartScope) => void;
  onManageCard: (cardId: string) => void;
  onNewPurchase: (cardId: string) => void;
}

export function WalletDeck({
  cards,
  chartScope,
  onChartScopeChange,
  onManageCard,
  onNewPurchase,
}: WalletDeckProps) {
  const [frontId, setFrontId] = React.useState<string | null>(
    () => cards[0]?.card.id ?? null
  );

  const frontCard =
    cards.find((item) => item.card.id === frontId) ?? cards[0] ?? null;

  const visibleCards = React.useMemo(() => {
    if (!frontCard) return [];
    const behind = cards
      .filter((item) => item.card.id !== frontCard.card.id)
      .slice(0, MAX_VISIBLE_CARDS - 1);
    return [...behind, frontCard];
  }, [cards, frontCard]);

  if (!frontCard) return null;

  const behindCount = visibleCards.length - 1;
  const hiddenCount = Math.max(0, cards.length - visibleCards.length);
  const allOpenTotal = cards.reduce((sum, item) => sum + item.openTotal, 0);
  const allOpenOwnTotal = cards.reduce(
    (sum, item) => sum + (item.openOwnTotal ?? item.openTotal),
    0
  );
  const allNextPaymentTotal = cards.reduce(
    (sum, item) => sum + item.nextPaymentTotal,
    0
  );
  const frontCardOwnTotal = ownTotalToShow(frontCard.openTotal, frontCard.openOwnTotal);
  const allOwnTotal = ownTotalToShow(allOpenTotal, allOpenOwnTotal);

  function selectCard(cardId: string) {
    setFrontId(cardId);
    onChartScopeChange(cardId);
  }

  return (
    <section className="space-y-4" aria-label="Carteira de cartões">
      <div className="relative isolate overflow-hidden rounded-[24px] bg-[#101828] p-4 text-white shadow-[0_24px_70px_-42px_rgba(15,23,42,0.85)] sm:p-6 lg:p-8">
        <div className="pointer-events-none absolute -right-32 -top-40 -z-10 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-48 left-1/4 -z-10 h-96 w-96 rounded-full bg-violet-500/10 blur-3xl" />

        <div className="grid items-center gap-6 lg:grid-cols-[minmax(320px,440px)_minmax(0,1fr)] lg:gap-10 xl:gap-14">
          <div className="min-w-0">
            <div
              className="relative mx-auto w-full max-w-[420px]"
              style={{ paddingTop: behindCount * CARD_PEEK }}
            >
              <div
                aria-hidden="true"
                className="w-full"
                style={{ aspectRatio: String(CARD_RATIO) }}
              />
              {visibleCards.map((item, index) => {
                const isFront = index === visibleCards.length - 1;
                return (
                  <div
                    key={item.card.id}
                    className="absolute inset-x-0 transition-[top,transform,opacity] duration-300 ease-out"
                    style={{
                      top: index * CARD_PEEK,
                      zIndex: index + 1,
                      opacity: isFront ? 1 : 0.82 + index * 0.06,
                      transform: isFront ? "scale(1)" : `scale(${0.97 + index * 0.01})`,
                      transformOrigin: "top center",
                    }}
                  >
                    <WalletCardVisual
                      data={item}
                      isFront={isFront}
                      onClick={() =>
                        isFront
                          ? onManageCard(item.card.id)
                          : selectCard(item.card.id)
                      }
                    />
                  </div>
                );
              })}
              {hiddenCount > 0 && (
                <span className="absolute right-3 top-1 z-20 rounded-full border border-white/15 bg-slate-950/75 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur">
                  +{hiddenCount}
                </span>
              )}
            </div>

            <div className="mt-5 flex gap-2 lg:hidden">
              <Button
                variant="outline"
                className="h-11 flex-1 border-white/20 bg-white/10 text-white hover:bg-white/15 hover:text-white"
                onClick={() => onManageCard(frontCard.card.id)}
              >
                <Settings2 size={16} />
                Gerenciar
              </Button>
              <Button
                className="h-11 flex-1 bg-white text-slate-950 hover:bg-white/90"
                onClick={() => onNewPurchase(frontCard.card.id)}
              >
                <ShoppingBag size={16} />
                Nova compra
              </Button>
            </div>
          </div>

          <div className="hidden min-w-0 flex-col justify-center lg:flex">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Cartão em foco
            </p>
            <h2 className="mt-2 truncate text-2xl font-semibold tracking-tight xl:text-3xl">
              {frontCard.card.name}
            </h2>
            <p className="mt-6 text-sm text-slate-400">Próxima fatura</p>
            <p className="mt-1 text-4xl font-semibold tracking-[-0.04em] tabular-nums xl:text-5xl">
              {formatCurrency(frontCard.nextPaymentTotal)}
            </p>
            <p className="mt-2 text-sm text-slate-400">
              Em aberto{" "}
              <span className="font-medium text-slate-200 tabular-nums">
                {formatCurrency(frontCard.openTotal)}
              </span>
              {frontCard.nextPaymentDate ? (
                <> · vence {formatDateBR(frontCard.nextPaymentDate)}</>
              ) : null}
            </p>
            {frontCardOwnTotal !== null ? (
              <p className="mt-1 text-sm text-slate-400">
                Sua parte{" "}
                <span className="font-medium text-slate-200 tabular-nums">
                  {formatCurrency(frontCardOwnTotal)}
                </span>
              </p>
            ) : null}

            <div className="mt-7 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                <CalendarClock className="text-slate-400" size={18} />
                <p className="mt-3 text-xs text-slate-400">Fechamento / vencimento</p>
                <p className="mt-0.5 font-semibold">
                  Dia {cardClosingDay(frontCard.card)} / {frontCard.card.due_day}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                <Layers3 className="text-slate-400" size={18} />
                <p className="mt-3 text-xs text-slate-400">Compras registradas</p>
                <p className="mt-0.5 font-semibold tabular-nums">
                  {frontCard.purchaseCount}
                </p>
              </div>
            </div>

            <div className="mt-5 flex gap-3">
              <Button
                variant="outline"
                className="h-11 flex-1 border-white/20 bg-white/10 text-white hover:bg-white/15 hover:text-white"
                onClick={() => onManageCard(frontCard.card.id)}
              >
                <Settings2 size={16} />
                Gerenciar
              </Button>
              <Button
                className="h-11 flex-1 bg-white text-slate-950 hover:bg-white/90"
                onClick={() => onNewPurchase(frontCard.card.id)}
              >
                <ShoppingBag size={16} />
                Nova compra
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-5 border-t border-white/10 pt-4 lg:mt-7">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium text-slate-400">Selecionar cartão</p>
            <p className="hidden text-xs text-slate-400 sm:block">
              {cards.length} {cards.length === 1 ? "cartão" : "cartões"}
            </p>
          </div>
          <div className="scrollbar-none -mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1">
            {cards.map((item) => {
              const active = item.card.id === frontCard.card.id;
              const [color] = creditCardGradient(item.card, item.gradientIndex);
              return (
                <button
                  key={item.card.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => selectCard(item.card.id)}
                  className={cn(
                    "inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
                    active
                      ? "border-white/30 bg-white text-slate-950"
                      : "border-white/10 bg-white/[0.06] text-slate-300 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <span
                    className="h-2 w-2 rounded-full ring-1 ring-white/20"
                    style={{ backgroundColor: color }}
                  />
                  {item.card.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Analisar faturas</p>
          <p className="text-xs text-muted">
            {formatCurrency(allNextPaymentTotal)} na próxima fatura ·{" "}
            {formatCurrency(allOpenTotal)} em aberto
            {allOwnTotal !== null ? (
              <>
                {" "}
                · <span className="font-medium text-primary">
                  sua parte {formatCurrency(allOwnTotal)}
                </span>
              </>
            ) : null}
          </p>
        </div>
        <div
          className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:px-0"
          role="tablist"
          aria-label="Escopo da análise"
        >
          <ScopeChip
            label="Todos"
            active={chartScope === "all"}
            onClick={() => onChartScopeChange("all")}
          />
          {cards.map((item) => (
            <ScopeChip
              key={item.card.id}
              label={item.card.name}
              active={chartScope === item.card.id}
              color={creditCardGradient(item.card, item.gradientIndex)[0]}
              onClick={() => selectCard(item.card.id)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function ScopeChip({
  label,
  active,
  color,
  onClick,
}: {
  label: string;
  active: boolean;
  color?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
        active
          ? "border-primary bg-primary text-white shadow-sm"
          : "border-border bg-card text-foreground hover:border-border-strong hover:bg-surface"
      )}
    >
      {color && (
        <span
          className={cn("h-2 w-2 rounded-full", active && "ring-2 ring-white/35")}
          style={{ backgroundColor: color }}
        />
      )}
      {label}
    </button>
  );
}
