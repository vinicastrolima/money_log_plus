import { describe, expect, it } from "vitest";
import {
  computeDailyBudget,
  filterByMonth,
  getExpenseByCategory,
  getExpenseTransactions,
  summarizeMonth,
} from "./budget";
import { makeCategory, makeTransaction } from "./test-fixtures";

describe("summarizeMonth", () => {
  it("soma entradas, saídas e saldo", () => {
    const summary = summarizeMonth([
      makeTransaction({ direction: "in", amount: 1000 }),
      makeTransaction({ direction: "out", amount: 250 }),
      makeTransaction({ id: "tx-2", direction: "out", amount: 50 }),
    ]);
    expect(summary).toEqual({ income: 1000, expense: 300, balance: 700 });
  });
});

describe("filterByMonth", () => {
  it("filtra pelo mês local da data", () => {
    const txs = [
      makeTransaction({ id: "a", date: "2026-07-31" }),
      makeTransaction({ id: "b", date: "2026-08-01" }),
      makeTransaction({ id: "c", date: "2026-08-15" }),
      makeTransaction({ id: "d", date: "2026-09-01" }),
    ];
    expect(filterByMonth(txs, 2026, 7).map((t) => t.id)).toEqual(["b", "c"]);
  });
});

describe("computeDailyBudget", () => {
  it("calcula envelope no mês atual", () => {
    const today = new Date(2026, 7, 10);
    const budget = computeDailyBudget(
      [
        makeTransaction({
          date: "2026-08-02",
          type: "diaria",
          direction: "out",
          amount: 40,
        }),
        makeTransaction({
          id: "tx-2",
          date: "2026-08-05",
          type: "diaria",
          direction: "out",
          amount: 30,
        }),
        makeTransaction({
          id: "tx-3",
          date: "2026-08-01",
          type: "prevista",
          direction: "in",
          amount: 1000,
        }),
      ],
      2026,
      7,
      50,
      today
    );

    expect(budget.daysInMonth).toBe(31);
    expect(budget.daysElapsed).toBe(10);
    expect(budget.daysRemaining).toBe(22);
    expect(budget.spentDaily).toBe(70);
    expect(budget.allowedSoFar).toBe(500);
    expect(budget.envelope).toBe(430);
    expect(budget.available).toBe(930);
  });

  it("trata mês futuro com daysElapsed=0", () => {
    const budget = computeDailyBudget([], 2026, 9, 50, new Date(2026, 7, 6));
    expect(budget.daysElapsed).toBe(0);
    expect(budget.daysRemaining).toBe(31);
  });

  it("trata mês passado como totalmente decorrido", () => {
    const budget = computeDailyBudget(
      [
        makeTransaction({
          date: "2026-07-01",
          type: "diaria",
          direction: "out",
          amount: 20,
        }),
      ],
      2026,
      6,
      50,
      new Date(2026, 7, 6)
    );
    expect(budget.daysElapsed).toBe(31);
    expect(budget.spentDaily).toBe(20);
  });
});

describe("getExpenseByCategory", () => {
  it("agrupa só saídas de categorias de despesa", () => {
    const food = makeCategory({ id: "food", name: "Alimentação" });
    const salary = makeCategory({
      id: "salary",
      name: "Salário",
      kind: "income",
    });
    const totals = getExpenseByCategory(
      [
        makeTransaction({
          amount: 40,
          category_id: food.id,
          direction: "out",
        }),
        makeTransaction({
          id: "tx-2",
          amount: 60,
          category_id: food.id,
          direction: "out",
        }),
        makeTransaction({
          id: "tx-3",
          amount: 1000,
          category_id: salary.id,
          direction: "out",
        }),
        makeTransaction({
          id: "tx-4",
          amount: 500,
          category_id: food.id,
          direction: "in",
        }),
      ],
      [food, salary]
    );

    expect(totals).toHaveLength(1);
    expect(totals[0]).toMatchObject({ name: "Alimentação", total: 100 });
  });

  it("getExpenseTransactions retorna apenas saídas", () => {
    expect(
      getExpenseTransactions([
        makeTransaction({ direction: "in" }),
        makeTransaction({ id: "tx-2", direction: "out" }),
      ])
    ).toHaveLength(1);
  });
});
