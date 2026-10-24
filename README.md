# lamsa-web

Customer website of the **Lamsa** (لمسة) beauty store. Arabic only for now, right to left.
The backend is the FastAPI project in [`../lamsa-backend`](../lamsa-backend); its README describes the API, the auth flow, error codes and image sizes.

> Status: phase 1. The global layout (desktop and mobile) and the home page reproduce the design prototype with real backend data; the other pages still render just their Arabic title.

## Stack

|           |                                                                                                   |
| --------- | ------------------------------------------------------------------------------------------------- |
| Framework | Next.js 16.4 (App Router, Turbopack, `src/` directory), React 19.3, React Compiler (Babel plugin) |
| Rendering | Cache Components + Partial Prefetching (as generated), `output: "standalone"`, typed routes       |
| Language  | TypeScript 5.9, `strict`, no `any` (ESLint error)                                                 |
| Styling   | Tailwind CSS 4 (Turbopack loader), shadcn/ui (Radix, RTL mode), tw-animate-css, lucide-react      |
| Data      | `openapi-fetch` client typed by `openapi-typescript` from the FastAPI OpenAPI schema; zod         |
| Forms     | react-hook-form + @hookform/resolvers (zod)                                                       |
| Tests     | Vitest + Testing Library (jsdom), Playwright (Chromium)                                           |
| Quality   | ESLint 9 (next/core-web-vitals + a local rule), Prettier + Tailwind plugin                        |

