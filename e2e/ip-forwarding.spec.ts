import { expect, test } from "@playwright/test";

// `next dev` with WEB_TRUST_PROXY_HEADERS=false; its backend calls go through the
// recording proxy (e2e/support/capture-server.mjs), which keeps what the website sends.
test.describe.configure({ timeout: 180_000 });

const CAPTURE = "http://127.0.0.1:3199/__captured";

type Captured = {
  method: string;
  path: string;
  xForwardedFor: string | null;
  xRealIp: string | null;
  userAgent: string | null;
  requestId: string | null;
};

test("a spoofed X-Forwarded-For from the browser is never forwarded (development)", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    userAgent: "lamsa-e2e-agent/1.0",
    extraHTTPHeaders: {
      "X-Forwarded-For": "6.6.6.6",
      "X-Real-IP": "7.7.7.7",
      "X-Request-ID": "browser-chosen-id",
    },
  });
  // A (fake) refresh cookie makes the proxy call POST /auth/refresh.
  await context.addCookies([
    { name: "lamsa_rt", value: "e2e-fake", url: baseURL ?? "" },
  ]);
  const page = await context.newPage();
  await page.goto("/login", { timeout: 150_000 });

  // And a login through the server action.
  const submit = page.locator(".lm-auth button[type=submit].primary:visible");
  await expect(submit).toBeEnabled({ timeout: 60_000 });
  await page.locator('[data-field="phone"]:visible').fill("15123456789");
  await page.locator('[data-field="password"]:visible').fill("Wrong-pass-1");
  await submit.click();
  await expect(page.locator(".lm-auth .lm-err:visible")).toBeVisible({
    timeout: 60_000,
  });
  await context.close();

  const records = (await (await fetch(CAPTURE)).json()) as Captured[];
  // The auth-dev tests share this server: look at this browser's requests.
  const auth = records.filter(
    (record) =>
      record.path.includes("/auth/") &&
      record.userAgent === "lamsa-e2e-agent/1.0",
  );
  expect(auth.map((record) => record.path)).toEqual(
    expect.arrayContaining(["/api/v1/auth/refresh", "/api/v1/auth/login"]),
  );
  for (const record of auth) {
    expect(record.xForwardedFor, record.path).toBe("127.0.0.1");
    expect(record.xRealIp, record.path).toBeNull();
    expect(record.userAgent, record.path).toBe("lamsa-e2e-agent/1.0");
    expect(record.requestId, record.path).toMatch(/^[0-9a-f-]{36}$/);
  }
  for (const record of records)
    expect(record.xForwardedFor ?? "127.0.0.1", record.path).not.toContain(
      "6.6.6.6",
    );
});
