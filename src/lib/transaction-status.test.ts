import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  dominantStatus,
  suggestStatusForDate,
  TX_STATUS,
  TX_STATUS_ORDER,
} from "./transaction-status";

describe("TX_STATUS", () => {
  it("cobre os três status com labels", () => {
    expect(TX_STATUS.concluido.label).toBe("Concluído");
    expect(TX_STATUS.pendente.label).toBe("Pendente");
    expect(TX_STATUS.atrasado.label).toBe("Atrasado");
    expect(TX_STATUS_ORDER).toEqual(["concluido", "pendente", "atrasado"]);
  });
});

describe("dominantStatus", () => {
  it("retorna null para lista vazia", () => {
    expect(dominantStatus([])).toBeNull();
  });

  it("prioriza atrasado > pendente > concluido", () => {
    expect(dominantStatus(["concluido", "pendente"])).toBe("pendente");
    expect(dominantStatus(["concluido", "atrasado", "pendente"])).toBe("atrasado");
    expect(dominantStatus(["concluido"])).toBe("concluido");
  });
});

describe("suggestStatusForDate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 6, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sugere atrasado para datas passadas", () => {
    expect(suggestStatusForDate("2026-08-05")).toBe("atrasado");
  });

  it("sugere pendente para hoje e futuro", () => {
    expect(suggestStatusForDate("2026-08-06")).toBe("pendente");
    expect(suggestStatusForDate("2026-08-10")).toBe("pendente");
  });
});
