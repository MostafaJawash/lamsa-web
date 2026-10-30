import { expect, test, type Page } from "@playwright/test";

const API_HEALTH = "http://127.0.0.1:8000/health";
const DRY = encodeURIComponent("جافة");

async function backendUp(): Promise<boolean> {
  try {
    return (await fetch(API_HEALTH, { signal: AbortSignal.timeout(2_000) })).ok;
  } catch {
    return false;
  }
}

test.beforeAll(async () => {
  test.skip(!(await backendUp()), "needs the backend with demo data");
});

const results = (page: Page) => page.locator("#lm-results .lm-card");

/** Loads a list page and waits until the streamed result replaced the unfiltered preview. */
async function openList(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator("[data-list-preview]")).toHaveCount(0);
}

test.describe("list filters (desktop)", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("type chips, selects, sheet, removable chips and clear all update the URL", async ({
    page,
  }) => {
    await openList(page, "/c/care");
    const all = await results(page).count();
    expect(all).toBeGreaterThan(1);

    // Primary attribute chips (prototype "types" row).
    await page
      .getByRole("navigation", { name: "نوع البشرة" })
      .getByRole("link", { name: "جافة" })
      .click();
    await expect(page).toHaveURL(new RegExp(`attr\\.skin_type=${DRY}`));
    expect(await results(page).count()).toBeLessThan(all);

    // Selects: sort.
    await page.getByLabel("الترتيب").selectOption("price_asc");
    await expect(page).toHaveURL(/sort=price_asc/);
    await expect(page).toHaveURL(new RegExp(`attr\\.skin_type=${DRY}`));

    // Back restores the previous state, forward the next one.
    await page.goBack();
    await expect(page).not.toHaveURL(/sort=/);
    await expect(page.getByLabel("الترتيب")).toHaveValue("newest");
    await page.goForward();
    await expect(page).toHaveURL(/sort=price_asc/);
    await expect(page.getByLabel("الترتيب")).toHaveValue("price_asc");

    // The sheet: every facet, applied with the backend parameter names.
    await page.getByRole("link", { name: /المزيد من الفلاتر/ }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    // No "in stock only" toggle: browsing never shows out-of-stock products.
    await expect(
      sheet.locator("label.lm-toggle", { hasText: "المتوفر فقط" }),
    ).toHaveCount(0);
    await sheet.locator("label.lm-toggle", { hasText: "عليه خصم" }).click();
    await sheet.getByRole("button", { name: "عرض النتائج" }).click();
    await expect(page).toHaveURL(/on_sale=true/);
    await expect(
      page.getByRole("link", { name: /المزيد من الفلاتر/ }),
    ).toContainText("2");

    // Removable chip.
    await page.getByRole("link", { name: "إزالة الفلتر: عليه خصم" }).click();
    await expect(page).not.toHaveURL(/on_sale/);

    // Clear all (inside the sheet).
    await page.getByRole("link", { name: /المزيد من الفلاتر/ }).click();
    await page
      .getByRole("dialog")
      .getByRole("link", { name: "مسح الكل" })
      .click();
    await expect(page).not.toHaveURL(/attr\./);
    expect(await results(page).count()).toBe(all);
  });

  test("the sheet opens from the end side on desktop and scrolls inside", async ({
    page,
  }) => {
    await page.goto("/c/care");
    await page.getByRole("link", { name: /المزيد من الفلاتر/ }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toHaveAttribute("data-side", "end");
    // RTL: the end side is the left edge (a 2px border/shadow may sit outside).
    await expect
      .poll(async () => Math.abs((await sheet.boundingBox())?.x ?? 99))
      .toBeLessThanOrEqual(2);
    await expect(
      sheet.getByRole("button", { name: "عرض النتائج" }),
    ).toBeInViewport();
  });

  test("an invalid filter is ignored with a notice", async ({ page }) => {
    const response = await page.goto("/c/care?attr.nope=1&brand=demo-ward");
    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole("status").filter({ hasText: "تجاهلنا" }),
    ).toBeVisible();
    await expect(results(page).first()).toBeVisible();
    await expect(
      page.getByRole("link", { name: "إزالة الفلتر: وَرد" }),
    ).toBeVisible();
  });

  test("an empty filter result offers to clear the filters", async ({
    page,
  }) => {
    await page.goto("/c/care?min_price=999999");
    await expect(
      page.getByText("لا توجد منتجات تطابق هذه الفلاتر"),
    ).toBeVisible();
    await page.getByRole("link", { name: "مسح الفلاتر" }).click();
    await expect(page).toHaveURL(/\/c\/care$/);
  });

  test("a hard load of a filtered URL marks the unfiltered preview as pending", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { pendingSeen: boolean };
      w.pendingSeen = false;
      new MutationObserver(() => {
        if (document.querySelector("[data-list-preview][data-pending]"))
          w.pendingSeen = true;
      }).observe(document, {
        subtree: true,
        childList: true,
        attributes: true,
      });
    });
    const seen = () =>
      page.evaluate(
        () => (window as unknown as { pendingSeen: boolean }).pendingSeen,
      );

    await page.goto("/c/care?sort=price_asc");
    await expect(page.locator("[data-list-preview]")).toHaveCount(0);
    expect(await seen()).toBe(true);

    await page.goto("/c/care");
    expect(await seen()).toBe(false);
  });

  test("without JavaScript: the unfiltered list is visible, links and the GET form navigate", async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/c/care");
    // The prerendered fallback (the streamed result stays hidden without JS).
    const visibleCards = page.locator("[data-list-preview] .lm-card");
    expect(await visibleCards.count()).toBeGreaterThan(1);
    await expect(visibleCards.first()).toBeVisible();

    // "المزيد من الفلاتر" leads to the GET form below the results.
    await page.getByRole("link", { name: /المزيد من الفلاتر/ }).click();
    const panel = page.locator("#lm-filters");
    await expect(panel).toBeVisible();
    await panel.locator("label.lm-chip", { hasText: "جافة" }).click();
    await panel.getByRole("button", { name: "عرض النتائج" }).click();
    await expect(page).toHaveURL(new RegExp(`attr\\.skin_type=${DRY}`));
    await expect(visibleCards.first()).toBeVisible();

    // Plain links: a product card opens the product page.
    await visibleCards.first().locator("a").first().click();
    await expect(page).toHaveURL(/\/p\//);
    await context.close();
  });
});

