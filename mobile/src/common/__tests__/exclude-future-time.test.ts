import { excludeFutureTimeRange, todayIso } from "../exclude-future-time";

describe("todayIso", () => {
  it("formats the device's local date as YYYY-MM-DD", () => {
    // Local noon avoids UTC/local straddling.
    expect(todayIso(new Date(2026, 6, 22, 12))).toBe("2026-07-22");
  });

  it("pads single-digit months and days", () => {
    expect(todayIso(new Date(2026, 0, 5, 12))).toBe("2026-01-05");
  });
});

describe("excludeFutureTimeRange", () => {
  it("writes a Fava range from the dawn of beancount time through today", () => {
    expect(excludeFutureTimeRange("2026-07-22")).toBe(
      "0001-01-01 - 2026-07-22",
    );
  });

  it("defaults to the device's today when called with no argument", () => {
    expect(excludeFutureTimeRange()).toBe(`0001-01-01 - ${todayIso()}`);
  });
});
