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
        "h-11 min-w-0 max-w-full w-full rounded-xl border border-border-strong bg-card px-3.5 text-base text-foreground shadow-[0_1px_1px_rgba(15,23,42,0.02)] outline-none transition-[border-color,box-shadow,background-color] placeholder:text-muted/80 focus:border-primary focus:ring-2 focus:ring-ring/35 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-muted aria-invalid:border-expense aria-invalid:ring-expense/20",
        className
      )}
      {...props}
    />
  );
});
Input.displayName = "Input";

export const DateInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">
>(({ className, disabled, "aria-invalid": ariaInvalid, ...props }, ref) => {
  const invalid = ariaInvalid === true || ariaInvalid === "true";

  return (
    <span
      className={cn(
        "flex h-11 min-w-0 max-w-full w-full items-center overflow-clip rounded-xl border border-border-strong bg-card px-3.5 shadow-[0_1px_1px_rgba(15,23,42,0.02)] transition-[border-color,box-shadow,background-color] focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/35",
        disabled && "cursor-not-allowed bg-surface-muted text-muted",
        invalid && "border-expense ring-2 ring-expense/20",
        className
      )}
    >
      <input
        ref={ref}
        type="date"
        disabled={disabled}
        aria-invalid={ariaInvalid}
        className="native-date-input-control block h-full min-w-0 max-w-full w-full flex-1 border-0 bg-transparent p-0 text-base text-foreground outline-none disabled:cursor-not-allowed disabled:text-muted"
        {...props}
      />
    </span>
  );
});
DateInput.displayName = "DateInput";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => {
  return (
    <select
      ref={ref}
      className={cn(
        "h-11 min-w-0 max-w-full w-full rounded-xl border border-border-strong bg-card px-3.5 text-base text-foreground shadow-[0_1px_1px_rgba(15,23,42,0.02)] outline-none transition-[border-color,box-shadow,background-color] focus:border-primary focus:ring-2 focus:ring-ring/35 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-muted aria-invalid:border-expense aria-invalid:ring-expense/20",
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
