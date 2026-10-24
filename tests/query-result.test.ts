import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cacheLife = vi.fn();
vi.mock("next/cache", () => ({
  cacheLife: (...args: unknown[]) => cacheLife(...args),
}));

const { logQueryFailure, safeQuery, settle } = await import("@/lib/api/result");

const LIFE = { stale: 45, revalidate: 45, expire: 600 };

describe("settle (inside a cached function)", () => {
  beforeEach(() => cacheLife.mockReset());

  it("returns data and applies the normal lifetime", async () => {
    await expect(settle(LIFE, async () => [1, 2])).resolves.toEqual({
      ok: true,
      data: [1, 2],
    });
    expect(cacheLife).toHaveBeenCalledWith(LIFE);
  });

  it("never throws: a failure becomes ok:false with the short 'seconds' lifetime", async () => {
    const loaded = await settle(LIFE, async () => {
      throw new Error("ECONNREFUSED");
    });
    expect(loaded).toEqual({ ok: false, error: "Error: ECONNREFUSED" });
    expect(cacheLife).toHaveBeenCalledWith("seconds");
    expect(cacheLife).not.toHaveBeenCalledWith(LIFE);
  });
});

describe("safeQuery", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => errorSpy.mockRestore());

  const isEmpty = (items: number[]) => items.length === 0;

  it("returns ok with data", async () => {
    const result = await safeQuery(
      "t-ok",
      async () => ({ ok: true, data: [1] }),
      isEmpty,
    );
    expect(result).toEqual({ status: "ok", data: [1] });
  });

  it("returns empty for an empty list", async () => {
    const result = await safeQuery(
      "t-empty",
      async () => ({ ok: true, data: [] }),
      isEmpty,
    );
    expect(result).toEqual({ status: "empty" });
  });

  it("returns unavailable and logs when the load failed", async () => {
    const result = await safeQuery<number[]>(
      "t-failed",
      async () => ({ ok: false, error: "ApiError: NETWORK_ERROR" }),
      isEmpty,
    );
    expect(result).toEqual({ status: "unavailable" });
    expect(errorSpy).toHaveBeenCalledWith(
      "[lamsa] t-failed unavailable: ApiError: NETWORK_ERROR",
    );
  });

  it("returns unavailable even if the loader itself throws", async () => {
    const result = await safeQuery<number[]>(
      "t-throws",
      async () => {
        throw new Error("boom");
      },
      isEmpty,
    );
    expect(result).toEqual({ status: "unavailable" });
  });
});

describe("logQueryFailure", () => {
  it("logs a kind at most once a minute", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    logQueryFailure("t-throttle", "x", 1_000);
    logQueryFailure("t-throttle", "x", 30_000);
    logQueryFailure("t-throttle", "x", 61_001);
    logQueryFailure("t-other", "x", 30_000);
    expect(spy).toHaveBeenCalledTimes(3);
    spy.mockRestore();
  });
});
