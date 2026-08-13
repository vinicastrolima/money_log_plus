import { describe, expect, it } from "vitest";
import {
  aggregateByDueDate,
  allCardsOpenTotal,
  allInstallmentLines,
  cardAvailableLimit,
  cardClosingDay,
  cardGradient,
  cardInvoiceStatusByDate,
  cardNextPayment,
  cardOpenTotals,
  cardPaymentStatsInMonth,
  creditCardGradient,
  defaultClosingDay,
  dueDateInMonth,
  firstPaymentDate,
  installmentLinesForList,
  installmentsForPurchaseWithCard,
  installmentsForSubscription,
  invoiceDateKey,
  invoiceDueDateForPurchase,
  invoiceNetTotal,
  paymentsByMonthRange,
  prepaymentTotalForDueDate,
  spendingByCategoryInMonth,
  splitInstallments,
} from "./cards";
import {
  makeCard,
  makeCategory,
  makePrepayment,
  makePurchase,
  makeSubscription,
  makeTransaction,
} from "./test-fixtures";
import { toISODate } from "./utils";

describe("dueDateInMonth / firstPaymentDate / closing", () => {
  it("ajusta dia 31 para o último dia do mês", () => {
    const d = dueDateInMonth(2026, 1, 31);
    expect(d.getDate()).toBe(28);
  });

  it("firstPaymentDate usa o próximo vencimento após a compra", () => {
    expect(toISODate(firstPaymentDate("2026-08-05", 10))).toBe("2026-08-10");
    expect(toISODate(firstPaymentDate("2026-08-10", 10))).toBe("2026-09-10");
  });

  it("defaultClosingDay fica ~7 dias antes do vencimento", () => {
    expect(defaultClosingDay(10)).toBe(3);
    expect(cardClosingDay(makeCard({ closing_day: null }))).toBe(3);
    expect(cardClosingDay(makeCard({ closing_day: 27 }))).toBe(27);
  });
});

describe("invoiceDueDateForPurchase", () => {
  it("compra antes do fechamento entra na fatura do mês", () => {
    // C6: fecha 3, vence 10 — compra em 02/08 fecha na fatura 10/08
    expect(toISODate(invoiceDueDateForPurchase("2026-08-02", 10, 3))).toBe(
      "2026-08-10"
    );
  });

  it("compra depois do fechamento vai para a próxima fatura", () => {
    expect(toISODate(invoiceDueDateForPurchase("2026-08-06", 10, 3))).toBe(
      "2026-09-10"
    );
  });

  it("cartão com fechamento após vencimento (Nubank 27/3)", () => {
    // Compra 15/07 (antes do fechamento 27) → fatura 03/08
    expect(toISODate(invoiceDueDateForPurchase("2026-07-15", 3, 27))).toBe(
      "2026-08-03"
    );
    // Compra 28/07 (após fechamento 27) → fatura 03/09
    expect(toISODate(invoiceDueDateForPurchase("2026-07-28", 3, 27))).toBe(
      "2026-09-03"
    );
  });
});

describe("splitInstallments / prepayments", () => {
  it("divide e joga centavos na última parcela", () => {
    expect(splitInstallments(100, 3)).toEqual([33.33, 33.33, 33.34]);
    expect(splitInstallments(100, 3).reduce((a, b) => a + b, 0)).toBeCloseTo(
      100,
      2
    );
  });

  it("invoiceNetTotal não fica negativo", () => {
    expect(invoiceNetTotal(100, 40)).toBe(60);
    expect(invoiceNetTotal(100, 150)).toBe(0);
  });

  it("prepaymentTotalForDueDate soma só o cartão/vencimento certo", () => {
    const total = prepaymentTotalForDueDate(
      [
        makePrepayment({ amount: 40, invoice_due_date: "2026-09-10" }),
        makePrepayment({
          id: "p2",
          amount: 10,
          invoice_due_date: "2026-09-10",
        }),
        makePrepayment({
          id: "p3",
          amount: 99,
          invoice_due_date: "2026-10-10",
        }),
      ],
      "card-1",
      "2026-09-10"
    );
    expect(total).toBe(50);
  });
});

