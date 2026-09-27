import { useIncomeStatementQuery } from "@/generated-graphql/graphql";
import { BALANCE_CONVERSION } from "@/common/balance-util";

/** Pinned for offline cold start — see m34 fetch-policy audit. */
const INCOME_STATEMENT_FETCH_POLICY = "cache-and-network" as const;

/**
 * Holdings are valued per the `conversion` passed in — a fava keyword
 * (`BALANCE_CONVERSION` = "at_cost") or a currency code — never left unset,
 * which fava reads as `units` and returns raw share counts instead. Reports
 * passes its selected display currency, so the server folds every flow it can
 * (GBP→EUR at each period's own price) into one currency before this ever
 * reaches a selector.
 */
export const useIncomeStatement = (
  ledgerId: string,
  conversion: string = BALANCE_CONVERSION,
  time?: string,
  interval?: string,
) => {
  const { loading, data, error, refetch } = useIncomeStatementQuery({
    variables: { ledgerId, time, interval, conversion },
    skip: !ledgerId,
    fetchPolicy: INCOME_STATEMENT_FETCH_POLICY,
  });
  return { loading, data, error, refetch };
};
