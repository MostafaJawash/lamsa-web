# lamsa-web

Customer website of the **Lamsa** (لمسة) beauty store. Arabic only for now, right to left.
The backend is the FastAPI project in [`../lamsa-backend`](../lamsa-backend); its README describes the API, the auth flow, error codes and image sizes.

> Status: project structure and tooling only. Every page renders just its Arabic title.

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
    (shop)/                 Shop pages with header + footer: home, /c, /brands, /p, /new, /sale, /search, /cart, /favorites
    (auth)/                 Login, register, complete-profile (Google onboarding), centered layout
    (account)/account/      Account pages with the account navigation
    checkout/               Checkout and the success page
    api/auth/               BFF route handlers (refresh, logout); skeletons returning 501
    layout.tsx              <html lang="ar" dir="rtl">, fonts, metadata, Toaster
    globals.css             Tailwind + design tokens (brand palette, light and dark)
    not-found / error / global-error, sitemap.ts, robots.ts, manifest.ts
  features/<name>/          One folder per domain: catalog, cart, favorites, auth, account, orders, notifications, banners
    components/             UI of that feature
    queries.ts              Server-only reads (server components)
    actions.ts              Server actions (mutations), callable from client components
    types.ts                Aliases of the generated backend schemas
  components/ui/            shadcn/ui components (button, input, label, card, dialog, sheet, sonner)
  components/layout/        Header, Footer, Container, PageTitle
  components/shared/        Reusable app components used by several features
  config/site.ts            Store name, description, main and account navigation
  i18n/                     Locale config and the typed t() helper
  hooks/                    Shared client hooks
  lib/api/client.ts         Server-only FastAPI client (timeout, token, error mapping)
  lib/api/schema.d.ts       Generated OpenAPI types (committed; do not edit)
  lib/api/types.ts          Type helpers over the schema (Schema<"ProductCardOut">)
  lib/auth/session.ts       Server-only session cookie helpers
  lib/env.ts                Server env (zod, fail fast); lib/env.public.ts for NEXT_PUBLIC_*
  lib/errors.ts             ApiError, backend error codes, Arabic fallbacks
  lib/images.ts             next/image loader (thumb / medium / large)
  lib/format.ts             formatPrice, formatDate, pluralize
  lib/utils.ts              cn()
  proxy.ts                  Next.js 16 Proxy (formerly middleware) for /account and /checkout
tests/                      Vitest unit tests
e2e/                        Playwright smoke tests
scripts/start-standalone.mjs  Starts the standalone build (used by npm start)
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

| Script                            |                                                                                                                    |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `npm run dev`                     | Dev server (Turbopack)                                                                                             |
| `npm run build`                   | Production build (`.next/standalone`)                                                                              |
| `npm run start`                   | Start the standalone build (`scripts/start-standalone.mjs`, copies static assets; `-- --port 3100`)                |
| `npm run lint`                    | ESLint                                                                                                             |
| `npm run typecheck`               | `next typegen` (route types) + `tsc --noEmit`                                                                      |
| `npm run format` / `format:check` | Prettier write / check                                                                                             |
| `npm run test`                    | Vitest unit tests                                                                                                  |
| `npm run test:e2e`                | Playwright against the production build (run `npm run build` first; first time: `npx playwright install chromium`) |
| `npm run gen:api`                 | Regenerate the API types from the running backend                                                                  |
| `npm run audit`                   | `npm audit --omit=dev --audit-level=high` (fails on high/critical runtime issues)                                  |

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
- **Images:** always `next/image` with the backend `image_key` or one of its URLs as `src`. The custom loader picks `thumb` (≤ 300), `medium` (≤ 800) or `large`; Next never re-optimizes.
- **RTL:** use logical utilities only (`ms-/me-`, `ps-/pe-`, `start-/end-`, `border-s/e`, `rounded-s/e`, `text-start/end`, `slide-in-from-start/end`), never `left/right`, `ml/mr`, `pl/pr`. The `Sheet` sides are `start | end | top | bottom`. shadcn is configured with `"rtl": true`, so `npx shadcn@4.21.4 add <component>` generates logical classes; still review each new component.
- **Design tokens:** brand colors as Tailwind utilities (`bg-surface`, `text-ink`, `text-ink-muted`, `border-line`, `text-brand`, `bg-brand-soft`, `text-gold`, `text-ok`, `text-warn`, `text-danger`, `shadow-card`), plus the shadcn tokens (`bg-primary`, …) mapped onto them. Fonts: `font-sans` (IBM Plex Sans Arabic), `font-display` (Reem Kufi, also used by `h1`–`h3`). Dark mode follows the system.
- **Naming:** files in kebab-case (`page-title.tsx`), components in PascalCase, one feature per folder; import with `@/…`.
- **Files:** UTF-8 without BOM, LF line endings (`.editorconfig`, `.gitattributes`).

## Dependency policy

**Pin exact versions at least 2 weeks old, unless a newer patch fixes a published security advisory; in that case use the smallest patched version.**

- `next` and `eslint-config-next` are on **16.4.1**: 16.4.0 is affected by GHSA-673q-mjm6-r5xr (critical), GHSA-2464-fhr4-w9xw (critical) and GHSA-p3m5-59mp-jv5r (high).
- `zod` is on **4.6.6** (GHSA-mrhx-c7xc-m3w5). An `overrides` entry forces it for transitive copies too (the `shadcn` CLI pins an older one).
- **Before deploying:** upgrade `next` and `eslint-config-next` to the newest 16.4.x patch that is at least 2 weeks old (or newer if a security fix requires it), then re-run all checks.

## Security updates

- Run `npm audit` regularly (the full report, including dev dependencies). `npm run audit` must report no high or critical issues before every commit.
- Before every deploy, re-check `next` for new advisories ([GitHub advisories for next](https://github.com/vercel/next.js/security/advisories)) and apply the smallest patched version.
- TODO: Content-Security-Policy (see `next.config.ts`).
