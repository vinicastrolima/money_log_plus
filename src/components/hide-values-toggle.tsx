"use client";

import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHideValues } from "@/lib/hide-values";
import { cn } from "@/lib/utils";

interface HideValuesToggleProps {
  className?: string;
}

export function HideValuesToggle({ className }: HideValuesToggleProps) {
  const { hidden, toggle } = useHideValues();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={hidden ? "Mostrar valores" : "Ocultar valores"}
      aria-pressed={hidden}
      title={hidden ? "Mostrar valores" : "Ocultar valores"}
      className={cn(
        "h-9 w-9 rounded-xl text-muted/55 shadow-none hover:bg-surface hover:text-muted",
        className
      )}
    >
      {hidden ? <EyeOff size={16} strokeWidth={1.75} /> : <Eye size={16} strokeWidth={1.75} />}
    </Button>
  );
}
