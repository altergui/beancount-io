import { resolveCurrencyBalance, unconvertedOf } from "../balance-util";

describe("resolveCurrencyBalance", () => {
  it("returns 0 for null/undefined maps", () => {
    expect(resolveCurrencyBalance(null, "USD")).toBe(0);
    expect(resolveCurrencyBalance(undefined, "USD")).toBe(0);
  });

  it("uses the requested currency when present", () => {
    expect(resolveCurrencyBalance({ USD: 100, EUR: 90 }, "EUR")).toBe(90);
  });

  it("falls back to USD when the requested currency is missing", () => {
    expect(resolveCurrencyBalance({ USD: 100, EUR: 90 }, "CNY")).toBe(100);
  });

  it("returns 0 when neither the currency nor USD is present", () => {
    expect(resolveCurrencyBalance({ EUR: 90 }, "CNY")).toBe(0);
  });

  it("parses string amounts", () => {
    expect(resolveCurrencyBalance({ USD: "1500.50" }, "USD")).toBe(1500.5);
  });

  it("treats invalid strings as 0", () => {
    expect(resolveCurrencyBalance({ USD: "not-a-number" }, "USD")).toBe(0);
  });

  it("does not fall back for a present zero value (uses the `in` check)", () => {
    expect(resolveCurrencyBalance({ USD: 0, EUR: 90 }, "USD")).toBe(0);
  });

  it("passes through negative numbers", () => {
    expect(resolveCurrencyBalance({ USD: -250.25 }, "USD")).toBe(-250.25);
  });
});

describe("unconvertedOf", () => {
  it("returns nothing for a map holding only the requested currency", () => {
    expect(unconvertedOf({ EUR: 1200 }, "EUR")).toEqual([]);
  });

  it("names every other non-zero currency, strictly — no USD fallback key", () => {
    // JPY with no direct or inverse price to EUR: the server leaves it under
    // its own key rather than folding or silently dropping it.
    expect(unconvertedOf({ EUR: 1200, JPY: "500.75" }, "EUR")).toEqual([
      { currency: "JPY", number: 500.75 },
    ]);
  });

  it("ignores zero entries and null/undefined maps", () => {
    expect(unconvertedOf({ EUR: 1200, JPY: 0 }, "EUR")).toEqual([]);
    expect(unconvertedOf(null, "EUR")).toEqual([]);
    expect(unconvertedOf(undefined, "EUR")).toEqual([]);
  });

  it("does not treat USD as a special fallback currency", () => {
    // Unlike `resolveCurrencyBalance`/`notInTotalOf`, USD is just another
    // currency here: Reports must never quietly relabel it as the display one.
    expect(unconvertedOf({ EUR: 1200, USD: 300 }, "EUR")).toEqual([
      { currency: "USD", number: 300 },
    ]);
  });
});
