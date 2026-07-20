import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  differenceInCalendarMonths,
  differenceInCalendarWeeks,
  differenceInCalendarYears,
  endOfMonth,
  isAfter,
} from "date-fns";
import type {
  MonthlyOrdinalTarget,
  RecurrenceConfig,
} from "./types";
import { parseISODate, toISODate } from "./utils";

export type RecurrencePreset =
  | "daily"
  | "weekdays"
  | "weekends"
  | "weekly"
  | "biweekly"
  | "monthly"
  | "quarterly"
  | "semiannual"
  | "yearly";

export const RECURRENCE_HORIZON_MONTHS = 18;

const WEEKDAY_NAMES = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];

const ORDINAL_NAMES: Record<1 | 2 | 3 | 4 | -1, string> = {
  1: "primeiro",
  2: "segundo",
  3: "terceiro",
  4: "quarto",
  [-1]: "último",
};

function sortedUnique(values: number[]) {
  return [...new Set(values)].sort((a, b) => a - b);
}

export function recurrenceFromPreset(
  preset: RecurrencePreset,
  startDate: string
): RecurrenceConfig {
  const start = parseISODate(startDate);
  const weekday = start.getDay();
  const day = start.getDate();

  switch (preset) {
    case "daily":
      return { frequency: "daily", interval: 1 };
    case "weekdays":
      return { frequency: "weekly", interval: 1, week_days: [1, 2, 3, 4, 5] };
    case "weekends":
      return { frequency: "weekly", interval: 1, week_days: [0, 6] };
    case "weekly":
      return { frequency: "weekly", interval: 1, week_days: [weekday] };
    case "biweekly":
      return { frequency: "weekly", interval: 2, week_days: [weekday] };
    case "monthly":
      return {
        frequency: "monthly",
        interval: 1,
        month_mode: "days",
        month_days: [day],
      };
    case "quarterly":
      return {
        frequency: "monthly",
        interval: 3,
        month_mode: "days",
        month_days: [day],
      };
    case "semiannual":
      return {
        frequency: "monthly",
        interval: 6,
        month_mode: "days",
        month_days: [day],
      };
    case "yearly":
      return { frequency: "yearly", interval: 1 };
  }
}

export function defaultCustomRecurrence(startDate: string): RecurrenceConfig {
  return recurrenceFromPreset("weekly", startDate);
}

export function alignRecurrenceWithDate(
  config: RecurrenceConfig,
  previousDate: string,
  nextDate: string
): RecurrenceConfig {
  const previous = parseISODate(previousDate);
  const next = parseISODate(nextDate);

  if (
    config.frequency === "weekly" &&
    config.week_days?.length === 1 &&
    config.week_days[0] === previous.getDay()
  ) {
    return { ...config, week_days: [next.getDay()] };
  }

  if (
    config.frequency === "monthly" &&
    (config.month_mode ?? "days") === "days" &&
    config.month_days?.length === 1 &&
    config.month_days[0] === previous.getDate()
  ) {
    return { ...config, month_days: [next.getDate()] };
  }

  return config;
}

function ordinalTargetLabel(target: MonthlyOrdinalTarget) {
  if (typeof target === "number") return WEEKDAY_NAMES[target];
  if (target === "weekday") return "dia útil";
  if (target === "weekend") return "dia do fim de semana";
  return "dia";
}

function pluralizeInterval(
  interval: number,
  singular: string,
  plural: string
) {
  return interval === 1 ? `A cada ${singular}` : `A cada ${interval} ${plural}`;
}

export function getRecurrenceSummary(config: RecurrenceConfig): string {
  const interval = Math.max(1, config.interval || 1);

  if (config.frequency === "daily") {
    return interval === 1 ? "Diariamente" : pluralizeInterval(interval, "dia", "dias");
  }

  if (config.frequency === "weekly") {
    const weekdays = sortedUnique(config.week_days ?? []);
    if (interval === 1 && weekdays.join(",") === "1,2,3,4,5") return "Dias úteis";
    if (interval === 1 && weekdays.join(",") === "0,6") return "Fins de semana";
    const cadence =
      interval === 1
        ? "Semanalmente"
        : interval === 2
          ? "Quinzenalmente"
          : `A cada ${interval} semanas`;
    const days = weekdays.map((day) => WEEKDAY_NAMES[day]).join(", ");
    return days ? `${cadence} · ${days}` : cadence;
  }

  if (config.frequency === "monthly") {
    const cadence =
      interval === 1
        ? "Mensalmente"
        : interval === 3
          ? "A cada 3 meses"
          : interval === 6
            ? "A cada 6 meses"
            : `A cada ${interval} meses`;

    if ((config.month_mode ?? "days") === "ordinal") {
      const ordinal = ORDINAL_NAMES[config.month_ordinal ?? 1];
      const target = ordinalTargetLabel(config.month_ordinal_target ?? "day");
      return `${cadence} · ${ordinal} ${target}`;
    }

    const days = sortedUnique(config.month_days ?? []);
    if (!days.length) return cadence;
    return `${cadence} · dia${days.length > 1 ? "s" : ""} ${days.join(", ")}`;
  }

  return interval === 1 ? "Anualmente" : `A cada ${interval} anos`;
}

