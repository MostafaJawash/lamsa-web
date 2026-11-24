import { expect, test } from "@playwright/test";

const API_HEALTH = "http://127.0.0.1:8000/health";

async function backendUp(): Promise<boolean> {
  try {
    return (await fetch(API_HEALTH, { signal: AbortSignal.timeout(2_000) })).ok;
  } catch {
    return false;
  }
}

const rgb = (page: import("@playwright/test").Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((el) => getComputedStyle(el).backgroundColor);

test.describe("theme: light by default, dark only by choice", () => {
  test.use({ colorScheme: "dark" });

  test("a device in dark mode still gets the light site", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).not.toHaveAttribute(
      "data-theme",
      "dark",
    );
    expect(await rgb(page, "body")).toBe("rgb(247, 240, 242)"); // --lamsa-bg, light
    expect(
      await page.evaluate(
        () => getComputedStyle(document.documentElement).colorScheme,
      ),
    ).toBe("light");
    expect(
      await page.evaluate(
        () => matchMedia("(prefers-color-scheme: dark)").matches,
      ),
    ).toBe(true);
  });

  test("the footer toggle switches to dark, remembers it, and back", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const toggle = page.locator("footer [data-testid=theme-toggle]:visible");
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await toggle.click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    expect(await rgb(page, "body")).toBe("rgb(22, 16, 21)"); // --lamsa-bg, dark
    await expect(toggle).toHaveAttribute("aria-pressed", "true");

    // A reload (no flash: the head script applies it before paint).
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    await page.locator("footer [data-testid=theme-toggle]:visible").click();
    await expect(page.locator("html")).not.toHaveAttribute(
      "data-theme",
      "dark",
    );
  });
});

for (const theme of ["light", "dark"] as const) {
  test.describe(`mobile tabbar, ${theme} theme`, () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

    test("its background differs from the page background", async ({
      page,
      context,
    }) => {
      if (theme === "dark")
        await context.addCookies([
          { name: "lamsa-theme", value: "dark", url: "http://localhost:3100" },
        ]);
      await page.goto("/");
      if (theme === "dark")
        await expect(page.locator("html")).toHaveAttribute(
          "data-theme",
          "dark",
        );
      const bar = await rgb(page, ".lm-tabbar:visible");
      const bg = await rgb(page, "body");
      expect(bar).not.toBe(bg);
      expect(bar).toBe(
        theme === "dark" ? "rgb(44, 32, 41)" : "rgb(241, 229, 234)",
      );
    });
  });
}

test.describe("tabbar animation", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("the new active icon pops after a tab switch", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const tabbar = page.locator(".lm-tabbar:visible");
    await expect(tabbar).not.toHaveAttribute("data-pop", /.*/);
    await tabbar.getByRole("link", { name: "الأقسام" }).click();
    await expect(tabbar).toHaveAttribute("data-pop", "");
    const icon = tabbar.locator("a.on .lm-ic");
    expect(
      await icon.evaluate((el) => getComputedStyle(el).animationName),
    ).toBe("lm-tab-pop");
  });

  test("prefers-reduced-motion skips it", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const tabbar = page.locator(".lm-tabbar:visible");
    await tabbar.getByRole("link", { name: "الأقسام" }).click();
    await expect(tabbar.locator("a.on")).toHaveAttribute("href", "/categories");
    expect(
      await tabbar
        .locator("a.on .lm-ic")
        .evaluate((el) => getComputedStyle(el).animationName),
    ).toBe("none");
  });
});

