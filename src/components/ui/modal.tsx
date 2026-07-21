"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

let modalStack: string[] = [];
const modalDialogs = new Map<string, HTMLElement>();
let scrollLockCount = 0;
let previousBodyOverflow = "";

function lockBodyScroll() {
  if (scrollLockCount === 0) {
    previousBodyOverflow = document.body.style.overflow;
  }
  scrollLockCount += 1;
  document.body.style.overflow = "hidden";
}

function unlockBodyScroll() {
  scrollLockCount = Math.max(0, scrollLockCount - 1);
  if (scrollLockCount === 0) {
    document.body.style.overflow = previousBodyOverflow;
  }
}

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  inactive?: boolean;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  className,
  contentClassName,
  inactive = false,
}: ModalProps) {
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const previousFocusRef = React.useRef<HTMLElement | null>(null);
  const onCloseRef = React.useRef(onClose);
  const modalId = React.useId();
  const titleId = React.useId();

  React.useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  React.useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    modalStack.push(modalId);
    if (dialogRef.current) {
      modalDialogs.set(modalId, dialogRef.current);
    }
    lockBodyScroll();

    const onKey = (event: KeyboardEvent) => {
      const isTopModal = modalStack[modalStack.length - 1] === modalId;
      if (!isTopModal) return;

      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter(
        (element) =>
          element.getAttribute("aria-hidden") !== "true" &&
          !element.hasAttribute("disabled") &&
          element.getClientRects().length > 0
      );

      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || !dialog.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (active === last || !dialog.contains(active))
      ) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      modalStack = modalStack.filter((id) => id !== modalId);
      modalDialogs.delete(modalId);
      unlockBodyScroll();

      const previousFocus = previousFocusRef.current;
      window.requestAnimationFrame(() => {
        const topModalId = modalStack[modalStack.length - 1];
        const topDialog = topModalId ? modalDialogs.get(topModalId) : null;

        if (topDialog && !topDialog.hasAttribute("inert")) {
          if (previousFocus?.isConnected && topDialog.contains(previousFocus)) {
            previousFocus.focus({ preventScroll: true });
            return;
          }

          const preferred = topDialog.querySelector<HTMLElement>(
            "[autofocus], [data-autofocus]"
          );
          (preferred ?? topDialog).focus({ preventScroll: true });
          return;
        }

        if (previousFocus?.isConnected) {
          previousFocus.focus({ preventScroll: true });
        }
      });
    };
  }, [open, modalId]);

  React.useEffect(() => {
    if (!open || inactive) return;

    const frame = window.requestAnimationFrame(() => {
      const dialog = dialogRef.current;
      if (!dialog || modalStack[modalStack.length - 1] !== modalId) return;
      if (dialog.contains(document.activeElement)) return;
      const preferred = dialog.querySelector<HTMLElement>(
        "[autofocus], [data-autofocus]"
      );
      (preferred ?? dialog).focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [inactive, modalId, open]);

  if (!open) return null;

  return (
    <div
      data-modal-overlay
      className={cn(
        "fixed inset-0 z-[60] flex items-end justify-center overflow-hidden bg-[var(--overlay)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pt-[env(safe-area-inset-top)] backdrop-blur-[2px] sm:items-center sm:pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))] sm:pt-[max(1.5rem,env(safe-area-inset-top))]",
        inactive && "pointer-events-none"
      )}
      onMouseDown={(event) => {
        if (
          !inactive &&
          event.target === event.currentTarget &&
          modalStack[modalStack.length - 1] === modalId
        ) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal={inactive ? undefined : true}
        aria-hidden={inactive || undefined}
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : "Janela de diálogo"}
        inert={inactive ? true : undefined}
        tabIndex={-1}
        data-modal-scroll-region
        className={cn(
          "card max-h-[min(94dvh,100%)] w-full min-w-0 max-w-lg touch-pan-y overflow-x-hidden overflow-y-auto overscroll-x-none overscroll-y-contain rounded-b-none rounded-t-3xl shadow-[var(--shadow-float)] outline-none sm:max-h-[min(90dvh,100%)] sm:rounded-2xl",
          className
        )}
      >
        <div
          className={cn(
            "w-full min-w-0 px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6 sm:pt-6 sm:pb-[max(1.5rem,env(safe-area-inset-bottom))]",
            contentClassName
          )}
        >
          <div className="mb-5 flex min-w-0 items-center justify-between gap-3">
            {title ? (
              <h2
                id={titleId}
                className="min-w-0 truncate text-lg font-semibold tracking-[-0.015em]"
              >
                {title}
              </h2>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
