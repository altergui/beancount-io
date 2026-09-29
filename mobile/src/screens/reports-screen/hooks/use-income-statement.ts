import { useIncomeStatementQuery } from "@/generated-graphql/graphql";
import { BALANCE_CONVERSION } from "@/common/balance-util";
import { excludeFutureTimeRange } from "@/common/exclude-future-time";

/** Pinned for offline cold start — see m34 fetch-policy audit. */
const INCOME_STATEMENT_FETCH_POLICY = "cache-and-network" as const;

/**
 * Holdings are valued per the `conversion` passed in — a fava keyword
 * (`BALANCE_CONVERSION` = "at_cost") or a currency code — never left unset,
 * which fava reads as `units` and returns raw share counts instead. Reports
 * passes its selected display currency, so the server folds every flow it can
 * (GBP→EUR at each period's own price) into one currency before this ever
 * reaches a selector.
 *
 * `time` defaults to {@link excludeFutureTimeRange}, not left open — the
 * per-interval series this backs (`intervalTotals` in
 * backend-cluster/ledger/src/foundation/rustledger/interval-series.ts) spans
 * `firstAndLastDate(directives)` when no `time` window is given: the ledger's
 * OWN first and last directive, across every account, not just Income or
 * Expenses. A single scheduled future transaction anywhere (an installment
 * plan posted months ahead) stretches that span, and every selector here
 * (`selectIncomeExpenseChartSeries`, `selectStatementAnchorMonth`) anchors its
 * "recent" window to the series' latest MONTH — so the report ends up showing
 * a run of real-future, income-free months instead of the recent past. Income
 * isn't sign-flipped wrong or dropped; it's just not in the window being read.
 */
export const useIncomeStatement = (
  ledgerId: string,
  conversion: string = BALANCE_CONVERSION,
  time: string = excludeFutureTimeRange(),
  interval?: string,
) => {
  const { loading, data, error, refetch } = useIncomeStatementQuery({
    variables: { ledgerId, time, interval, conversion },
    skip: !ledgerId,
    fetchPolicy: INCOME_STATEMENT_FETCH_POLICY,
  });
  return { loading, data, error, refetch };
};
