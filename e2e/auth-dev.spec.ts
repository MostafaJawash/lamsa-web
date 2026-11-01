import { PASSWORD, registerViaApi, uniquePhone } from "./support/backend";
import {
  cookieValue,
  expect,
  ready,
  submitButton,
  test,
} from "./support/fixtures";

// `next dev` against the backend (GOOGLE_DEV_MODE=true there): the dev Google button.
test.describe.configure({ timeout: 180_000 });

async function clickDevGoogle(page: import("@playwright/test").Page) {
  await page.goto("/login", { timeout: 150_000 });
  await ready(page);
  const button = page.locator(".lm-btn.google");
  await expect(button).toHaveText(/دخول تجريبي بـ Google/);
  await button.click();
}

test("Google dev: a new user completes the profile, then comes back", async ({
  page,
  accounts,
}) => {
  await clickDevGoogle(page);
  await page.waitForURL("/complete-profile", { timeout: 60_000 });
  const sub = (await cookieValue(page, "lamsa_devg")) ?? "";
  expect(sub).toMatch(/^[a-f0-9]{16}$/);
  accounts.google(sub);

  // Signup token: its own short-lived httpOnly cookie, never in the URL or the page.
  const signup = (await page.context().cookies()).find(
    (cookie) => cookie.name === "lamsa_su",
  );
  expect(signup?.httpOnly).toBe(true);
  expect((signup?.expires ?? 0) - Date.now() / 1000).toBeLessThanOrEqual(600);
  expect(await page.content()).not.toContain(signup?.value ?? "-");

  await ready(page);
  await expect(page.locator('[data-field="name"]:visible')).toHaveValue(
    "مستخدم تجريبي",
  );
  await page.locator('[data-field="name"]:visible').fill("e2e-google تجربة");
  await page
    .locator('[data-field="phone"]:visible')
    .fill(uniquePhone().national);
  await submitButton(page).click();
  await page.waitForURL("/", { timeout: 60_000 });
  await expect(page.locator(".lm-acct span:visible")).toHaveText("e2e-google");
  expect(await cookieValue(page, "lamsa_su")).toBeUndefined();

  await page.goto("/account");
  await expect(page.locator(".lm-profile .meta").last()).toHaveText(
    "سجّلت الدخول عبر Google",
  );
  await page
    .locator(".lm-profile button", { hasText: /^تسجيل الخروج$/ })
    .click();
  await page.waitForURL("/");

  // Same browser, same dev cookie: the same (now registered) user, straight in.
  await clickDevGoogle(page);
  await page.waitForURL("/", { timeout: 60_000 });
  await expect(page.locator(".lm-acct span:visible")).toHaveText("e2e-google");
});

test("Google dev: PHONE_TAKEN on complete-profile", async ({
  page,
  accounts,
}) => {
  const taken = uniquePhone();
  accounts.phone(taken.e164);
  await registerViaApi("e2e-taken", taken.e164, PASSWORD);

  await clickDevGoogle(page);
  await page.waitForURL("/complete-profile", { timeout: 60_000 });
  accounts.google((await cookieValue(page, "lamsa_devg")) ?? "");
  await ready(page);
  await page.locator('[data-field="phone"]:visible').fill(taken.national);
  await submitButton(page).click();
  await expect(
    page.locator('[data-field-error="phone"]:visible'),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/complete-profile$/);
});

test("Google account settings: no password anywhere, the phone changes without one", async ({
  page,
  accounts,
}) => {
  await clickDevGoogle(page);
  await page.waitForURL("/complete-profile", { timeout: 60_000 });
  const sub = (await cookieValue(page, "lamsa_devg")) ?? "";
  accounts.google(sub);
  await ready(page);
  await page.locator('[data-field="name"]:visible').fill("e2e-google إعدادات");
  await page
    .locator('[data-field="phone"]:visible')
    .fill(uniquePhone().national);
  await submitButton(page).click();
  await page.waitForURL("/", { timeout: 60_000 });

  await page.goto("/account/settings", { timeout: 150_000 });
  await page.locator('html[data-hydrated="1"]').waitFor({ timeout: 60_000 });
  // The password section only explains; the phone form has no password field.
  await expect(page.getByTestId("google-password-note")).toBeVisible();
  await expect(page.locator('[data-settings-form="password"]')).toHaveCount(0);
  const phoneForm = page.locator('[data-settings-form="phone"]:visible');
  await expect(phoneForm).toBeVisible();
  await expect(phoneForm.locator('[data-field="currentPassword"]')).toHaveCount(
    0,
  );

  // The Google address (not one the backend would accept as new) stays when only the name changes.
  const profile = page.locator('[data-settings-form="profile"]:visible');
  await expect(profile.locator('[data-field="email"]')).toHaveValue(
    /^dev-[a-f0-9]{16}@example\.test$/,
  );
  await profile.locator('[data-field="name"]').fill("e2e-google جديد");
  await profile.locator("button[type=submit]").click();
  await expect(page.locator(".lm-toast").first()).toContainText(
    "تم حفظ بياناتك",
  );

  const target = uniquePhone();
  await phoneForm.locator('[data-field="phone"]').fill(target.national);
  await phoneForm.locator("button[type=submit]").click();
  await expect(page.locator(".lm-toast").first()).toContainText(
    "تم تغيير رقم الهاتف",
  );
  await expect(page.getByTestId("current-phone")).toHaveText(target.e164);

  // The password page explains too; the backend's own guard is NOT_A_PASSWORD_ACCOUNT.
  await page.goto("/account/change-password");
  await expect(page.locator(".lm-note")).toContainText("Google");
  await expect(page.locator('[data-settings-form="password"]')).toHaveCount(0);
});
