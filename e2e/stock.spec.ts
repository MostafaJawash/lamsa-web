import type { Page } from "@playwright/test";

import { call, PASSWORD, registerViaApi, uniquePhone } from "./support/backend";
import { expect, fillLogin, test } from "./support/fixtures";
import {
  addFromProductPage,
  listed,
  product,
  setActive,
  setGuestCart,
  setHideOutOfStock,
  setStock,
} from "./support/shop";

/**
 * Changes demo stock, product activation and the catalog_hide_out_of_stock setting
 * through the admin API (the e2e admin of global-setup.ts), and restores them. Runs as
 * the `stock` project: alone, after the parallel tests (playwright.config.ts).
 *
 * The site caches lists for up to 45 s and product pages and related rails for up to
 * 120 s (as the backend does), so changes are awaited by reloading.
 */
test.describe.configure({ mode: "serial", timeout: 1_200_000 });
test.use({ viewport: { width: 1280, height: 900 } });

const CLEANSER = "demo-green-tea-cleanser"; // simple, category care, brand demo-ward

async function login(page: Page, accounts: { phone(e164: string): void }) {
  const phone = uniquePhone();
  accounts.phone(phone.e164);
  await registerViaApi(`e2e-stock-${Date.now()}`, phone.e164);
  await page.goto("/login");
  await fillLogin(page, phone.national, PASSWORD);
  await page.waitForURL("/");
}

/** How many links to the product a page shows, after a fresh load. */
async function linksTo(page: Page, path: string, slug: string) {
  await page.goto(path);
  // Streamed results are in (bounded: a busy page must not stall the poll).
  await page
    .waitForLoadState("networkidle", { timeout: 15_000 })
    .catch(() => {});
  return page.locator(`main a[href="/p/${slug}"]:visible`).count();
}

/** The pages (of `paths`) that link to the product now. */
async function pagesShowing(page: Page, paths: string[], slug: string) {
  const showing: string[] = [];
  for (const path of paths)
    if ((await linksTo(page, path, slug)) > 0) showing.push(path);
  return showing;
}

const SLOW = { timeout: 300_000, intervals: [3_000, 5_000, 10_000] };

test("a sold-out product leaves browsing and comes back; product page, favorites and cart keep it", async ({
  page,
  accounts,
}) => {
  const cleanser = await product(CLEANSER);
  await login(page, accounts);
  // A previous run may have sold it out: wait until the site's cached page is back.
  await expect
    .poll(async () => {
      await page.goto(`/p/${CLEANSER}`);
      return page.locator(".lm-buy button.primary:visible").isEnabled();
    }, SLOW)
    .toBe(true);
  await addFromProductPage(page, `/p/${CLEANSER}`);
  const initialHeart = page.locator(".lm-buy .lm-fav-lg:visible");
  await initialHeart.click();
  await expect(initialHeart).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".lm-toast").first()).toContainText(
    "أُضيف إلى المفضلة",
  );

  // Category, search, brand and related always show it; the home rails only when it is
  // among their newest / on-sale products.
  const required = [
    "/c/care",
    `/search?q=${encodeURIComponent(cleanser.name)}`,
    "/brands/demo-ward",
    "/p/demo-intense-moisturizer",
  ];
  for (const path of required)
    await expect
      .poll(() => linksTo(page, path, CLEANSER), { ...SLOW, message: path })
      .toBeGreaterThan(0);
  const pages =
    (await linksTo(page, "/", CLEANSER)) > 0 ? ["/", ...required] : required;
  const facetsBefore = await call<{
    brands: { slug: string; count: number }[];
  }>("GET", "/products/facets?category=care");

  const before = await setStock(cleanser.id, 0);
  try {
    // The backend at once (its cache follows the stock change) ...
    expect(
      (await listed({ category: "care" })).map((p) => p.slug),
    ).not.toContain(CLEANSER);
    const facets = await call<{ brands: { slug: string; count: number }[] }>(
      "GET",
      "/products/facets?category=care",
    );
    const count = (f: typeof facets) =>
      f.brands.find((b) => b.slug === "demo-ward")?.count ?? 0;
    expect(count(facets)).toBe(count(facetsBefore) - 1);
    // ... and the site's pages once their 45 s cache has turned over.
    // Every page in each round, so the 45 s caches turn over in parallel.
    await expect
      .poll(() => pagesShowing(page, pages, CLEANSER), SLOW)
      .toEqual([]);

    // The product page still opens, with the hint, and its heart works.
    await expect
      .poll(async () => {
        await page.goto(`/p/${CLEANSER}`);
        return page.locator(".lm-avail:visible").innerText();
      }, SLOW)
      .toContain("نفدت الكمية");
    await expect(
      page.locator(".lm-hint:visible", {
        hasText: "أضِفه إلى المفضلة وسنُعلمك عند توفّره من جديد",
      }),
    ).toBeVisible();
    await expect(page.locator(".lm-buy button.primary:visible")).toBeDisabled();
    const heart = page.locator(".lm-buy .lm-fav-lg:visible");
    await page.waitForLoadState("networkidle");
    await expect(heart).toHaveAttribute("aria-pressed", "true");
    await heart.click();
    await expect(heart).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator(".lm-toast").first()).toContainText(
      "أُزيل من المفضلة",
    );
    await page.waitForLoadState("networkidle");
    await heart.click();
    await expect(page.locator(".lm-toast").first()).toContainText(
      "أُضيف إلى المفضلة",
    );
    await expect(heart).toHaveAttribute("aria-pressed", "true");

    // Still in favorites (move disabled) and in the cart (with the issue).
    await page.goto("/favorites");
    await expect(
      page.getByRole("button", { name: "نفدت الكمية" }),
    ).toBeDisabled();
    await page.goto("/cart");
    await expect(page.locator(".lm-line:visible")).toContainText("نفدت الكمية");
    await expect(
      page.getByRole("button", { name: "إتمام الطلب" }),
    ).toBeDisabled();
  } finally {
    await setStock(cleanser.id, before);
  }
  await expect
    .poll(() => pagesShowing(page, pages, CLEANSER), SLOW)
    .toEqual(pages);
  // The product-detail cache lives longer than list caches; settle it before the
  // next serial stock test tries to add this same product.
  await expect
    .poll(async () => {
      await page.goto(`/p/${CLEANSER}`);
      return page.locator(".lm-buy button.primary:visible").isEnabled();
    }, SLOW)
    .toBe(true);
});