test.describe("search", () => {
  test("suggestions without q, results with q", async ({ page }) => {
    await page.goto("/search");
    await page.getByRole("link", { name: "عطر" }).click();
    await expect(page).toHaveURL(/q=/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "نتائج «عطر»",
    );
    await expect(results(page).first()).toBeVisible();
    await expect(page.getByLabel("الترتيب")).toHaveValue("relevance");
  });
});

test.describe("product page", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("variant switching updates price, availability, images, button and ?v", async ({
    page,
  }) => {
    await page.goto("/p/demo-velvet-lipstick");
    const main = page.locator(".lm-g-main img:visible");
    const before = await main.getAttribute("src");

    await page.getByRole("radio", { name: "أحمر كلاسيكي" }).click();
    await expect(page).toHaveURL(/\?v=\d+/);
    await expect(page.locator(".lm-avail")).toHaveText("لم يتبقَّ سوى 3");
    await expect(main).not.toHaveAttribute("src", before ?? "");

    // Quantity bounded by the stock left (3).
    const more = page.getByRole("button", { name: "المزيد" });
    await more.click();
    await more.click();
    await expect(page.locator(".lm-qty span")).toHaveText("3");
    await expect(more).toBeDisabled();

    // Out-of-stock variant disables the button.
    await page.getByRole("radio", { name: /نيود دافئ/ }).click();
    await expect(page.locator(".lm-avail")).toHaveText("نفدت الكمية");
    await expect(page.locator(".lm-buy .lm-btn.primary")).toBeDisabled();
  });

  test("?v deep link is server-rendered with that variant", async ({
    request,
  }) => {
    // The variant id of "أحمر كلاسيكي" (low stock: 3 left), from the backend.
    const api = await request.get(
      "http://127.0.0.1:8000/api/v1/products/demo-velvet-lipstick",
    );
    const product = (await api.json()) as {
      variants: { id: number; options: Record<string, string> }[];
    };
    const id = product.variants.find(
      (v) => v.options.color === "أحمر كلاسيكي",
    )?.id;
    expect(id).toBeTruthy();
    const deep = await (
      await request.get(`/p/demo-velvet-lipstick?v=${id}`)
    ).text();
    expect(deep).toContain("لم يتبقَّ سوى 3");
  });

  test("size variants show their price", async ({ page }) => {
    await page.goto("/p/demo-jasmine-night-perfume");
    await page.getByRole("radio", { name: /50 ml/ }).click();
    await expect(page.locator(".lm-p-price .lm-now")).toHaveText("27.95 $");
  });

  test("the related rail lists products of the same category", async ({
    page,
  }) => {
    await page.goto("/p/demo-velvet-lipstick");
    const rail = page.getByRole("region", { name: "قد يعجبك أيضًا" });
    await expect(rail.locator(".lm-card").first()).toBeVisible();
  });

  test("tabs work with the keyboard", async ({ page }) => {
    await page.goto("/p/demo-velvet-lipstick");
    const desc = page.getByRole("tab", { name: "الوصف" });
    await desc.focus();
    await page.keyboard.press("ArrowLeft");
    const details = page.getByRole("tab", { name: "التفاصيل" });
    await expect(details).toHaveAttribute("aria-selected", "true");
    await expect(details).toBeFocused();
    await expect(page.getByRole("tabpanel")).toContainText("المكونات");
    await page.keyboard.press("Home");
    await expect(desc).toHaveAttribute("aria-selected", "true");
  });

  test("bundle contents, related rail, JSON-LD and add to cart", async ({
    page,
  }) => {
    await page.goto("/p/demo-care-box");
    const bundle = page.getByRole("region", { name: "محتويات علبة الهدايا" });
    await expect(bundle.locator("a.lm-mini")).toHaveCount(3);
    // The bundle's category has no other products, so no related rail here.
    await expect(
      page.getByRole("region", { name: "قد يعجبك أيضًا" }),
    ).toHaveCount(0);
    const ld = await page
      .locator('script[type="application/ld+json"]')
      .allTextContents();
    expect(ld.some((s) => s.includes('"@type":"Product"'))).toBe(true);
    expect(ld.some((s) => s.includes('"@type":"BreadcrumbList"'))).toBe(true);
    await page.getByRole("button", { name: "أضِف إلى السلة" }).click();
    await expect(page.locator(".lm-toast")).toContainText("أُضيف إلى السلة");
  });

  test("the product's category tab is active on desktop", async ({ page }) => {
    await page.goto("/p/demo-velvet-lipstick");
    const tab = page.locator('.lm-dnav a[href="/c/makeup"]');
    await expect(tab).toHaveCSS(
      "border-bottom-color",
      /rgb\(184, 23, 78\)|rgb\(238, 92, 138\)/,
    );
  });
});

