// Client JS per route, from the Next.js bundle analyzer (Turbopack).
//
//   npx next analyze --output            # writes .next/diagnostics/analyze
//   node scripts/bundle-report.mjs [/route ...] [--modules]
//
// Prints, per route: initial and lazy client JS (raw and compressed), the share of each
// package, and the project's own client modules ("use client" files under src/).
import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const showModules = args.includes("--modules");
const wanted = args.filter((a) => a.startsWith("/"));

function exportRoute(route) {
  // MSYS_NO_PATHCONV keeps Git Bash on Windows from rewriting "/" into a path.
  const out = execFileSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["next", "analyze", "export", "--route", route],
    {
      encoding: "utf8",
      maxBuffer: 512 * 1024 * 1024,
      env: { ...process.env, MSYS_NO_PATHCONV: "1" },
      shell: process.platform === "win32",
    },
  );
  return out
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function listRoutes() {
  const meta = exportRoute("/").find((r) => r.type === "meta");
  return meta ? [] : [];
}

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

function packageOf(sourcePath) {
  const m = /node_modules\/((?:@[^/]+\/)?[^/]+)/.exec(sourcePath);
  if (m) return m[1];
  if (sourcePath.includes("/src/")) return "(app: src/)";
  return "(other)";
}

function report(route) {
  const records = exportRoute(route);
  const isClient = (file) => file.startsWith("[client-fs]/");
  const lazy = new Set(
    records
      .filter((r) => r.type === "group" && r.kind === "async")
      .flatMap((r) => r.outputs ?? []),
  );
  const parts = records.filter(
    (r) =>
      r.type === "part" && isClient(r.filename) && r.filename.endsWith(".js"),
  );
  const files = new Map();
  for (const p of parts) {
    const f = files.get(p.filename) ?? {
      size: 0,
      gz: 0,
      lazy: lazy.has(p.filename),
    };
    f.size += p.size;
    f.gz += p.compressed_size;
    files.set(p.filename, f);
  }
  const sum = (filter) =>
    [...files.values()]
      .filter(filter)
      .reduce((a, f) => ({ size: a.size + f.size, gz: a.gz + f.gz }), {
        size: 0,
        gz: 0,
      });
  const initial = sum((f) => !f.lazy);
  const lazyTotal = sum((f) => f.lazy);

  const byPackage = new Map();
  for (const p of parts) {
    if (lazy.has(p.filename)) continue;
    const key = packageOf(p.source_path);
    const e = byPackage.get(key) ?? { size: 0, gz: 0 };
    e.size += p.size;
    e.gz += p.compressed_size;
    byPackage.set(key, e);
  }

  const appModules = [
    ...new Set(
      parts
        .filter((p) => !lazy.has(p.filename) && p.source_path.includes("/src/"))
        .map((p) => p.source_path.replace("[project]/", "")),
    ),
  ].sort();

  console.log(`\n## ${route}`);
  console.log(
    `initial client JS: ${kb(initial.size)} raw, ${kb(initial.gz)} compressed (${[...files.values()].filter((f) => !f.lazy).length} files)`,
  );
  console.log(
    `lazy client JS:    ${kb(lazyTotal.size)} raw, ${kb(lazyTotal.gz)} compressed`,
  );
  console.log("initial by package (compressed):");
  for (const [name, e] of [...byPackage.entries()]
    .sort((a, b) => b[1].gz - a[1].gz)
    .slice(0, 12)) {
    console.log(`  ${kb(e.gz).padStart(9)}  ${name}`);
  }
  console.log(
    `app client modules in the initial bundle (${appModules.length}):`,
  );
  for (const m of appModules) console.log(`  ${m}`);
  if (showModules) {
    for (const p of parts
      .sort((a, b) => b.compressed_size - a.compressed_size)
      .slice(0, 25)) {
      console.log(`  ${kb(p.compressed_size).padStart(9)}  ${p.source_path}`);
    }
  }
}

void listRoutes;
for (const route of wanted.length
  ? wanted
  : ["/", "/categories", "/login", "/p/[slug]"])
  report(route);