describe("installmentsForPurchaseWithCard", () => {
  it("gera N parcelas a partir da fatura correta", () => {
    const card = makeCard();
    const lines = installmentsForPurchaseWithCard(
      makePurchase({
        total_amount: 300,
        installments: 3,
        purchase_date: "2026-08-06",
      }),
      card
    );
    expect(lines).toHaveLength(3);
    expect(lines.map((l) => l.dueDate)).toEqual([
      "2026-09-10",
      "2026-10-10",
      "2026-11-10",
    ]);
    expect(lines.map((l) => l.amount)).toEqual([100, 100, 100]);
  });

  it("aggregateByDueDate abate antecipações do total líquido", () => {
    const card = makeCard();
    const aggs = aggregateByDueDate(
      [
        makePurchase({
          purchase_date: "2026-08-06",
          total_amount: 100,
          installments: 1,
        }),
      ],
      card,
      [],
      [makePrepayment({ invoice_due_date: "2026-09-10", amount: 40 })]
    );
    const sept = aggs.find((a) => a.dueDate === "2026-09-10");
    expect(sept?.grossTotal).toBe(100);
    expect(sept?.prepaidTotal).toBe(40);
    expect(sept?.total).toBe(60);
  });
});

describe("subscriptions + aggregate", () => {
  it("assinatura inativa não gera linhas", () => {
    expect(
      installmentsForSubscription(
        makeSubscription({ active: false }),
        makeCard(),
        3
      )
    ).toEqual([]);
  });

  it("aggregateByDueDate soma compra + assinatura no mesmo vencimento", () => {
    const card = makeCard();
    const aggs = aggregateByDueDate(
      [
        makePurchase({
          purchase_date: "2026-08-06",
          total_amount: 70,
          installments: 1,
        }),
      ],
      card,
      [
        makeSubscription({
          start_date: "2026-08-06",
          amount: 30,
        }),
      ]
    );
    const sept = aggs.find((a) => a.dueDate === "2026-09-10");
    expect(sept?.total).toBe(100);
    expect(sept?.lines).toHaveLength(2);
  });

  it("allInstallmentLines ignora assinatura de outro cartão", () => {
    const lines = allInstallmentLines(
      [],
      [makeSubscription({ credit_card_id: "other", amount: 99 })],
      makeCard(),
    );
    expect(lines).toHaveLength(0);
  });
});

describe("fatura paga libera limite e avança próxima fatura", () => {
  const card = makeCard({ credit_limit: 1124 });
  const purchases = [
    makePurchase({
      id: "p-aug",
      purchase_date: "2026-07-15",
      total_amount: 900,
      installments: 1,
    }),
    makePurchase({
      id: "p-sep",
      purchase_date: "2026-08-15",
      total_amount: 200,
      installments: 1,
    }),
  ];
  const today = new Date(2026, 7, 6);

  it("cardInvoiceStatusByDate normaliza ISO datetime", () => {
    const map = cardInvoiceStatusByDate(
      [
        makeTransaction({
          date: "2026-08-10T00:00:00.000Z",
          status: "concluido",
        }),
      ],
      card.id
    );
    expect(invoiceDateKey("2026-08-10T12:00:00Z")).toBe("2026-08-10");
    expect(map.get("2026-08-10")).toBe("concluido");
  });

  it("antes de pagar, próxima fatura é a de agosto e limite fica baixo", () => {
    const open = cardOpenTotals(purchases, card, today);
    const next = cardNextPayment(purchases, card, [], today);
    expect(next?.dueDate).toBe("2026-08-10");
    expect(open.total).toBe(1100);
    expect(cardAvailableLimit(card.credit_limit, open.total)).toBe(24);
  });

  it("ao marcar agosto como concluido, libera limite e mostra setembro", () => {
    const status = cardInvoiceStatusByDate(
      [
        makeTransaction({ date: "2026-08-10", status: "concluido" }),
        makeTransaction({
          id: "tx-2",
          date: "2026-09-10",
          status: "pendente",
        }),
      ],
      card.id
    );
    const open = cardOpenTotals(purchases, card, today, status);
    const next = cardNextPayment(purchases, card, [], today, status);
    expect(next?.dueDate).toBe("2026-09-10");
    expect(next?.total).toBe(200);
    expect(open.total).toBe(200);
    expect(cardAvailableLimit(1124, open.total)).toBe(924);
  });

  it("fatura vencida só entra em aberto se pendente/atrasada", () => {
    const pastToday = new Date(2026, 7, 15);
    const unpaid = cardOpenTotals(
      purchases,
      card,
      pastToday,
      cardInvoiceStatusByDate(
        [makeTransaction({ date: "2026-08-10", status: "atrasado" })],
        card.id
      )
    );
    const paid = cardOpenTotals(
      purchases,
      card,
      pastToday,
      cardInvoiceStatusByDate(
        [makeTransaction({ date: "2026-08-10", status: "concluido" })],
        card.id
      )
    );
    expect(unpaid.total).toBeGreaterThan(paid.total);
    expect(paid.total).toBe(200);
  });

  it("cardAvailableLimit nunca fica negativo e null sem limite", () => {
    expect(cardAvailableLimit(null, 10)).toBeNull();
    expect(cardAvailableLimit(100, 250)).toBe(0);
  });

  it("allCardsOpenTotal soma cartões", () => {
    const cards = [card, makeCard({ id: "card-2", credit_limit: 500 })];
    const allPurchases = [
      ...purchases,
      makePurchase({
        id: "p2",
        credit_card_id: "card-2",
        purchase_date: "2026-08-15",
        total_amount: 50,
      }),
    ];
    expect(allCardsOpenTotal(allPurchases, cards, today)).toBe(1150);
  });
});