test.describe("not found", () => {
  const endpoint = { p: "products", c: "categories", brands: "brands" };
  for (const [path, kind] of [
    ["/p/nope", "p"],
    ["/c/nope", "c"],
    ["/brands/nope", "brands"],
  ] as const) {
    test(`${path} is a 404 (full document request)`, async ({
      page,
      request,
    }) => {
      // The proxy gives the backend 1.5 s and passes through when it is slower (200 with
      // noindex). The dev backend's first request after idle can take 2 s: warm it.
      await request.get(
        `http://127.0.0.1:8000/api/v1/${endpoint[kind]}/warm-up`,
      );
      const response = await page.goto(path);
      expect(response?.status()).toBe(404);
      await expect(
        page.getByRole("heading", { name: "الصفحة غير موجودة" }),
      ).toBeVisible();
    });
  }

  test("known slugs are not affected", async ({ page }) => {
    for (const path of [
      "/p/demo-velvet-lipstick",
      "/c/care",
      "/brands/demo-baity",
    ])
      expect((await page.goto(path))?.status()).toBe(200);
  });

  test("RSC and prefetch requests are not checked by the proxy", async ({
    request,
  }) => {
    // Without the proxy's rewrite, Next.js answers an RSC request without its cache-busting
    // parameter with a 307 to the same path; a rewritten one would be a 404. Next.js hides
    // the RSC headers from the proxy, so it tells client navigations from documents by
    // Sec-Fetch-Dest, which browsers send as "empty" on those fetches. Prefetches never
    // reach the proxy (matcher).
    for (const headers of <Record<string, string>[]>[
      { RSC: "1", "Sec-Fetch-Dest": "empty" },
      { RSC: "1", "Next-Router-Prefetch": "1" },
    ]) {
      const response = await request.get("/p/nope", {
        headers,
        maxRedirects: 0,
      });
      expect(response.status()).not.toBe(404);
    }
  });
});