function matchesOrdinalTarget(date: Date, target: MonthlyOrdinalTarget) {
  if (typeof target === "number") return date.getDay() === target;
  if (target === "weekday") return date.getDay() >= 1 && date.getDay() <= 5;
  if (target === "weekend") return date.getDay() === 0 || date.getDay() === 6;
  return true;
}

function isOrdinalMatch(
  date: Date,
  ordinal: 1 | 2 | 3 | 4 | -1,
  target: MonthlyOrdinalTarget
) {
  if (!matchesOrdinalTarget(date, target)) return false;

  const matchingDays: number[] = [];
  const lastDay = endOfMonth(date).getDate();
  for (let day = 1; day <= lastDay; day += 1) {
    const candidate = new Date(date.getFullYear(), date.getMonth(), day);
    if (matchesOrdinalTarget(candidate, target)) matchingDays.push(day);
  }

  const expected = ordinal === -1 ? matchingDays.at(-1) : matchingDays[ordinal - 1];
  return date.getDate() === expected;
}

function matchesRecurrence(
  date: Date,
  start: Date,
  config: RecurrenceConfig
) {
  const interval = Math.max(1, Math.floor(config.interval || 1));

  if (config.frequency === "daily") {
    return differenceInCalendarDays(date, start) % interval === 0;
  }

  if (config.frequency === "weekly") {
    const weekDifference = differenceInCalendarWeeks(date, start, { weekStartsOn: 0 });
    return (
      weekDifference >= 0 &&
      weekDifference % interval === 0 &&
      (config.week_days ?? [start.getDay()]).includes(date.getDay())
    );
  }

  if (config.frequency === "monthly") {
    const monthDifference = differenceInCalendarMonths(date, start);
    if (monthDifference < 0 || monthDifference % interval !== 0) return false;

    if ((config.month_mode ?? "days") === "ordinal") {
      return isOrdinalMatch(
        date,
        config.month_ordinal ?? 1,
        config.month_ordinal_target ?? "day"
      );
    }

    const lastDay = endOfMonth(date).getDate();
    return (config.month_days ?? [start.getDate()]).some(
      (day) => date.getDate() === Math.min(day, lastDay)
    );
  }

  const yearDifference = differenceInCalendarYears(date, start);
  if (yearDifference < 0 || yearDifference % interval !== 0) return false;
  if (date.getMonth() !== start.getMonth()) return false;
  return date.getDate() === Math.min(start.getDate(), endOfMonth(date).getDate());
}

export function buildRecurrenceDates(
  startDate: string,
  endDate: string,
  config: RecurrenceConfig,
  anchorDate: string = startDate
) {
  const start = parseISODate(startDate);
  const anchor = parseISODate(anchorDate);
  const end = parseISODate(endDate);
  const dates: string[] = [];

  for (let cursor = start, checked = 0; !isAfter(cursor, end); cursor = addDays(cursor, 1)) {
    if (checked > 10000) {
      throw new Error("O período da recorrência é longo demais para ser gerado.");
    }
    if (matchesRecurrence(cursor, anchor, config)) dates.push(toISODate(cursor));
    checked += 1;
  }

  return dates;
}

export function getRecurrenceHorizon(startDate: string) {
  const fromStart = addMonths(parseISODate(startDate), RECURRENCE_HORIZON_MONTHS);
  const fromToday = addMonths(new Date(), RECURRENCE_HORIZON_MONTHS);
  return toISODate(isAfter(fromStart, fromToday) ? fromStart : fromToday);
}

export function nextDate(date: string) {
  return toISODate(addDays(parseISODate(date), 1));
}
