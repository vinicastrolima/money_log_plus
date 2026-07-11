"use client";

import * as React from "react";
import { CreditCard as CreditCardIcon } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { CreditCard } from "@/lib/types";
import { ALL_CARDS_GRADIENT, cardGradient } from "@/lib/cards";

export type WalletSlide =
  | { type: "all"; openTotal: number; cardCount: number }
  | { type: "card"; card: CreditCard; openTotal: number; purchaseCount: number; gradientIndex: number };

interface WalletCardVisualProps {
  slide: WalletSlide;
  active?: boolean;
  onClick?: () => void;
  compact?: boolean;
}

export function WalletCardVisual({
  slide,
  active,
  onClick,
  compact,
}: WalletCardVisualProps) {
  const gradient =
    slide.type === "all"
      ? ALL_CARDS_GRADIENT
      : cardGradient(slide.gradientIndex);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative w-full overflow-hidden rounded-2xl text-left text-white shadow-xl transition-all duration-300 cursor-pointer",
        compact ? "aspect-[1.7/1] max-h-36" : "aspect-[1.586/1]",
        active ? "scale-100 opacity-100" : "scale-[0.92] opacity-70",
        onClick && "hover:scale-[0.98] active:scale-[0.96]"
      )}
      style={{
        background: `linear-gradient(135deg, ${gradient[0]} 0%, ${gradient[1]} 100%)`,
      }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.18),transparent_45%)]" />
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" />
      <div className="absolute -bottom-12 -left-6 h-40 w-40 rounded-full bg-black/10" />

      <div className="relative flex h-full flex-col justify-between p-5">
        <div className="flex items-start justify-between">
          <div>
            {slide.type === "all" ? (
              <>
                <p className="text-xs font-medium uppercase tracking-widest text-white/70">
                  Resumo
                </p>
                <p className="mt-1 text-xl font-bold">Todos os cartões</p>
              </>
            ) : (
              <>
                <p className="text-xs font-medium uppercase tracking-widest text-white/70">
                  Cartão
                </p>
                <p className="mt-1 text-xl font-bold">{slide.card.name}</p>
              </>
            )}
          </div>
          <CreditCardIcon size={compact ? 22 : 28} className="text-white/80" />
        </div>

        <div>
          <p className="text-xs text-white/70">Em aberto</p>
          <p className="text-2xl font-semibold tracking-tight">
            {formatCurrency(slide.openTotal)}
          </p>
          <p className="mt-1 text-xs text-white/60">
            {slide.type === "all"
              ? `${slide.cardCount} cartão(ões)`
              : `Vence dia ${slide.card.due_day} · ${slide.purchaseCount} compra(s)`}
          </p>
        </div>
      </div>
    </button>
  );
}

interface WalletCarouselProps {
  slides: WalletSlide[];
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  onCardClick: (slide: WalletSlide, index: number) => void;
}

export function WalletCarousel({
  slides,
  activeIndex,
  onActiveIndexChange,
  onCardClick,
}: WalletCarouselProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onScroll = () => {
      const center = el.scrollLeft + el.clientWidth / 2;
      const children = Array.from(el.children) as HTMLElement[];
      let best = 0;
      let bestDist = Infinity;
      children.forEach((child, i) => {
        const childCenter = child.offsetLeft + child.offsetWidth / 2;
        const dist = Math.abs(center - childCenter);
        if (dist < bestDist) {
          bestDist = dist;
          best = i;
        }
      });
      if (best !== activeIndex) onActiveIndexChange(best);
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [activeIndex, onActiveIndexChange]);

  function scrollToIndex(index: number) {
    const el = scrollRef.current;
    if (!el) return;
    const child = el.children[index] as HTMLElement | undefined;
    if (!child) return;
    const left = child.offsetLeft - (el.clientWidth - child.offsetWidth) / 2;
    el.scrollTo({ left, behavior: "smooth" });
  }

  return (
    <div className="space-y-4">
      <div
        ref={scrollRef}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 scrollbar-none"
        style={{
          paddingLeft: "max(1rem, calc(50% - 140px))",
          paddingRight: "max(1rem, calc(50% - 140px))",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {slides.map((slide, i) => (
          <div
            key={slide.type === "all" ? "all" : slide.card.id}
            className="w-[min(280px,78vw)] shrink-0 snap-center"
          >
            <WalletCardVisual
              slide={slide}
              active={i === activeIndex}
              onClick={() => onCardClick(slide, i)}
            />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-center gap-1.5">
        {slides.map((slide, i) => (
          <button
            key={slide.type === "all" ? "all-dot" : slide.card.id}
            type="button"
            aria-label={`Ir para cartão ${i + 1}`}
            onClick={() => scrollToIndex(i)}
            className={cn(
              "h-1.5 rounded-full transition-all cursor-pointer",
              i === activeIndex ? "w-6 bg-primary" : "w-1.5 bg-slate-300"
            )}
          />
        ))}
      </div>
    </div>
  );
}
