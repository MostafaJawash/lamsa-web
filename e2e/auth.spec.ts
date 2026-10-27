import type { Page } from "@playwright/test";

import {
  call,
  loginViaApi,
  PASSWORD,
  registerViaApi,
  uniquePhone,
} from "./support/backend";
import {
  type Accounts,
  cookieValue,
  expect,
  fillLogin,
  ready,
  submitButton,
  test,
} from "./support/fixtures";

// Production build (npm start): cookies have no __Host- prefix only in development.
const AT = "__Host-lamsa_at";
const RT = "__Host-lamsa_rt";

async function registeredUser(
  accounts: Accounts,
  name = `e2e-user ${Date.now()}`,
) {
  const phone = uniquePhone();
  accounts.phone(phone.e164);
  const pair = await registerViaApi(name, phone.e164);
  accounts.token(phone.e164, pair.access_token);
  return { ...phone, name };
}

async function loginAs(page: Page, national: string, password = PASSWORD) {
  await page.goto("/login");
  await fillLogin(page, national, password);
  await page.waitForURL("/");
}

async function expireAccessCookie(page: Page) {
  await page.context().clearCookies({ name: AT });
}

test.describe("register and login", () => {
  test("register: client rules, then the session and the first name in the header", async ({
    page,
    accounts,
  }) => {
    const phone = uniquePhone();
    accounts.phone(phone.e164);
    await page.goto("/register?next=/categories");
    await ready(page);
    await page.locator('[data-field="name"]:visible').fill("e2e-ليلى أحمد");
    await page.locator('[data-field="phone"]:visible').fill(phone.national);
    await page.locator('[data-field="password"]:visible').fill("1234");

    const rules = page.locator(".lm-rules .lm-hint");
    await expect(rules).toHaveCount(3);
    await expect(rules.nth(0)).not.toHaveClass(/ok/);
    await expect(rules.nth(1)).not.toHaveClass(/ok/);

    await submitButton(page).click();
    await expect(
      page.locator('[data-field="password"]:visible'),
    ).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator('[data-field="password"]:visible')).toBeFocused();
    await expect(
      page.locator('[data-field-error="password"]:visible'),
    ).toBeVisible();

    await page.locator('[data-field="password"]:visible').fill(PASSWORD);
    await expect(rules.nth(0)).toHaveClass(/ok/);
    await submitButton(page).click();
    await page.waitForURL("/categories");

    await expect(page.locator(".lm-acct span:visible")).toHaveText("e2e-ليلى");
    await expect(page.locator(".lm-acct:visible")).toHaveAttribute(
      "href",
      "/account",
    );

    const cookies = await page.context().cookies();
    for (const name of [AT, RT]) {
      const cookie = cookies.find((item) => item.name === name);
      expect(cookie, name).toBeDefined();
      expect(cookie?.httpOnly, name).toBe(true);
      expect(cookie?.secure, name).toBe(true);
      expect(cookie?.sameSite, name).toBe("Lax");
      expect(cookie?.path, name).toBe("/");
    }
    const ttl = (name: string) =>
      (cookies.find((item) => item.name === name)?.expires ?? 0) -
      Date.now() / 1000;
    expect(ttl(AT)).toBeGreaterThan(800);
    expect(ttl(AT)).toBeLessThanOrEqual(900);
    expect(ttl(RT)).toBeGreaterThan(59 * 24 * 3600);
  });

  test("PHONE_TAKEN on register shows on the phone field", async ({
    page,
    accounts,
  }) => {
    const user = await registeredUser(accounts);
    await page.goto("/register");
    await ready(page);
    await page.locator('[data-field="name"]:visible').fill("e2e-other");
    await page.locator('[data-field="phone"]:visible').fill(user.national);
    await page.locator('[data-field="password"]:visible').fill(PASSWORD);
    await submitButton(page).click();
    await expect(
      page.locator('[data-field-error="phone"]:visible'),
    ).toBeVisible();
    await expect(page.locator('[data-field="phone"]:visible')).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  test("login, wrong password and unknown phone give the same message", async ({
    page,
    accounts,
  }) => {
    const user = await registeredUser(accounts);
    await page.goto("/login");

    await fillLogin(page, user.national, "Wrong-pass-1");
    const error = page.locator(".lm-auth .lm-err [role=alert] >> visible=true");
    await expect(error).toBeVisible();
    const wrongPassword = await error.textContent();

    await page
      .locator('[data-field="phone"]:visible')
      .fill(uniquePhone().national);
    await submitButton(page).click();
    await expect(error).toBeVisible();
    await expect(error).toHaveText(wrongPassword ?? "");

    await page.locator('[data-field="phone"]:visible').fill(user.national);
    await page.locator('[data-field="password"]:visible').fill(PASSWORD);
    await submitButton(page).click();
    await page.waitForURL("/");
    await expect(page.locator(".lm-acct span:visible")).toHaveText("e2e-user");
  });

  test("TOO_MANY_ATTEMPTS: countdown, submit disabled", async ({
    page,
    accounts,
  }) => {
    const user = await registeredUser(accounts);
    await page.goto("/login");
    await ready(page);
    await page.locator('[data-field="phone"]:visible').fill(user.national);
    await page.locator('[data-field="password"]:visible').fill("Wrong-pass-1");
    // 5 failures per phone; the 6th attempt is refused.
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await submitButton(page).click();
      await expect(submitButton(page)).not.toHaveAttribute("aria-busy", "true");
      await expect(page.locator(".lm-auth .lm-err:visible")).toBeVisible();
    }
    const countdown = page.locator(".lm-auth .lm-err .lm-num:visible");
    await expect(countdown).toHaveText(/^\d+:\d\d$/);
    await expect(submitButton(page)).toBeDisabled();
    const first = await countdown.textContent();
    await expect(countdown).not.toHaveText(first ?? "", { timeout: 3_000 });
  });

  test("logout ends the session", async ({ page, accounts }) => {
    const user = await registeredUser(accounts);
    await loginAs(page, user.national);
    const refresh = await cookieValue(page, RT);
    await page.goto("/account");
    await page
      .locator(".lm-profile button", { hasText: /^تسجيل الخروج$/ })
      .click();
    await page.waitForURL("/");
    await expect(page.locator(".lm-acct span:visible")).toHaveText(
      "تسجيل الدخول",
    );
    expect(await cookieValue(page, RT)).toBeUndefined();
    // The backend no longer accepts that refresh token.
    await expect(
      call("POST", "/auth/refresh", { body: { refresh_token: refresh } }),
    ).rejects.toMatchObject({ status: 401 });
  });

  test("logout-all ends the sessions of other devices", async ({
    page,
    browser,
    accounts,
    visitorIp,
  }) => {
    const user = await registeredUser(accounts);
    const other = await browser.newContext({
      extraHTTPHeaders: { "X-Real-IP": visitorIp },
    });
    const otherPage = await other.newPage();
    await loginAs(otherPage, user.national);
    await loginAs(page, user.national);

    await page.goto("/account");
    await page
      .locator(".lm-profile button", { hasText: "من كل الأجهزة" })
      .click();
    await page.waitForURL("/");

    // The other device's access token runs out (≤ 15 min); its refresh is refused.
    await other.clearCookies({ name: AT });
    await otherPage.goto("/account");
    await otherPage.waitForURL(/\/login\?next=%2Faccount$/);
    await expect(otherPage.locator(".lm-acct span:visible")).toHaveText(
      "تسجيل الدخول",
    );
    await other.close();
  });
});

