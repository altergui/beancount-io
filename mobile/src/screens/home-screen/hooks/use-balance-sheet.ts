import { useBalanceSheetQuery } from "@/generated-graphql/graphql";
import { VALUATION_CONVERSION } from "@/common/balance-util";

/** Pinned for offline cold start — see m34 fetch-policy audit. */
const BALANCE_SHEET_FETCH_POLICY = "cache-and-network" as const;

/**
 * Balance sheet for a ledger: net-worth / assets / liabilities series plus the
 * assets & liabilities hierarchy trees, with commodity holdings valued at
 * market ({@link VALUATION_CONVERSION}) by default. `time` scopes the series
 * (e.g. a Fava-style range string); omit it for the full history the range
 * pills slice. `conversion` defaults to `VALUATION_CONVERSION` (native
 * holdings, at market) — Home also reads a second copy scoped to the selected
 * display currency, so net worth can be charted in one currency while its
 * breakdown stays native.
 */
export const useBalanceSheet = (
  ledgerId: string,
  time?: string,
  conversion: string = VALUATION_CONVERSION,
) => {
  const { loading, data, error, refetch } = useBalanceSheetQuery({
    variables: { ledgerId, time, conversion },
    skip: !ledgerId,
    fetchPolicy: BALANCE_SHEET_FETCH_POLICY,
  });
  return { loading, data, error, refetch };
};
