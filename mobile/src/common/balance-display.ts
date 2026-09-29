/**
 * What a balance figure says it is.
 *
 * Balances value holdings `at_value` (see `VALUATION_CONVERSION`), flows and
 * history `at_cost`. Either converts a commodity held at cost into the
 * operating currency, and leaves one with no cost — vacation hours,
 * placeholder IRA units — under its own key, where reading only the operating
 * currency turned `-8 VACHR` into `$0.00`. A second `units` read of the same
 * balance says what the ledger actually holds. From the two maps this decides
 * what a figure leads with:
 *
 * - a balance of one commodity (`597.748 RGAGX`, `-13 VACHR`) reads in its
 *   units, and carries its value when it has one, with that value's basis;
 * - anything else keeps the operating-currency total, and names the holdings
 *   that total cannot include.
 *
 * What a total then says about its basis lives in `valuation.ts`.
 *
 * Free of `@/` imports so the jest-lite runner can require it.
 */
import { operatingKey, resolveCurrencyBalance } from "./balance-util";
import { amountScale, formatUnits } from "./number-utils";
import type { Valuation } from "./valuation";

/** A beancount balance map as the API returns it: currency → decimal. */
export type BalanceMap = Record<string, number | string> | null | undefined;

/** One commodity amount, with the scale the ledger recorded it at. */
export type Holding = { currency: string; number: number; scale: number };

/**
 * The basis a commodity's value was read at: a market price, or its cost for
 * lack of one.
 */
export type ValueBasis = "market" | "cost";

export type Translate = (
  key: string,
  params?: Record<string, unknown>,
) => string;

export type BalanceDisplay =
  | {
      kind: "money";
      /** Operating-currency total, as `resolveCurrencyBalance` reads it. */
      value: number;
      /** Holdings that total cannot express in the operating currency. */
      notInTotal: Holding[];
      /**
       * What the total discloses about its basis, when the caller shows it:
       * a Home page, an Accounts root, the account detail header.
       */
      valuation?: Valuation;
    }
  | {
      kind: "units";
      /** The one commodity the balance holds. */
      units: Holding;
      /**
       * Its value in the operating currency and the basis it was read at;
       * null when it has none. `basis` is null while the ledger's prices are
       * unknown.
       */
      value: { amount: number; basis: ValueBasis | null } | null;
    }
  | {
      kind: "multi";
      /**
       * Every operating-currency holding this balance carries, shown natively
       * rather than folded into one total — the display currency first (when
       * held), then the rest by descending magnitude. Empty when the balance
       * holds only currencies the ledger never declared operating (a USD or
       * JPY account in a EUR/GBP ledger): there is no native line to draw,
       * only the converted total below.
       */
      holdings: Holding[];
      /**
       * The server-converted total in the display currency, when the caller
       * has one to offer (a second, `displayCurrency`-scoped read of the same
       * balance). Shown as "≈" under the native holdings; absent while that
       * read hasn't landed yet. It is the ONLY figure shown when `holdings` is
       * empty, so that case reads as "here's what this is worth converted",
       * not a bogus zero.
       */
      converted?: number;
      /** Non-operating holdings (a priced-but-not-operating currency, a stock, vacation hours) the total still excludes. */
      notInTotal: Holding[];
    };

/**
 * One currency's entry in a balance map with its recorded scale, read strictly:
 * a missing or unparseable entry is zero, never the USD fallback.
 */
export function amountIn(
  map: BalanceMap,
  currency: string,
): { number: number; scale: number } {
  const raw = map?.[currency];
  const number = Number(raw);
  return raw == null || !Number.isFinite(number)
    ? { number: 0, scale: 0 }
    : { number, scale: amountScale(String(raw)) };
}

/** Non-zero entries of a balance map, in the order the API returned them. */
export function holdingsOf(map: BalanceMap): Holding[] {
  return Object.keys(map ?? {}).flatMap((currency) => {
    const amount = amountIn(map, currency);
    return amount.number === 0 ? [] : [{ currency, ...amount }];
  });
}

/** Holdings a total in `currency` leaves out of the figure it shows. */
export function notInTotalOf(map: BalanceMap, currency: string): Holding[] {
  const key = operatingKey(map, currency);
  return holdingsOf(map).filter((holding) => holding.currency !== key);
}

