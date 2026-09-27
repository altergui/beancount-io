import { useCallback, useMemo } from "react";
import { useReactiveVar } from "@apollo/client";
import { displayCurrencyVar } from "@/common/vars/display-currency";
import { getPrimaryCurrency } from "@/common/currency-util";
import { useLedgerPrices } from "@/common/hooks/use-ledger-prices";

/**
 * The currency Reports and Accounts' "≈ total" convert into, plus the set of
 * currencies worth offering: the ledger's own `operating_currency` list, in
 * ledger order, plus any commodity that pairs with one of them in a `price`
 * directive (`getLedgerCommodities`' `base`/`quote`) — a ledger with `price GBP
 * EUR` offers GBP even though only EUR is declared operating. Persisted per
 * ledger (`displayCurrencyVar`), so switching ledgers doesn't fight over one
 * saved choice.
 */
export const useDisplayCurrency = (ledgerId: string, currencies: string[]) => {
  const saved = useReactiveVar(displayCurrencyVar);
  const { prices } = useLedgerPrices(ledgerId);

  const options = useMemo(() => {
    const ordered = [...currencies];
    const seen = new Set(ordered);
    for (const pair of prices ?? []) {
      for (const candidate of [pair.base, pair.quote]) {
        // Only offer a commodity that actually forms a pair with a declared
        // operating currency — a ledger's price directives can also record a
        // stock's cost basis (RGAGX in USD), which isn't a currency to switch
        // display into.
        const pairsWithOperating =
          currencies.includes(pair.base) || currencies.includes(pair.quote);
        if (pairsWithOperating && !seen.has(candidate)) {
          seen.add(candidate);
          ordered.push(candidate);
        }
      }
    }
    return ordered;
  }, [currencies, prices]);

  const savedCurrency = ledgerId ? saved[ledgerId] : undefined;
  const currency =
    savedCurrency && options.includes(savedCurrency)
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

  return { currency, options, setCurrency };
};
