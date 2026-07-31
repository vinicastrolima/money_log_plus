"use client";

import { CreditCard, ReceiptText, Users } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import type { Category } from "@/lib/types";
import type { ScopedInstallmentLine } from "@/lib/cards";
import { formatCurrency, formatDateBR } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  lines: ScopedInstallmentLine[];
  categories: Category[];
  showCardName: boolean;
  showOwnAmounts?: boolean;
  onOpenCard?: (cardId: string) => void;
}

export function InvoiceLinesModal({
  open,
  onClose,
  title,
  subtitle,
  lines,
  categories,
  showCardName,
  showOwnAmounts = false,
  onOpenCard,
}: Props) {
  const total = lines.reduce((sum, line) => sum + line.amount, 0);
  const ownTotal = lines.reduce((sum, line) => sum + line.ownAmount, 0);
  const showOwnTotal = showOwnAmounts && ownTotal < total - 0.005;

  return (
    <Modal open={open} onClose={onClose} title={title} className="sm:max-w-xl">
      {subtitle && <p className="-mt-2 mb-4 text-sm text-muted">{subtitle}</p>}

      {lines.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-5 py-10 text-center">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-surface text-muted">
            <ReceiptText size={20} aria-hidden="true" />
          </span>
          <p className="mt-3 text-sm font-medium">Nenhuma compra neste recorte</p>
          <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-muted">
            Não há parcelas ou assinaturas para o período selecionado.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-3 flex items-start justify-between gap-3 text-xs text-muted">
            <span>
              {lines.length} item{lines.length === 1 ? "" : "s"}
            </span>
            <span className="text-right">
              <span className="block font-semibold text-foreground">
                {showOwnTotal ? `Cartão ${formatCurrency(total)}` : formatCurrency(total)}
              </span>
              {showOwnTotal && (
                <span className="mt-0.5 block font-semibold text-primary">
                  Sua parte {formatCurrency(ownTotal)}
                </span>
              )}
            </span>
          </div>
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border sm:max-h-[min(28rem,55dvh)] sm:overflow-y-auto">
            {lines.map((line) => {
              const category = categories.find((item) => item.id === line.categoryId);
              const key = `${line.cardId}-${line.purchaseId}-${line.dueDate}-${line.installmentNumber}`;
              const shared = showOwnAmounts && line.isShared;

              const content = (
                <>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold">
                        {line.purchaseDescription}
                      </p>
                      {shared && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                          <Users size={11} aria-hidden="true" />
                          Dividida
                        </span>
                      )}
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted">
                      <span>{formatDateBR(line.dueDate)}</span>
                      {showCardName && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex min-w-0 items-center gap-1">
                            <CreditCard size={11} aria-hidden="true" />
                            <span className="max-w-28 truncate">{line.cardName}</span>
                          </span>
                        </>
                      )}
                      <span aria-hidden="true">·</span>
                      <span>
                        {line.isSubscription
                          ? "Assinatura"
                          : line.installmentsTotal <= 1
                            ? "À vista"
                            : `${line.installmentNumber}/${line.installmentsTotal}`}
                      </span>
                      {category && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex min-w-0 items-center gap-1.5">
                            <span
                              className="h-2 w-2 shrink-0 rounded-full"
                              style={{ background: category.color }}
                              aria-hidden="true"
                            />
                            <span className="max-w-28 truncate">{category.name}</span>
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                  <span className="shrink-0 text-right">
                    <span className="block text-sm font-semibold text-expense">
                      {formatCurrency(line.amount)}
                    </span>
                    {shared && (
                      <span className="mt-0.5 block text-[11px] font-medium text-primary">
                        sua parte {formatCurrency(line.ownAmount)}
                      </span>
                    )}
                  </span>
                </>
              );

              if (onOpenCard) {
                return (
                  <li key={key}>
                    <button
                      type="button"
                      onClick={() => onOpenCard(line.cardId)}
                      className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-3.5 text-left transition-colors hover:bg-surface/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:p-4"
                    >
                      {content}
                    </button>
                  </li>
                );
              }

              return (
                <li
                  key={key}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-3.5 sm:p-4"
                >
                  {content}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Modal>
  );
}
