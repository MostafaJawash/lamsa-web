import type { Page } from "@playwright/test";

import {
  PASSWORD,
  registerViaApi,
  uniquePhone,
  type TokenPair,
} from "./support/backend";
import { cookieValue, expect, fillLogin, test } from "./support/fixtures";
import {
  addFromProductPage,
  cookieNames,
  euro,
  GUEST_CART,
  GUEST_FAVORITES,
  previewOf,
  product,
  setGuestCart,
  setGuestFavorites,
} from "./support/shop";

/**
 * Cart and favorites (guest and logged in), without changing stock or settings (those
 * tests are in stock.spec.ts). Each test is its own visitor: guest data lives in that
 * browser context's cookies; accounts are e2e-… and deleted afterwards.
 */

const SHAMPOO = "/p/demo-argan-shampoo"; // simple, 3.95
const SERUM = "/p/demo-vitamin-c-serum"; // simple, on sale
const LIPSTICK = "/p/demo-velvet-lipstick"; // variable

const desktopBadge = (page: Page, label: "السلة" | "المفضلة") =>
  page.locator(`.lm-dicons a[aria-label="${label}"] .lm-badge`);
const lines = (page: Page) => page.locator(".lm-line:visible");
const summary = (page: Page) => page.locator(".lm-summary:visible");

async function register(accounts: { phone(e164: string): void }) {
  const phone = uniquePhone();
  accounts.phone(phone.e164);
  const pair = await registerViaApi(`e2e-cart-${Date.now()}`, phone.e164);
  return { phone, pair };
}

async function loginThroughSite(page: Page, national: string, next = "/") {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await fillLogin(page, national, PASSWORD);
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

/** The response of the next server action call (POST with a Next-Action header). */
function actionResponse(page: Page) {
  return page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      !!response.request().headers()["next-action"],
  );
}

/** Server action POSTs (Next-Action header) made while `run` runs. */
async function actionCalls(page: Page, run: () => Promise<void>) {
  let count = 0;
  const listener = (request: {
    method(): string;
    headers(): Record<string, string>;
  }) => {
    if (request.method() === "POST" && request.headers()["next-action"])
      count++;
  };
  page.on("request", listener);
  await run();
  page.off("request", listener);
  return count;
}

