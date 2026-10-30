import { expect, test } from "./support/fixtures";
import {
  ALEPPO,
  DAMASCUS,
  SYP_PRODUCT,
  addAddress,
  addToCart,
  customer,
  ensureStock,
  makeOrder,
  signIn,
} from "./support/checkout";
import { cookieValue } from "./support/fixtures";

/**
 * The checkout, order and address pages together: layout at the project's responsive
 * widths (the same four as layout.spec.ts) and the rule that no token ever reaches the
 * browser through them.
 */

const WIDTHS = [360, 768, 1024, 1440];

test.beforeAll(async () => {
  await ensureStock(SYP_PRODUCT, 40);
});

for (const width of WIDTHS) {
  test.describe(`layout at ${width}px`, () => {
    test.use({ viewport: { width, height: 800 } });

    test("checkout, success, orders, order and addresses: no horizontal scroll, the right chrome", async ({
      page,
      accounts,
    }) => {
      test.setTimeout(120_000);
      const who = await customer(accounts, "layout");
      const home = await addAddress(who.token, DAMASCUS);
      await addAddress(who.token, ALEPPO);
      const order = await makeOrder(accounts, who, home.id, "damascus");
      await addToCart(who.token, SYP_PRODUCT, 2);

      const paths = [
        "/checkout",
        `/checkout/success/${order.id}`,
        "/account/orders",
        `/account/orders/${order.id}`,
        "/account/addresses",
        "/account/addresses?new=1",
        `/account/addresses?edit=${home.id}`,
      ];
      await signIn(page, who, paths[0]!);
      for (const path of paths) {
        await page.goto(path);
        await page.evaluate(() => document.fonts.ready);
        await page.waitForLoadState("networkidle");
        const overflow = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        }));
        expect(overflow.scrollWidth, path).toBeLessThanOrEqual(
          overflow.innerWidth,
        );

        if (width < 768) {
          await expect(
            page.locator(".lm-tabbar:visible").last(),
            path,
          ).toBeVisible();
          await expect(page.locator(".lm-dnav")).toBeHidden();
          await expect(page.locator(".lm-mhead")).toBeVisible();
          await page.evaluate(() =>
            window.scrollTo(0, document.documentElement.scrollHeight),
          );
          const contentBottom = await page.evaluate(() => {
            const main = document.querySelector("main");
            // Leaflet keeps tile panes far off-screen inside the map: not page content.
            const items = main
              ? [...main.querySelectorAll("*")].filter(
                  (el) => !el.closest(".lm-map"),
                )
              : [];
            return Math.max(
              0,
              ...items.map((el) => el.getBoundingClientRect().bottom),
            );
          });
          const tabbarTop =
            (await page.locator(".lm-tabbar:visible").last().boundingBox())
              ?.y ?? 0;
          expect(contentBottom, path).toBeLessThanOrEqual(tabbarTop + 0.5);
        } else {
          await expect(page.locator(".lm-dnav"), path).toBeVisible();
          await expect(page.locator(".lm-mhead")).toBeHidden();
          await expect(page.locator(".lm-dfoot")).toBeVisible();
        }
        // The two-column checkout becomes one column when narrow, and the form fields never
        // overflow their box.
        const wide = await page.evaluate(() =>
          [
            ...document.querySelectorAll<HTMLElement>(
              ".lm-box, .lm-summary, .lm-addr, .lm-order-row",
            ),
          ]
            .filter((el) => el.offsetParent !== null)
            .filter((el) => el.scrollWidth > el.clientWidth + 1)
            .map((el) => el.className),
        );
        expect(wide, path).toEqual([]);
      }
      if (width === 360 || width === 1440) {
        await page.goto("/checkout");
        await page.screenshot({
          path: `e2e/screenshots/checkout-${width}.png`,
          fullPage: true,
        });
      }
    });
  });
}

test("tokens never reach the browser through these pages", async ({
  page,
  accounts,
}) => {
  test.setTimeout(120_000);
  const who = await customer(accounts, "tokens");
  const home = await addAddress(who.token, DAMASCUS);
  const order = await makeOrder(accounts, who, home.id, "damascus");
  await addToCart(who.token, SYP_PRODUCT, 1);

  const bodies: string[] = [];
  page.on("response", async (response) => {
    const type = response.headers()["content-type"] ?? "";
    if (/javascript|x-component|json|html/.test(type))
      bodies.push(await response.text().catch(() => ""));
  });
  await signIn(page, who, "/checkout");
  const access = (await cookieValue(page, "__Host-lamsa_at")) ?? "";
  const refresh = (await cookieValue(page, "__Host-lamsa_rt")) ?? "";
  expect(access.length).toBeGreaterThan(20);

  const paths = [
    "/checkout",
    `/checkout/success/${order.id}`,
    "/account/orders",
    `/account/orders/${order.id}`,
    "/account/addresses",
    "/account/addresses?new=1",
  ];
  for (const path of paths) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const html = await page.content();
    expect(html, path).not.toContain(access);
    expect(html, path).not.toContain(refresh);
    const raw = await (await page.request.get(path)).text();
    expect(raw, path).not.toContain(access);
    expect(raw, path).not.toContain(refresh);
  }
  // Client navigations (RSC payloads) and the actions' responses too.
  await page.locator('.lm-dnav a[href="/brands"]').click();
  await page.waitForURL("/brands");
  for (const body of bodies) {
    expect(body.includes(access)).toBe(false);
    expect(body.includes(refresh)).toBe(false);
  }
  const storage = await page.evaluate(() => ({
    local: JSON.stringify({ ...localStorage }),
    session: JSON.stringify({ ...sessionStorage }),
    cookie: document.cookie,
  }));
  for (const value of [storage.local, storage.session, storage.cookie]) {
    expect(value).not.toContain(access);
    expect(value).not.toContain(refresh);
  }
  expect(storage.cookie).not.toContain("lamsa_at");
  expect(storage.cookie).not.toContain("lamsa_rt");
});
