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
    "دخلت عن طريق Google",
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