test.describe("list pages in the path", () => {
  test("old ?page URLs and /page/1 redirect (308) to the path form", async ({
    request,
  }) => {
    for (const [from, to] of [
      ["/new?page=2&sort=price_asc", "/new/page/2?sort=price_asc"],
      ["/c/care?brand=demo-ward&page=1", "/c/care?brand=demo-ward"],
      ["/c/care/page/1", "/c/care"],
    ]) {
      const response = await request.get(from, { maxRedirects: 0 });
      expect(response.status(), from).toBe(308);
      const location = new URL(response.headers().location ?? "", "http://x");
      expect(decodeURI(location.pathname + location.search), from).toBe(to);
    }
  });

  test("a page past the end or an invalid page is a 404", async ({
    request,
  }) => {
    await request.get("http://127.0.0.1:8000/api/v1/products?page_size=1");
    for (const path of ["/c/care/page/2", "/new/page/99", "/sale/page/0"])
      expect((await request.get(path)).status(), path).toBe(404);
  });

  test("list metadata is part of the static head", async ({ request }) => {
    for (const path of ["/c/care", "/new", "/brands/demo-baity"]) {
      const html = await (await request.get(path)).text();
      const head = html.slice(0, html.indexOf("</head>"));
      expect(head, path).toContain('name="description"');
      expect(head, path).toContain('rel="canonical"');
    }
  });
});

test("sitemap lists categories, brands and products", async ({ request }) => {
  const xml = await (await request.get("/sitemap.xml")).text();
  expect(xml).toContain("/c/care");
  expect(xml).toContain("/brands/demo-baity");
  expect(xml).toContain("/p/demo-velvet-lipstick");
});

test.describe("every page renders exactly one mobile header", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  const pages = [
    "/",
    "/categories",
    "/c/care",
    "/new",
    "/sale",
    "/search",
    "/search?q=عطر",
    "/brands",
    "/brands/demo-baity",
    "/p/demo-velvet-lipstick",
    "/cart",
    "/favorites",
    "/login",
    "/register",
    "/complete-profile",
    "/account",
    "/account/addresses",
    "/account/orders",
    "/account/orders/1",
    "/account/notifications",
    "/account/settings",
    "/checkout",
    "/checkout/success/1",
    "/nope",
  ];
  for (const path of pages) {
    test(path, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator(".lm-mhead")).toHaveCount(1);
      await expect(page.locator(".lm-mhead")).toBeVisible();
    });
  }

  test("titles are the real names", async ({ page }) => {
    await page.goto("/c/care");
    await expect(page.locator(".lm-mtitle")).toHaveText("عناية وعطور");
    await page.goto("/brands/demo-baity");
    await expect(page.locator(".lm-mtitle")).toHaveText("بيتي");
    await page.goto("/p/demo-velvet-lipstick");
    await expect(page.locator(".lm-mtitle")).toHaveText("أحمر شفاه مخملي");
  });

  test("the sheet opens from the bottom on mobile", async ({ page }) => {
    await page.goto("/c/care");
    await page.getByRole("link", { name: /المزيد من الفلاتر/ }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toHaveAttribute("data-side", "bottom");
    await expect(
      sheet.getByRole("button", { name: "عرض النتائج" }),
    ).toBeInViewport();
  });
});
