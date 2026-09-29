import { useCallback } from "react";
import { useReactiveVar } from "@apollo/client";
import { displayCurrencyVar } from "@/common/vars/display-currency";
import { getPrimaryCurrency } from "@/common/currency-util";

/**
 * The currency Reports and Accounts' "≈ total" convert into, plus the set of
 * currencies worth offering: exactly the ledger's own `operating_currency`
 * list, in ledger order. Persisted per ledger (`displayCurrencyVar`), so
 * switching ledgers doesn't fight over one saved choice.
 *
 * `options` used to also offer any commodity that merely paired with an
 * operating currency in a `price` directive (a stock's cost-basis pair, but
 * also — since `price` records both fiat/fiat conversions and commodity
 * cost bases alike — every other currency the ledger ever priced against
 * one, e.g. a travel-cash JPY or a BTC holding). On a ledger with several
 * such pairs that grew the picker past a handful of pills into an opaque
 * "pick one" dropdown, and the very same list doubles as `operatingCurrencies`
 * for `selectBalanceDisplay` (see account-table.tsx, select-trial-balance.ts,
 * select-account-balance-series.ts) — the set of currencies a multi-currency
 * balance shows a native line for. Padding it with priced-but-not-operating
 * commodities made those get a line of their own too, instead of folding into
 * the converted "≈ total" the way a currency the ledger never declared
 * operating should. Both are fixed by the same change: `options` is exactly
 * `currencies`, nothing added.
 */
export const useDisplayCurrency = (ledgerId: string, currencies: string[]) => {
  const saved = useReactiveVar(displayCurrencyVar);

  const savedCurrency = ledgerId ? saved[ledgerId] : undefined;
  const currency =
    savedCurrency && currencies.includes(savedCurrency)
      ? savedCurrency
      : getPrimaryCurrency(currencies);

  const setCurrency = useCallback(
    (next: string) => {
      if (!ledgerId) {
        return;
      }
      displayCurrencyVar({ ...displayCurrencyVar(), [ledgerId]: next });
    },
    [ledgerId],
  );

  return { currency, options: currencies, setCurrency };
};
