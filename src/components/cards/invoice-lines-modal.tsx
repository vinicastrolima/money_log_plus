"use client";

import { CreditCard, ReceiptText } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import type { CardInvoicePrepayment, Category } from "@/lib/types";
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
  /** Antecipações do recorte (abatimentos). */
  prepayments?: CardInvoicePrepayment[];
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
  prepayments = [],
  onOpenCard,
}: Props) {
  const grossTotal = lines.reduce((sum, line) => sum + line.amount, 0);
  const prepaidTotal = prepayments.reduce((sum, item) => sum + item.amount, 0);
  const netTotal = Math.max(0, Math.round((grossTotal - prepaidTotal) * 100) / 100);
  const empty = lines.length === 0 && prepayments.length === 0;

  return (
    <Modal open={open} onClose={onClose} title={title} className="sm:max-w-xl">
      {subtitle && <p className="-mt-2 mb-4 text-sm text-muted">{subtitle}</p>}

      {empty ? (
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
              {prepayments.length > 0
                ? ` · ${prepayments.length} antecipação${
                    prepayments.length === 1 ? "" : "ões"
                  }`
                : ""}
            </span>
            <span className="text-right">
              {prepaidTotal > 0.005 ? (
                <>
                  <span className="block font-semibold text-foreground">
                    Bruto {formatCurrency(grossTotal)}
                  </span>
                  <span className="mt-0.5 block font-semibold text-primary">
                    A pagar {formatCurrency(netTotal)}
                  </span>
                </>
              ) : (
                <span className="block font-semibold text-foreground">
                  {formatCurrency(grossTotal)}
                </span>
              )}
            </span>
          </div>
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border sm:max-h-[min(28rem,55dvh)] sm:overflow-y-auto">
            {lines.map((line) => {
              const category = categories.find((item) => item.id === line.categoryId);
              const key = `${line.cardId}-${line.purchaseId}-${line.dueDate}-${line.installmentNumber}`;

              const content = (
                <>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {line.purchaseDescription}
                    </p>
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
                  <span className="shrink-0 text-sm font-semibold text-expense">
                    {formatCurrency(line.amount)}
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
            {prepayments.map((prepayment) => (
              <li
                key={prepayment.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 bg-primary/[0.03] p-3.5 sm:p-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-primary">
                    {prepayment.description || "Antecipação"}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Pago em {formatDateBR(prepayment.payment_date)} · abate fatura{" "}
                    {formatDateBR(prepayment.invoice_due_date)}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold text-primary">
                  −{formatCurrency(prepayment.amount)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Modal>
  );
}
