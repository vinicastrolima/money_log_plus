import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ToggleFieldProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  icon: LucideIcon;
  title: string;
  description: string;
  ariaLabel: string;
  children?: ReactNode;
}

export function ToggleField({
  checked,
  onCheckedChange,
  icon: Icon,
  title,
  description,
  ariaLabel,
  children,
}: ToggleFieldProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border transition-colors",
        checked ? "border-primary/30 bg-primary-soft/45" : "border-border bg-card"
      )}
    >
      <div className="flex items-center gap-3 p-3">
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors",
            checked ? "bg-primary text-primary-foreground" : "bg-surface text-muted"
          )}
          aria-hidden="true"
        >
          <Icon size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{title}</span>
          <span className="block text-xs text-muted">{description}</span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label={ariaLabel}
          onClick={() => onCheckedChange(!checked)}
          className={cn(
            "relative h-7 w-12 shrink-0 rounded-full p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            checked ? "bg-primary" : "bg-border-strong"
          )}
        >
          <span
            className={cn(
              "block h-6 w-6 rounded-full bg-white shadow-sm transition-transform",
              checked && "translate-x-5"
            )}
          />
        </button>
      </div>
      {checked && children ? children : null}
    </div>
  );
}