test.describe("session refresh", () => {
  test("silent refresh in the proxy: same request sees the new token", async ({
    page,
    accounts,
  }) => {
    const user = await registeredUser(accounts);
    await loginAs(page, user.national);
    const before = await cookieValue(page, RT);
    await expireAccessCookie(page);

    const response = await page.goto("/account");
    expect(response?.status()).toBe(200);
    await expect(page.locator(".lm-profile h2")).toHaveText(user.name);
    expect(await cookieValue(page, AT)).toBeTruthy();
    expect(await cookieValue(page, RT)).not.toBe(before);

    // Client navigation (RSC request) refreshes too.
    const rotated = await cookieValue(page, RT);
    await expireAccessCookie(page);
    await page.locator(".lm-dnav a[href='/brands']").click();
    await page.waitForURL("/brands");
    await expect(page.locator(".lm-acct span:visible")).toHaveText("e2e-user");
    await expect.poll(() => cookieValue(page, RT)).not.toBe(rotated);
  });

  test("TOKEN_REUSED clears the session (and ends the new one too)", async ({
    page,
    accounts,
  }) => {
    test.setTimeout(90_000);
    const user = await registeredUser(accounts);
    await loginAs(page, user.national);
    const original = (await cookieValue(page, RT)) ?? "";
    await expireAccessCookie(page);
    await page.goto("/categories");
    const rotated = (await cookieValue(page, RT)) ?? "";
    expect(rotated).not.toBe(original);

    // Past the backend's 20 s grace, re-using the old refresh token is theft.
    await page.waitForTimeout(21_000);
    const context = page.context();
    await context.clearCookies({ name: AT });
    await context.addCookies([
      {
        name: RT,
        value: original,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "Lax",
      },
    ]);
    await page.goto("/account");
    await page.waitForURL(/\/login\?next=%2Faccount$/);
    expect(await cookieValue(page, RT)).toBeUndefined();
    await expect(
      call("POST", "/auth/refresh", { body: { refresh_token: rotated } }),
    ).rejects.toMatchObject({ status: 401 });
  });
});

