// Quick screenshots of site pages: node scripts/shots.mjs [--base URL] [--dark] path... (to e2e/screenshots/quick)
import { mkdirSync } from "node:fs";

import { chromium } from "@playwright/test";

const args = process.argv.slice(2);
const baseIndex = args.indexOf("--base");
const base = baseIndex !== -1 ? args[baseIndex + 1] : "http://localhost:3000";
const dark = args.includes("--dark");
const paths = args.filter(
  (a, i) => a.startsWith("/") && args[i - 1] !== "--base",
);
const out = "e2e/screenshots/quick";
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
for (const [w, h, tag] of [
  [1280, 800, "d"],
  [390, 844, "m"],
]) {
  const page = await browser.newPage({
    viewport: { width: w, height: h },
    colorScheme: dark ? "dark" : "light",
  });
  for (const path of paths) {
    await page.goto(base + path, {
      waitUntil: "networkidle",
      timeout: 120_000,
    });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    const name =
      path.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "home";
    await page.screenshot({
      path: `${out}/${name}-${tag}${dark ? "-dark" : ""}.png`,
      fullPage: true,
    });
  }
  await page.close();
}
await browser.close();
console.log(`saved to ${out}`);
