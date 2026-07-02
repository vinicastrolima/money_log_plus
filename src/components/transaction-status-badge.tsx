import type { TxStatus } from "@/lib/types";
import { TX_STATUS } from "@/lib/transaction-status";
import { cn } from "@/lib/utils";

interface Props {
  status: TxStatus;
  size?: "sm" | "md";
  showLabel?: boolean;
  className?: string;
}

export function TransactionStatusBadge({
  status,
  size = "sm",
  showLabel = true,
  className,
}: Props) {
  const cfg = TX_STATUS[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium",
        cfg.badge,
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        className
      )}
    >
      <span className={cn("shrink-0 rounded-full", cfg.dot, size === "sm" ? "h-2 w-2" : "h-2.5 w-2.5")} />
      {showLabel && cfg.label}
    </span>
  );
}

export function TransactionStatusDot({
  status,
  className,
}: {
  status: TxStatus;
  className?: string;
}) {
  const cfg = TX_STATUS[status];
  return (
    <span
      className={cn("h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white", cfg.dot, className)}
      title={cfg.label}
    />
  );
}