test.describe("gates and redirects", () => {
  test("protected route → /login?next=… → back after login", async ({
    page,
    accounts,
  }) => {
    const user = await registeredUser(accounts);
    const response = await page.goto("/account/orders?tab=open");
    await page.waitForURL("/login?next=%2Faccount%2Forders%3Ftab%3Dopen");
    expect(response?.status()).toBe(200);
    await fillLogin(page, user.national, PASSWORD);
    await page.waitForURL("/account/orders?tab=open");

    const checkout = await page.request.get("/checkout", { maxRedirects: 0 });
    expect(checkout.status()).toBe(200);
  });

  test("guests: /checkout redirects with next and shows the checkout note", async ({
    page,
  }) => {
    const response = await page.request.get("/checkout", { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers().location).toMatch(/\/login\?next=%2Fcheckout$/);
    await page.goto("/checkout");
    await expect(page.locator(".lm-note")).toHaveText(
      "سجّل دخولك لتكمّل طلبك.",
    );
  });

  test("logged-in visitors skip /login and /register", async ({
    page,
    accounts,
  }) => {
    const user = await registeredUser(accounts);
    await loginAs(page, user.national);
    await page.goto("/login");
    await page.waitForURL("/");
    await page.goto("/register?next=/brands");
    await page.waitForURL("/brands");
  });

  for (const next of [
    "//evil.example",
    "https://evil.example/x",
    "/\\evil.example",
    "/%2F%2Fevil.example",
    "javascript:alert(1)",
  ]) {
    test(`open redirect rejected: next=${next}`, async ({ page, accounts }) => {
      const user = await registeredUser(accounts);
      await page.goto(`/login?next=${encodeURIComponent(next)}`);
      await fillLogin(page, user.national, PASSWORD);
      await page.waitForURL((url) => url.pathname !== "/login");
      const landed = new URL(page.url());
      expect(landed.host).toBe("localhost:3100");
      // "/" or a harmless same-site path (the encoded one is just an unknown page).
      expect(["/", "/%2F%2Fevil.example"]).toContain(landed.pathname);
    });
  }

  test("/complete-profile without the Google signup cookie → /login", async ({
    page,
  }) => {
    await page.goto("/complete-profile");
    await page.waitForURL("/login");
  });

  test("production hides Google without a client id", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator(".lm-or")).toHaveCount(0);
    await expect(page.locator(".lm-btn.google")).toHaveCount(0);
  });
});