test.describe("guest cart", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("add, update, remove and clear, with the backend's totals", async ({
    page,
  }) => {
    const shampoo = await product("demo-argan-shampoo");
    await addFromProductPage(page, SHAMPOO);
    await expect(page.locator(".lm-toast").first()).toContainText(
      "انضاف للسلة",
    );
    await expect(desktopBadge(page, "السلة")).toHaveText("1");
    expect(await cookieNames(page)).toContain(GUEST_CART);

    await page.goto("/cart");
    await expect(lines(page)).toHaveCount(1);
    await expect(lines(page).first()).toContainText(shampoo.name);
    const one = await previewOf([{ product_id: shampoo.id, quantity: 1 }]);
    await expect(summary(page)).toContainText(euro(one.subtotal));

    const plus = lines(page).first().getByRole("button", { name: "أكتر" });
    await plus.click();
    await plus.click();
    await expect(lines(page).first().locator(".lm-qty span")).toHaveText("3");
    const three = await previewOf([{ product_id: shampoo.id, quantity: 3 }]);
    await expect(summary(page)).toContainText(euro(three.subtotal));
    await expect(desktopBadge(page, "السلة")).toHaveText("3");

    await lines(page).first().getByRole("button", { name: /^احذف/ }).click();
    await expect(page.getByText("سلتك فاضية")).toBeVisible();
    await expect(desktopBadge(page, "السلة")).toHaveCount(0);

    await addFromProductPage(page, SERUM);
    await page.goto("/cart");
    await page.waitForLoadState("networkidle"); // hydrated
    await page.getByRole("button", { name: "إفراغ السلة" }).click();
    const done = actionResponse(page);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "إفراغ" })
      .click();
    await expect(page.getByText("سلتك فاضية")).toBeVisible(); // optimistic
    await done; // the server action finished
    await page.reload();
    await expect(page.getByText("سلتك فاضية")).toBeVisible();
  });

  test("quantity is optimistic, debounced and reconciled with the server", async ({
    page,
  }) => {
    await addFromProductPage(page, SHAMPOO);
    await page.goto("/cart");
    const plus = lines(page).first().getByRole("button", { name: "أكتر" });
    await plus.waitFor();
    await page.waitForLoadState("networkidle");
    const calls = await actionCalls(page, async () => {
      await plus.click();
      await plus.click();
      await plus.click();
      // Shown at once, before any answer.
      await expect(lines(page).first().locator(".lm-qty span")).toHaveText("4");
      await page.waitForTimeout(1_200);
      await page.waitForLoadState("networkidle");
    });
    expect(calls).toBe(1); // one update for three clicks (300 ms debounce)
    await page.reload();
    await expect(lines(page).first().locator(".lm-qty span")).toHaveText("4");
  });

  test("the summary has the free-shipping bar and the savings row", async ({
    page,
  }) => {
    await addFromProductPage(page, SERUM);
    await page.goto("/cart");
    await expect(summary(page).locator(".lm-freebar")).toBeVisible();
    await expect(summary(page)).toContainText("لتوصل للشحن المجاني");
    await expect(summary(page)).toContainText("وفّرت");
    await expect(
      summary(page).getByRole("link", { name: "إتمام الطلب" }),
    ).toHaveAttribute("href", "/checkout");
  });

  test("checkout as a guest goes to login with next=/checkout and back", async ({
    page,
    accounts,
  }) => {
    const { phone } = await register(accounts);
    await addFromProductPage(page, SHAMPOO);
    await page.goto("/cart");
    await summary(page).getByRole("link", { name: "إتمام الطلب" }).click();
    await page.waitForURL(/\/login\?next=%2Fcheckout$/);
    await fillLogin(page, phone.national, PASSWORD);
    await page.waitForURL("/checkout");
  });

  test("limits: quantity per line, lines in the cart", async ({
    page,
    context,
  }) => {
    // 12 in stock, at most 10 per line.
    const shampoo = await product("demo-argan-shampoo");
    await setGuestCart(context, [[shampoo.id, 0, 10, shampoo.slug]]);
    await addFromProductPage(page, SHAMPOO);
    await expect(page.locator(".lm-toast").first()).toContainText(
      /الحد الأقصى|باقي/,
    );

    const full = Array.from(
      { length: 50 },
      (_, i) =>
        [900_000 + i, 0, 1, `e2e-${i}`] as [number, number, number, string],
    );
    await setGuestCart(context, full);
    await addFromProductPage(page, SERUM);
    await expect(page.locator(".lm-toast").first()).not.toContainText(
      "انضاف للسلة",
    );
  });

  test("garbage or tampered cookies are reset safely", async ({
    page,
    context,
  }) => {
    await setGuestCart(context, "garbage");
    await setGuestFavorites(context, "v9.e30");
    await page.goto("/cart");
    await expect(page.getByText("سلتك فاضية")).toBeVisible();
    // Reset: gone, or an empty value (Next.js re-sends cleared request cookies).
    expect((await cookieValue(page, GUEST_CART)) ?? "").toBe("");
    expect((await cookieValue(page, GUEST_FAVORITES)) ?? "").toBe("");
    // A well-formed cookie with an unknown product: an unavailable line, never trusted.
    await setGuestCart(context, [[987_654, 0, 2, "fake-slug"]]);
    await page.goto("/cart");
    await expect(lines(page)).toHaveCount(1);
    await expect(lines(page).first()).toContainText("منتج غير متوفر");
    await expect(lines(page).first()).toContainText("المنتج ما عاد متوفر");
    await expect(
      summary(page).getByRole("button", { name: "إتمام الطلب" }),
    ).toBeDisabled();
  });
});

