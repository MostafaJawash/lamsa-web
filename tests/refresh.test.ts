import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createRefresher,
  type RefreshCall,
  type RefreshOutcome,
} from "@/lib/auth/refresh";
import type { ClientContext } from "@/lib/http/client-context";

const client: ClientContext = {
  ip: "127.0.0.1",
  userAgent: null,
  requestId: "r",
};

const refreshed = {
  kind: "refreshed",
  pair: { access_token: "new" },
} as RefreshOutcome;

function deferred() {
  let resolve!: (outcome: RefreshOutcome) => void;
  const promise = new Promise<RefreshOutcome>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("single-flight refresh", () => {
  it("shares one backend call between concurrent requests with the same token", async () => {
    const pending = deferred();
    const call = vi.fn<RefreshCall>(() => pending.promise);
    const refresher = createRefresher(call);
    const results = Promise.all([
      refresher.refresh("rt-1", client),
      refresher.refresh("rt-1", client),
      refresher.refresh("rt-1", client),
    ]);
    pending.resolve(refreshed);
    expect(await results).toEqual([refreshed, refreshed, refreshed]);
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("keeps a settled result briefly for requests still carrying the old cookie", async () => {
    vi.useFakeTimers();
    const call = vi.fn<RefreshCall>(async () => refreshed);
    const refresher = createRefresher(call, { keepMs: 10_000 });
    await refresher.refresh("rt-1", client);
    await refresher.refresh("rt-1", client);
    expect(call).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(10_001);
    expect(refresher.size).toBe(0);
    await refresher.refresh("rt-1", client);
    expect(call).toHaveBeenCalledTimes(2);
  });

  it("does not share between different tokens", async () => {
    const call = vi.fn<RefreshCall>(async () => refreshed);
    const refresher = createRefresher(call);
    await Promise.all([
      refresher.refresh("rt-1", client),
      refresher.refresh("rt-2", client),
    ]);
    expect(call).toHaveBeenCalledTimes(2);
  });

  it("forgets 'unavailable' at once so the next request retries", async () => {
    const call = vi
      .fn<RefreshCall>()
      .mockResolvedValueOnce({ kind: "unavailable" })
      .mockResolvedValueOnce(refreshed);
    const refresher = createRefresher(call);
    expect(await refresher.refresh("rt-1", client)).toEqual({
      kind: "unavailable",
    });
    await Promise.resolve();
    expect(await refresher.refresh("rt-1", client)).toEqual(refreshed);
    expect(call).toHaveBeenCalledTimes(2);
  });

  it("turns a throwing call into 'unavailable'", async () => {
    const refresher = createRefresher(async () => {
      throw new Error("boom");
    });
    expect(await refresher.refresh("rt-1", client)).toEqual({
      kind: "unavailable",
    });
  });
});
