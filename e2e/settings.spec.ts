import type { Locator, Page } from "@playwright/test";

import {
  BackendError,
  call,
  loginViaApi,
  PASSWORD,
  registerViaApi,
  uniquePhone,
} from "./support/backend";
import { customer, signIn, type Customer } from "./support/checkout";
import { cookieValue, expect, hydrated, test } from "./support/fixtures";
import { preferences } from "./support/notifications";

/**
 * /account/settings and the password page: the profile form, the phone change, the password
 * change (and what it does to the session), the notification preferences, and the same
 * forms without JavaScript. Customers are throwaway `e2e-…` accounts.
 */

const NEW_PASSWORD = "E2e-new-pass-77";
const AT = "__Host-lamsa_at";
const RT = "__Host-lamsa_rt";

const form = (page: Page, name: string) =>
  page.locator(`[data-settings-form="${name}"]:visible`);
const field = (f: Locator, name: string) => f.locator(`[data-field="${name}"]`);
const fieldError = (f: Locator, name: string) =>
  f.locator(`[data-field-error="${name}"]`);
const save = (f: Locator) => f.locator("button[type=submit]");
const toast = (page: Page) => page.locator(".lm-toast").first();

type Me = { name: string; email: string | null; phone: string };
const me = (token: string) => call<Me>("GET", "/users/me", { token });

async function open(page: Page, who: Customer, path = "/account/settings") {
  await signIn(page, who, path);
  await page.goto(path);
  await hydrated(page);
}

