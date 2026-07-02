"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
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
    <div className="flex items-center gap-1">
      <button
        onClick={() => shift(-1)}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-slate-600 hover:bg-slate-50 cursor-pointer"
        aria-label="Mês anterior"
      >
        <ChevronLeft size={18} />
      </button>
      <div className="min-w-[150px] text-center text-sm font-semibold">
        {MONTH_NAMES_PT[month0]} {year}
      </div>
      <button
        onClick={() => shift(1)}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-slate-600 hover:bg-slate-50 cursor-pointer"
        aria-label="Próximo mês"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
