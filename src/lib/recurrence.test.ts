import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  alignRecurrenceWithDate,
  buildRecurrenceDates,
  defaultCustomRecurrence,
  getRecurrenceHorizon,
  getRecurrenceSummary,
  nextDate,
  recurrenceFromPreset,
  RECURRENCE_HORIZON_MONTHS,
} from "./recurrence";

describe("recurrenceFromPreset", () => {
  it("gera configs dos presets principais", () => {
    expect(recurrenceFromPreset("daily", "2026-08-06")).toEqual({
      frequency: "daily",
      interval: 1,
    });
    expect(recurrenceFromPreset("weekdays", "2026-08-06").week_days).toEqual([
      1, 2, 3, 4, 5,
    ]);
    expect(recurrenceFromPreset("weekends", "2026-08-06").week_days).toEqual([
      0, 6,
    ]);
    expect(recurrenceFromPreset("weekly", "2026-08-06")).toMatchObject({
      frequency: "weekly",
      week_days: [4], // quinta
    });
    expect(recurrenceFromPreset("biweekly", "2026-08-06").interval).toBe(2);
    expect(recurrenceFromPreset("monthly", "2026-08-06")).toMatchObject({
      frequency: "monthly",
      month_days: [6],
    });
    expect(recurrenceFromPreset("quarterly", "2026-08-06").interval).toBe(3);
    expect(recurrenceFromPreset("semiannual", "2026-08-06").interval).toBe(6);
    expect(recurrenceFromPreset("yearly", "2026-08-06")).toEqual({
      frequency: "yearly",
      interval: 1,
    });
  });

  it("defaultCustomRecurrence usa weekly", () => {
    expect(defaultCustomRecurrence("2026-08-06").frequency).toBe("weekly");
  });
});

describe("alignRecurrenceWithDate", () => {
  it("realinha weekday único ao mudar a data", () => {
    const config = recurrenceFromPreset("weekly", "2026-08-06");
    const next = alignRecurrenceWithDate(config, "2026-08-06", "2026-08-07");
    expect(next.week_days).toEqual([5]);
  });

  it("realinha dia do mês único", () => {
    const config = recurrenceFromPreset("monthly", "2026-08-06");
    const next = alignRecurrenceWithDate(config, "2026-08-06", "2026-08-15");
    expect(next.month_days).toEqual([15]);
  });

  it("não altera configs com múltiplos dias", () => {
    const config = recurrenceFromPreset("weekdays", "2026-08-06");
    expect(alignRecurrenceWithDate(config, "2026-08-06", "2026-08-07")).toEqual(
      config
    );
  });
});

describe("getRecurrenceSummary", () => {
  it("resume cadências comuns em português", () => {
    expect(getRecurrenceSummary({ frequency: "daily", interval: 1 })).toBe(
      "Diariamente"
    );
    expect(
      getRecurrenceSummary({
        frequency: "weekly",
        interval: 1,
        week_days: [1, 2, 3, 4, 5],
      })
    ).toBe("Dias úteis");
    expect(
      getRecurrenceSummary({
        frequency: "weekly",
        interval: 2,
        week_days: [1],
      })
    ).toContain("Quinzenalmente");
    expect(
      getRecurrenceSummary({
        frequency: "monthly",
        interval: 1,
        month_mode: "days",
        month_days: [10],
      })
    ).toBe("Mensalmente · dia 10");
    expect(
      getRecurrenceSummary({
        frequency: "monthly",
        interval: 1,
        month_mode: "ordinal",
        month_ordinal: 1,
        month_ordinal_target: 1,
      })
    ).toContain("primeiro");
    expect(getRecurrenceSummary({ frequency: "yearly", interval: 1 })).toBe(
      "Anualmente"
    );
  });
});

describe("buildRecurrenceDates", () => {
  it("gera datas diárias no intervalo", () => {
    expect(
      buildRecurrenceDates("2026-08-01", "2026-08-03", {
        frequency: "daily",
        interval: 1,
      })
    ).toEqual(["2026-08-01", "2026-08-02", "2026-08-03"]);
  });

  it("gera mensal no mesmo dia", () => {
    expect(
      buildRecurrenceDates("2026-01-15", "2026-04-15", {
        frequency: "monthly",
        interval: 1,
        month_mode: "days",
        month_days: [15],
      })
    ).toEqual(["2026-01-15", "2026-02-15", "2026-03-15", "2026-04-15"]);
  });

  it("ajusta dia 31 para o último dia do mês curto", () => {
    expect(
      buildRecurrenceDates("2026-01-31", "2026-03-31", {
        frequency: "monthly",
        interval: 1,
        month_mode: "days",
        month_days: [31],
      })
    ).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
  });

  it("gera ordinal (primeiro dia útil)", () => {
    const dates = buildRecurrenceDates("2026-08-01", "2026-08-31", {
      frequency: "monthly",
      interval: 1,
      month_mode: "ordinal",
      month_ordinal: 1,
      month_ordinal_target: "weekday",
    });
    expect(dates).toContain("2026-08-03");
  });
});

describe("getRecurrenceHorizon / nextDate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 6));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("usa o máximo entre start+horizonte e hoje+horizonte", () => {
    const horizon = getRecurrenceHorizon("2026-01-01");
    expect(horizon).toBe("2028-02-06");
    expect(RECURRENCE_HORIZON_MONTHS).toBe(18);
  });

  it("nextDate avança um dia", () => {
    expect(nextDate("2026-08-31")).toBe("2026-09-01");
  });
});
