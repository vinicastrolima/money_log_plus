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
}

export function Modal({ open, onClose, title, children, className }: ModalProps) {
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
    lockBodyScroll();

    const frame = window.requestAnimationFrame(() => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      if (dialog.contains(document.activeElement)) return;
      const preferred = dialog.querySelector<HTMLElement>(
        "[autofocus], [data-autofocus]"
      );
      (preferred ?? dialog).focus({ preventScroll: true });
    });

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
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKey);
      modalStack = modalStack.filter((id) => id !== modalId);
      unlockBodyScroll();

      const previousFocus = previousFocusRef.current;
      if (previousFocus?.isConnected) {
        window.requestAnimationFrame(() => previousFocus.focus());
      }
    };
  }, [open, modalId]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center overflow-y-auto bg-[var(--overlay)] p-0 backdrop-blur-[2px] sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (
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
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : "Janela de diálogo"}
        tabIndex={-1}
        className={cn(
          "card w-full max-w-lg overflow-x-hidden overflow-y-auto rounded-b-none rounded-t-3xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[var(--shadow-float)] outline-none sm:max-h-[90dvh] sm:rounded-2xl sm:p-6",
          "max-h-[94dvh]",
          className
        )}
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          {title ? (
            <h2 id={titleId} className="text-lg font-semibold tracking-[-0.015em]">
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
  );
}