test.describe("guest favorites", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("hearts are toggles, in sync on the page, listed on /favorites", async ({
    page,
  }) => {
    await page.goto("/");
    const heart = page
      .getByRole("region", { name: "وصل حديثاً" })
      .locator("button.lm-fav")
      .first();
    const id = await heart.getAttribute("data-product-id");
    await page.waitForLoadState("networkidle");
    await heart.click();
    await expect(page.locator(".lm-toast").first()).toContainText(
      "انحفظ بالمفضلة",
    );
    const same = page.locator(`button.lm-fav[data-product-id="${id}"]:visible`);
    for (const button of await same.all())
      await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(desktopBadge(page, "المفضلة")).toHaveText("1");

    await page.reload();
    await expect(heart).toHaveAttribute("aria-pressed", "true");

    await page.goto("/favorites");
    await expect(page.locator(".lm-grid:visible .lm-card")).toHaveCount(1);
    await page.getByRole("button", { name: /^احذف من المفضلة/ }).click();
    await expect(page.locator(".lm-toast").first()).toContainText(
      "انشال من المفضلة",
    );
    await expect(page.getByText("المفضلة فاضية")).toBeVisible();
    await expect(desktopBadge(page, "المفضلة")).toHaveCount(0);
  });

  test("move to cart: simple and variable (first variant in stock)", async ({
    page,
  }) => {
    const lipstick = await product("demo-velvet-lipstick");
    for (const path of [SHAMPOO, LIPSTICK]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await page.locator(".lm-buy .lm-fav-lg:visible").click();
      await expect(page.locator(".lm-toast").first()).toContainText("انحفظ");
    }
    await page.goto("/favorites");
    for (let i = 0; i < 2; i++) {
      await page.getByRole("button", { name: "انقل للسلة" }).first().click();
      await expect(page.locator(".lm-toast").first()).toContainText(
        "انتقل للسلة",
      );
      await page.waitForLoadState("networkidle");
    }
    await expect(page.getByText("المفضلة فاضية")).toBeVisible();
    await page.goto("/cart");
    await expect(lines(page)).toHaveCount(2);
    const first = lipstick.variants.find((v) => v.stock_status !== "out");
    await expect(
      page.locator(`.lm-line[data-line="${lipstick.id}:${first?.id}"]`),
    ).toBeVisible();
  });

  test("the favorites limit", async ({ page, context }) => {
    await setGuestFavorites(
      context,
      Array.from(
        { length: 200 },
        (_, i) => [800_000 + i, ""] as [number, string],
      ),
    );
    await page.goto(SHAMPOO);
    await page.waitForLoadState("networkidle");
    const heart = page.locator(".lm-buy .lm-fav-lg:visible");
    await heart.click();
    await expect(page.locator(".lm-toast").first()).not.toContainText("انحفظ");
    await expect(heart).toHaveAttribute("aria-pressed", "false");
  });
});

test.describe("login merge", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("cart and favorites move into the account, with a toast; cookies cleared", async ({
    page,
    accounts,
  }) => {
    const { phone, pair } = await register(accounts);
    await addFromProductPage(page, SHAMPOO);
    await addFromProductPage(page, SERUM);
    await page.locator(".lm-buy .lm-fav-lg:visible").click();
    await expect(page.locator(".lm-toast").first()).toContainText("انحفظ");

    await loginThroughSite(page, phone.national, "/cart");
    await expect(page.locator(".lm-toast").first()).toContainText(
      "رجّعنالك منتجين من سلتك",
    );
    expect(await cookieNames(page)).not.toContain(GUEST_CART);
    expect(await cookieNames(page)).not.toContain(GUEST_FAVORITES);
    await page.goto("/cart");
    await expect(lines(page)).toHaveCount(2);
    await expect(desktopBadge(page, "المفضلة")).toHaveText("1");
    await checkNoSecrets(page, pair);
  });

  test("capped and skipped items: a second toast line", async ({
    page,
    context,
    accounts,
  }) => {
    const { phone } = await register(accounts);
    const shampoo = await product("demo-argan-shampoo");
    await setGuestCart(context, [
      [shampoo.id, 0, 40, shampoo.slug], // capped at 10
      [987_654, 0, 1, "gone"], // skipped
    ]);
    await loginThroughSite(page, phone.national, "/");
    const toast = page.locator(".lm-toast").first();
    await expect(toast).toContainText("رجّعنالك منتج واحد من سلتك");
    await expect(toast).toContainText("بعض المنتجات تعدّلت حسب المخزون");
  });
});

async function checkNoSecrets(page: Page, pair: TokenPair) {
  const html = await page.content();
  const access = await cookieValue(page, "__Host-lamsa_at");
  for (const secret of [pair.access_token, pair.refresh_token, access ?? "-"])
    expect(html).not.toContain(secret);
  expect(await page.evaluate(() => document.cookie)).not.toMatch(
    /lamsa_(at|rt|gcart|gfav)/,
  );
}

