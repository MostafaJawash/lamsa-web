import { expect, test } from "@playwright/test";

const API_HEALTH = "http://127.0.0.1:8000/health";

async function backendUp(): Promise<boolean> {
  try {
    return (await fetch(API_HEALTH, { signal: AbortSignal.timeout(2_000) })).ok;
  } catch {
    return false;
  }
}

test.describe("home with data", () => {
  test.beforeAll(async () => {
    test.skip(
      !(await backendUp()),
      "needs the backend with demo data at 127.0.0.1:8000",
    );
  });

  test("shows banners, rails, categories and brands", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);

    await expect(page.locator(".lm-banner").first()).toBeVisible();

    const newRail = page.getByRole("region", { name: "وصل حديثًا" });
    await expect(newRail.locator(".lm-card").first()).toBeVisible();
    await expect(
      newRail.getByRole("link", { name: "عرض الكل" }),
    ).toHaveAttribute("href", "/new");

    const saleRail = page.getByRole("region", { name: "عروض لفترة محدودة" });
    await expect(saleRail.locator(".lm-card").first()).toBeVisible();
    await expect(saleRail.locator(".lm-bd.off").first()).toContainText("٪");
    await expect(saleRail.locator("s .lm-num").first()).toHaveAttribute(
      "dir",
      "ltr",
    );

    const tiles = page
      .getByRole("region", { name: "تسوّق حسب القسم" })
      .locator(".lm-cat-tile");
    expect(await tiles.count()).toBeGreaterThan(0);
    await expect(tiles.first()).toHaveAttribute("href", /^\/c\//);

    const brands = page.getByRole("region", { name: "الماركات" });
    await expect(brands.locator(".lm-brand-chip").first()).toHaveAttribute(
      "href",
      /^\/brands\//,
    );
  });

  test("product card links to the product; the heart is a toggle form", async ({
    page,
  }) => {
    await page.goto("/");
    const card = page
      .getByRole("region", { name: "وصل حديثًا" })
      .locator(".lm-card")
      .first();
    await expect(card.locator(".lm-card-link")).toHaveAttribute(
      "href",
      /^\/p\//,
    );
    const heart = card.locator("form[data-lm-form=fav] button.lm-fav");
    await expect(heart).toHaveAttribute("aria-pressed", /^(true|false)$/);
    await expect(card.locator("form input[name=next]")).toHaveValue("/");
  });
});

test.describe("desktop chrome", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("search form submits to /search?q=", async ({ page }) => {
    await page.goto("/");
    const input = page.getByRole("searchbox", { name: "بحث" });
    await input.fill("ارغان");
    await input.press("Enter");
    await expect(page).toHaveURL(/\/search\?q=%D8%A7%D8%B1%D8%BA%D8%A7%D9%86$/);
  });

  test("marks the active category tab", async ({ page }) => {
    // The page marks its tab with the accent underline (PageChrome); others stay plain.
    const accent = /rgb\(184, 23, 78\)/;
    await page.goto("/new");
    const tab = (href: string) => page.locator(`.lm-dnav a[href="${href}"]`);
    await expect(tab("/new")).toHaveCSS("border-bottom-color", accent);
    await expect(tab("/sale")).not.toHaveCSS("border-bottom-color", accent);

    await tab("/brands").click();
    await expect(page).toHaveURL(/\/brands$/);
    await expect(tab("/brands")).toHaveCSS("border-bottom-color", accent);
    await expect(tab("/new")).not.toHaveCSS("border-bottom-color", accent);
  });
});

test.describe("mobile chrome", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("tabbar navigates and highlights the current tab", async ({ page }) => {
    await page.goto("/");
    const tabbar = page.getByRole("navigation", { name: "التنقل السفلي" });
    await expect(tabbar).toBeVisible();
    await expect(
      tabbar.getByRole("link", { name: "الرئيسية" }),
    ).toHaveAttribute("aria-current", "page");

    await tabbar.getByRole("link", { name: "الأقسام" }).click();
    await expect(page).toHaveURL(/\/categories$/);
    await expect(tabbar.getByRole("link", { name: "الأقسام" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(page.locator(".lm-mtitle")).toHaveText("الأقسام");

    // Guest: حسابي leads to the login page.
    await tabbar.getByRole("link", { name: "حسابي" }).click();
    await expect(page).toHaveURL(/\/login(\?next=%2Faccount)?$/);
    await expect(tabbar.getByRole("link", { name: "حسابي" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("auth pages keep the chrome and highlight حسابي", async ({ page }) => {
    await page.goto("/login");
    const tabbar = page.getByRole("navigation", { name: "التنقل السفلي" });
    await expect(tabbar.getByRole("link", { name: "حسابي" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(page.locator(".lm-mtitle")).toHaveText("تسجيل الدخول");
    await expect(page.locator(".lm-auth")).toBeVisible();
  });

  test("back button returns to the previous page, or home on a deep link", async ({
    page,
  }) => {
    await page.goto("/new");
    // Hydrated, and the session-dependent tabbar (it counts the visits) streamed in.
    await page.waitForLoadState("networkidle");
    await expect(
      page.locator(".lm-tabbar a[href='/login']:visible"),
    ).toHaveCount(1);
    await page.getByRole("button", { name: "رجوع" }).click();
    await expect(page).toHaveURL(/\/$/);

    await page.goto("/");
    await page
      .locator(".lm-chips")
      .getByRole("link", { name: "التخفيضات" })
      .click();
    await expect(page).toHaveURL(/\/sale$/);
    await page.getByRole("button", { name: "رجوع" }).click();
    await expect(page).toHaveURL(/\/$/);
  });
});
