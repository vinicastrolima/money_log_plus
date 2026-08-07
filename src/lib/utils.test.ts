import { describe, expect, it } from "vitest";
import {
  cn,
  daysInMonth,
  formatCurrency,
  formatDateBR,
  MONTH_NAMES_PT,
  parseISODate,
  toISODate,
  WEEKDAYS_PT,
} from "./utils";

describe("cn", () => {
  it("mescla classes e resolve conflitos do Tailwind", () => {
    expect(cn("px-2", "px-4", false && "hidden")).toBe("px-4");
  });
});

describe("formatCurrency", () => {
  it("formata em BRL", () => {
    expect(formatCurrency(1234.5)).toMatch(/R\$\s*1\.234,50/);
  });

  it("mascara valor quando hidden=true", () => {
    expect(formatCurrency(99, true)).toBe("***");
  });
});

describe("parseISODate / toISODate", () => {
  it("parseia YYYY-MM-DD em data local sem shift de fuso", () => {
    const d = parseISODate("2026-08-10");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(7);
    expect(d.getDate()).toBe(10);
  });

  it("serializa Date local para YYYY-MM-DD", () => {
    expect(toISODate(new Date(2026, 7, 6))).toBe("2026-08-06");
  });

  it("é round-trip estável", () => {
    expect(toISODate(parseISODate("2026-02-28"))).toBe("2026-02-28");
  });
});

describe("formatDateBR", () => {
  it("formata string ISO em pt-BR", () => {
    expect(formatDateBR("2026-08-10")).toBe("10/08/2026");
  });

  it("aceita Date", () => {
    expect(formatDateBR(new Date(2026, 0, 5))).toBe("05/01/2026");
  });
});

describe("daysInMonth", () => {
  it("retorna 31 para janeiro e 28/29 para fevereiro", () => {
    expect(daysInMonth(2026, 0)).toBe(31);
    expect(daysInMonth(2026, 1)).toBe(28);
    expect(daysInMonth(2024, 1)).toBe(29);
  });
});

describe("constantes PT", () => {
  it("tem 12 meses e 7 dias da semana", () => {
    expect(MONTH_NAMES_PT).toHaveLength(12);
    expect(WEEKDAYS_PT).toHaveLength(7);
    expect(MONTH_NAMES_PT[7]).toBe("Agosto");
  });
});
