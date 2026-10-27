import { expect, test } from "@playwright/test";

// Runs against `next dev` with API_BASE_URL on a closed port (see playwright.config.ts).
test.describe.configure({ timeout: 180_000 });

test("home still renders with fallbacks when the backend is unreachable", async ({
  page,
}) => {
  const response = await page.goto("/", { timeout: 150_000 });
  expect(response?.status()).toBe(200);

  // Chrome is there.
  await expect(page.locator(".lm-dhead")).toBeVisible();
  await expect(page.locator(".lm-dfoot")).toBeVisible();

  // The two prototype banners.
  await expect(page.locator(".lm-banner.b-sale")).toContainText(
    "تخفيضات الموسم",
  );
  await expect(page.locator(".lm-banner.b-sale")).toHaveAttribute(
    "href",
    "/sale",
  );
  await expect(page.locator(".lm-banner.b-new")).toContainText(
    "منتجات جديدة كل أسبوع",
  );
  await expect(page.locator(".lm-banner.b-new")).toHaveAttribute(
    "href",
    "/new",
  );

  // Rails keep their header, show the empty state, and no "عرض الكل".
  const newRail = page.getByRole("region", { name: "وصل حديثًا" });
  await expect(newRail).toContainText("سنضيف منتجات جديدة قريبًا");
  await expect(newRail.getByRole("link", { name: "عرض الكل" })).toHaveCount(0);
  const saleRail = page.getByRole("region", { name: "عروض لفترة محدودة" });
  await expect(saleRail).toContainText("لا توجد عروض حاليًا، تابعنا قريبًا");

  // Categories and brands are hidden; navigation still works from the static config.
  await expect(
    page.getByRole("region", { name: "تسوّق حسب القسم" }),
  ).toHaveCount(0);
  await expect(page.getByRole("region", { name: "الماركات" })).toHaveCount(0);
  await expect(page.locator(".lm-dnav a")).toHaveCount(6);

  // Development notice, dismissible.
  const notice = page
    .getByRole("status")
    .filter({ hasText: "الخادم غير متاح حاليًا" });
  await expect(notice).toBeVisible();
  await notice.getByRole("button", { name: "إخفاء" }).click();
  await expect(notice).toHaveCount(0);
});

test("categories page renders every tile without the backend", async ({
  page,
}) => {
  const response = await page.goto("/categories", { timeout: 150_000 });
  expect(response?.status()).toBe(200);
  await expect(page.locator(".lm-cat-tile")).toHaveCount(6);
});

const catalogPages: [string, string][] = [
  ["/c/care", "تعذّر تحميل المنتجات حاليًا"],
  ["/brands/demo-baity", "تعذّر تحميل المنتجات حاليًا"],
  ["/p/demo-velvet-lipstick", "تعذّر تحميل هذا المنتج حاليًا"],
  // The 404 check in the proxy passes through when the backend is down.
  ["/p/nope", "تعذّر تحميل هذا المنتج حاليًا"],
  ["/new", "تعذّر تحميل المنتجات حاليًا"],
  ["/sale", "تعذّر تحميل المنتجات حاليًا"],
  ["/search?q=عطر", "تعذّر تحميل المنتجات حاليًا"],
  ["/brands", "تعذّر تحميل المنتجات حاليًا"],
];

for (const [path, text] of catalogPages) {
  test(`${path} returns 200 with an unavailable state`, async ({ page }) => {
    const response = await page.goto(path, { timeout: 150_000 });
    expect(response?.status()).toBe(200);
    await expect(page.getByText(text).first()).toBeVisible();
    await expect(page.locator(".lm-mhead")).toHaveCount(1);
  });
}

test("the cart shows the unavailable state and keeps the guest cookie", async ({
  page,
  context,
}) => {
  // Development server: cookie names without the __Host- prefix.
  const value = `v1.${Buffer.from(JSON.stringify([[3, 0, 2, "demo"]])).toString("base64url")}`;
  await context.addCookies([
    {
      name: "lamsa_gcart",
      value,
      url: "http://localhost:3101",
      httpOnly: true,
    },
  ]);
  const response = await page.goto("/cart", { timeout: 150_000 });
  expect(response?.status()).toBe(200);
  await expect(
    page.getByText("تعذّر تحميل سلتك الآن، يُرجى المحاولة لاحقًا"),
  ).toBeVisible();
  const kept = (await context.cookies()).find((c) => c.name === "lamsa_gcart");
  expect(kept?.value).toBe(value);
});