Versions are pinned exactly in `package.json`. See [Dependency policy](#dependency-policy).

## Folder structure

```
messages/ar.json            All UI texts (Arabic), read through t()
src/
  app/                      Routes only (pages, layouts, route handlers, metadata files)
    (shop)/                 Shop pages in the .pg box: home, /categories, /c, /brands, /p, /new, /sale, /search, /cart, /favorites
    (auth)/                 Login, register, complete-profile (Google onboarding) in the narrow .auth block
    (account)/account/      Account pages with the account navigation
    checkout/               Checkout and the success page
    api/auth/               BFF route handlers (refresh, logout); skeletons returning 501
    layout.tsx              <html lang="ar" dir="rtl">, fonts, metadata, site chrome (SiteShell), Toaster
    globals.css             Tailwind, design tokens (light and dark) and the prototype component classes (lm-*)
    not-found / error / global-error, sitemap.ts, robots.ts, manifest.ts
  features/<name>/          One folder per domain: catalog, cart, favorites, auth, account, orders, notifications, banners, system
    components/             UI of that feature
    queries.ts              Server-only reads (server components)
    actions.ts              Server actions (mutations), callable from client components
    types.ts                Aliases of the generated backend schemas
  components/ui/            shadcn/ui components (button, input, label, card, dialog, sheet, sonner)
  components/layout/        Site chrome: SiteShell, desktop header + nav, mobile header, tabbar, footer, dev backend notice
  components/shared/        Reusable pieces: icons, product card, price, BackendImage, category tile, brand logo, section, empty state, skeletons, error boundary
  config/site.ts            Store name, navigation (tabs, chips, tabbar) and navState(pathname) (active tab, mobile title)
  i18n/                     Locale config and the typed t() helper
  hooks/                    Shared client hooks
  lib/api/client.ts         Server-only FastAPI client (timeout, token, error mapping)
  lib/api/result.ts         QueryResult + settle()/safeQuery(): backend failures become fallbacks, never errors
  lib/api/schema.d.ts       Generated OpenAPI types (committed; do not edit)
  lib/api/types.ts          Type helpers over the schema (Schema<"ProductCardOut">)
  lib/auth/session.ts       Server-only session cookie helpers
  lib/env.ts                Server env (zod, fail fast); lib/env.public.ts for NEXT_PUBLIC_*
  lib/errors.ts             ApiError, backend error codes, Arabic fallbacks
  lib/image-urls.ts         Backend image URLs and srcset (thumb / medium / large), server and client
  lib/images.ts             next/image loader, kept for completeness (the site renders BackendImage)
  lib/format.ts             formatPrice, formatDate, pluralize
  lib/utils.ts              cn()
  proxy.ts                  Next.js 16 Proxy (formerly middleware) for /account and /checkout
tests/                      Vitest unit tests
e2e/                        Playwright tests (home, layout at 4 widths, backend down); e2e/screenshots/ is git-ignored
scripts/start-standalone.mjs  Starts the standalone build with .env files and static assets (used by npm start)
scripts/visual-compare.mjs    Screenshots the prototype and the site side by side
scripts/bundle-report.mjs     Client JS per route from the Next.js bundle analyzer
scripts/lighthouse-runs.mjs   Runs Lighthouse N times and prints the median
```

## BFF and auth

The browser **never talks to FastAPI and never sees a token**. This app is a backend-for-frontend:

- Server components, server actions and route handlers call FastAPI through `src/lib/api/client.ts` (server-only).
- Access and refresh tokens live in **httpOnly** cookies on the website's domain: `Secure` in production (with the `__Host-` prefix), `SameSite=Lax`, `path=/`. Helpers are in `src/lib/auth/session.ts`.
- Access tokens last 15 minutes. Refresh tokens last 60 days and **each one works once**: refresh one at a time, rotate both cookies, and treat `TOKEN_REUSED` as a logout. The planned flow is described in `src/app/api/auth/*/route.ts`.
- `src/proxy.ts` will only do an optimistic redirect to `/login` when no session cookie exists. The real check happens where data is read.
- Public catalog reads use `publicApi` (no cookies, cacheable with `"use cache"`). Personal reads use `await getApi()`, which reads cookies, so that UI must render inside `<Suspense>` (Cache Components).
- Errors from the backend (`{"error": {"code", "message", "details"}}`) become a typed `ApiError`. Show `errorMessage(error)`, which prefers the backend's Arabic message, then the fallback for the code in `messages/ar.json`.
- To do before going live: forward the visitor's IP to the backend (per-IP login rate limits), see the TODO in `client.ts`.

The admin panel is a separate project; nothing admin lives here.

## Running backend + web together

1. Backend (see its README for the first-time setup: venv, MySQL, `.env`, migrations, seeds):

   ```powershell
   cd ..\lamsa-backend
   .\venv\Scripts\fastapi.exe dev app/main.py        # http://127.0.0.1:8000/docs
   ```

   Optional demo data: `.\venv\Scripts\python.exe -m scripts.seed_demo_catalog`.

2. Web:

   ```powershell
   npm ci
   copy .env.example .env.local
   npm run dev                                         # http://localhost:3000
   ```

   The backend's `CORS_ORIGINS` doesn't matter for the BFF (server-to-server), but leave `http://localhost:3000` in it for tools.

## Environment variables

`.env.local` is git-ignored; `.env.example` is the template. Files must be UTF-8 **without BOM**: don't write them with PowerShell 5.1 `Set-Content` or `Out-File`. Missing or invalid values stop the app at startup with a clear message.

| Variable                     | Scope       | Example                        |
| ---------------------------- | ----------- | ------------------------------ |
| `API_BASE_URL`               | server only | `http://127.0.0.1:8000/api/v1` |
| `NEXT_PUBLIC_SITE_URL`       | public      | `http://localhost:3000`        |
| `NEXT_PUBLIC_MEDIA_BASE_URL` | public      | `http://127.0.0.1:8000/media`  |

`NEXT_PUBLIC_*` values are inlined at **build** time; rebuild after changing them.

## Scripts

| Script                            |                                                                                                                                                                                                               |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                     | Dev server (Turbopack)                                                                                                                                                                                        |
| `npm run build`                   | Production build (`.next/standalone`)                                                                                                                                                                         |
| `npm run start`                   | Start the standalone build (`scripts/start-standalone.mjs`: loads `.env*` files like `next start`, copies static assets; `-- --port 3100`)                                                                    |
| `npm run lint`                    | ESLint                                                                                                                                                                                                        |
| `npm run typecheck`               | `next typegen` (route types) + `tsc --noEmit`                                                                                                                                                                 |
| `npm run format` / `format:check` | Prettier write / check                                                                                                                                                                                        |
| `npm run test`                    | Vitest unit tests                                                                                                                                                                                             |
| `npm run test:e2e`                | Playwright: project `chromium` against the production build (run `npm run build` first), project `backend-down` against `next dev` with an unreachable backend. First time: `npx playwright install chromium` |
| `npm run gen:api`                 | Regenerate the API types from the running backend                                                                                                                                                             |
| `npm run audit`                   | `npm audit --omit=dev --audit-level=high` (fails on high/critical runtime issues)                                                                                                                             |

Before every commit: `npm run lint && npm run typecheck && npm run test && npm run build && npm run audit`.

## Regenerating the API types

With the backend running at `http://127.0.0.1:8000`:

```powershell
npm run gen:api
npm run typecheck
```

Commit `src/lib/api/schema.d.ts` together with the code that uses the changed endpoints. The client strips the `/api/v1` prefix at type level, so calls look like `publicApi.GET("/products", { params: { query: { category: "makeup" } } })`.

## Conventions

- **Server code** lives in `src/lib/api`, `src/lib/auth`, `src/lib/env.ts` and `src/features/*/queries.ts`, each starting with `import "server-only"`. Mutations are server actions in `src/features/*/actions.ts`. The ESLint rule `lamsa/no-server-imports-in-client` blocks these imports in `"use client"` files (type-only imports are fine).
- **Client components** only when needed (state, effects, browser APIs). Add `"use client"` at the top, keep them small and push them to the leaves.
- **Texts:** never hard-code UI text. Add it to `messages/ar.json` and use `t("section.key")`; keys are type-checked. Plurals: `pluralize(count, "products")`. Designed so a `[locale]` segment can be added later (`src/i18n/config.ts`).
- **Formatting:** prices with `formatPrice("8.95")` → `8,95 €` (string math, no floats); dates with `formatDate()` (Arabic, Latin digits, Europe/Berlin). Latin digits everywhere, as in the prototype.
- **Images:** backend images use `BackendImage` (`src/components/shared/backend-image.tsx`): a plain server-rendered `<img>` whose `srcset` lists the three backend files (300 / 800 / 1600w), with `sizes` set to the rendered width. No client component per image. `priority` preloads above-the-fold images (the mobile LCP). For a fallback, render it in the tile _before_ the image (silhouette, monogram); the global module script hides an image that fails to load (`data-failed`) so the fallback shows.
- **Mixed directions:** any sign, percent or currency next to Arabic text goes in an isolated LTR run (`.lm-num` + `dir="ltr"`), like prices and the discount badge (`−25٪`).
- **RTL:** use logical utilities only (`ms-/me-`, `ps-/pe-`, `start-/end-`, `border-s/e`, `rounded-s/e`, `text-start/end`, `slide-in-from-start/end`), never `left/right`, `ml/mr`, `pl/pr`. The `Sheet` sides are `start | end | top | bottom`. shadcn is configured with `"rtl": true`, so `npx shadcn@4.21.4 add <component>` generates logical classes; still review each new component.
- **Design tokens:** brand colors as Tailwind utilities (`bg-surface`, `text-ink`, `text-ink-muted`, `border-line`, `text-brand`, `bg-brand-soft`, `text-gold`, `text-ok`, `text-warn`, `text-danger`, `shadow-card`), plus the shadcn tokens (`bg-primary`, …) mapped onto them. Fonts: body IBM Plex Sans Arabic; the display font (Reem Kufi, `font-display` / `var(--lamsa-display)`) only where the prototype uses it (logo, banner titles, page titles, monograms). Dark mode follows the system.
- **Naming:** files in kebab-case (`page-title.tsx`), components in PascalCase, one feature per folder; import with `@/…`.
- **Files:** UTF-8 without BOM, LF line endings (`.editorconfig`, `.gitattributes`).

## Design fidelity

**Source of truth:** the prototype `../lamsa-backend/docs/prototype/lamsa-presentation.html`: CSS in its `<style>`, markup in the `App` render functions (`desktop()`, `mobile()`, `pHome()`, `card()`, `rail()`, `pCats()`, …). Copy its values exactly (colors, fonts, sizes, spacing, radii, shadows, states); don't restyle.

- **Component classes:** the prototype classes live in `src/app/globals.css` under `@layer components`, renamed `lm-*` (`.card` → `.lm-card`, `.d-bar` → `.lm-dbar`, …), each with a comment naming its prototype selector. Their inner parts keep the prototype names (`.lm-card .c-name`, `.lm-banner .bt`). Tailwind utilities are for layout glue only (visibility per breakpoint, wrappers). For a new screen, copy the prototype rule into this layer first, then use the class.
- **Breakpoints:** below **768px** the site is the prototype mobile app (`.m-head` + fixed `.tabbar`, all `.m-app` overrides); from **768px** it is the desktop site (`.d-bar` + `.d-nav` + `.d-foot`). The prototype `@container (min-width:720px)` rules apply from 768px. `<main>` is a size container, so the prototype `cqi` font sizes still work. Content box `.lm-pg`: 26px 32px, max 1120px (mobile 14px 14px 22px).
- **Icons:** `src/components/shared/icons.tsx` (the prototype set, not lucide).
- **RTL:** logical properties only, as in the prototype (`inset-inline-*`, `padding-inline`, `margin-inline-*`).

**How fidelity is checked:** with the backend (demo data) running:

```powershell
npm run build
npm run start -- --port 3300
node scripts/visual-compare.mjs --base http://localhost:3300
```

This screenshots the prototype (feature 1, home, its frames expanded to full height) and the site at the same widths (1158 and 346px) and at 1280×800 and 390×844, in light and dark mode, into `e2e/screenshots/`. Compare the pairs and fix differences. `npm run test:e2e` also checks 360, 768, 1024 and 1440px: no horizontal scroll, tabbar only below 768px, desktop nav from 768px, nothing hidden behind the tabbar.

**Known, intentional differences:** real product photos instead of the prototype drawings (the demo images carry their own light backgrounds, also in dark mode); brand logos inside the round mark, with the monogram only as a fallback; rail order follows the backend (newest first); category tiles show every top-level category with products, and the desktop columns avoid an orphan tile (1–4 tiles in one row, 5–8 in two balanced rows); no count badges, favorite state or user name until auth exists; the subtitle of the "new" fallback banner is static.

## Data, empty and error states

Pages never crash or go blank because of the backend:

- **Queries** (`src/features/*/queries.ts`) read through the typed `publicApi` with a 4 s page timeout, inside `"use cache"` functions. `cacheLife` matches the backend TTLs (banners 60 s, products 45 s, categories and brands 300 s), and `cacheTag` is set per kind (`banners`, `products`, `categories`, `brands`) for on-demand revalidation later. Nothing user-specific is cached.
- A cached function **must not throw**: Next.js treats that as a prerender error. `settle()` returns `{ ok: false }` instead and gives that result the short `"seconds"` cache profile. Next.js keeps such entries out of prerenders, so the section becomes a request-time hole (a build without backend still succeeds), and retries about once a second at runtime. `safeQuery()` turns the result into a `QueryResult` (`ok`, `empty` or `unavailable`) and logs a failure at most once a minute per kind.
- **Every home section** has its own `<Suspense>` with a same-size skeleton and its own error boundary (`SectionBoundary`).
- **Fallbacks:**
  - no or unavailable banners: the two prototype banners (sale and new) with the prototype drawings;
  - empty or unavailable rails: the section header with an `.lm-empty-st` message and no "عرض الكل";
  - no categories or no brands: the section is hidden (navigation uses the static config);
  - product without image, or a broken image URL: the prototype bottle silhouette;
  - brand without logo: the monogram on a color hashed from the brand id.
- **Backend down:** every page still returns 200 with the chrome and the fallbacks. In development a dismissible "الباك إند مش شغال" notice shows at the top.
- Unknown routes use `not-found.tsx` (the prototype `.empty-st`).

## Performance

Measure before changing anything:

```powershell
npx next analyze --output                  # bundle analyzer data in .next/diagnostics/analyze
node scripts/bundle-report.mjs             # client JS per route, by package, our client modules
npm run build; npm run start -- --port 3300
node scripts/lighthouse-runs.mjs --runs 5  # mobile; add --desktop for desktop
```

Rules that keep the client small:

- **No client component per item.** Cards, tiles and images are server components; client code is limited to the navigation (active tab, mobile header, tabbar), the section error boundaries and the deferred Toaster. Use `clsx` (not `cn()`, which pulls tailwind-merge) in client components with static class lists.
- **Fonts:** only the weights the prototype uses: IBM Plex Sans Arabic 400/500/600/700 (Arabic + Latin preloaded, as the body font) and Reem Kufi 600/700 (not preloaded). The desktop logo box has a fixed width so the display font swapping in moves nothing (CLS 0).
- **Above the fold:** the first two cards of the first rail and the first banner image are preloaded with high priority.

**Lighthouse on a slow machine:** Lighthouse simulates a phone by slowing the host CPU 4×, assuming a host with a benchmark index of at least 1000. On a slower host it warns ("The tested device appears to have a slower CPU than Lighthouse expects") and the mobile score mostly reflects the machine. Check `environment.benchmarkIndex` in the report before comparing numbers, and compare builds on the same machine at the same time.

## Dependency policy

**Pin exact versions at least 2 weeks old, unless a newer patch fixes a published security advisory; in that case use the smallest patched version.**

- `next` and `eslint-config-next` are on **16.4.1**: 16.4.0 is affected by GHSA-673q-mjm6-r5xr (critical), GHSA-2464-fhr4-w9xw (critical) and GHSA-p3m5-59mp-jv5r (high).
- `zod` is on **4.6.6** (GHSA-mrhx-c7xc-m3w5). An `overrides` entry forces it for transitive copies too (the `shadcn` CLI pins an older one).
- **Before deploying:** upgrade `next` and `eslint-config-next` to the newest 16.4.x patch that is at least 2 weeks old (or newer if a security fix requires it), then re-run all checks.

## Security updates

- Run `npm audit` regularly (the full report, including dev dependencies). `npm run audit` must report no high or critical issues before every commit.
- Before every deploy, re-check `next` for new advisories ([GitHub advisories for next](https://github.com/vercel/next.js/security/advisories)) and apply the smallest patched version.
- TODO: Content-Security-Policy (see `next.config.ts`).
