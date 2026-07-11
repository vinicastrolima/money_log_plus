import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "card flex min-h-56 flex-col items-center justify-center border-dashed px-6 py-10 text-center",
        className
      )}
    >
      {Icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <Icon size={22} aria-hidden="true" />
        </div>
      )}
      <h2 className="text-base font-semibold tracking-[-0.015em] text-foreground">
        {title}
      </h2>
      {description && (
        <p className="mt-1.5 max-w-md text-sm leading-6 text-muted">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
