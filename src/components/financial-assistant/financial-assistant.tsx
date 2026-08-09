"use client";

import * as React from "react";
import {
  Bot,
  LoaderCircle,
  MessageCircle,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import type {
  FinancialAssistantConversationResponse,
  FinancialAssistantErrorResponse,
  FinancialAssistantResponse,
} from "@/lib/financial-assistant-types";
import { FINANCIAL_ASSISTANT_MAX_QUESTION_LENGTH } from "@/lib/financial-assistant-types";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  highlights?: string[];
  period?: string;
  disclaimer?: string;
  includeInHistory?: boolean;
  error?: boolean;
}

const CONVERSATION_STORAGE_KEY = "money-log-assistant-conversation-id";

const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Olá! Posso analisar seus gastos, receitas, categorias, cartões e orçamento usando os dados registrados no Money Log.",
  includeInHistory: false,
};

const SUGGESTIONS = [
  "Quais foram minhas maiores categorias de gastos neste mês?",
  "Faça uma análise dos meus gastos recentes.",
  "Onde eu poderia economizar com base nos meus dados?",
  "Como está meu orçamento neste mês?",
];

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "textarea:not([disabled])",
  "a[href]",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function createMessageId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isAssistantResponse(value: unknown): value is FinancialAssistantResponse {
  if (!value || typeof value !== "object") return false;
  const response = value as Record<string, unknown>;
  return (
    typeof response.answer === "string" &&
    typeof response.period === "string" &&
    typeof response.disclaimer === "string" &&
    Array.isArray(response.highlights) &&
    response.highlights.every((highlight) => typeof highlight === "string")
  );
}

function readStoredConversationId() {
  try {
    const value = window.localStorage.getItem(CONVERSATION_STORAGE_KEY);
    return value || null;
  } catch {
    return null;
  }
}