test.describe("all products and gift boxes", () => {
  test.beforeAll(async () => {
    test.skip(!(await backendUp()), "needs the backend with demo data");
  });

  test("Home tiles lead to the real lists", async ({ page }) => {
    await page.goto("/");
    const tiles = page
      .getByRole("region", { name: "تسوّق حسب القسم" })
      .locator(".lm-cat-tile");
    await tiles.nth(1).click();
    await expect(page).toHaveURL(/\/c\/demo-gifts$/);
    await expect(page.locator(".lm-card:visible").first()).toBeVisible();
    // The category's own name from the backend (not the fallback string).
    await expect(page.locator("h1:visible").first()).toContainText(
      "علبة هدايا",
    );

    await page.goto("/");
    await tiles.nth(0).click();
    await expect(page).toHaveURL(/\/products$/);
    await expect(page.locator("h1:visible").first()).toHaveText("كل المنتجات");
    const count = await page.locator(".lm-card:visible").count();
    expect(count).toBeGreaterThan(3);
  });

  test("desktop nav has both links; /products matches the unfiltered API", async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/products");
    const nav = page.locator(".lm-dnav:visible");
    await expect(nav.getByRole("link", { name: "كل المنتجات" })).toBeVisible();
    await expect(nav.locator("a[href='/c/demo-gifts']")).toBeVisible();
    const api = await request.get(
      "http://127.0.0.1:8000/api/v1/products?page_size=24",
    );
    const body = (await api.json()) as { items: unknown[]; total: number };
    await expect(page.locator(".lm-card:visible")).toHaveCount(
      body.items.length,
    );
  });

  test("Categories page lists both entries", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/categories");
    await expect(
      page.locator(".lm-cat-tile[href='/products']:visible"),
    ).toHaveCount(1);
    await expect(
      page.locator(".lm-cat-tile[href='/c/demo-gifts']:visible"),
    ).toHaveCount(1);
  });

  test("a page past the end of /products is a 404", async ({ page }) => {
    const response = await page.goto("/products/page/999");
    expect(response?.status()).toBe(404);
  });
});

test.describe("Home chip row removed; its pages stay reachable", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test.beforeAll(async () => {
    test.skip(!(await backendUp()), "needs the backend with demo data");
  });

  test("no chip row on Home, but /new, /sale and /brands are one tap away", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator(".lm-chips:visible")).toHaveCount(0);

    await page
      .getByRole("region", { name: "وصل حديثًا" })
      .getByRole("link", { name: "عرض الكل" })
      .click();
    await expect(page).toHaveURL(/\/new$/);

    await page.goto("/");
    await page
      .getByRole("region", { name: "عروض لفترة محدودة" })
      .getByRole("link", { name: "عرض الكل" })
      .click();
    await expect(page).toHaveURL(/\/sale$/);

    await page.goto("/");
    await page
      .getByRole("region", { name: "الماركات" })
      .getByRole("link", { name: "كل الماركات" })
      .click();
    await expect(page).toHaveURL(/\/brands$/);

    // And through the Categories tab, which lists all three.
    await page.goto("/categories");
    for (const href of ["/new", "/sale", "/brands"])
      await expect(
        page.locator(`.lm-cat-tile[href='${href}']:visible`),
      ).toHaveCount(1);
  });

  test("the chips remain on the list pages as sibling navigation", async ({
    page,
  }) => {
    await page.goto("/new");
    await expect(page.locator(".lm-chips:visible").first()).toBeVisible();
  });
});

test.describe("brands page: long Arabic names do not overflow", () => {
  test.beforeAll(async () => {
    test.skip(!(await backendUp()), "needs the backend with demo data");
  });

  for (const width of [320, 360]) {
    test(`at ${width}px with large text`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/brands");
      await page.waitForLoadState("networkidle");
      // The longest realistic label, injected into the first real card, at 1.5x text.
      await page.addStyleTag({
        content: "html { font-size: 24px !important; }",
      });
      await page.evaluate(() => {
        const name = document.querySelector<HTMLElement>(".lm-brand-card .bn");
        if (name)
          name.textContent =
            "مستحضرات التجميل الطبيعية الفاخرة للعناية بالبشرة والشعر";
      });
      const result = await page.evaluate(() => {
        const cards = [
          ...document.querySelectorAll<HTMLElement>(".lm-brand-card"),
        ];
        return {
          page: document.documentElement.scrollWidth <= window.innerWidth,
          cards: cards.every((card) => {
            const box = card.getBoundingClientRect();
            return (
              card.scrollWidth <= card.clientWidth &&
              card.scrollHeight <= card.clientHeight &&
              [...card.children].every((child) => {
                const c = child.getBoundingClientRect();
                return (
                  c.left >= box.left - 0.5 &&
                  c.right <= box.right + 0.5 &&
                  c.bottom <= box.bottom + 0.5
                );
              })
            );
          }),
        };
      });
      expect(result.page).toBe(true);
      expect(result.cards).toBe(true);
    });
  }
});
