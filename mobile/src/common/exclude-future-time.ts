/**
 * The `time` value every dated read (journal, account journal, balance sheet,
 * trial balance, account report) should default to when the caller has no
 * period of its own: everything the ledger has ever recorded, up to and
 * including today — never a transaction dated after it.
 *
 * The mobile app has no UI for scheduled or "future-dated" transactions, but a
 * ledger edited by hand (or by an importer that mis-parses a date) can still
 * carry one, and nothing before this stopped it from showing up in a journal,
 * a chart's "latest point", or a running balance. Fava resolves the string in
 * `$time` through `beancount.ops.summarize.clamp_opt`
 * (backend-cluster/ledger/src/foundation/rustledger/time-clamp.ts and
 * `directive-filter.ts`'s `parseDateRange`), which already accepts a `begin -
 * end` range and the bare keyword `day` (today, per `VARIABLE_RE`) — so
 * `"0001-01-01 - <today>"` reads as "the full history, truncated the instant
 * after today" with no other change to what a query returns: `0001-01-01`
 * predates any real beancount ledger, so the clamp's opening-balance
 * synthesis (folding pre-`begin` activity into `Equity:Opening-Balances`) has
 * nothing to fold.
 *
 * Deliberately spelled out as an explicit ISO date rather than the bare `day`
 * keyword: `parseDateRange` resolves `day` against the LEDGER SERVICE's own
 * local clock (`localTodayStr()`), which can be a different calendar day than
 * the device's if they straddle midnight in different timezones. Computing
 * `today` from the device's local clock instead makes "future" mean what the
 * person looking at the screen means by it.
 *
 * Free of `@/` imports so the jest-lite runner can require it, matching
 * `balance-display.ts` and `balance-util.ts`.
 */

/** Today's date, in the device's local timezone, as `YYYY-MM-DD`. */
export function todayIso(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * The earliest date any real beancount ledger predates: `parseDateRange`'s
 * `begin` when a query wants "everything" but still needs a real lower bound
 * to form a `begin - end` range string.
 */
const BEGINNING_OF_TIME = "0001-01-01";

/**
 * The `time` argument that reads the ledger's full history while excluding
 * anything dated after `today` (inclusive of `today` itself). Pass this as the
 * default `time` for any query that would otherwise omit the argument and
 * therefore run unbounded.
 */
export function excludeFutureTimeRange(today: string = todayIso()): string {
  return `${BEGINNING_OF_TIME} - ${today}`;
}