test.describe("logged in", () => {
  test("add from the product page and the favorites page; badges", async ({
    page,
    accounts,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const { phone, pair } = await register(accounts);
    await loginThroughSite(page, phone.national);
    await addFromProductPage(page, LIPSTICK);
    await expect(desktopBadge(page, "السلة")).toHaveText("1");
    await page.goto(SERUM);
    await page.waitForLoadState("networkidle");
    await page.locator(".lm-buy .lm-fav-lg:visible").click();
    await expect(desktopBadge(page, "المفضلة")).toHaveText("1");
    await page.goto("/favorites");
    await page.getByRole("button", { name: "انقل للسلة" }).click();
    await expect(page.locator(".lm-toast").first()).toContainText(
      "انتقل للسلة",
    );
    await expect(desktopBadge(page, "السلة")).toHaveText("2");
    await expect(desktopBadge(page, "المفضلة")).toHaveCount(0);
    await expect(page.getByText("المفضلة فاضية")).toBeVisible();
    await page.goto("/cart");
    await expect(lines(page)).toHaveCount(2);
    await checkNoSecrets(page, pair);
  });

  test("mobile: the tabbar badges update without a reload", async ({
    page,
    accounts,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const { phone } = await register(accounts);
    await loginThroughSite(page, phone.national);
    await addFromProductPage(page, SHAMPOO);
    const tab = (name: string) =>
      page.locator(".lm-tabbar a", { hasText: name }).locator(".lm-badge");
    await expect(tab("السلة")).toHaveText("1");
    await page.locator(".lm-buy .lm-fav-lg:visible").click();
    await expect(tab("المفضلة")).toHaveText("1");
  });
});

test.describe("without JavaScript", () => {
  test.use({
    javaScriptEnabled: false,
    viewport: { width: 1280, height: 900 },
  });

  test("add to cart, heart and remove line are plain forms", async ({
    page,
  }) => {
    // The product page's static shell already holds a working purchase form.
    await page.goto(SHAMPOO);
    await page.locator(".lm-buy button.primary").first().click();
    await page.waitForURL(SHAMPOO);
    // The flash toast, server-rendered (CSS only).
    await expect(page.locator(".lm-toast.lm-static")).toContainText(
      "انضاف للسلة",
    );

    await page.locator(".lm-buy .lm-fav-lg").first().click();
    await page.waitForURL(SHAMPOO);
    await expect(page.locator(".lm-toast.lm-static")).toContainText(
      "انحفظ بالمفضلة",
    );
    await page.goto("/favorites");
    await expect(page.locator(".lm-grid .lm-card")).toHaveCount(1);

    await page.goto("/cart");
    await expect(page.locator(".lm-line")).toHaveCount(1);
    await page.locator(".lm-line .l-rm").click();
    await page.waitForURL("/cart");
    await expect(page.getByText("سلتك فاضية")).toBeVisible();
  });
});

test.describe("no layout shift", () => {
  for (const viewport of [
    { width: 1280, height: 900 },
    { width: 390, height: 844 },
  ]) {
    test(`badges and add to cart at ${viewport.width}px`, async ({
      page,
      context,
    }) => {
      await page.setViewportSize(viewport);
      const shampoo = await product("demo-argan-shampoo");
      await setGuestCart(context, [[shampoo.id, 0, 2, shampoo.slug]]);
      await setGuestFavorites(context, [[shampoo.id, shampoo.slug]]);
      await page.addInitScript(() => {
        const w = window as unknown as {
          __shifts: { value: number; nodes: string[] }[];
        };
        w.__shifts = [];
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as unknown as {
            value: number;
            hadRecentInput: boolean;
            sources?: { node?: Node | null }[];
          }[]) {
            if (entry.hadRecentInput) continue;
            const nodes = (entry.sources ?? []).map((source) => {
              const node = source.node;
              const element =
                node instanceof Element ? node : (node?.parentElement ?? null);
              return element?.closest(".lm-dicons, .lm-tabbar, .lm-badge")
                ? "chrome"
                : "other";
            });
            w.__shifts.push({ value: entry.value, nodes });
          }
        }).observe({ type: "layout-shift", buffered: true });
      });
      await page.goto(SHAMPOO);
      await page.waitForLoadState("networkidle");
      await page.evaluate(() => document.fonts.ready);
      const shifts = () =>
        page.evaluate(
          () =>
            (
              window as unknown as {
                __shifts: { value: number; nodes: string[] }[];
              }
            ).__shifts,
        );
      // Loading: the badges never move the header or the tabbar.
      await expect(page.locator(".lm-badge:visible").first()).toBeVisible();
      expect(
        (await shifts()).filter((s) => s.nodes.includes("chrome")),
      ).toEqual([]);
      // After load (fonts done): adding to cart and the badge update shift nothing.
      const before = (await shifts()).length;
      await page.locator(".lm-buy button.primary:visible").click();
      await page.locator(".lm-toast").first().waitFor();
      await page.waitForTimeout(1_000);
      expect((await shifts()).slice(before)).toEqual([]);
    });
  }
});
