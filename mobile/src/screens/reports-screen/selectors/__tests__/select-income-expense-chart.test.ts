import {
  selectIncomeExpenseChartSeries,
  selectUnconvertedTotals,
} from "../select-income-expense-chart";

describe("selectIncomeExpenseChartSeries", () => {
  it("plots a profitable month as positive net aligned with income and expense", () => {
    const chart = selectIncomeExpenseChartSeries(
      "USD",
      [{ date: "2025-09-30", balance: { USD: -4639.7 } }],
      [{ date: "2025-09-30", balance: { USD: 2284.81 } }],
      [{ date: "2025-09-30", balance: { USD: -2354.89 } }],
      "1M",
    );

    expect(chart.months).toEqual(["2025-09"]);
    expect(chart.income).toEqual([4639.7]);
    expect(chart.expense).toEqual([2284.81]);
    expect(chart.net).toEqual([2354.89]);
  });

  it("keeps a loss month below zero without using absolute value", () => {
    const chart = selectIncomeExpenseChartSeries(
      "USD",
      [{ date: "2025-08-31", balance: { USD: -1000 } }],
      [{ date: "2025-08-31", balance: { USD: 1500 } }],
      [{ date: "2025-08-31", balance: { USD: 500 } }],
      "1M",
    );

    expect(chart.income).toEqual([1000]);
    expect(chart.expense).toEqual([1500]);
    expect(chart.net).toEqual([-500]);
  });

  it("keeps zero profit at zero", () => {
    const chart = selectIncomeExpenseChartSeries(
      "USD",
      [{ date: "2025-07-31", balance: { USD: -200 } }],
      [{ date: "2025-07-31", balance: { USD: 200 } }],
      [{ date: "2025-07-31", balance: { USD: 0 } }],
      "1M",
    );

    expect(chart.net).toEqual([0]);
  });

  it("filters to the selected single-month window", () => {
    const chart = selectIncomeExpenseChartSeries(
      "USD",
      [
        { date: "2025-08-31", balance: { USD: -100 } },
        { date: "2025-09-30", balance: { USD: -4639.7 } },
      ],
      [
        { date: "2025-08-31", balance: { USD: 50 } },
        { date: "2025-09-30", balance: { USD: 2284.81 } },
      ],
      [
        { date: "2025-08-31", balance: { USD: -50 } },
        { date: "2025-09-30", balance: { USD: -2354.89 } },
      ],
      "1M",
    );

    expect(chart.months).toEqual(["2025-09"]);
    expect(chart.net).toEqual([2354.89]);
  });
});

describe("selectIncomeExpenseChartSeries with a non-fully-convertible balance", () => {
  it("reads strictly — an JPY leftover never counts as EUR", () => {
    // Before amountIn, this month's income read via resolveCurrencyBalance
    // would have fallen back to USD (absent here) and silently reported 0 —
    // masking the fact that JPY 1200 could not be folded into EUR at all.
    const chart = selectIncomeExpenseChartSeries(
      "EUR",
      [{ date: "2025-09-30", balance: { JPY: -1200 } }],
      [{ date: "2025-09-30", balance: { EUR: 500 } }],
      [{ date: "2025-09-30", balance: { EUR: -500 } }],
      "1M",
    );
    expect(chart.income).toEqual([0]);
    expect(chart.expense).toEqual([500]);
  });
});

describe("selectUnconvertedTotals", () => {
  it("returns nothing when every series is fully in the display currency", () => {
    expect(
      selectUnconvertedTotals(
        "EUR",
        "ALL",
        [{ date: "2025-09-30", balance: { EUR: -500 } }],
        [{ date: "2025-09-30", balance: { EUR: 200 } }],
      ),
    ).toEqual([]);
  });

  it("sums a leftover currency across the visible range", () => {
    const income: { date: string; balance: Record<string, number> }[] = [
      { date: "2025-08-31", balance: { JPY: -800 } },
      { date: "2025-09-30", balance: { EUR: -500, JPY: -400 } },
    ];
    expect(selectUnconvertedTotals("EUR", "ALL", income)).toEqual([
      { currency: "JPY", number: -1200 },
    ]);
  });

  it("only sums points inside the selected time range", () => {
    const income = [
      { date: "2024-01-31", balance: { JPY: -9999 } },
      { date: "2025-09-30", balance: { JPY: -400 } },
    ];
    expect(selectUnconvertedTotals("EUR", "1M", income)).toEqual([
      { currency: "JPY", number: -400 },
    ]);
  });

  it("ignores null/undefined series", () => {
    expect(
      selectUnconvertedTotals("EUR", "ALL", undefined, null, [
        { date: "2025-09-30", balance: { EUR: -500 } },
      ]),
    ).toEqual([]);
  });
});
