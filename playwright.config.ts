import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const DOWN_PORT = 3101;
const DEV_PORT = 3102;
const CAPTURE_PORT = 3199;

const DEV_ONLY = /(backend-down|auth-dev|ip-forwarding)\.spec\.ts/;
/** Changes stock and store settings: runs alone, after the parallel tests. */
const STOCK = /stock\.spec\.ts/;

/**
 * Projects:
 * - `chromium`: the production build (`npm run build` first) against the running backend,
 *   with WEB_TRUST_PROXY_HEADERS=true like behind our Nginx: each test sends its own
 *   X-Real-IP (e2e/support/fixtures.ts), so the backend's per-IP login limits never
 *   collide between tests. The backend must list 127.0.0.1 in TRUSTED_PROXY_IPS.
 * - `stock`: the production build too, but alone and after `chromium` (it changes demo
 *   stock, product activation and the catalog_hide_out_of_stock setting through the
 *   admin API, and restores them), so no other test sees those changes.
 * - `backend-down`: `next dev` with API_BASE_URL on a closed port, to check that pages
 *   still render with fallbacks. Dev mode, because a production build would serve the
 *   data cached at build time.
 * - `auth-dev` and `ip-forwarding`: one `next dev` server (WEB_TRUST_PROXY_HEADERS=false)
 *   whose backend calls go through a recording proxy (e2e/support/capture-server.mjs)
 *   to the real backend: the dev-only Google button (needs the backend's
 *   GOOGLE_DEV_MODE=true; production hides it) and what the website forwards.
 *
 * Only two `next dev` servers: several in one project directory race on shared files
 * (next-env.d.ts) and slow each other's first compiles.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 60_000,
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    locale: "ar",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      testIgnore: [DEV_ONLY, STOCK],
      use: {
        ...devices["Desktop Chrome"],
        baseURL: `http://localhost:${PORT}`,
      },
    },
    {
      name: "stock",
      testMatch: STOCK,
      dependencies: ["chromium"],
      fullyParallel: false,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: `http://localhost:${PORT}`,
      },
    },
    {
      name: "backend-down",
      testMatch: /backend-down\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: `http://localhost:${DOWN_PORT}`,
      },
    },
    {
      name: "auth-dev",
      testMatch: /auth-dev\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: `http://localhost:${DEV_PORT}`,
      },
    },
    {
      name: "ip-forwarding",
      testMatch: /ip-forwarding\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: `http://localhost:${DEV_PORT}`,
      },
    },
  ],
  webServer: [
    {
      command: `npm run start -- --port ${PORT}`,
      url: `http://localhost:${PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: { WEB_TRUST_PROXY_HEADERS: "true" },
    },
    {
      command: `npx next dev --port ${DOWN_PORT}`,
      url: `http://localhost:${DOWN_PORT}/robots.txt`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      // Port 9 (discard) is closed: every backend call fails fast.
      // Its own build directory, so it runs next to a developer's `npm run dev`.
      env: {
        API_BASE_URL: "http://127.0.0.1:9/api/v1",
        NEXT_DIST_DIR: ".next-e2e",
      },
    },
    {
      command: `node e2e/support/capture-server.mjs ${CAPTURE_PORT}`,
      url: `http://127.0.0.1:${CAPTURE_PORT}/__captured`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: `npx next dev --port ${DEV_PORT}`,
      url: `http://localhost:${DEV_PORT}/robots.txt`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: {
        API_BASE_URL: `http://127.0.0.1:${CAPTURE_PORT}/api/v1`,
        NEXT_PUBLIC_GOOGLE_CLIENT_ID: "",
        WEB_TRUST_PROXY_HEADERS: "false",
        NEXT_DIST_DIR: ".next-e2e-auth",
      },
    },
  ],
});
