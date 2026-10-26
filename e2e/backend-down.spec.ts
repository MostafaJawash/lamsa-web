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
    "تنزيلات الموسم",
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
  const newRail = page.getByRole("region", { name: "وصل حديثاً" });
  await expect(newRail).toContainText("رح نضيف منتجات جديدة قريباً");
  await expect(newRail.getByRole("link", { name: "عرض الكل" })).toHaveCount(0);
  const saleRail = page.getByRole("region", { name: "عروض لفترة محدودة" });
  await expect(saleRail).toContainText("ما في عروض حالياً، تابعنا قريباً");

  // Categories and brands are hidden; navigation still works from the static config.
  await expect(
    page.getByRole("region", { name: "تسوّق حسب القسم" }),
  ).toHaveCount(0);
  await expect(page.getByRole("region", { name: "ماركاتنا" })).toHaveCount(0);
  await expect(page.locator(".lm-dnav a")).toHaveCount(6);

  // Development notice, dismissible.
  const notice = page
    .getByRole("status")
    .filter({ hasText: "الباك إند مش شغال" });
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
  ["/c/care", "ما قدرنا نجيب المنتجات هلأ"],
  ["/brands/demo-baity", "ما قدرنا نجيب المنتجات هلأ"],
  ["/p/demo-velvet-lipstick", "ما قدرنا نجيب هالمنتج هلأ"],
  // The 404 check in the proxy passes through when the backend is down.
  ["/p/nope", "ما قدرنا نجيب هالمنتج هلأ"],
  ["/new", "ما قدرنا نجيب المنتجات هلأ"],
  ["/sale", "ما قدرنا نجيب المنتجات هلأ"],
  ["/search?q=عطر", "ما قدرنا نجيب المنتجات هلأ"],
  ["/brands", "ما قدرنا نجيب المنتجات هلأ"],
];

for (const [path, text] of catalogPages) {
  test(`${path} returns 200 with an unavailable state`, async ({ page }) => {
    const response = await page.goto(path, { timeout: 150_000 });
    expect(response?.status()).toBe(200);
    await expect(page.getByText(text).first()).toBeVisible();
    await expect(page.locator(".lm-mhead")).toHaveCount(1);
  });
}
