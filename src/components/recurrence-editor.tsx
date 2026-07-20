"use client";

import * as React from "react";
import { CalendarClock, Check, ChevronRight, Repeat2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import {
  defaultCustomRecurrence,
  getRecurrenceSummary,
  recurrenceFromPreset,
  type RecurrencePreset,
} from "@/lib/recurrence";
import type {
  MonthlyOrdinalTarget,
  RecurrenceConfig,
  RecurrenceFrequency,
} from "@/lib/types";
import { cn, parseISODate } from "@/lib/utils";

interface RecurrenceEditorProps {
  enabled: boolean;
  value: RecurrenceConfig;
  startDate: string;
  editingSeries?: boolean;
  onEnabledChange: (enabled: boolean) => void;
  onChange: (value: RecurrenceConfig) => void;
}

const PRESETS: Array<{ value: RecurrencePreset; label: string }> = [
  { value: "daily", label: "Diariamente" },
  { value: "weekdays", label: "Dias úteis" },
  { value: "weekends", label: "Fins de semana" },
  { value: "weekly", label: "Semanalmente" },
  { value: "biweekly", label: "Quinzenalmente" },
  { value: "monthly", label: "Mensalmente" },
  { value: "quarterly", label: "A cada 3 meses" },
  { value: "semiannual", label: "A cada 6 meses" },
  { value: "yearly", label: "Anualmente" },
];

const WEEK_DAYS = [
  { short: "D", label: "Domingo", value: 0 },
  { short: "S", label: "Segunda-feira", value: 1 },
  { short: "T", label: "Terça-feira", value: 2 },
  { short: "Q", label: "Quarta-feira", value: 3 },
  { short: "Q", label: "Quinta-feira", value: 4 },
  { short: "S", label: "Sexta-feira", value: 5 },
  { short: "S", label: "Sábado", value: 6 },
];

function configsMatch(a: RecurrenceConfig, b: RecurrenceConfig) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function RecurrenceEditor({
  enabled,
  value,
  startDate,
  editingSeries = false,
  onEnabledChange,
  onChange,
}: RecurrenceEditorProps) {
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [customOpen, setCustomOpen] = React.useState(false);

  return (
    <>
      <div
        className={cn(
          "overflow-hidden rounded-xl border transition-colors",
          enabled ? "border-primary/30 bg-primary-soft/45" : "border-border bg-card"
        )}
      >
        <div className="flex items-center gap-3 p-3">
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
              enabled ? "bg-primary text-primary-foreground" : "bg-surface text-muted"
            )}
          >
            <Repeat2 size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">Recorrente</span>
            <span className="block text-xs text-muted">
              Repita esta {editingSeries ? "série" : "movimentação"} automaticamente
            </span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label="Ativar recorrência"
            onClick={() => onEnabledChange(!enabled)}
            className={cn(
              "relative h-7 w-12 shrink-0 rounded-full p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              enabled ? "bg-primary" : "bg-border-strong"
            )}
          >
            <span
              className={cn(
                "block h-6 w-6 rounded-full bg-white shadow-sm transition-transform",
                enabled && "translate-x-5"
              )}
            />
          </button>
        </div>

        {enabled ? (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="flex w-full items-center gap-3 border-t border-primary/15 px-3 py-3 text-left transition-colors hover:bg-primary-soft/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40"
          >
            <CalendarClock size={17} className="ml-1 shrink-0 text-primary" />
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-medium text-muted">Periodicidade</span>
              <span className="block truncate text-sm font-semibold">
                {getRecurrenceSummary(value)}
              </span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-muted" />
          </button>
        ) : null}
      </div>

      {editingSeries && enabled ? (
        <p className="-mt-2 text-xs text-muted">
          Valor, descrição e repetição valem para este e os próximos. O status vale só para este.
        </p>
      ) : null}

      <Modal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Repetição"
        className="sm:max-w-sm"
      >
        <div className="-mx-2 space-y-0.5">
          <button
            type="button"
            onClick={() => {
              onEnabledChange(false);
              setPickerOpen(false);
            }}
            className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-medium hover:bg-surface"
          >
            Nunca
            {!enabled ? <Check size={18} className="text-primary" /> : null}
          </button>
          <div className="my-2 border-t border-border" />
          {PRESETS.map((preset) => {
            const presetConfig = recurrenceFromPreset(preset.value, startDate);
            const selected = enabled && configsMatch(value, presetConfig);
            return (
              <button
                key={preset.value}
                type="button"
                onClick={() => {
                  onChange(presetConfig);
                  onEnabledChange(true);
                  setPickerOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-surface",
                  selected && "bg-primary-soft font-semibold text-primary"
                )}
              >
                {preset.label}
                {selected ? <Check size={18} /> : null}
              </button>
            );
          })}
          <div className="my-2 border-t border-border" />
          <button
            type="button"
            onClick={() => setCustomOpen(true)}
            className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-medium hover:bg-surface"
          >
            Personalizada
            <ChevronRight size={18} className="text-muted" />
          </button>
        </div>
      </Modal>

      {customOpen ? (
        <CustomRecurrenceModal
          key={`${value.frequency}-${value.interval}-${getRecurrenceSummary(value)}`}
          value={enabled ? value : defaultCustomRecurrence(startDate)}
          startDate={startDate}
          onClose={() => setCustomOpen(false)}
          onConfirm={(nextValue) => {
            onChange(nextValue);
            onEnabledChange(true);
            setCustomOpen(false);
            setPickerOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

function CustomRecurrenceModal({
  value,
  startDate,
  onClose,
  onConfirm,
}: {
  value: RecurrenceConfig;
  startDate: string;
  onClose: () => void;
  onConfirm: (value: RecurrenceConfig) => void;
}) {
  const [draft, setDraft] = React.useState<RecurrenceConfig>(() => ({
    ...value,
    week_days: value.week_days ? [...value.week_days] : undefined,
    month_days: value.month_days ? [...value.month_days] : undefined,
  }));
  const start = parseISODate(startDate);

  function changeFrequency(frequency: RecurrenceFrequency) {
    const interval = Math.max(1, draft.interval || 1);
    if (frequency === "daily") setDraft({ frequency, interval });
    if (frequency === "weekly") {
      setDraft({ frequency, interval, week_days: [start.getDay()] });
    }
    if (frequency === "monthly") {
      setDraft({
        frequency,
        interval,
        month_mode: "days",
        month_days: [start.getDate()],
      });
    }
    if (frequency === "yearly") setDraft({ frequency, interval });
  }

  const intervalUnit = {
    daily: draft.interval === 1 ? "dia" : "dias",
    weekly: draft.interval === 1 ? "semana" : "semanas",
    monthly: draft.interval === 1 ? "mês" : "meses",
    yearly: draft.interval === 1 ? "ano" : "anos",
  }[draft.frequency];

  const valid =
    draft.frequency !== "weekly" || (draft.week_days?.length ?? 0) > 0;
  const monthlyValid =
    draft.frequency !== "monthly" ||
    draft.month_mode === "ordinal" ||
    (draft.month_days?.length ?? 0) > 0;

  return (
    <Modal open onClose={onClose} title="Repetição personalizada" className="sm:max-w-md">
      <div className="space-y-5">
        <div>
          <Label htmlFor="recurrence-frequency">Frequência</Label>
          <Select
            id="recurrence-frequency"
            value={draft.frequency}
            onChange={(event) => changeFrequency(event.target.value as RecurrenceFrequency)}
          >
            <option value="daily">Diariamente</option>
            <option value="weekly">Semanalmente</option>
            <option value="monthly">Mensalmente</option>
            <option value="yearly">Anualmente</option>
          </Select>
        </div>

        <div>
          <Label htmlFor="recurrence-interval">Intervalo</Label>
          <div className="flex items-center gap-2 text-sm text-muted">
            <span>A cada</span>
            <Input
              id="recurrence-interval"
              type="number"
              inputMode="numeric"
              min={1}
              max={365}
              value={draft.interval}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  interval: Math.max(1, Math.min(365, Number(event.target.value) || 1)),
                }))
              }
              className="w-20 text-center font-semibold tabular-nums"
            />
            <span>{intervalUnit}</span>
          </div>
        </div>

        {draft.frequency === "weekly" ? (
          <div>
            <Label>Dias da semana</Label>
            <div className="grid grid-cols-7 gap-1.5">
              {WEEK_DAYS.map((day) => {
                const selected = draft.week_days?.includes(day.value) ?? false;
                return (
                  <button
                    key={day.value}
                    type="button"
                    title={day.label}
                    aria-label={day.label}
                    aria-pressed={selected}
                    onClick={() =>
                      setDraft((current) => {
                        const days = current.week_days ?? [];
                        return {
                          ...current,
                          week_days: selected
                            ? days.filter((value) => value !== day.value)
                            : [...days, day.value].sort(),
                        };
                      })
                    }
                    className={cn(
                      "aspect-square rounded-xl border text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border-strong bg-card text-muted hover:bg-surface"
                    )}
                  >
                    {day.short}
                  </button>
                );
              })}
            </div>
            {!valid ? <p className="mt-2 text-xs text-expense">Escolha ao menos um dia.</p> : null}
          </div>
        ) : null}

        {draft.frequency === "monthly" ? (
          <MonthlyOptions draft={draft} setDraft={setDraft} />
        ) : null}

        <div className="rounded-xl bg-surface px-3 py-2.5 text-sm">
          <span className="text-muted">Resumo: </span>
          <span className="font-semibold">{getRecurrenceSummary(draft)}</span>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={!valid || !monthlyValid}
            onClick={() => onConfirm(draft)}
          >
            Confirmar
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function MonthlyOptions({
  draft,
  setDraft,
}: {
  draft: RecurrenceConfig;
  setDraft: React.Dispatch<React.SetStateAction<RecurrenceConfig>>;
}) {
  const mode = draft.month_mode ?? "days";

  return (
    <div className="space-y-4">
      <div>
        <button
          type="button"
          onClick={() => setDraft((current) => ({ ...current, month_mode: "days" }))}
          className="mb-2 flex items-center gap-2 rounded-lg text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Radio active={mode === "days"} /> Em cada dia
        </button>
        <div className={cn("grid grid-cols-7 gap-1", mode !== "days" && "opacity-45")}>
          {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => {
            const selected = draft.month_days?.includes(day) ?? false;
            return (
              <button
                key={day}
                type="button"
                disabled={mode !== "days"}
                aria-pressed={selected}
                onClick={() =>
                  setDraft((current) => {
                    const days = current.month_days ?? [];
                    return {
                      ...current,
                      month_days: selected
                        ? days.filter((value) => value !== day)
                        : [...days, day].sort((a, b) => a - b),
                    };
                  })
                }
                className={cn(
                  "flex aspect-square items-center justify-center rounded-lg border text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted hover:bg-surface"
                )}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={() =>
            setDraft((current) => ({
              ...current,
              month_mode: "ordinal",
              month_ordinal: current.month_ordinal ?? 1,
              month_ordinal_target: current.month_ordinal_target ?? "day",
            }))
          }
          className="mb-2 flex items-center gap-2 rounded-lg text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Radio active={mode === "ordinal"} /> Em uma posição do mês
        </button>
        <div className={cn("grid grid-cols-2 gap-2", mode !== "ordinal" && "opacity-45")}>
          <Select
            aria-label="Posição no mês"
            disabled={mode !== "ordinal"}
            value={draft.month_ordinal ?? 1}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                month_ordinal: Number(event.target.value) as 1 | 2 | 3 | 4 | -1,
              }))
            }
          >
            <option value={1}>Primeiro</option>
            <option value={2}>Segundo</option>
            <option value={3}>Terceiro</option>
            <option value={4}>Quarto</option>
            <option value={-1}>Último</option>
          </Select>
          <Select
            aria-label="Dia de referência"
            disabled={mode !== "ordinal"}
            value={String(draft.month_ordinal_target ?? "day")}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                month_ordinal_target: parseOrdinalTarget(event.target.value),
              }))
            }
          >
            <option value="day">Dia</option>
            <option value="weekday">Dia útil</option>
            <option value="weekend">Sábado ou domingo</option>
            {WEEK_DAYS.map((day) => (
              <option key={day.value} value={day.value}>
                {day.label}
              </option>
            ))}
          </Select>
        </div>
      </div>
    </div>
  );
}

function Radio({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "flex h-4 w-4 items-center justify-center rounded-full border",
        active ? "border-primary bg-primary" : "border-border-strong bg-card"
      )}
      aria-hidden="true"
    >
      {active ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
    </span>
  );
}

function parseOrdinalTarget(value: string): MonthlyOrdinalTarget {
  if (["day", "weekday", "weekend"].includes(value)) {
    return value as MonthlyOrdinalTarget;
  }
  return Number(value) as MonthlyOrdinalTarget;
}
