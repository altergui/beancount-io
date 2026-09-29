import { incrementInWindow } from "../redis-counter";

jest.mock("../redis-utils", () => ({ getRedisClient: jest.fn() }));

import { getRedisClient } from "../redis-utils";

const mockGetRedisClient = getRedisClient as jest.MockedFunction<
  typeof getRedisClient
>;

describe("incrementInWindow", () => {
  let client: { incr: jest.Mock; pExpire: jest.Mock; pTTL: jest.Mock };

  beforeEach(() => {
    client = {
      incr: jest.fn(),
      pExpire: jest.fn().mockResolvedValue(true),
      pTTL: jest.fn(),
    };
    mockGetRedisClient.mockReturnValue(client as never);
  });

  it("sets the window's expiry when the counter is created", async () => {
    client.incr.mockResolvedValue(1);

    await expect(incrementInWindow("k", 60_000)).resolves.toEqual({
      count: 1,
      resetInMs: 60_000,
    });
    expect(client.pExpire).toHaveBeenCalledWith("k", 60_000);
  });

  it("leaves a running window's expiry alone", async () => {
    client.incr.mockResolvedValue(5);
    client.pTTL.mockResolvedValue(12_000);

    await expect(incrementInWindow("k", 60_000)).resolves.toEqual({
      count: 5,
      resetInMs: 12_000,
    });
    expect(client.pExpire).not.toHaveBeenCalled();
  });

  // INCR and PEXPIRE are two round trips: a process or Redis restart between
  // them leaves a counter with no TTL, which never resets and turns a
  // per-minute budget into a permanent ban (seen in prod: count 1096/300).
  it("re-arms the expiry of a counter that lost it", async () => {
    client.incr.mockResolvedValue(1096);
    client.pTTL.mockResolvedValue(-1);

    await expect(incrementInWindow("k", 60_000)).resolves.toEqual({
      count: 1096,
      resetInMs: 60_000,
    });
    expect(client.pExpire).toHaveBeenCalledWith("k", 60_000);
  });
});
