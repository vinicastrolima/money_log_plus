"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarDays,
  CreditCard,
  Ellipsis,
  LayoutDashboard,
  List,
  LogOut,
  PieChart,
  Tags,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const links: NavItem[] = [
  { href: "/", label: "Painel", icon: LayoutDashboard },
  { href: "/calendario", label: "Calendário", icon: CalendarDays },
  { href: "/lista", label: "Lista", icon: List },
  { href: "/graficos", label: "Gráficos", icon: PieChart },
  { href: "/cartoes", label: "Cartões", icon: CreditCard },
  { href: "/categorias", label: "Categorias", icon: Tags },
];

const mobileLinks = links.filter((link) =>
  ["/", "/calendario", "/lista", "/cartoes"].includes(link.href)
);
const moreLinks = links.filter((link) =>
  ["/graficos", "/categorias"].includes(link.href)
);

interface NavProps {
  userEmail?: string | null;
}

function isLinkActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function UserAvatar({ email }: { email?: string | null }) {
  const initial = email?.trim().charAt(0).toUpperCase() || "M";
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary">
      {initial}
    </span>
  );
}

export function Nav({ userEmail }: NavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);
  const [moreOpen, setMoreOpen] = React.useState(false);
  const [loggingOut, setLoggingOut] = React.useState(false);
  const moreActive = moreLinks.some((link) => isLinkActive(pathname, link.href));

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await supabase.auth.signOut();
      setMoreOpen(false);
      router.push("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-sidebar/95 px-4 backdrop-blur-lg md:hidden">
        <Link
          href="/"
          className="inline-flex items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label="Money Log — ir ao Painel"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Wallet size={18} strokeWidth={2.2} />
          </span>
          <span>
            <span className="block text-sm font-bold leading-none tracking-[-0.015em]">
              Money Log
            </span>
            <span className="mt-1 block text-[11px] leading-none text-muted">
              Finanças em ordem
            </span>
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label="Abrir conta e mais opções"
        >
          <UserAvatar email={userEmail} />
        </button>
      </header>

      <aside className="sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-sidebar md:flex md:w-[4.75rem] xl:w-72">
        <div className="flex h-20 items-center justify-center border-b border-border px-3 xl:justify-start xl:px-5">
          <Link
            href="/"
            className="flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label="Money Log — ir ao Painel"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Wallet size={19} strokeWidth={2.2} />
            </span>
            <span className="hidden min-w-0 xl:block">
              <span className="block font-bold leading-tight tracking-[-0.015em]">
                Money Log
              </span>
              <span className="block text-xs text-muted">Finanças pessoais</span>
            </span>
          </Link>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-5 xl:px-4">
          <p className="mb-2 hidden px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-muted/80 xl:block">
            Menu principal
          </p>
          <nav className="flex flex-col gap-1.5" aria-label="Navegação principal">
            {links.map((link) => {
              const active = isLinkActive(pathname, link.href);
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  title={link.label}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-11 items-center justify-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 xl:justify-start",
                    active
                      ? "bg-primary-soft text-primary"
                      : "text-muted hover:bg-surface-muted hover:text-foreground"
                  )}
                >
                  <Icon size={20} className="shrink-0" strokeWidth={active ? 2.2 : 1.9} />
                  <span className="hidden truncate xl:block">{link.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-border p-3 xl:p-4">
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex h-11 w-full items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface-muted hover:text-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 xl:hidden"
            aria-label="Sair da conta"
            title="Sair"
          >
            <LogOut size={19} />
          </button>

          <div className="hidden items-center gap-3 rounded-2xl border border-border bg-card p-2.5 xl:flex">
            <UserAvatar email={userEmail} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-foreground">Sua conta</p>
              <p className="truncate text-xs text-muted">{userEmail || "Money Log"}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface-muted hover:text-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Sair da conta"
              title="Sair"
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-sidebar/95 px-2 pt-1.5 shadow-[0_-10px_32px_rgba(15,23,42,0.06)] backdrop-blur-xl md:hidden"
        style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
        aria-label="Navegação principal mobile"
      >
        <div className="grid grid-cols-5 gap-0.5">
          {mobileLinks.map((link) => {
            const active = isLinkActive(pathname, link.href);
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[10px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active ? "bg-primary-soft text-primary" : "text-muted"
                )}
              >
                <Icon size={20} strokeWidth={active ? 2.3 : 1.9} />
                <span>{link.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-expanded={moreOpen}
            aria-haspopup="dialog"
            className={cn(
              "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[10px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              moreActive || moreOpen ? "bg-primary-soft text-primary" : "text-muted"
            )}
          >
            <Ellipsis size={20} />
            <span>Mais</span>
          </button>
        </div>
      </nav>

      <Modal open={moreOpen} onClose={() => setMoreOpen(false)} title="Mais opções">
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-2xl bg-surface p-3.5">
            <UserAvatar email={userEmail} />
            <div className="min-w-0">
              <p className="text-sm font-semibold">Sua conta</p>
              <p className="truncate text-xs text-muted">{userEmail || "Money Log"}</p>
            </div>
          </div>

          <nav className="grid grid-cols-2 gap-2" aria-label="Mais páginas">
            {moreLinks.map((link) => {
              const active = isLinkActive(pathname, link.href);
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMoreOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-24 flex-col items-start justify-between rounded-2xl border p-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    active
                      ? "border-primary/25 bg-primary-soft text-primary"
                      : "border-border bg-card text-foreground hover:bg-surface"
                  )}
                >
                  <Icon size={21} />
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <Button
            type="button"
            variant="outline"
            className="w-full text-expense hover:bg-expense-bg"
            onClick={handleLogout}
            disabled={loggingOut}
          >
            <LogOut size={17} />
            {loggingOut ? "Saindo..." : "Sair da conta"}
          </Button>
        </div>
      </Modal>
    </>
  );
}
