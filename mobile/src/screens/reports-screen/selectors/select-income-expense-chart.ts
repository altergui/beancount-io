import {
  alignMonthlySeries,
  filterSeriesByRange,
  pointsToMonthlySeries,
  rangeStartMonth,
  type DateBalancePoint,
  type TimeRange,
} from "../../../common/series-util";
import { amountIn } from "../../../common/balance-display";
import {
  unconvertedOf,
  type UnconvertedAmount,
} from "../../../common/balance-util";

/** Strict currency read for Reports: no USD fallback, ever (see `amountIn`). */
const readStrict = (balance: DateBalancePoint["balance"], currency: string) =>
  amountIn(balance, currency).number;

/**
 * Every currency the report's charted series (income, expenses, net profit)
 * could not fold into `currency` — an JPY balance with no direct or inverse
 * price to EUR, say — summed over the visible time range. Drives the "Not
 * converted" banner under the combined chart.
 */
export function selectUnconvertedTotals(
  currency: string,
  timeRange: TimeRange,
  ...series: BalanceSeries[]
): UnconvertedAmount[] {
  const points = series.flatMap((s) => (s ?? []).filter((p) => !!p?.date));
  if (points.length === 0) {
    return [];
  }
  points.sort((a, b) => a!.date.localeCompare(b!.date));
  const cutoff = rangeStartMonth(
    timeRange,
    points[points.length - 1]!.date.slice(0, 7),
  );
  const totals = new Map<string, number>();
  for (const point of points) {
    if (cutoff && point!.date.slice(0, 7) < cutoff) {
      continue;
    }
    for (const leftover of unconvertedOf(point!.balance, currency)) {
      totals.set(
        leftover.currency,
        (totals.get(leftover.currency) ?? 0) + leftover.number,
      );
    }
  }
  return Array.from(totals, ([leftoverCurrency, number]) => ({
    currency: leftoverCurrency,
    number,
  })).filter((amount) => amount.number !== 0);
}

type BalanceSeries =
  ReadonlyArray<DateBalancePoint | null | undefined> | null | undefined;

/**
 * The report's anchor month ("YYYY-MM"): the latest month any statement series
 * carries data for, i.e. the chart's right edge.
 *
 * `filterSeriesByRange` anchors each charted series to its own newest point, so
 * the chart as a whole ends at this month. The recent-transactions list windows
 * on the same value, which keeps it on the month the chart shows even when that
 * month's only activity is a transfer (no Income/Expenses posting of its own).
 * Returns null while the statement is unresolved.
 */
export function selectStatementAnchorMonth(
  ...series: BalanceSeries[]
): string | null {
  let latest: string | null = null;
  for (const points of series) {
    for (const point of points ?? []) {
      if (!point?.date) {
        continue;
      }
      const month = point.date.slice(0, 7);
      if (latest === null || month > latest) {
        latest = month;
      }
    }
  }
  return latest;
}

/**
 * Convert IncomeStatement series for the Reports combined chart.
 *
 * Accounting balances keep income and net profit as credits (negative). The
 * chart plots both as positive magnitudes for profitable months, so negate
 * those two series at this presentation boundary. Expenses stay as-is.
 */
export function selectIncomeExpenseChartSeries(
  currency: string,
  incomeData: BalanceSeries,
  expensesData: BalanceSeries,
  netProfitData: BalanceSeries,
  timeRange: TimeRange,
) {
  const income = pointsToMonthlySeries(currency, incomeData, readStrict).map(
    (point) => ({
      ...point,
      value: -point.value + 0,
    }),
  );
  const expense = pointsToMonthlySeries(currency, expensesData, readStrict);
  const net = pointsToMonthlySeries(currency, netProfitData, readStrict).map(
    (point) => ({
      ...point,
      value: -point.value + 0,
    }),
  );
  return alignMonthlySeries({
    income: filterSeriesByRange(income, timeRange),
    expense: filterSeriesByRange(expense, timeRange),
    net: filterSeriesByRange(net, timeRange),
  });
}
