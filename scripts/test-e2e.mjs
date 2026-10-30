import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const executable = process.execPath;
const cli = resolve("node_modules", "@playwright", "test", "cli.js");

/**
 * The production phase runs its projects in parallel, with two workers: with four, the
 * single production server and the backend on one machine were slow enough for timing-
 * sensitive checks (a toast, a redirect within 5 s) to fail now and then. The two `next dev` phases run with ONE worker and start from an empty
 * build directory: a dev server compiles each route on its first request, and parallel
 * first requests to the same uncompiled route race on the compiler's files (500
 * "Unexpected end of JSON input"). Each dev phase already has its own build directory
 * (NEXT_DIST_DIR in playwright.config.ts), so they never share files with each other or
 * with `npm run build`.
 */
/**
 * Empties a dev build directory but keeps `dev/cache` (Turbopack's cache, which also holds the
 * downloaded Google fonts): with a cold cache every `next dev` start depends on the network,
 * and a failed font download answers every page with 500.
 */
function cleanBuildDirectory(directory) {
  if (!existsSync(directory)) return;
  for (const entry of readdirSync(directory)) {
    const path = resolve(directory, entry);
    if (entry !== "dev") {
      rmSync(path, { recursive: true, force: true });
      continue;
    }
    for (const inner of readdirSync(path))
      if (inner !== "cache")
        rmSync(resolve(path, inner), { recursive: true, force: true });
  }
}

const phases = [
  {
    name: "production",
    projects: ["chromium", "stock"],
    serial: false,
    workers: 2,
  },
  {
    name: "backend-down",
    projects: ["backend-down"],
    serial: true,
    dist: ".next-e2e",
  },
  {
    name: "auth-dev",
    projects: ["auth-dev", "ip-forwarding"],
    serial: true,
    dist: ".next-e2e-auth",
  },
];

/**
 * `next dev` downloads the Google fonts when it starts, over the network; now and then that
 * download fails and every page of that dev server answers 500 ("next/font/google queries have
 * exactly one entry"), which has nothing to do with the site. A dev phase that fails is
 * therefore run once more from an empty build directory; the production phase is never
 * retried, and a dev phase that fails twice fails the run.
 */
for (const { name, projects, serial, workers, dist } of phases) {
  const attempts = dist ? 2 : 1;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    if (dist) {
      // The retry starts completely cold, so a failed download is not cached.
      if (attempt === 1) cleanBuildDirectory(resolve(dist));
      else rmSync(resolve(dist), { recursive: true, force: true });
    }
    const args = [
      cli,
      "test",
      ...projects.flatMap((project) => ["--project", project]),
      ...(serial ? ["--workers=1"] : workers ? [`--workers=${workers}`] : []),
    ];
    const result = spawnSync(executable, args, {
      env: { ...process.env, E2E_PHASE: name },
      stdio: "inherit",
    });
    if (result.error) throw result.error;
    if (result.status === 0) break;
    if (attempt === attempts) process.exit(result.status ?? 1);
    console.warn(`
[e2e] phase "${name}" failed; running it once more (see the note in scripts/test-e2e.mjs)
`);
  }
}
