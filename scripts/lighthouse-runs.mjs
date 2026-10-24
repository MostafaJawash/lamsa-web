// Runs Lighthouse N times against a URL and prints each run plus the median.
// Uses Playwright's Chromium; Lighthouse itself runs via npx (not a dependency).
//
//   node scripts/lighthouse-runs.mjs [--url http://localhost:3300/] [--runs 5] [--desktop] [--out e2e/screenshots/lighthouse]
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { chromium } from "@playwright/test";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : fallback;
}

const LIGHTHOUSE = "lighthouse@13.5.0";
const url = arg("url", "http://localhost:3300/");
const runs = Number(arg("runs", "5"));
const desktop = process.argv.includes("--desktop");
const out = arg("out", "e2e/screenshots/lighthouse");
const mode = desktop ? "desktop" : "mobile";
mkdirSync(out, { recursive: true });

const median = (values) => {
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

const rows = [];
for (let i = 1; i <= runs; i++) {
  const base = join(out, `${mode}-${i}`);
  execFileSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    [
      "-y",
      LIGHTHOUSE,
      url,
      ...(desktop ? ["--preset=desktop"] : []),
      "--quiet",
      "--chrome-flags=--headless=new",
      "--output=json",
      "--output=html",
      `--output-path=${base}`,
    ],
    {
      stdio: "ignore",
      env: { ...process.env, CHROME_PATH: chromium.executablePath() },
      shell: process.platform === "win32",
    },
  );
  const report = JSON.parse(readFileSync(`${base}.report.json`, "utf8"));
  const a = report.audits;
  let lcpElement = "";
  const walk = (o) => {
    if (lcpElement || !o || typeof o !== "object") return;
    if (o.type === "node" && o.snippet) lcpElement = o.snippet;
    for (const v of Object.values(o)) walk(v);
  };
  walk(a["lcp-breakdown-insight"]?.details);
  const row = {
    performance: Math.round(report.categories.performance.score * 100),
    accessibility: Math.round(report.categories.accessibility.score * 100),
    bestPractices: Math.round(report.categories["best-practices"].score * 100),
    seo: Math.round(report.categories.seo.score * 100),
    fcp: a["first-contentful-paint"].numericValue,
    lcp: a["largest-contentful-paint"].numericValue,
    tbt: a["total-blocking-time"].numericValue,
    cls: a["cumulative-layout-shift"].numericValue,
    lcpElement,
  };
  rows.push(row);
  console.log(
    `${mode} #${i}: perf ${row.performance} a11y ${row.accessibility} bp ${row.bestPractices} seo ${row.seo} | FCP ${(row.fcp / 1000).toFixed(1)}s LCP ${(row.lcp / 1000).toFixed(1)}s TBT ${Math.round(row.tbt)}ms CLS ${row.cls.toFixed(3)}`,
  );
}

const pick = (k) => rows.map((r) => r[k]);
console.log(
  `MEDIAN ${mode} (${runs} runs): perf ${median(pick("performance"))} | FCP ${(median(pick("fcp")) / 1000).toFixed(1)}s LCP ${(median(pick("lcp")) / 1000).toFixed(1)}s TBT ${Math.round(median(pick("tbt")))}ms CLS ${median(pick("cls")).toFixed(3)} | a11y ${Math.min(...pick("accessibility"))} bp ${Math.min(...pick("bestPractices"))} seo ${Math.min(...pick("seo"))} (min)`,
);
console.log(`LCP element (last run): ${rows.at(-1)?.lcpElement.slice(0, 160)}`);
