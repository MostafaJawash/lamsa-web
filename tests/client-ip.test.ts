import { describe, expect, it } from "vitest";

import { visitorHeaders } from "@/lib/api/client";
import {
  clientContextFrom,
  clientIpFrom,
  LOCAL_IP,
  proxyRequestId,
} from "@/lib/http/client-context";

const UUID = /^[0-9a-f-]{36}$/;

describe("visitor IP", () => {
  it("development (no trusted proxy): always 127.0.0.1, spoofed headers ignored", () => {
    const headers = new Headers({
      "x-forwarded-for": "1.2.3.4",
      "x-real-ip": "5.6.7.8",
    });
    expect(clientIpFrom(headers, false)).toBe(LOCAL_IP);
    expect(clientContextFrom(headers, false).ip).toBe("127.0.0.1");
  });

  it("behind our Nginx: X-Real-IP first", () => {
    const headers = new Headers({
      "x-real-ip": "198.51.100.7",
      "x-forwarded-for": "1.2.3.4, 198.51.100.9",
    });
    expect(clientIpFrom(headers, true)).toBe("198.51.100.7");
  });

  it("behind our Nginx: else the rightmost X-Forwarded-For entry (set by Nginx)", () => {
    expect(
      clientIpFrom(
        new Headers({ "x-forwarded-for": "1.2.3.4, 198.51.100.9" }),
        true,
      ),
    ).toBe("198.51.100.9");
    expect(
      clientIpFrom(new Headers({ "x-forwarded-for": "2001:db8::1" }), true),
    ).toBe("2001:db8::1");
  });

  it("ignores garbage", () => {
    expect(
      clientIpFrom(
        new Headers({
          "x-real-ip": "nope",
          "x-forwarded-for": "1.2.3.4, evil",
        }),
        true,
      ),
    ).toBe(LOCAL_IP);
    expect(clientIpFrom(new Headers(), true)).toBe(LOCAL_IP);
  });
});

describe("request id", () => {
  it("reuses Nginx's id only behind a trusted proxy", () => {
    const headers = new Headers({ "x-request-id": "abc123" });
    expect(proxyRequestId(headers, true)).toBe("abc123");
    expect(proxyRequestId(headers, false)).toMatch(UUID);
  });

  it("never reuses an invalid id", () => {
    const headers = new Headers({ "x-request-id": "a b c" });
    expect(proxyRequestId(headers, true)).toMatch(UUID);
    expect(clientContextFrom(headers, true).requestId).toBeNull();
  });

  it("render code reuses the proxy's id and never draws a random one", () => {
    expect(
      clientContextFrom(new Headers({ "x-request-id": "from-proxy" }), false)
        .requestId,
    ).toBe("from-proxy");
    expect(clientContextFrom(new Headers(), false).requestId).toBeNull();
  });
});

describe("headers sent to the backend", () => {
  it("forwards IP, user agent and request id", () => {
    expect(
      visitorHeaders({
        ip: "198.51.100.7",
        userAgent: "UA/1",
        requestId: "r1",
      }),
    ).toEqual({
      "X-Forwarded-For": "198.51.100.7",
      "User-Agent": "UA/1",
      "X-Request-ID": "r1",
    });
    const minimal = visitorHeaders({
      ip: "127.0.0.1",
      userAgent: null,
      requestId: null,
    });
    expect(minimal).toEqual({ "X-Forwarded-For": "127.0.0.1" });
  });
});