/**
 * How one balance reads, from its valued map and — when it has landed — its
 * `units` map. Without the units read, a commodity held at cost stays a money
 * figure, and only a balance of one unconverted commodity reads in units.
 * `basisOf` says which basis the valued map read a commodity at.
 *
 * `operatingCurrencies` names every currency the ledger (or the display-currency
 * picker) treats as fiat and worth showing natively — defaulting to just
 * `currency` itself, which reproduces the single-currency behavior every
 * existing caller and test relies on. A balance holding more than one of those
 * currencies, or exactly one that isn't `currency`, reads as `kind: "multi"`
 * instead of folding (or silently mislabeling, via the old USD fallback) one
 * currency's figure as the total. `convertedTotal` is that total, read
 * separately by the caller from a second `conversion: currency`-scoped balance
 * — this function has no access to a currency graph of its own.
 */
export function selectBalanceDisplay(
  valued: BalanceMap,
  units: BalanceMap,
  currency: string,
  basisOf: (commodity: string) => ValueBasis | null = () => null,
  operatingCurrencies: readonly string[] = [currency],
  convertedTotal?: number,
): BalanceDisplay {
  const notInTotalForUnits = notInTotalOf(valued, currency);
  const valueForUnits = resolveCurrencyBalance(valued, currency);
  const unitsHeld = holdingsOf(units);
  const [map, held]: [BalanceMap, Holding[]] =
    unitsHeld.length > 0 ? [units, unitsHeld] : [valued, holdingsOf(valued)];

  if (
    held.length === 1 &&
    held[0].currency !== operatingKey(map, currency) &&
    // A lone fiat holding that merely isn't `currency` (a GBP-only account
    // viewed in EUR) is a multi-currency balance, not a commodity: it falls
    // through to the fiat classification below instead of reading in "units".
    !operatingCurrencies.includes(held[0].currency) &&
    // A lone holding in a currency the ledger never declared operating (an
    // JPY travel account in a EUR/GBP ledger) reads in "units" too, ONLY
    // while there is nothing better to show: this branch cannot use
    // `convertedTotal` (a currency figure, not a unit count) at all, so once
    // the caller HAS converted this balance into the display currency, that
    // reads better than a raw "150,000 JPY" with no equivalent beside it —
    // see the `fiat.length === 0` case below, which then takes over. Without
    // a converted read yet (or for a real non-currency commodity, which never
    // gets one), this still shows the ledger's own units, unchanged.
    convertedTotal === undefined
  ) {
    return {
      kind: "units",
      units: held[0],
      value:
        notInTotalForUnits.length === 0 && valueForUnits !== 0
          ? { amount: valueForUnits, basis: basisOf(held[0].currency) }
          : null,
    };
  }

  const holdings = holdingsOf(valued);
  const fiat = holdings.filter((holding) =>
    operatingCurrencies.includes(holding.currency),
  );
  const notInTotal = holdings.filter(
    (holding) => !operatingCurrencies.includes(holding.currency),
  );

  if (fiat.length === 0) {
    // A balance holding only non-operating currencies (a USD or JPY account
    // in a EUR/GBP ledger) is not empty and must not read as a bogus €0.00 —
    // once the caller has a converted total to offer (the same second,
    // `displayCurrency`-scoped read a "multi" balance uses), show only that,
    // the way a "multi" balance's "≈" line discloses one. Without a converted
    // total — a genuinely empty balance, or an old caller that never reads
    // one — this stays the plain zero it always was.
    return holdings.length > 0 && convertedTotal !== undefined
      ? { kind: "multi", holdings: [], converted: convertedTotal, notInTotal }
      : { kind: "money", value: 0, notInTotal };
  }
  if (fiat.length === 1 && fiat[0].currency === currency) {
    return { kind: "money", value: fiat[0].number, notInTotal };
  }
  return {
    kind: "multi",
    holdings: [...fiat].sort((a, b) =>
      a.currency === currency
        ? -1
        : b.currency === currency
          ? 1
          : Math.abs(b.number) - Math.abs(a.number),
    ),
    converted: convertedTotal,
    notInTotal,
  };
}

export const formatHolding = (holding: Holding, includePlus = false): string =>
  formatUnits(holding.number, holding.currency, holding.scale, includePlus);

/** The note naming holdings a total leaves out, or nothing when it has none. */
export function notInTotalNotes(
  holdings: readonly Holding[],
  t: Translate,
): string[] {
  return holdings.length === 0
    ? []
    : [
        t("notInTotal", {
          amounts: holdings.map((holding) => formatHolding(holding)).join(", "),
        }),
      ];
}
