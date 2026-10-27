// Responsive check of every page at the phase 2 viewport matrix (see README "Responsive
// check"). For each page and viewport it reports: horizontal scroll, elements outside
// the viewport (outside horizontal scrollers), clipped labels, overlapping controls,
// the chrome of the breakpoint, tap targets under 44px (including ::before hit areas),
// and on /c/care the filter sheet (side, inside the viewport, internal scroll). Long
// names (70 characters) are injected on a list and a product page. Screenshots go to
// e2e/screenshots/responsive/ (git-ignored); the JSON report to stdout.
//
//   node scripts/responsive-check.mjs [--base http://localhost:3000] [--only /c/care]
//     [--state e2e/screenshots/state-cart.json]  (cookies, e.g. a guest cart: see
//     visual-compare.mjs --prepare; /cart and /favorites then show their items)
// Git Bash: prefix with MSYS_NO_PATHCONV=1.
import { mkdirSync, writeFileSync } from "node:fs";

import { chromium } from "@playwright/test";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : fallback;
}

const base = arg("base", "http://localhost:3000");
const only = arg("only", null);
const state = arg("state", undefined);
const out = "e2e/screenshots/responsive";
mkdirSync(out, { recursive: true });

const VIEWPORTS = [
  [360, 740],
  [390, 844],
  [430, 932],
  [844, 390],
  [768, 1024],
  [1024, 768],
  [1280, 800],
  [1440, 900],
  [1920, 1080],
];
const DARK = new Set(["390x844", "1280x800"]);

const PAGES = [
  "/",
  "/categories",
  "/c/care",
  "/c/care?attr.skin_type=%D8%AC%D8%A7%D9%81%D8%A9&on_sale=true&filters=1",
  "/c/care?min_price=500",
  "/c/makeup",
  "/new",
  "/sale",
  "/search",
  "/search?q=%D8%B9%D8%B7%D8%B1",
  "/search?q=zzzz",
  "/brands",
  "/brands/demo-baity",
  "/p/demo-velvet-lipstick",
  "/p/demo-jasmine-night-perfume",
  "/p/demo-care-box",
  "/p/nope",
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
].filter((p) => !only || p === only);

const LONG =
  "كريم ترطيب مكثّف بزبدة الشيا وزيت الأرغان للبشرة الجافة جداً والحساسة 200 مل";

/** Runs in the page: every layout problem as a short string. */
function audit() {
  const vw = document.documentElement.clientWidth;
  const problems = [];
  const describe = (el) => {
    const cls =
      typeof el.className === "string"
        ? el.className.trim().split(/\s+/).slice(0, 2).join(".")
        : "";
    const text = (el.textContent ?? "")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 24);
    return `${el.tagName.toLowerCase()}${cls ? `.${cls}` : ""}${text ? ` "${text}"` : ""}`;
  };
  const visible = (el) => {
    if (
      el.closest(
        "[hidden], [aria-hidden='true'], noscript, [data-list-preview], .sr-only",
      )
    )
      return false;
    const s = getComputedStyle(el);
    if (
      s.visibility === "hidden" ||
      s.display === "none" ||
      Number(s.opacity) === 0
    )
      return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const inScroller = (el) => {
    for (
      let p = el.parentElement;
      p && p !== document.body;
      p = p.parentElement
    ) {
      const o = getComputedStyle(p).overflowX;
      if (o === "auto" || o === "scroll" || o === "hidden" || o === "clip")
        return true;
    }
    return false;
  };

  if (document.documentElement.scrollWidth > vw + 1)
    problems.push(
      `horizontal scroll: ${document.documentElement.scrollWidth} > ${vw}`,
    );

  // Outside the viewport (not inside a scroller that clips on purpose).
  for (const el of document.querySelectorAll("body *")) {
    if (!visible(el) || inScroller(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.right > vw + 1 || r.left < -1) {
      problems.push(
        `outside viewport: ${describe(el)} [${Math.round(r.left)}..${Math.round(r.right)}]`,
      );
      break;
    }
  }

  // Clipped single-line labels.
  for (const el of document.querySelectorAll(
    "h1, h2, h3, .lm-chip, .lm-btn, .lm-sel select, .lm-mtitle, .lm-p-name, .lm-card .c-name, .lm-bd, .lm-tabs [role=tab]",
  )) {
    if (!visible(el)) continue;
    const s = getComputedStyle(el);
    const ellipsis =
      s.textOverflow === "ellipsis" || s.webkitLineClamp !== "none";
    if (
      !ellipsis &&
      (el.scrollWidth > el.clientWidth + 1 ||
        el.scrollHeight > el.clientHeight + 2) &&
      s.overflow !== "visible"
    )
      problems.push(`clipped: ${describe(el)}`);
  }

  // Controls and their effective hit area (the element or its ::before hit area).
  const controls = [
    ...document.querySelectorAll(
      "a[href], button, select, summary, input:not([type=hidden]), label.lm-chip, label.lm-toggle, [role=radio], [role=tab]",
    ),
  ].filter(visible);
  const boxes = [];
  for (const el of controls) {
    if (!visible(el)) continue;
    // Inputs inside a label are hit through the label.
    if (el.matches("input") && el.closest("label")) continue;
    const r = el.getBoundingClientRect();
    let w = r.width;
    let h = r.height;
    const before = getComputedStyle(el, "::before");
    if (before.content !== "none" && before.position === "absolute") {
      const px = (v) => (v.endsWith("px") ? Number.parseFloat(v) : 0);
      w = Math.max(w, r.width - px(before.left) - px(before.right));
      h = Math.max(h, r.height - px(before.top) - px(before.bottom));
    }
    // Links inside running text are exempt (WCAG 2.5.8 inline exception).
    const inline =
      el.matches("a") &&
      getComputedStyle(el).display === "inline" &&
      el.closest("p");
    if (!inline && (w < 43.5 || h < 43.5))
      problems.push(
        `tap target ${Math.round(w)}x${Math.round(h)}: ${describe(el)}`,
      );
    boxes.push([el, r]);
  }
  // Fixed and sticky chrome (headers, tabbar) covers scrolled content by design, and the
  // heart sits on its card.
  const pinned = (el) => {
    for (let p = el; p; p = p.parentElement) {
      const pos = getComputedStyle(p).position;
      if (pos === "fixed" || pos === "sticky") return true;
    }
    return false;
  };
  const intended = (a, b) =>
    pinned(a) !== pinned(b) ||
    (a.matches(".lm-fav") && b.matches(".lm-card-link")) ||
    (b.matches(".lm-fav") && a.matches(".lm-card-link"));
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const [a, ra] = boxes[i];
      const [b, rb] = boxes[j];
      if (a.contains(b) || b.contains(a) || intended(a, b)) continue;
      const x = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
      const y = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      if (x > 2 && y > 2)
        problems.push(`overlap: ${describe(a)} × ${describe(b)}`);
    }
  }

  // Chrome of the breakpoint.
  const shown = (sel) => {
    const el = document.querySelector(sel);
    return (
      !!el &&
      getComputedStyle(el).display !== "none" &&
      el.getBoundingClientRect().height > 0
    );
  };
  const mobile = window.innerWidth < 768;
  if (shown(".lm-mhead") !== mobile)
    problems.push(`chrome: mobile header ${mobile ? "missing" : "shown"}`);
  if (shown(".lm-tabbar") !== mobile)
    problems.push(`chrome: tab bar ${mobile ? "missing" : "shown"}`);
  if (shown(".lm-dhead") === mobile)
    problems.push(`chrome: desktop header ${mobile ? "shown" : "missing"}`);
  return [...new Set(problems)];
}

