"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  CheckCircle2,
  CreditCard,
  LayoutDashboard,
  List,
  PieChart,
  Tags,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

const STORAGE_VERSION = "v1";
const OPEN_TUTORIAL_EVENT = "money-log:open-tutorial";
const STORAGE_CHANGE_EVENT = "money-log:tutorial-storage-change";

interface TutorialStep {
  href: string;
  title: string;
  eyebrow: string;
  description: string;
  icon: LucideIcon;
  tips: string[];
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    href: "/",
    title: "Painel",
    eyebrow: "Visão geral",
    description:
      "Aqui você acompanha o saldo do mês, entradas, saídas, orçamento diário e as movimentações mais recentes.",
    icon: LayoutDashboard,
    tips: [
      "Use o seletor de mês para revisar períodos anteriores.",
      "O botão Nova transação registra entradas e saídas rapidamente.",
      "Toque em uma transação recente para abrir a edição.",
    ],
  },
  {
    href: "/calendario",
    title: "Calendário",
    eyebrow: "Dias e compromissos",
    description:
      "Veja em quais dias existem entradas, saídas, gastos diários e contas pendentes, concluídas ou atrasadas.",
    icon: CalendarDays,
    tips: [
      "Selecione um dia para ver as transações daquele período.",
      "A legenda mostra o significado das cores e indicadores.",
      "No celular, arraste a grade para enxergar todos os dias.",
    ],
  },
  {
    href: "/lista",
    title: "Lista",
    eyebrow: "Busca e edição",
    description:
      "Esta aba concentra todas as transações do mês com filtros para encontrar e ajustar lançamentos.",
    icon: List,
    tips: [
      "Combine busca, categoria, tipo, direção e status para refinar a lista.",
      "Os cards de resumo refletem apenas o que está filtrado.",
      "Selecione qualquer linha para editar ou excluir a transação.",
    ],
  },
  {
    href: "/graficos",
    title: "Gráficos",
    eyebrow: "Análise visual",
    description:
      "Use os gráficos para entender a distribuição dos gastos e comparar entradas e saídas ao longo do mês.",
    icon: PieChart,
    tips: [
      "O gráfico de categorias mostra onde suas saídas se concentram.",
      "Prevista x diária separa contas planejadas dos gastos do dia a dia.",
      "Passe o cursor ou toque nos gráficos para ver valores detalhados.",
    ],
  },
  {
    href: "/cartoes",
    title: "Cartões",
    eyebrow: "Faturas e compras",
    description:
      "Gerencie seus cartões, registre compras parceladas e acompanhe próximas faturas em um só lugar.",
    icon: CreditCard,
    tips: [
      "Crie um cartão informando vencimento, fechamento e cores.",
      "Abra um cartão para gerenciar compras, parcelas e assinaturas.",
      "Os gráficos podem ser filtrados por um cartão específico.",
    ],
  },
  {
    href: "/categorias",
    title: "Categorias",
    eyebrow: "Organização",
    description:
      "Configure categorias, cores e a meta diária usada nos resumos do painel.",
    icon: Tags,
    tips: [
      "Categorias podem servir para entradas, saídas ou ambos.",
      "A cor ajuda a identificar gastos nos gráficos e listas.",
      "A meta diária define quanto você planeja gastar por dia.",
    ],
  },
];

interface StoredTutorialState {
  disabled: boolean;
  seen: string[];
}

interface AppTutorialProps {
  userKey?: string | null;
}

function getStepForPath(pathname: string) {
  return (
    TUTORIAL_STEPS.find((step) =>
      step.href === "/" ? pathname === "/" : pathname.startsWith(step.href)
    ) ?? TUTORIAL_STEPS[0]
  );
}

function getStorageKey(userKey?: string | null) {
  const normalized = userKey?.trim().toLowerCase() || "local";
  return `money-log:tutorial:${STORAGE_VERSION}:${normalized}`;
}

function parseState(raw: string | null): StoredTutorialState {
  try {
    if (!raw) return { disabled: false, seen: [] };
    const parsed = JSON.parse(raw) as Partial<StoredTutorialState>;
    return {
      disabled: Boolean(parsed.disabled),
      seen: Array.isArray(parsed.seen) ? parsed.seen.filter(Boolean) : [],
    };
  } catch {
    return { disabled: false, seen: [] };
  }
}

function writeState(storageKey: string, state: StoredTutorialState) {
  window.localStorage.setItem(storageKey, JSON.stringify(state));
  window.dispatchEvent(new Event(STORAGE_CHANGE_EVENT));
}

function subscribeToStorage(onStoreChange: () => void) {
  window.addEventListener(STORAGE_CHANGE_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(STORAGE_CHANGE_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function subscribeToHydration(onStoreChange: () => void) {
  const timer = window.setTimeout(onStoreChange, 0);
  return () => window.clearTimeout(timer);
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

export function AppTutorial({ userKey }: AppTutorialProps) {
  const pathname = usePathname();
  const storageKey = React.useMemo(() => getStorageKey(userKey), [userKey]);
  const [manualOpen, setManualOpen] = React.useState(false);
  const isHydrated = React.useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false
  );
  const rawState = React.useSyncExternalStore(
    subscribeToStorage,
    () => window.localStorage.getItem(storageKey) ?? "",
    () => ""
  );
  const state = React.useMemo(() => parseState(rawState), [rawState]);
  const step = getStepForPath(pathname);
  const StepIcon = step.icon;
  const autoOpen = isHydrated && !state.disabled && !state.seen.includes(step.href);
  const open = manualOpen || autoOpen;

  React.useEffect(() => {
    const onOpenTutorial = () => {
      setManualOpen(true);
    };

    window.addEventListener(OPEN_TUTORIAL_EVENT, onOpenTutorial);
    return () => window.removeEventListener(OPEN_TUTORIAL_EVENT, onOpenTutorial);
  }, []);

  const updateStoredState = React.useCallback(
    (updater: (current: StoredTutorialState) => StoredTutorialState) => {
      writeState(storageKey, updater(state));
    },
    [state, storageKey]
  );

  function markCurrentAsSeen() {
    updateStoredState((current) => ({
      ...current,
      seen: unique([...current.seen, step.href]),
    }));
  }

  function handleClose() {
    markCurrentAsSeen();
    setManualOpen(false);
  }

  function handleDisableTips() {
    updateStoredState((current) => ({
      disabled: true,
      seen: unique([...current.seen, step.href]),
    }));
    setManualOpen(false);
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={`Dica: ${step.title}`}
      className="sm:max-w-xl"
    >
      <div className="space-y-5">
        <div className="flex gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <StepIcon size={21} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
              {step.eyebrow}
            </p>
            <p className="mt-1 text-sm leading-6 text-muted">{step.description}</p>
          </div>
        </div>

        <ul className="space-y-3">
          {step.tips.map((tip) => (
            <li key={tip} className="flex gap-2.5 text-sm leading-6">
              <CheckCircle2
                size={17}
                className="mt-0.5 shrink-0 text-income"
                aria-hidden="true"
              />
              <span>{tip}</span>
            </li>
          ))}
        </ul>

        <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={handleDisableTips}>
            Não mostrar mais dicas
          </Button>
          <Button type="button" onClick={handleClose} data-autofocus>
            Entendi
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function openCurrentTutorial() {
  window.dispatchEvent(new Event(OPEN_TUTORIAL_EVENT));
}
