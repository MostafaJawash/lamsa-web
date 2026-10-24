import { mkdirSync } from "node:fs";

import { expect, test } from "@playwright/test";

const WIDTHS = [360, 768, 1024, 1440];
const PAGES = [
  "/",
  "/categories",
  "/login",
  "/p/velvet-lipstick",
  "/does-not-exist",
];

mkdirSync("e2e/screenshots", { recursive: true });

for (const width of WIDTHS) {
  test.describe(`layout at ${width}px`, () => {
    test.use({ viewport: { width, height: 800 } });

    for (const path of PAGES) {
      test(`${path}: no horizontal scroll, right chrome, nothing under the tabbar`, async ({
        page,
      }) => {
        await page.goto(path);
        await page.evaluate(() => document.fonts.ready);

        const overflow = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        }));
        expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth);

        const tabbar = page.locator(".lm-tabbar");
        const desktopNav = page.locator(".lm-dnav");
        if (width < 768) {
          await expect(tabbar).toBeVisible();
          await expect(desktopNav).toBeHidden();
          await expect(page.locator(".lm-mhead")).toBeVisible();

          // Scrolled to the very bottom, the last content must end above the tabbar.
          await page.evaluate(() =>
            window.scrollTo(0, document.documentElement.scrollHeight),
          );
          const contentBottom = await page.evaluate(() => {
            const main = document.querySelector("main");
            const items = main ? [...main.querySelectorAll("*")] : [];
            return Math.max(
              0,
              ...items.map((el) => el.getBoundingClientRect().bottom),
            );
          });
          const tabbarTop = (await tabbar.boundingBox())?.y ?? 0;
          expect(contentBottom).toBeLessThanOrEqual(tabbarTop + 0.5);
        } else {
          await expect(tabbar).toBeHidden();
          await expect(desktopNav).toBeVisible();
          await expect(page.locator(".lm-mhead")).toBeHidden();
          await expect(page.locator(".lm-dfoot")).toBeVisible();
        }

        if (path === "/") {
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.screenshot({
            path: `e2e/screenshots/home-${width}.png`,
            fullPage: true,
          });
        }
      });
    }
  });
}
