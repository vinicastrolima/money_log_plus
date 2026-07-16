"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ShieldCheck, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export default function LoginPage() {
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);
  const [mode, setMode] = React.useState<"login" | "signup">("login");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage(
          "Conta criada! Se a confirmação de email estiver ativa, verifique sua caixa de entrada. Caso contrário, já pode entrar."
        );
        setMode("login");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push("/");
        router.refresh();
      }
    } catch (err: unknown) {
      setError(traduzErro(getAuthErrorMessage(err)));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-dvh overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_12%,rgba(37,99,235,0.12),transparent_34%),radial-gradient(circle_at_88%_85%,rgba(14,165,233,0.08),transparent_30%)]" />

      <div className="relative mx-auto grid min-h-dvh w-full max-w-[90rem] lg:grid-cols-[minmax(0,1.05fr)_minmax(26rem,0.75fr)]">
        <section className="hidden flex-col justify-between px-10 py-12 lg:flex xl:px-16 xl:py-16">
          <div className="inline-flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
              <Wallet size={21} strokeWidth={2.2} />
            </span>
            <div>
              <p className="font-bold tracking-[-0.02em]">Money Log</p>
              <p className="text-xs text-muted">Finanças em ordem</p>
            </div>
          </div>

          <div className="max-w-xl py-16">
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.16em] text-primary">
              Clareza para decidir melhor
            </p>
            <h2 className="text-4xl font-semibold leading-[1.08] tracking-[-0.045em] text-foreground xl:text-5xl">
              Organize hoje. Respire melhor amanhã.
            </h2>
            <p className="mt-5 max-w-lg text-base leading-7 text-muted xl:text-lg xl:leading-8">
              Acompanhe gastos, cartões e metas em uma visão simples, feita para a sua rotina.
            </p>

            <div className="mt-10 grid max-w-lg gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-card/80 p-4 shadow-sm backdrop-blur">
                <CalendarDays size={20} className="text-primary" />
                <p className="mt-3 text-sm font-semibold">Sua rotina visível</p>
                <p className="mt-1 text-xs leading-5 text-muted">
                  Contas, compras e compromissos no mesmo calendário.
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-card/80 p-4 shadow-sm backdrop-blur">
                <ShieldCheck size={20} className="text-primary" />
                <p className="mt-3 text-sm font-semibold">Dados protegidos</p>
                <p className="mt-1 text-xs leading-5 text-muted">
                  Sua conta mantém cada informação no lugar certo.
                </p>
              </div>
            </div>
          </div>

          <p className="text-xs text-muted">Controle financeiro pessoal, sem ruído.</p>
        </section>

        <section className="flex min-h-dvh items-center justify-center px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-6 lg:border-l lg:border-border lg:bg-card/45 lg:px-10 xl:px-16">
          <div className="w-full max-w-md">
            <div className="mb-8 flex items-center justify-center gap-3 lg:hidden">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
                <Wallet size={21} strokeWidth={2.2} />
              </span>
              <div>
                <p className="font-bold tracking-[-0.02em]">Money Log</p>
                <p className="text-xs text-muted">Finanças em ordem</p>
              </div>
            </div>

            <div className="card p-6 sm:p-8">
              <div className="mb-7">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
                  {mode === "login" ? "Bem-vindo de volta" : "Comece agora"}
                </p>
                <h1 className="mt-2 text-2xl font-semibold tracking-[-0.035em]">
                  {mode === "login" ? "Entre na sua conta" : "Crie sua conta"}
                </h1>
                <p className="mt-2 text-sm leading-6 text-muted">
                  {mode === "login"
                    ? "Acesse seu painel e continue de onde parou."
                    : "Leva menos de um minuto para organizar sua vida financeira."}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="voce@email.com"
                    autoComplete="email"
                    disabled={loading}
                    aria-invalid={Boolean(error)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    disabled={loading}
                    aria-invalid={Boolean(error)}
                    minLength={6}
                    required
                  />
                  {mode === "signup" && (
                    <p className="mt-1.5 text-xs text-muted">
                      Use pelo menos 6 caracteres.
                    </p>
                  )}
                </div>

                {(error || message) && (
                  <div aria-live="polite">
                    {error && (
                      <p
                        role="alert"
                        className="rounded-xl border border-expense/15 bg-expense-bg px-3 py-2.5 text-sm text-expense"
                      >
                        {error}
                      </p>
                    )}
                    {message && (
                      <p
                        role="status"
                        className="rounded-xl border border-income/15 bg-income-bg px-3 py-2.5 text-sm text-income"
                      >
                        {message}
                      </p>
                    )}
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading
                    ? "Aguarde..."
                    : mode === "login"
                    ? "Entrar"
                    : "Criar conta"}
                </Button>
              </form>

              <p className="mt-5 text-center text-sm text-muted">
                {mode === "login" ? "Ainda não tem conta? " : "Já tem uma conta? "}
                <button
                  type="button"
                  onClick={() => {
                    setMode(mode === "login" ? "signup" : "login");
                    setError(null);
                    setMessage(null);
                  }}
                  disabled={loading}
                  className="rounded font-semibold text-primary underline-offset-4 hover:underline disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {mode === "login" ? "Criar conta" : "Entrar"}
                </button>
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function getAuthErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "object" && err !== null) {
    const record = err as { message?: unknown; msg?: unknown };
    if (typeof record.message === "string" && record.message) return record.message;
    if (typeof record.msg === "string" && record.msg) return record.msg;
  }
  return "Erro ao autenticar.";
}

function traduzErro(msg: string): string {
  if (msg.includes("Invalid login credentials")) return "Email ou senha inválidos.";
  if (msg.includes("already registered")) return "Este email já está cadastrado.";
  if (msg.includes("Email not confirmed"))
    return "Confirme seu email antes de entrar.";
  if (msg.includes("Database error")) return "Erro no servidor de autenticação. Tente novamente.";
  return msg;
}
