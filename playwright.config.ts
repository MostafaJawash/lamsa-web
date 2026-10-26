import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const DOWN_PORT = 3101;

/**
 * Two projects:
 * - `chromium`: the production build (`npm run build` first) against the configured backend.
 * - `backend-down`: `next dev` with API_BASE_URL on a closed port, to check that pages
 *   still render with fallbacks. Dev mode, because a production build would serve the
 *   data cached at build time.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 60_000,
  use: {
    locale: "ar",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      testIgnore: /backend-down\.spec\.ts/,
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
  ],
  webServer: [
    {
      command: `npm run start -- --port ${PORT}`,
      url: `http://localhost:${PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
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
  ],
});
