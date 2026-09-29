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

describe("selectIncomeExpenseChartSeries with a future-dated tail (m?/note income-almost-zero)", () => {
  // Real-ledger shape: the backend's per-interval series
  // (backend-cluster/ledger `intervalTotals`) spans the WHOLE ledger's first
  // and last directive date whenever the query omits `time` — every mobile
  // caller did, before `useIncomeStatement` defaulted `time` to
  // `excludeFutureTimeRange()`. A ledger with a scheduled future installment
  // plan (postings to Liabilities/Assets only, months or years out) stretches
  // that span past "today" even though Income has nothing left to report
  // there, so the monthly series comes back with a run of real, empty months
  // *after* the last one with actual income. `filterSeriesByRange` anchors
  // "6M" to the series' own latest month (by design, so a stale ledger still
  // shows its history) — which is now one of those empty future months, so the
  // window it draws is almost entirely future and income reads as ~0 even
  // though the ledger has real income every month up to today.
  type MonthlyPoint = { date: string; balance: Record<string, number> };
  const monthlyIncome = (amount: number, month: string): MonthlyPoint => ({
    date: `${month}-28`,
    balance: { GBP: -amount },
  });
  const monthlyExpense = (amount: number, month: string): MonthlyPoint => ({
    date: `${month}-28`,
    balance: { GBP: amount },
  });

  // Six months of monthly salary income up to "today" (2026-09), then
  // six income-free months the ledger's global span still produces because a
  // Liabilities-only installment plan runs through 2027-03.
  const incomeData: MonthlyPoint[] = [
    monthlyIncome(3000, "2026-04"),
    monthlyIncome(3000, "2026-05"),
    monthlyIncome(3000, "2026-06"),
    monthlyIncome(3000, "2026-07"),
    monthlyIncome(3000, "2026-08"),
    monthlyIncome(3000, "2026-09"),
    { date: "2026-10-31", balance: {} },
    { date: "2026-11-30", balance: {} },
    { date: "2026-12-31", balance: {} },
    { date: "2027-01-31", balance: {} },
    { date: "2027-02-28", balance: {} },
    { date: "2027-03-31", balance: {} },
  ];
  const expensesData: MonthlyPoint[] = [
    monthlyExpense(2000, "2026-04"),
    monthlyExpense(2000, "2026-05"),
    monthlyExpense(2000, "2026-06"),
    monthlyExpense(2000, "2026-07"),
    monthlyExpense(2000, "2026-08"),
    monthlyExpense(2000, "2026-09"),
    { date: "2026-10-31", balance: {} },
    { date: "2026-11-30", balance: {} },
    { date: "2026-12-31", balance: {} },
    { date: "2027-01-31", balance: {} },
    { date: "2027-02-28", balance: {} },
    { date: "2027-03-31", balance: {} },
  ];
  const netProfitData = incomeData.map((point, index) => ({
    date: point.date,
    balance: {
      GBP: (point.balance.GBP ?? 0) + (expensesData[index].balance.GBP ?? 0),
    },
  }));

  it("reproduces the bug: an unbounded series windows on the future and shows ~0 income", () => {
    const chart = selectIncomeExpenseChartSeries(
      "GBP",
      incomeData,
      expensesData,
      netProfitData,
      "6M",
    );

    // The window anchors to the series' last month (2027-03) and walks back
    // six months — entirely inside the income-free scheduled-payments tail.
    expect(chart.months).toEqual([
      "2026-10",
      "2026-11",
      "2026-12",
      "2027-01",
      "2027-02",
      "2027-03",
    ]);
    expect(chart.income.every((value) => value === 0)).toBe(true);
  });

  it("fixed: a series already bounded to today (what excludeFutureTimeRange achieves) shows the real income", () => {
    const boundedIncome = incomeData.filter((p) => p.date <= "2026-09-29");
    const boundedExpenses = expensesData.filter((p) => p.date <= "2026-09-29");
    const boundedNet = netProfitData.filter((p) => p.date <= "2026-09-29");

    const chart = selectIncomeExpenseChartSeries(
      "GBP",
      boundedIncome,
      boundedExpenses,
      boundedNet,
      "6M",
    );

    expect(chart.months).toEqual([
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
    ]);
    expect(chart.income.every((value) => value === 3000)).toBe(true);
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
