import { mkdirSync } from "node:fs";

import { expect, test } from "@playwright/test";

const API_HEALTH = "http://127.0.0.1:8000/health";

async function backendUp(): Promise<boolean> {
  try {
    return (await fetch(API_HEALTH, { signal: AbortSignal.timeout(2_000) })).ok;
  } catch {
    return false;
  }
}

mkdirSync("e2e/screenshots", { recursive: true });

test.describe("product cards on mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test.beforeAll(async () => {
    test.skip(
      !(await backendUp()),
      "needs the backend with demo data at 127.0.0.1:8000",
    );
  });

  test("discount badge reads −NN٪ left to right", async ({ page }) => {
    await page.goto("/");
    const badge = page
      .getByRole("region", { name: "عروض لفترة محدودة" })
      .locator(".lm-bd.off")
      .first();
    await expect(badge).toHaveAttribute("dir", "ltr");
    await expect(badge).toHaveText(/^−\d+٪$/);

    // Visual order: the minus sign is painted to the left of the percent sign.
    const order = await badge.evaluate((el) => {
      const text = el.firstChild;
      if (!text || text.nodeType !== Node.TEXT_NODE) return null;
      const length = text.textContent?.length ?? 0;
      const rectOf = (start: number) => {
        const range = document.createRange();
        range.setStart(text, start);
        range.setEnd(text, start + 1);
        return range.getBoundingClientRect();
      };
      return { minus: rectOf(0).left, percent: rectOf(length - 1).left };
    });
    expect(order).not.toBeNull();
    expect(order!.minus).toBeLessThan(order!.percent);
  });

  test("badges never overlap the heart and wrap instead (146px rail and 2-column grid)", async ({
    page,
  }) => {
    // Wait for hydration: nodes injected into React-managed markup before it may be
    // removed again.
    await page.goto("/", { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);

    // Build every badge combination from a real card, in a rail and in a list grid.
    await page.evaluate(() => {
      const source = document.querySelector(".lm-rail .lm-card");
      const pg = document.querySelector("main .lm-pg");
      if (!source || !pg) throw new Error("no card or page box");
      const combos = [
        ["new"],
        ["off"],
        ["na"],
        ["new", "off"],
        ["off", "na"],
        ["new", "na"],
        ["new", "off", "na"],
      ];
      const label: Record<string, string> = {
        new: "جديد",
        off: "−30٪",
        na: "نفدت الكمية",
      };
      const area = document.createElement("section");
      area.id = "badge-check";
      area.style.background = "var(--lamsa-bg)";
      for (const layout of ["lm-rail", "lm-grid"]) {
        const box = document.createElement("div");
        box.className = layout;
        box.style.marginBottom = "16px";
        for (const combo of combos) {
          const card = source.cloneNode(true) as HTMLElement;
          card.classList.toggle("out", combo.includes("na"));
          const badges = card.querySelector(".lm-badges");
          if (!badges) throw new Error("no badges");
          badges.replaceChildren(
            ...combo.map((kind) => {
              const i = document.createElement("i");
              i.className = `lm-bd ${kind}${kind === "off" ? " lm-num" : ""}`;
              if (kind === "off") i.dir = "ltr";
              i.textContent = label[kind] ?? "";
              return i;
            }),
          );
          box.append(card);
        }
        area.append(box);
      }
      pg.prepend(area);
    });

    const cards = page.locator("#badge-check .lm-card");
    await expect(cards).toHaveCount(14);
    const problems = await page.evaluate(() => {
      const out: string[] = [];
      const intersects = (a: DOMRect, b: DOMRect) =>
        a.left < b.right &&
        b.left < a.right &&
        a.top < b.bottom &&
        b.top < a.bottom;
      document.querySelectorAll("#badge-check .lm-card").forEach((card, n) => {
        const c = card.getBoundingClientRect();
        const fav = card.querySelector(".lm-fav")?.getBoundingClientRect();
        card.querySelectorAll(".lm-bd").forEach((bd) => {
          const b = bd.getBoundingClientRect();
          if (fav && intersects(b, fav))
            out.push(`card ${n}: "${bd.textContent}" under the heart`);
          if (b.left < c.left - 0.5 || b.right > c.right + 0.5)
            out.push(`card ${n}: "${bd.textContent}" clipped by the card`);
        });
      });
      return out;
    });
    expect(problems).toEqual([]);

    // The rail is 146px wide per card on mobile.
    const width = await cards
      .first()
      .evaluate((el) => el.getBoundingClientRect().width);
    expect(Math.round(width)).toBe(146);

    // For the review screenshot only: keep the sticky header and fixed tabbar out of it.
    await page.addStyleTag({
      content: ".lm-mhead,.lm-tabbar{visibility:hidden}",
    });
    await page.locator("#badge-check").screenshot({
      path: "e2e/screenshots/badges-mobile.png",
    });
  });

  test("a broken image shows the silhouette without client code per card", async ({
    page,
  }) => {
    // Break every size of the first new arrival's image.
    let broken = "";
    await page.route("**/media/products/**", async (route) => {
      const url = route.request().url();
      if (!broken) broken = url.replace(/_(thumb|medium|large)\.webp$/, "");
      if (url.startsWith(broken)) return route.abort();
      return route.continue();
    });
    await page.goto("/");
    const failed = page.locator("img[data-fallback][data-failed]");
    await expect(failed.first()).toBeAttached();
    await expect(failed.first()).toHaveCSS("visibility", "hidden");
    // The silhouette drawn behind it is there.
    await expect(
      failed.first().locator("xpath=..").locator("svg use"),
    ).toBeAttached();
    // Images that loaded are not marked.
    const ok = page.locator("img[data-fallback]:not([data-failed])");
    expect(await ok.count()).toBeGreaterThan(0);
  });
});