test.describe("must_change_password gate", () => {
  test("admin reset → forced change → back to normal", async ({
    page,
    accounts,
  }) => {
    const adminPhone = process.env.E2E_ADMIN_PHONE;
    const adminPassword = process.env.E2E_ADMIN_PASSWORD;
    test.skip(!adminPhone || !adminPassword, "no e2e admin (backend down?)");
    const newPassword = "E2e-new-pass-99";
    const user = await registeredUser(accounts, `e2e-gate ${Date.now()}`);
    const admin = await loginViaApi(adminPhone ?? "", adminPassword ?? "");
    const me = await loginViaApi(user.e164, PASSWORD);
    const { temporary_password: temporary } = await call<{
      temporary_password: string;
    }>("POST", `/admin/users/${me.user.id}/reset-password`, {
      token: admin.access_token,
    });
    accounts.phone(user.e164, temporary, newPassword);

    await page.goto("/login?next=/brands");
    await fillLogin(page, user.national, temporary);
    await page.waitForURL("/account/change-password?next=%2Fbrands");
    await expect(page.locator(".lm-note")).toContainText("كلمة سر مؤقتة");
    await expect(page.getByLabel("كلمة السر المؤقتة")).toBeVisible();
    // Only "تسجيل الخروج": the backend blocks logout-all until the change.
    await expect(
      page.locator("form button", { hasText: "تسجيل الخروج" }),
    ).toHaveCount(1);

    // Every other page sends the visitor back here.
    await page.goto("/categories");
    await page.waitForURL(/\/account\/change-password\?next=%2Fcategories$/);

    await ready(page);
    await page
      .locator('[data-field="currentPassword"]:visible')
      .fill(temporary);
    await page.locator('[data-field="newPassword"]:visible').fill(newPassword);
    await page
      .locator('[data-field="confirmPassword"]:visible')
      .fill(newPassword);
    await submitButton(page).click();
    await page.waitForURL("/categories");

    await page.goto("/account");
    await expect(page.locator(".lm-profile h2")).toHaveText(user.name);
    expect(await cookieValue(page, "__Host-lamsa_pwc")).toBeUndefined();
  });
});

test.describe("tokens never reach the browser", () => {
  test("not in the HTML, the JS, localStorage or document.cookie", async ({
    page,
    accounts,
  }) => {
    const user = await registeredUser(accounts);
    const scripts: string[] = [];
    page.on("response", async (response) => {
      const type = response.headers()["content-type"] ?? "";
      if (/javascript|x-component|json/.test(type))
        scripts.push(await response.text().catch(() => ""));
    });
    await loginAs(page, user.national);
    const access = (await cookieValue(page, AT)) ?? "";
    const refresh = (await cookieValue(page, RT)) ?? "";
    expect(access.length).toBeGreaterThan(20);

    for (const path of ["/", "/account", "/login", "/p/demo-velvet-lipstick"]) {
      await page.goto(path);
      const html = await page.content();
      expect(html, path).not.toContain(access);
      expect(html, path).not.toContain(refresh);
      const raw = await (await page.request.get(path)).text();
      expect(raw, path).not.toContain(access);
      expect(raw, path).not.toContain(refresh);
    }
    await page.locator(".lm-dnav a[href='/brands']").click();
    await page.waitForURL("/brands");

    for (const body of scripts) {
      expect(body.includes(access)).toBe(false);
      expect(body.includes(refresh)).toBe(false);
    }
    const storage = await page.evaluate(() => ({
      local: JSON.stringify({ ...localStorage }),
      session: JSON.stringify({ ...sessionStorage }),
      cookie: document.cookie,
    }));
    expect(storage.local).not.toContain(access);
    expect(storage.session).not.toContain(access);
    expect(storage.cookie).not.toContain("lamsa_");
  });
});

test.describe("catalog 404 check", () => {
  test("documents and bots get a real 404, client navigations are not re-checked", async ({
    page,
    request,
  }) => {
    // A cold or busy server may answer "unknown" (backend check over 1.5 s: passed
    // through, not cached); the next document request gets the real answer.
    await expect
      .poll(async () => (await page.goto("/p/e2e-missing-product"))?.status(), {
        timeout: 20_000,
      })
      .toBe(404);
    const document = await page.goto("/p/e2e-missing-product");
    expect(document?.status()).toBe(404);
    expect(document?.headers()["x-lamsa-catalog-check"]).toBe("missing");

    // curl / bots send no Sec-Fetch-Dest.
    const bot = await request.get("/p/e2e-missing-product", {
      headers: { "User-Agent": "curl/8.0" },
    });
    expect(bot.status()).toBe(404);

    // Client navigation to a product: the RSC request is not checked by the proxy.
    await page.goto("/brands/demo-baity");
    const card = page.locator("main a[href^='/p/']").first();
    const target = (await card.getAttribute("href")) ?? "";
    const rsc = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === target &&
        response.request().headers()["rsc"] === "1",
    );
    await card.click();
    const response = await rsc;
    expect(response.headers()["x-lamsa-catalog-check"]).toBeUndefined();
    await page.waitForURL(target);

    const known = await page.goto("/p/demo-velvet-lipstick");
    // Checked ("unknown" when the backend is slower than the 1.5 s check under load).
    expect(known?.headers()["x-lamsa-catalog-check"]).toMatch(
      /^(exists|unknown)$/,
    );
  });
});
