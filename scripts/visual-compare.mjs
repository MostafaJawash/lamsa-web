// Visual comparison with the design prototype (see README "Design fidelity").
// Screenshots a prototype feature (1 home, 2 care list, 3 velvet lipstick, 4 brands,
// 5 favorites → --path /favorites, 6 cart → --path /cart, 7 account: the login screen
// while signed out → --path /login, ...)
// and the matching page of this site at matching widths, in light and dark mode, into
// e2e/screenshots/<feature>/ (git-ignored). Needs a running site.
//
//   node scripts/visual-compare.mjs [--base http://localhost:3000] [--prototype <path>]
//     [--feature 1] [--path /] [--state <storage-state.json>] [--name <suffix>]
// --state: a Playwright storage state (cookies) for the site pages, e.g. a guest cart:
//   node scripts/visual-compare.mjs --prepare cart --base … (writes e2e/screenshots/state-cart.json)
// --name: a sub-folder for a variant of a feature (e.g. "issues", "empty").
// Git Bash: prefix with MSYS_NO_PATHCONV=1 so "--path /c/care" is not rewritten.
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { chromium } from "@playwright/test";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : fallback;
}

const base = arg("base", "http://localhost:3000");
const path = arg("path", "/");
const feature = Number(arg("feature", "1"));
const prototype = resolve(
  arg("prototype", "../lamsa-backend/docs/prototype/lamsa-presentation.html"),
);
const state = arg("state", undefined);
const variant = arg("name", "");
const prepare = arg("prepare", undefined);
const out = resolve(
  "e2e/screenshots",
  `feature-${feature}${variant ? `-${variant}` : ""}`,
);
mkdirSync(out, { recursive: true });

/** Expands the prototype frames so their whole scrollable page is visible. */
async function expandPrototype(page) {
  await page.evaluate(() => {
    // The sticky tour bar would cover the top of the frames in element screenshots.
    const tour = document.querySelector(".tourbar");
    if (tour) tour.style.display = "none";
    for (const sel of ["#d-screen", "#m-screen"]) {
      const screen = document.querySelector(sel);
      const main = screen?.querySelector(".main");
      if (!screen || !main) continue;
      const chrome = screen.querySelector(".d-app, .m-app");
      const extra = chrome ? chrome.scrollHeight - main.clientHeight : 0;
      const full = main.scrollHeight + extra;
      if (sel === "#d-screen") {
        screen.style.height = `${full}px`;
      } else {
        const phone = document.getElementById("phone");
        // 12px padding top/bottom + 46px status bar
        if (phone) phone.style.height = `${full + 24 + 46}px`;
      }
    }
  });
}

async function shootPrototype(browser, scheme) {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    colorScheme: scheme,
  });
  await page.goto(pathToFileURL(prototype).href, { waitUntil: "networkidle" });
  await page.locator(`.feat[data-i="${feature - 1}"]`).click();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);
  await expandPrototype(page);
  await page.waitForTimeout(300);
  const desktop = await page.locator("#d-screen").boundingBox();
  const phone = await page.locator("#m-screen").boundingBox();
  await page
    .locator("#d-screen")
    .screenshot({ path: `${out}/prototype-desktop-${scheme}.png` });
  await page
    .locator("#m-screen")
    .screenshot({ path: `${out}/prototype-mobile-${scheme}.png` });
  await page.close();
  return {
    desktopWidth: Math.round(desktop.width),
    phoneWidth: Math.round(phone.width),
  };
}

async function shootSite(
  browser,
  width,
  height,
  name,
  scheme,
  fullPage = true,
) {
  const page = await browser.newPage({
    viewport: { width, height },
    colorScheme: scheme,
    ...(state ? { storageState: state } : {}),
  });
  await page.goto(base + path, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/${name}.png`, fullPage });
  await page.close();
}

/**
 * --prepare cart|favorites: fills a guest cart (or favorites) through the site like a
 * visitor (two products, as in the prototype screens) and saves the cookies to
 * e2e/screenshots/state-<kind>.json for --state.
 */
async function prepareState(browser, kind) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const products = ["/p/demo-velvet-lipstick", "/p/demo-vitamin-c-serum"];
  for (const product of products) {
    await page.goto(base + product, { waitUntil: "networkidle" });
    const button =
      kind === "cart"
        ? page.locator(".lm-buy button.primary:visible")
        : page.locator(".lm-buy .lm-fav-lg:visible");
    await button.click();
    await page.locator(".lm-toast").first().waitFor();
    await page.waitForTimeout(400);
  }
  const file = resolve("e2e/screenshots", `state-${kind}.json`);
  await context.storageState({ path: file });
  await context.close();
  console.log(`storage state in ${file}`);
}

const browser = await chromium.launch();
if (prepare) {
  await prepareState(browser, prepare);
  await browser.close();
  process.exit(0);
}
const light = await shootPrototype(browser, "light");
await shootPrototype(browser, "dark");
console.log(
  `prototype frames: desktop ${light.desktopWidth}px, phone ${light.phoneWidth}px`,
);

for (const scheme of ["light", "dark"]) {
  // Same widths as the prototype frames, for a 1:1 comparison.
  await shootSite(
    browser,
    light.desktopWidth,
    800,
    `site-desktop-matched-${scheme}`,
    scheme,
  );
  await shootSite(
    browser,
    light.phoneWidth,
    760,
    `site-mobile-matched-${scheme}`,
    scheme,
  );
}
// Requested sizes.
await shootSite(browser, 1280, 800, "site-1280x800-light", "light");
await shootSite(browser, 390, 844, "site-390x844-light", "light");
await shootSite(browser, 1280, 800, "site-1280x800-dark", "dark");
await shootSite(browser, 390, 844, "site-390x844-dark", "dark");
await browser.close();
console.log(`screenshots in ${out}`);