test.describe("profile", () => {
  test("rules, save, clear the email, and a backend rejection on the field", async ({
    page,
    accounts,
  }) => {
    const who = await customer(accounts, "profile");
    await open(page, who);
    const f = form(page, "profile");
    await expect(field(f, "name")).toHaveValue(who.name);
    await expect(field(f, "email")).toHaveValue("");

    // The same rules as the backend, before anything is sent.
    await field(f, "name").fill("   ");
    await field(f, "email").fill("not-an-email");
    await save(f).click();
    await expect(fieldError(f, "name")).toHaveText("اكتب اسمك.");
    await expect(fieldError(f, "email")).toHaveText(
      "البريد الإلكتروني غير صحيح.",
    );
    expect(await me(who.token)).toMatchObject({ name: who.name, email: null });

    await field(f, "name").fill("e".repeat(101));
    await save(f).click();
    await expect(fieldError(f, "name")).toHaveText("الاسم طويل جدًا.");

    await field(f, "name").fill("e2e-profile جديد");
    await field(f, "email").fill("e2e-profile@example.com");
    await save(f).click();
    await expect(toast(page)).toContainText("تم حفظ بياناتك");
    await expect(page).toHaveURL(/\/account\/settings(#\w+)?$/);
    expect(await me(who.token)).toMatchObject({
      name: "e2e-profile جديد",
      email: "e2e-profile@example.com",
    });
    await expect(field(form(page, "profile"), "email")).toHaveValue(
      "e2e-profile@example.com",
    );
    await expect(page.locator(".lm-acct span:visible")).toHaveText(
      "e2e-profile",
    );

    // A blank email removes it.
    await field(form(page, "profile"), "email").fill("");
    await save(form(page, "profile")).click();
    await expect(toast(page)).toContainText("تم حفظ بياناتك");
    await expect.poll(async () => (await me(who.token)).email).toBeNull();
    // The page re-renders after the save (the form is rebuilt with what was stored).
    await page.waitForLoadState("networkidle");
    await expect(field(form(page, "profile"), "email")).toHaveValue("");

    // An address the page accepts but the backend refuses is shown on the email field.
    const again = form(page, "profile");
    await field(again, "email").fill("someone@example.test");
    await save(again).click();
    await expect(fieldError(again, "email")).toBeVisible();
    expect((await me(who.token)).email).toBeNull();
  });
});

test.describe("phone", () => {
  test("a wrong or missing password, an invalid or taken number, then the change", async ({
    page,
    accounts,
  }) => {
    const who = await customer(accounts, "phone");
    const other = uniquePhone();
    accounts.phone(other.e164);
    await registerViaApi("e2e-phone-other", other.e164, PASSWORD);
    const target = uniquePhone();
    accounts.phone(target.e164, PASSWORD);

    await open(page, who);
    await expect(page.getByTestId("current-phone")).toHaveText(who.e164);
    const f = form(page, "phone");
    await expect(field(f, "currentPassword")).toBeVisible();

    await save(f).click();
    await expect(fieldError(f, "phone")).toHaveText("أدخل رقم هاتفك.");
    await expect(fieldError(f, "currentPassword")).toHaveText(
      "أدخل كلمة المرور.",
    );

    await field(f, "phone").fill("12");
    await field(f, "currentPassword").fill(PASSWORD);
    await save(f).click();
    await expect(fieldError(f, "phone")).toHaveText("رقم الهاتف غير صحيح.");

    // A number of another account: the backend's own message, on the phone field.
    await field(f, "phone").fill(other.national);
    await save(f).click();
    await expect(fieldError(f, "phone")).toHaveText(
      "رقم الهاتف مستخدم في حساب آخر.",
    );

    // A wrong current password is refused on its own field; nothing changed.
    await field(f, "phone").fill(target.national);
    await field(f, "currentPassword").fill("E2e-wrong-pass-1");
    await save(f).click();
    await expect(fieldError(f, "currentPassword")).toBeVisible();
    expect((await me(who.token)).phone).toBe(who.e164);

    await field(f, "currentPassword").fill(PASSWORD);
    await save(f).click();
    await expect(toast(page)).toContainText("تم تغيير رقم الهاتف");
    await expect(page.getByTestId("current-phone")).toHaveText(target.e164);
    // The form is empty again and the session went on (no SMS, no new login).
    await expect(field(form(page, "phone"), "phone")).toHaveValue("");
    expect((await me(who.token)).phone).toBe(target.e164);
    await loginViaApi(target.e164, PASSWORD);
    await expect(loginViaApi(who.e164, PASSWORD)).rejects.toBeInstanceOf(
      BackendError,
    );
    await page.reload();
    await expect(page.getByTestId("current-phone")).toHaveText(target.e164);
  });
});

test.describe("password", () => {
  test("the rules, a wrong current password, then a change that keeps this session only", async ({
    page,
    accounts,
  }) => {
    const who = await customer(accounts, "password");
    accounts.phone(who.e164, PASSWORD, NEW_PASSWORD);
    const otherDevice = await loginViaApi(who.e164, PASSWORD);
    await open(page, who);
    const f = form(page, "password");
    const type = async (current: string, next: string, confirm = next) => {
      await field(f, "currentPassword").fill(current);
      await field(f, "newPassword").fill(next);
      await field(f, "confirmPassword").fill(confirm);
      await save(f).click();
    };

    await type(PASSWORD, "12345678");
    await expect(fieldError(f, "newPassword")).toHaveText(
      "يجب ألا تتكون كلمة المرور من أرقام فقط.",
    );
    await type(PASSWORD, "short1");
    await expect(fieldError(f, "newPassword")).toHaveText(
      "يجب أن تتكون كلمة المرور من 8 أحرف على الأقل.",
    );
    await type(PASSWORD, who.e164);
    await expect(fieldError(f, "newPassword")).toHaveText(
      "يجب ألا تكون كلمة المرور رقم الهاتف.",
    );
    await type(PASSWORD, PASSWORD);
    await expect(fieldError(f, "newPassword")).toHaveText(
      "يجب أن تختلف كلمة المرور الجديدة عن الحالية.",
    );
    await type(PASSWORD, NEW_PASSWORD, "E2e-other-pass-5");
    await expect(fieldError(f, "confirmPassword")).toHaveText(
      "كلمتا المرور غير متطابقتين.",
    );

    // The backend refuses a wrong current password, on that field.
    await type("E2e-wrong-pass-1", NEW_PASSWORD);
    await expect(fieldError(f, "currentPassword")).toBeVisible();
    await loginViaApi(who.e164, PASSWORD);

    const before = {
      at: await cookieValue(page, AT),
      rt: await cookieValue(page, RT),
    };
    await type(PASSWORD, NEW_PASSWORD);
    await expect(toast(page)).toContainText("تم تغيير كلمة المرور");
    await expect(page).toHaveURL(/\/account\/settings(#\w+)?$/);

    // New password in, old one out; the other device is signed out; this one stays in.
    await loginViaApi(who.e164, NEW_PASSWORD);
    await expect(loginViaApi(who.e164, PASSWORD)).rejects.toBeInstanceOf(
      BackendError,
    );
    await expect(
      call("POST", "/auth/refresh", {
        body: { refresh_token: otherDevice.refresh_token },
      }),
    ).rejects.toBeInstanceOf(BackendError);
    const after = {
      at: await cookieValue(page, AT),
      rt: await cookieValue(page, RT),
    };
    expect(after.at).toBeTruthy();
    expect(after.at).not.toBe(before.at);
    expect(after.rt).not.toBe(before.rt);
    await page.goto("/account/settings");
    await expect(page).toHaveURL(/\/account\/settings(#\w+)?$/);
    await expect(form(page, "profile")).toBeVisible();

    // Nothing of the new session is in the page.
    const html = await page.content();
    const raw = await (await page.request.get("/account/settings")).text();
    for (const secret of [after.at ?? "-", after.rt ?? "-"]) {
      expect(html).not.toContain(secret);
      expect(raw).not.toContain(secret);
    }
    const storage = await page.evaluate(() => ({
      local: JSON.stringify({ ...localStorage }),
      session: JSON.stringify({ ...sessionStorage }),
      cookie: document.cookie,
    }));
    for (const value of Object.values(storage)) {
      expect(value).not.toContain(after.at ?? "-");
      expect(value).not.toContain(after.rt ?? "-");
    }
  });

  test("the password page works the same for a regular account", async ({
    page,
    accounts,
  }) => {
    const who = await customer(accounts, "pwpage");
    accounts.phone(who.e164, PASSWORD, NEW_PASSWORD);
    await open(page, who, "/account/change-password");
    await expect(page.locator(".lm-note")).toHaveCount(0);
    const f = form(page, "password");
    await field(f, "currentPassword").fill("E2e-wrong-pass-1");
    await field(f, "newPassword").fill(NEW_PASSWORD);
    await field(f, "confirmPassword").fill(NEW_PASSWORD);
    await save(f).click();
    await expect(fieldError(f, "currentPassword")).toBeVisible();
    await field(f, "currentPassword").fill(PASSWORD);
    await save(f).click();
    await page.waitForURL("/account");
    await expect(toast(page)).toContainText("تم تغيير كلمة المرور");
    await loginViaApi(who.e164, NEW_PASSWORD);
  });
});

test.describe("notification preferences", () => {
  test("one switch per backend key, saved at once, and no switch for order updates", async ({
    page,
    accounts,
  }) => {
    const who = await customer(accounts, "prefs");
    await open(page, who);
    const keys = [
      "notify_marketing",
      "notify_favorites",
      "notify_cart_reminders",
    ];
    const listed = Object.keys(await preferences(who.token)).filter(
      (key) => key !== "order_updates",
    );
    expect(listed.sort()).toEqual([...keys].sort());

    await expect(page.locator(".lm-pref")).toHaveCount(keys.length);
    await expect(page.locator(".lm-pref input[type=checkbox]")).toHaveCount(
      keys.length,
    );
    await expect(
      page.locator('.lm-pref [name="key"][value="order_updates"]'),
    ).toHaveCount(0);
    await expect(page.getByTestId("order-updates-note")).toHaveText(
      "إشعارات طلباتك تُرسل دائمًا ولا يمكن إيقافها.",
    );
    // No "حفظ" button with JavaScript.
    await expect(page.locator(".lm-pref button")).toHaveCount(0);

    for (const key of keys) {
      const row = page.locator(`[data-pref="${key}"]`);
      await expect(row.locator("input[type=checkbox]")).toBeChecked();
      await row.locator("label.lm-toggle").click();
      await expect(row.locator("input[type=checkbox]")).not.toBeChecked();
      await expect(toast(page)).toContainText("تم حفظ تفضيل الإشعارات");
      await expect
        .poll(
          async () =>
            (await preferences(who.token))[
              key as keyof Awaited<ReturnType<typeof preferences>>
            ],
        )
        .toBe(false);
    }
    await page.reload();
    await hydrated(page);
    for (const key of keys)
      await expect(
        page.locator(`[data-pref="${key}"] input[type=checkbox]`),
      ).not.toBeChecked();

    // Back on, one by one, and it stays.
    for (const key of keys) {
      await page.locator(`[data-pref="${key}"] label.lm-toggle`).click();
      await expect
        .poll(
          async () =>
            (await preferences(who.token))[
              key as keyof Awaited<ReturnType<typeof preferences>>
            ],
        )
        .toBe(true);
    }
    await page.reload();
    for (const key of keys)
      await expect(
        page.locator(`[data-pref="${key}"] input[type=checkbox]`),
      ).toBeChecked();
    expect((await preferences(who.token)).order_updates).toBe(true);
  });
});

test.describe("notification preferences, when saving fails", () => {
  test("the switch moves back and says why; nothing is saved", async ({
    page,
    accounts,
  }) => {
    const who = await customer(accounts, "rollback");
    await open(page, who);
    // The connection drops for the server action's request.
    await page.route("**/account/settings", (route) =>
      route.request().method() === "POST" &&
      route.request().headers()["next-action"]
        ? route.abort()
        : route.continue(),
    );
    const row = page.locator('[data-pref="notify_marketing"]');
    await row.locator("label.lm-toggle").click();
    await expect(
      row.locator('[data-field-error="notify_marketing"]'),
    ).toHaveText("تعذّر الاتصال بالخادم. تحقّق من اتصالك وحاول مرة أخرى.");
    await expect(row.locator("input[type=checkbox]")).toBeChecked();
    expect((await preferences(who.token)).notify_marketing).toBe(true);

    // Back online: the same switch works.
    await page.unroute("**/account/settings");
    await row.locator("label.lm-toggle").click();
    await expect(row.locator("input[type=checkbox]")).not.toBeChecked();
    await expect(row.locator("[data-field-error]")).toHaveCount(0);
    await expect
      .poll(async () => (await preferences(who.token)).notify_marketing)
      .toBe(false);
  });
});

test.describe("without JavaScript", () => {
  test("profile, phone, password and each preference are plain forms", async ({
    page,
    browser,
    accounts,
  }) => {
    test.setTimeout(120_000);
    const who = await customer(accounts, "nojs");
    const target = uniquePhone();
    accounts.phone(target.e164, PASSWORD, NEW_PASSWORD);
    await signIn(page, who, "/");
    const plain = await browser.newContext({
      storageState: await page.context().storageState(),
      javaScriptEnabled: false,
      locale: "ar",
    });
    const nojs = await plain.newPage();
    await nojs.goto("/account/settings");

    // Profile: the failure comes back on the field with what was typed.
    let f = nojs.locator('[data-settings-form="profile"]');
    await f.locator('[data-field="name"]').fill("");
    await f.locator('[data-field="email"]').fill("bad");
    await save(f).click();
    await expect(nojs).toHaveURL(/fs=/);
    f = nojs.locator('[data-settings-form="profile"]');
    await expect(fieldError(f, "name")).toHaveText("اكتب اسمك.");
    await expect(fieldError(f, "email")).toBeVisible();
    await expect(f.locator('[data-field="email"]')).toHaveValue("bad");
    await f.locator('[data-field="name"]').fill("e2e-nojs جديد");
    await f.locator('[data-field="email"]').fill("e2e-nojs@example.com");
    await save(f).click();
    await expect(nojs).toHaveURL(/\/account\/settings(#\w+)?$/);
    await expect(nojs.locator(".lm-toast").first()).toContainText(
      "تم حفظ بياناتك",
    );
    expect(await me(who.token)).toMatchObject({
      name: "e2e-nojs جديد",
      email: "e2e-nojs@example.com",
    });

    // Phone: a wrong password first, then the change.
    f = nojs.locator('[data-settings-form="phone"]');
    await f.locator('[data-field="phone"]').fill(target.national);
    await f.locator('[data-field="currentPassword"]').fill("E2e-wrong-pass-1");
    await save(f).click();
    f = nojs.locator('[data-settings-form="phone"]');
    await expect(fieldError(f, "currentPassword")).toBeVisible();
    await f.locator('[data-field="currentPassword"]').fill(PASSWORD);
    await save(f).click();
    await expect(nojs.getByTestId("current-phone")).toHaveText(target.e164);

    // Preferences: each switch has its own small save button.
    const row = nojs.locator('[data-pref="notify_favorites"]');
    await expect(nojs.locator(".lm-pref button")).toHaveCount(3);
    await row.locator("label.lm-toggle").click();
    await row.locator("button").click();
    await expect(nojs).toHaveURL(/\/account\/settings/);
    await expect
      .poll(async () => (await preferences(who.token)).notify_favorites)
      .toBe(false);
    await expect(
      nojs.locator('[data-pref="notify_favorites"] input[type=checkbox]'),
    ).not.toBeChecked();
    expect((await preferences(who.token)).notify_marketing).toBe(true);

    // Password: the rules and the backend's refusal come back; then the change signs this
    // browser in again with the new cookies.
    f = nojs.locator('[data-settings-form="password"]');
    await f.locator('[data-field="currentPassword"]').fill(PASSWORD);
    await f.locator('[data-field="newPassword"]').fill("12345678");
    await f.locator('[data-field="confirmPassword"]').fill("12345678");
    await save(f).click();
    f = nojs.locator('[data-settings-form="password"]');
    await expect(fieldError(f, "newPassword")).toHaveText(
      "يجب ألا تتكون كلمة المرور من أرقام فقط.",
    );
    await f.locator('[data-field="currentPassword"]').fill("E2e-wrong-pass-1");
    await f.locator('[data-field="newPassword"]').fill(NEW_PASSWORD);
    await f.locator('[data-field="confirmPassword"]').fill(NEW_PASSWORD);
    await save(f).click();
    f = nojs.locator('[data-settings-form="password"]');
    await expect(fieldError(f, "currentPassword")).toBeVisible();
    await f.locator('[data-field="currentPassword"]').fill(PASSWORD);
    await f.locator('[data-field="newPassword"]').fill(NEW_PASSWORD);
    await f.locator('[data-field="confirmPassword"]').fill(NEW_PASSWORD);
    await save(f).click();
    await expect(nojs).toHaveURL(/\/account\/settings(#\w+)?$/);
    await expect(nojs.locator(".lm-toast").first()).toContainText(
      "تم تغيير كلمة المرور",
    );
    await loginViaApi(target.e164, NEW_PASSWORD);
    await nojs.goto("/account/settings");
    await expect(nojs).toHaveURL(/\/account\/settings(#\w+)?$/);
    await plain.close();
  });
});

test("another customer's data is never in the page", async ({
  page,
  accounts,
}) => {
  const a = await customer(accounts, "mine");
  const b = await customer(accounts, "theirs");
  await open(page, a);
  const html = await page.content();
  expect(html).toContain(a.e164);
  expect(html).not.toContain(b.e164);
  expect(html).not.toContain(b.name);
});