function storeConversationId(conversationId: string | null) {
  try {
    if (!conversationId) {
      window.localStorage.removeItem(CONVERSATION_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(CONVERSATION_STORAGE_KEY, conversationId);
  } catch {
    // localStorage pode falhar em modo privado
  }
}

export function FinancialAssistant() {
  const [open, setOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [conversationId, setConversationId] = React.useState<string | null>(null);
  const [loadingConversation, setLoadingConversation] = React.useState(false);
  const [input, setInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const panelRef = React.useRef<HTMLElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const conversationLoadedRef = React.useRef(false);

  React.useEffect(() => {
    return () => abortControllerRef.current?.abort();
  }, []);

  React.useEffect(() => {
    if (!open || conversationLoadedRef.current) return;
    conversationLoadedRef.current = true;

    const storedId = readStoredConversationId();
    if (!storedId) return;

    let cancelled = false;
    setLoadingConversation(true);

    void (async () => {
      try {
        const response = await fetch(
          `/api/financial-assistant/conversations/${storedId}`,
          { method: "GET", headers: { Accept: "application/json" } }
        );
        if (!response.ok) {
          storeConversationId(null);
          return;
        }
        const payload =
          (await response.json()) as FinancialAssistantConversationResponse;
        if (cancelled) return;
        if (!payload.conversationId || !Array.isArray(payload.messages)) {
          storeConversationId(null);
          return;
        }

        setConversationId(payload.conversationId);
        storeConversationId(payload.conversationId);

        if (payload.messages.length === 0) {
          setMessages([WELCOME_MESSAGE]);
          return;
        }

        setMessages([
          WELCOME_MESSAGE,
          ...payload.messages.map((message) => ({
            id: message.id,
            role: message.role,
            content: message.content,
            highlights: message.highlights,
            period: message.period ?? undefined,
            disclaimer:
              message.role === "assistant"
                ? "Análise informativa baseada nos dados registrados. Não substitui orientação financeira profissional."
                : undefined,
          })),
        ]);
      } catch {
        storeConversationId(null);
      } finally {
        if (!cancelled) setLoadingConversation(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;

    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        window.requestAnimationFrame(() => triggerRef.current?.focus());
        return;
      }

      if (event.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((element) => element.getClientRects().length > 0);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, open, sending, loadingConversation]);

  const startNewConversation = React.useCallback(() => {
    abortControllerRef.current?.abort();
    setConversationId(null);
    storeConversationId(null);
    setMessages([WELCOME_MESSAGE]);
    setInput("");
    setSending(false);
  }, []);

  const sendQuestion = React.useCallback(
    async (value: string) => {
      const question = value.trim();
      if (!question || sending || loadingConversation) return;

      const userMessage: ChatMessage = {
        id: createMessageId(),
        role: "user",
        content: question,
      };
      setMessages((current) => [...current, userMessage]);
      setInput("");
      setSending(true);

      const controller = new AbortController();
      abortControllerRef.current?.abort();
      abortControllerRef.current = controller;

      try {
        const response = await fetch("/api/financial-assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question,
            conversationId: conversationId ?? undefined,
          }),
          signal: controller.signal,
        });
        const contentType = response.headers.get("content-type") ?? "";
        if (!contentType.includes("application/json")) {
          const sessionExpired = response.redirected || response.url.includes("/login");
          throw new Error(
            sessionExpired
              ? "Sua sessão expirou. Entre novamente para continuar."
              : "Não foi possível concluir a análise agora."
          );
        }
        const payload = (await response.json()) as
          | FinancialAssistantResponse
          | FinancialAssistantErrorResponse;

        if (!response.ok) {
          const error = "error" in payload ? payload.error : "Falha ao analisar os dados.";
          throw new Error(error);
        }
        if (!isAssistantResponse(payload)) {
          throw new Error("O assistente retornou uma resposta inválida.");
        }

        if (payload.conversationId) {
          setConversationId(payload.conversationId);
          storeConversationId(payload.conversationId);
        }

        setMessages((current) => [
          ...current,
          {
            id: createMessageId(),
            role: "assistant",
            content: payload.answer,
            highlights: payload.highlights,
            period: payload.period,
            disclaimer: payload.disclaimer,
          },
        ]);
      } catch (error) {
        if (controller.signal.aborted) return;
        const safeMessage =
          error instanceof Error &&
          (error.message === "Sua sessão expirou. Entre novamente para continuar." ||
            error.message === "Não foi possível concluir a análise agora." ||
            error.message === "Falha ao analisar os dados." ||
            error.message === "O assistente retornou uma resposta inválida." ||
            error.message === "Conversa não encontrada." ||
            error.message.startsWith("O assistente financeiro") ||
            error.message.startsWith("Você atingiu") ||
            error.message.startsWith("Sua pergunta") ||
            error.message.startsWith("Faça uma pergunta") ||
            error.message.startsWith("Escreva uma pergunta"))
            ? error.message
            : "Não foi possível concluir a análise agora.";

        if (safeMessage === "Conversa não encontrada.") {
          setConversationId(null);
          storeConversationId(null);
        }

        setMessages((current) => [
          ...current,
          {
            id: createMessageId(),
            role: "assistant",
            content: safeMessage,
            includeInHistory: false,
            error: true,
          },
        ]);
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
          setSending(false);
        }
      }
    },
    [conversationId, loadingConversation, sending]
  );

  function closePanel() {
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  const showSuggestions =
    !loadingConversation &&
    messages.length === 1 &&
    messages[0]?.id === "welcome";

  return (
    <>
      {!open && (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-[calc(6.4rem+env(safe-area-inset-bottom))] right-4 z-40 flex h-14 items-center gap-2 rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground shadow-[var(--shadow-float)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:bottom-6 md:right-6"
          aria-label="Abrir assistente financeiro"
          aria-haspopup="dialog"
          aria-expanded="false"
          aria-controls="financial-assistant-dialog"
        >
          <MessageCircle size={22} strokeWidth={2.2} />
          <span className="hidden sm:inline">Pergunte à IA</span>
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-[55] flex items-end justify-center bg-[var(--overlay)] md:items-end md:justify-end md:bg-transparent md:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closePanel();
          }}
        >
          <section
            ref={panelRef}
            id="financial-assistant-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="financial-assistant-title"
            className="flex h-[min(88dvh,46rem)] w-full min-w-0 flex-col overflow-hidden rounded-t-3xl border border-border bg-card shadow-[var(--shadow-float)] outline-none md:h-[min(42rem,calc(100dvh-3rem))] md:w-[25rem] md:rounded-3xl"
          >
            <header className="flex shrink-0 items-center gap-3 border-b border-border bg-primary-soft px-4 py-3.5">
              <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
                <Bot size={21} />
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-primary-soft bg-income" />
              </span>
              <div className="min-w-0 flex-1">
                <h2
                  id="financial-assistant-title"
                  className="truncate text-sm font-bold tracking-[-0.01em]"
                >
                  Assistente financeiro
                </h2>
                <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted">
                  <ShieldCheck size={12} /> Memória e dados só seus
                </p>
              </div>
              <button
                type="button"
                onClick={startNewConversation}
                disabled={sending || loadingConversation}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted transition-colors hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
                aria-label="Nova conversa"
                title="Nova conversa"
              >
                <Plus size={18} />
              </button>
              <button
                type="button"
                onClick={closePanel}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted transition-colors hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Fechar assistente financeiro"
              >
                <X size={19} />
              </button>
            </header>

            <div
              className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-y-contain bg-surface px-4 py-4"
              aria-live="polite"
              aria-busy={sending || loadingConversation}
            >
              {loadingConversation && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-border bg-card px-3.5 py-3 text-xs text-muted shadow-sm">
                    <LoaderCircle size={15} className="animate-spin text-primary" />
                    Carregando conversa…
                  </div>
                </div>
              )}

              {!loadingConversation &&
                messages.map((message) => (
                  <article
                    key={message.id}
                    className={cn(
                      "flex",
                      message.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[88%] rounded-2xl px-3.5 py-3 text-sm shadow-sm",
                        message.role === "user"
                          ? "rounded-br-md bg-primary text-primary-foreground"
                          : message.error
                            ? "rounded-bl-md border border-expense/30 bg-expense-bg text-foreground"
                            : "rounded-bl-md border border-border bg-card text-foreground"
                      )}
                    >
                      <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                      {!!message.highlights?.length && (
                        <ul className="mt-3 space-y-1.5 border-t border-border pt-2.5">
                          {message.highlights.map((highlight, index) => (
                            <li key={`${message.id}-${index}`} className="flex gap-2 text-xs">
                              <Sparkles
                                size={13}
                                className="mt-0.5 shrink-0 text-primary"
                              />
                              <span>{highlight}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {message.period && message.period !== "Não aplicável" && (
                        <p className="mt-2.5 text-[10px] text-muted">Período: {message.period}</p>
                      )}
                      {message.disclaimer && (
                        <p className="mt-2 text-[10px] leading-relaxed text-muted">
                          {message.disclaimer}
                        </p>
                      )}
                    </div>
                  </article>
                ))}

              {showSuggestions && (
                <div className="grid gap-2" aria-label="Perguntas sugeridas">
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => void sendQuestion(suggestion)}
                      className="rounded-xl border border-border bg-card px-3 py-2.5 text-left text-xs font-medium text-foreground transition-colors hover:border-border-strong hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}

              {sending && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-border bg-card px-3.5 py-3 text-xs text-muted shadow-sm">
                    <LoaderCircle size={15} className="animate-spin text-primary" />
                    Analisando seus dados…
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <form
              className="shrink-0 border-t border-border bg-card px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:pb-3"
              onSubmit={(event) => {
                event.preventDefault();
                void sendQuestion(input);
              }}
            >
              <div className="flex items-end gap-2 rounded-2xl border border-border-strong bg-surface px-3 py-2 focus-within:ring-2 focus-within:ring-ring">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }
                  }}
                  maxLength={FINANCIAL_ASSISTANT_MAX_QUESTION_LENGTH}
                  rows={1}
                  disabled={sending || loadingConversation}
                  placeholder="Pergunte sobre seus gastos…"
                  aria-label="Pergunta para o assistente financeiro"
                  className="max-h-28 min-h-10 flex-1 resize-none bg-transparent py-2 text-sm text-foreground outline-none placeholder:text-muted disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={
                    sending ||
                    loadingConversation ||
                    input.trim().length < 3
                  }
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Enviar pergunta"
                >
                  {sending ? (
                    <LoaderCircle size={17} className="animate-spin" />
                  ) : (
                    <Send size={17} />
                  )}
                </button>
              </div>
              <p className="mt-2 text-center text-[10px] text-muted">
                Memória por usuário • resumo agregado • 20 análises/hora
              </p>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
