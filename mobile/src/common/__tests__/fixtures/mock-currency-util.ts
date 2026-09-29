/** Stand-in for `@/common/currency-util`: only the pure function this fixture
 * set needs, without the `currency-icons` asset import the real module carries. */
export const getPrimaryCurrency = (
  currencies: string[],
  fallback = "USD",
): string => (currencies.length > 0 ? currencies[0] : fallback);
