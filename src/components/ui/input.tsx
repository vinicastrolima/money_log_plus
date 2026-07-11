import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={cn(
        "h-11 w-full rounded-xl border border-border-strong bg-card px-3.5 text-sm text-foreground shadow-[0_1px_1px_rgba(15,23,42,0.02)] outline-none transition-[border-color,box-shadow,background-color] placeholder:text-muted/80 focus:border-primary focus:ring-2 focus:ring-ring/35 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-muted aria-invalid:border-expense aria-invalid:ring-expense/20",
        className
      )}
      {...props}
    />
  );
});
Input.displayName = "Input";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => {
  return (
    <select
      ref={ref}
      className={cn(
        "h-11 w-full rounded-xl border border-border-strong bg-card px-3.5 text-sm text-foreground shadow-[0_1px_1px_rgba(15,23,42,0.02)] outline-none transition-[border-color,box-shadow,background-color] focus:border-primary focus:ring-2 focus:ring-ring/35 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-muted aria-invalid:border-expense aria-invalid:ring-expense/20",
        className
      )}
      {...props}
    />
  );
});
Select.displayName = "Select";

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("mb-1.5 block text-sm font-semibold text-foreground/85", className)}
      {...props}
    />
  );
}
