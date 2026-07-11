"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MONTH_NAMES_PT } from "@/lib/utils";

interface Props {
  year: number;
  month0: number;
  onChange: (year: number, month0: number) => void;
}

export function MonthSwitcher({ year, month0, onChange }: Props) {
  function shift(delta: number) {
    const d = new Date(year, month0 + delta, 1);
    onChange(d.getFullYear(), d.getMonth());
  }

  return (
    <div
      className="inline-grid w-full max-w-[15rem] grid-cols-[2.5rem_minmax(7.5rem,1fr)_2.5rem] items-center gap-1 sm:w-auto"
      role="group"
      aria-label="Selecionar mês"
    >
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => shift(-1)}
        className="rounded-xl text-muted shadow-none"
        aria-label="Mês anterior"
      >
        <ChevronLeft size={18} />
      </Button>
      <div
        className="truncate px-1 text-center text-sm font-semibold text-foreground"
        aria-live="polite"
      >
        {MONTH_NAMES_PT[month0]} {year}
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => shift(1)}
        className="rounded-xl text-muted shadow-none"
        aria-label="Próximo mês"
      >
        <ChevronRight size={18} />
      </Button>
    </div>
  );
}
