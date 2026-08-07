import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { syncCreditCardTransactions } from "./card-sync";
import { makeCard, makePurchase } from "./test-fixtures";

type QueryResult = { data: unknown; error: null | { message: string } };

function createMockSupabase(existingRows: { date: string; status: string }[] = []) {
  const deleted: unknown[] = [];
  const inserted: unknown[] = [];

  const from = vi.fn(() => {
    const state: {
      filters: Record<string, unknown>;
      op: "select" | "delete" | "insert" | null;
    } = { filters: {}, op: null };

    const builder: Record<string, unknown> = {};
    const chain = () => builder;

    builder.select = vi.fn((cols?: string) => {
      state.op = "select";
      void cols;
      return builder;
    });
    builder.delete = vi.fn(() => {
      state.op = "delete";
      return builder;
    });
    builder.insert = vi.fn((rows: unknown) => {
      state.op = "insert";
      inserted.push(rows);
      return Promise.resolve({ data: rows, error: null } satisfies QueryResult);
    });
    builder.eq = vi.fn((col: string, val: unknown) => {
      state.filters[col] = val;
      return builder;
    });
    builder.gte = vi.fn((col: string, val: unknown) => {
      state.filters[`gte:${col}`] = val;
      if (state.op === "select") {
        return Promise.resolve({
          data: existingRows,
          error: null,
        } satisfies QueryResult);
      }
      if (state.op === "delete") {
        deleted.push({ ...state.filters, gte: { [col]: val } });
        return Promise.resolve({ data: null, error: null } satisfies QueryResult);
      }
      return builder;
    });

    return builder;
  });

  return {
    supabase: { from } as never,
    deleted,
    inserted,
    from,
  };
}

describe("syncCreditCardTransactions", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 6, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("recria faturas futuras e preserva status concluido", async () => {
    const { supabase, inserted } = createMockSupabase([
      { date: "2026-09-10", status: "concluido" },
    ]);
    const card = makeCard();
    const purchases = [
      makePurchase({
        purchase_date: "2026-08-06",
        total_amount: 100,
        installments: 2,
      }),
    ];

    await syncCreditCardTransactions(
      supabase,
      card,
      purchases,
      [],
      "cat-cartao",
      "user-1"
    );

    expect(inserted).toHaveLength(1);
    const rows = inserted[0] as Array<{
      date: string;
      status: string;
      credit_card_id: string;
      description: string;
    }>;
    expect(rows.every((r) => r.credit_card_id === card.id)).toBe(true);
    expect(rows.every((r) => r.description === card.name)).toBe(true);

    const sept = rows.find((r) => r.date === "2026-09-10");
    const oct = rows.find((r) => r.date === "2026-10-10");
    expect(sept?.status).toBe("concluido");
    expect(oct?.status).toBe("pendente");
  });

  it("não insere quando não há faturas futuras", async () => {
    const { supabase, inserted } = createMockSupabase();
    await syncCreditCardTransactions(
      supabase,
      makeCard(),
      [],
      [],
      "cat-cartao",
      "user-1"
    );
    expect(inserted).toHaveLength(0);
  });
});