describe("stats / charts helpers", () => {
  const card = makeCard();
  const food = makeCategory({ id: "food", name: "Alimentação" });
  const purchases = [
    makePurchase({
      purchase_date: "2026-08-06",
      total_amount: 120,
      category_id: food.id,
      installments: 1,
    }),
  ];

  it("cardPaymentStatsInMonth conta parcelas do mês", () => {
    const stats = cardPaymentStatsInMonth(purchases, [card], 2026, 8);
    expect(stats.total).toBe(120);
    expect(stats.purchaseCount).toBe(1);
    expect(stats.installmentCount).toBe(1);
  });

  it("spendingByCategoryInMonth agrupa por categoria", () => {
    const rows = spendingByCategoryInMonth(
      purchases,
      [card],
      [food],
      2026,
      8
    );
    expect(rows[0]).toMatchObject({ name: "Alimentação", total: 120 });
  });

  it("paymentsByMonthRange gera pontos mensais", () => {
    const points = paymentsByMonthRange(purchases, [card], 2026, 8, 2);
    expect(points).toHaveLength(2);
    expect(points[0].key).toBe("2026-09");
    expect(points[0].total).toBe(120);
  });

  it("installmentLinesForList filtra por mês e cartão", () => {
    const lines = installmentLinesForList(
      purchases,
      [card],
      [],
      card.id,
      { kind: "month", year: 2026, month0: 8 }
    );
    expect(lines).toHaveLength(1);
    expect(lines[0].cardName).toBe("C6 Bank");
  });
});

describe("antecipação de fatura", () => {
  const card = makeCard();
  const purchases = [
    makePurchase({
      purchase_date: "2026-08-06",
      total_amount: 100,
      installments: 1,
    }),
  ];
  const today = new Date(2026, 7, 20);

  it("reduz próxima fatura e em aberto", () => {
    const prepayments = [
      makePrepayment({ invoice_due_date: "2026-09-10", amount: 40 }),
    ];
    const next = cardNextPayment(purchases, card, [], today, undefined, prepayments);
    const open = cardOpenTotals(purchases, card, today, undefined, prepayments);
    expect(next?.grossTotal).toBe(100);
    expect(next?.total).toBe(60);
    expect(open.total).toBe(60);
  });

  it("fatura 100% antecipada deixa de ser a próxima", () => {
    const prepayments = [
      makePrepayment({ invoice_due_date: "2026-09-10", amount: 100 }),
    ];
    const next = cardNextPayment(purchases, card, [], today, undefined, prepayments);
    expect(next).toBeNull();
    expect(
      cardOpenTotals(purchases, card, today, undefined, prepayments).total
    ).toBe(0);
  });
});

describe("gradientes", () => {
  it("cardGradient e creditCardGradient usam fallback/cores do cartão", () => {
    expect(cardGradient(0)[0]).toBe("#262626");
    expect(cardGradient(-1)[0]).toBeTruthy();
    expect(
      creditCardGradient(makeCard({ color_start: "#fff", color_end: "#000" }), 0)
    ).toEqual(["#fff", "#000"]);
  });
});