/** Loads a page; networkidle is best effort (prefetches may keep the network busy). */
async function open(page, url) {
  await page.goto(url, { waitUntil: "load" });
  await page
    .waitForLoadState("networkidle", { timeout: 5_000 })
    .catch(() => {});
}

async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
}

const browser = await chromium.launch();
const report = {};
const add = (key, problems) => {
  if (problems.length) report[key] = problems;
};

for (const [width, height] of VIEWPORTS) {
  const size = `${width}x${height}`;
  const schemes = DARK.has(size) ? ["light", "dark"] : ["light"];
  for (const scheme of schemes) {
    const context = await browser.newContext({
      viewport: { width, height },
      colorScheme: scheme,
      ...(state ? { storageState: state } : {}),
    });
    const page = await context.newPage();
    for (const path of PAGES) {
      await open(page, base + path);
      await settle(page);
      add(`${size} ${scheme} ${path}`, await page.evaluate(audit));
      const name = `${size}-${scheme}-${path.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "home"}`;
      await page.screenshot({ path: `${out}/${name}.png` });
    }

    // The filter sheet.
    if (!only || only === "/c/care") {
      await open(page, `${base}/c/care`);
      await page.getByRole("link", { name: /المزيد من الفلاتر/ }).click();
      const sheet = page.getByRole("dialog");
      await sheet.waitFor();
      await page.waitForTimeout(400);
      const info = await sheet.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const body = el.querySelector(".lm-fpanel-body");
        const submit = el
          .querySelector("button[type=submit]")
          ?.getBoundingClientRect();
        return {
          side: el.getAttribute("data-side"),
          rect: [r.left, r.top, r.right, r.bottom].map(Math.round),
          vw: window.innerWidth,
          vh: window.innerHeight,
          bodyScrolls: body ? body.scrollHeight > body.clientHeight : false,
          bodyOverflow: body ? getComputedStyle(body).overflowY : null,
          submitInView:
            !!submit &&
            submit.bottom <= window.innerHeight + 1 &&
            submit.top >= 0,
        };
      });
      const problems = [];
      const expected = width >= 768 ? "end" : "bottom";
      if (info.side !== expected)
        problems.push(`sheet side ${info.side}, expected ${expected}`);
      if (
        info.rect[0] < -2 ||
        info.rect[2] > info.vw + 2 ||
        info.rect[1] < -2 ||
        info.rect[3] > info.vh + 2
      )
        problems.push(`sheet outside viewport ${info.rect}`);
      if (!info.submitInView) problems.push("sheet submit button not in view");
      if (info.bodyScrolls && !/(auto|scroll)/.test(info.bodyOverflow ?? ""))
        problems.push("sheet body overflows without scrolling");
      add(`${size} ${scheme} sheet`, problems);
      await page.screenshot({ path: `${out}/${size}-${scheme}-sheet.png` });
    }

    // Long names (70+ characters): a list card, the product title and the mobile title.
    if (!only) {
      for (const path of ["/c/care", "/p/demo-velvet-lipstick"]) {
        await open(page, base + path);
        await page.evaluate((long) => {
          for (const el of document.querySelectorAll(
            ".lm-card .c-name, .lm-p-name, .lm-mtitle, h1",
          ))
            el.textContent = long;
        }, LONG);
        await settle(page);
        add(`${size} ${scheme} long-name ${path}`, await page.evaluate(audit));
        await page.screenshot({
          path: `${out}/${size}-${scheme}-long${path.replace(/[^a-z0-9]+/gi, "_")}.png`,
        });
      }
    }
    await context.close();
  }
}
await browser.close();
writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
console.log(
  `${Object.keys(report).length} page/viewport combinations with problems`,
);
