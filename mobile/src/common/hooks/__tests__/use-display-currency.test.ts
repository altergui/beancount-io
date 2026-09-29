/**
 * Tests the real `useDisplayCurrency`. `options` used to also offer any
 * commodity that merely priced against an operating currency — a ledger with
 * `price JPY GBP` / `price USD EUR` / `price BTC EUR` offered JPY, USD and BTC
 * alongside EUR and GBP, which both (a) grew the currency-selector picker past
 * a handful of pills into an opaque "pick one" dropdown, and (b) leaked into
 * `selectBalanceDisplay`'s `operatingCurrencies` (the very same list), which
 * used it to decide which currencies get a native line in a multi-currency
 * balance. This pins the fix: `options` is exactly the ledger's own
 * `operating_currency` list, nothing added.
 */
import {
  freshRequire,
  interceptModules,
} from "../../__tests__/fixtures/intercept-modules";

type VarsMock =
  typeof import("../../__tests__/fixtures/mock-display-currency-var");
type Subject = typeof import("../use-display-currency");

const REACT_HOOKS =
  require.resolve("../../__tests__/fixtures/mock-react-hooks");
const APOLLO = require.resolve("../../__tests__/fixtures/mock-apollo-client");
const VARS =
  require.resolve("../../__tests__/fixtures/mock-display-currency-var");
const CURRENCY_UTIL =
  require.resolve("../../__tests__/fixtures/mock-currency-util");
const SUBJECT = require.resolve("../use-display-currency");

let restore: () => void;
let vars: VarsMock;
let useDisplayCurrency: Subject["useDisplayCurrency"];

beforeAll(() => {
  restore = interceptModules({
    react: REACT_HOOKS,
    "@apollo/client": APOLLO,
    "@/common/vars/display-currency": VARS,
    "@/common/currency-util": CURRENCY_UTIL,
  });
  vars = require(VARS) as VarsMock;
  ({ useDisplayCurrency } = freshRequire<Subject>(SUBJECT));
});

afterAll(() => {
  restore();
  delete require.cache[SUBJECT];
});

beforeEach(() => {
  vars.displayCurrencyVar({});
});

describe("useDisplayCurrency", () => {
  it("offers exactly the ledger's operating currencies, in ledger order", () => {
    const { options } = useDisplayCurrency("demo/ledger", ["EUR", "GBP"]);
    expect(options).toEqual(["EUR", "GBP"]);
  });

  it("defaults to the primary (first) operating currency", () => {
    const { currency } = useDisplayCurrency("demo/ledger", ["EUR", "GBP"]);
    expect(currency).toBe("EUR");
  });

  it("uses the saved currency for this ledger when it is still a valid option", () => {
    vars.displayCurrencyVar({ "demo/ledger": "GBP" });
    const { currency } = useDisplayCurrency("demo/ledger", ["EUR", "GBP"]);
    expect(currency).toBe("GBP");
  });

  it("falls back to the primary currency when the saved one is no longer valid", () => {
    vars.displayCurrencyVar({ "demo/ledger": "USD" });
    const { currency } = useDisplayCurrency("demo/ledger", ["EUR", "GBP"]);
    expect(currency).toBe("EUR");
  });

  it("persists a selection scoped to the ledger", () => {
    const { setCurrency } = useDisplayCurrency("demo/ledger", ["EUR", "GBP"]);
    setCurrency("GBP");
    expect(vars.displayCurrencyVar()).toEqual({ "demo/ledger": "GBP" });
  });
});