test("every line issue, then update cart; checkout only without issues", async ({
  page,
  accounts,
}) => {
  const shampoo = await product("demo-argan-shampoo");
  const serum = await product("demo-vitamin-c-serum");
  const cleanser = await product(CLEANSER);
  const liner = await product("demo-lip-liner");
  const linerVariant = liner.variants.find((v) => v.stock_status !== "out");
  if (!linerVariant) throw new Error("demo-lip-liner has no variant in stock");

  await login(page, accounts);
  await addFromProductPage(page, `/p/${shampoo.slug}`, 3);
  await addFromProductPage(page, `/p/${serum.slug}`);
  await addFromProductPage(page, `/p/${cleanser.slug}`);
  await addFromProductPage(page, `/p/${liner.slug}?v=${linerVariant.id}`);

  const shampooStock = await setStock(shampoo.id, 1); // INSUFFICIENT_STOCK
  const cleanserStock = await setStock(cleanser.id, 0); // OUT_OF_STOCK
  await setActive(serum.id, false); // UNAVAILABLE
  await setActive(liner.id, false, linerVariant.id); // VARIANT_UNAVAILABLE
  try {
    await page.goto("/cart");
    const cart = page.locator(".lm-cart-grid:visible");
    for (const text of [
      "لم يتبقَّ سوى 1",
      "نفدت الكمية",
      "لم يعد المنتج متوفرًا",
      "لم يعد هذا الخيار متوفرًا",
    ])
      await expect(cart).toContainText(text);
    await expect(page.locator(".lm-line.out:visible")).toHaveCount(4);
    await expect(
      page.getByRole("button", { name: "إتمام الطلب" }),
    ).toBeDisabled();
    await expect(
      page.getByText("حدّث سلتك أولًا لتتمكن من إتمام الطلب."),
    ).toBeVisible();

    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "تحديث السلة" }).click();
    await expect(page.locator(".lm-toast").first()).toBeVisible();
    await expect(page.locator(".lm-line:visible")).toHaveCount(1);
    await expect(page.locator(".lm-line:visible .lm-qty span")).toHaveText("1");
    await expect(page.locator(".lm-cart-notice")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "إتمام الطلب" })).toBeVisible();
  } finally {
    await setStock(shampoo.id, shampooStock);
    await setStock(cleanser.id, cleanserStock);
    await setActive(serum.id, true);
    await setActive(liner.id, true, linerVariant.id);
  }
});

test("guest: QUANTITY_LIMIT_EXCEEDED in the cart, fixed like resolve-issues", async ({
  page,
  context,
}) => {
  const moisturizer = await product("demo-intense-moisturizer");
  const before = await setStock(moisturizer.id, 30);
  try {
    await setGuestCart(context, [[moisturizer.id, 0, 15, moisturizer.slug]]);
    await page.goto("/cart");
    await expect(page.locator(".lm-line:visible")).toContainText(
      "الحد الأقصى 10",
    );
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "تحديث السلة" }).click();
    await expect(page.locator(".lm-line:visible .lm-qty span")).toHaveText(
      "10",
    );
    await expect(page.getByRole("link", { name: "إتمام الطلب" })).toBeVisible();
  } finally {
    await setStock(moisturizer.id, before);
  }
});

test("catalog_hide_out_of_stock off shows out-of-stock products again", async () => {
  const mist = await product("demo-fresh-body-mist");
  expect(mist.in_stock).toBe(false);
  expect((await listed({})).map((p) => p.slug)).not.toContain(mist.slug);
  await setHideOutOfStock(false);
  try {
    expect((await listed({})).map((p) => p.slug)).toContain(mist.slug);
  } finally {
    await setHideOutOfStock(true);
  }
  expect((await listed({})).map((p) => p.slug)).not.toContain(mist.slug);
});
