import { createPersistentVar } from "@/common/apollo/persistent-var";

/**
 * The currency Reports and Accounts' "≈ total" convert into, per ledger. A map
 * rather than a single value because a user can switch ledgers with different
 * operating currencies — a EUR/GBP ledger and a ledger in a third
 * currency shouldn't fight over one saved preference. Read through
 * `useDisplayCurrency`, which falls back to `getPrimaryCurrency` when the
 * ledger has no saved choice, or the saved one is no longer a valid option.
 */
export const [displayCurrencyVar, loadDisplayCurrency] = createPersistentVar<
  Record<string, string>
>("displayCurrency", {});
