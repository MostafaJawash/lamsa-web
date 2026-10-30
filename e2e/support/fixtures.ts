import { test as base, expect, type Page } from "@playwright/test";

import {
  call,
  deleteGoogleAccount,
  deletePhoneAccount,
  PASSWORD,
  uniqueIp,
} from "./backend";

/** Accounts a test creates; all deleted (DELETE /users/me) when the test ends. */
export class Accounts {
  private readonly phones = new Map<string, Set<string>>();
  private readonly tokens = new Map<string, string>();
  private readonly googleSubs = new Set<string>();
  private readonly orderIds = new Set<number>();

  /** `passwords`: every password the account may have by the end (tries each). */
  phone(e164: string, ...passwords: string[]) {
    const known = this.phones.get(e164) ?? new Set<string>();
    for (const password of passwords.length ? passwords : [PASSWORD])
      known.add(password);
    this.phones.set(e164, known);
  }

  /** An access token of the account (cleanup without logging in, e.g. a locked phone). */
  token(e164: string, accessToken: string) {
    this.tokens.set(e164, accessToken);
  }

  google(sub: string) {
    this.googleSubs.add(sub);
  }

  /** An order the test made: cancelled by the store at the end, so its stock comes back. */
  order(id: number) {
    this.orderIds.add(id);
  }

  async cleanup() {
    await this.cancelOrders();
    for (const [phone, passwords] of this.phones)
      await deletePhoneAccount(phone, [...passwords], this.tokens.get(phone));
    for (const sub of this.googleSubs) await deleteGoogleAccount(sub);
  }

  private async cancelOrders() {
    if (this.orderIds.size === 0) return;
    const phone = process.env.E2E_ADMIN_PHONE;
    const password = process.env.E2E_ADMIN_PASSWORD;
    if (!phone || !password) return;
    const { loginViaApi } = await import("./backend");
    const admin = await loginViaApi(phone, password);
    for (const id of this.orderIds) {
      try {
        await call("POST", `/admin/orders/${id}/cancel`, {
          token: admin.access_token,
          body: { reason: "e2e cleanup", restore_stock: true },
        });
      } catch {
        // Already cancelled, or delivered: nothing to give back.
      }
    }
  }
}

type Fixtures = { visitorIp: string; accounts: Accounts };

export const test = base.extend<Fixtures>({
  visitorIp: async ({}, provide) => {
    await provide(uniqueIp());
  },
  // Each test is its own visitor for the backend's per-IP login limits: the production
  // e2e server runs with WEB_TRUST_PROXY_HEADERS=true, like behind our Nginx.
  extraHTTPHeaders: async ({ visitorIp }, provide) => {
    await provide({ "X-Real-IP": visitorIp });
  },
  accounts: async ({}, provide) => {
    const accounts = new Accounts();
    await provide(accounts);
    await accounts.cleanup();
  },
});

export { expect };

/** The auth form's primary submit button (not the header search or the logout forms). */
export function submitButton(page: Page) {
  return page.locator(".lm-auth button[type=submit].primary:visible");
}

/** Waits for hydration (the submit button is disabled until then). */
export async function ready(page: Page) {
  await expect(submitButton(page)).toBeEnabled({ timeout: 30_000 });
}

export async function fillLogin(
  page: Page,
  national: string,
  password: string,
) {
  await ready(page);
  await page.locator('[data-field="phone"]:visible').fill(national);
  await page.locator('[data-field="password"]:visible').fill(password);
  await submitButton(page).click();
}

export async function cookieValue(page: Page, name: string) {
  return (await page.context().cookies()).find((cookie) => cookie.name === name)
    ?.value;
}
