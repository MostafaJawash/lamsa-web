# lamsa-web

Customer website of the **Lamsa** (لمسة) beauty store. Arabic only for now, right to left.
The backend is the FastAPI project in [`../lamsa-backend`](../lamsa-backend); its README describes the API, the auth flow, error codes and image sizes.

> Status: phase 4. The global layout, the home page and the catalog pages (category, brand, new, sale, search, brand grid, product) reproduce the design prototype with real backend data. Authentication works end to end (phone + password, Google, silent refresh, forced password change, logout), and the account page shows the profile card. Cart and favorites work for guests and logged-in users: hearts everywhere, header and tabbar badges, the cart and favorites pages, and the merge after login. The other account pages and checkout still render just their Arabic title.

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
  lib/auth/                 Session (server-only): session.ts cookies, refresh.ts single-flight refresh, user.ts getSession/requireUser,
                            action-session.ts (actions), jwt.ts exp decoding, next-param.ts safeNext, paths.ts
  lib/http/client-context.ts  Visitor IP / user agent / request id forwarded to the backend
  lib/env.ts                Server env (zod, fail fast); lib/env.public.ts for NEXT_PUBLIC_*
  lib/errors.ts             ApiError, backend error codes, Arabic fallbacks
  lib/image-urls.ts         Backend image URLs and srcset (thumb / medium / large), server and client
  lib/images.ts             next/image loader, kept for completeness (the site renders BackendImage)
  lib/format.ts             formatPrice, formatDate, pluralize
  lib/utils.ts              cn()
  proxy.ts                  Next.js 16 Proxy (formerly middleware): silent refresh, auth gates, catalog 404s
tests/                      Vitest unit tests
e2e/                        Playwright tests (home, catalog, layout at 4 widths, auth, cart and favorites, stock changes, backend down, dev Google, IP forwarding); e2e/screenshots/ is git-ignored
scripts/start-standalone.mjs  Starts the standalone build with .env files and static assets (used by npm start)
scripts/visual-compare.mjs    Screenshots the prototype and the site side by side
scripts/bundle-report.mjs     Client JS per route from the Next.js bundle analyzer
scripts/lighthouse-runs.mjs   Runs Lighthouse N times and prints the median
```

## BFF and auth

The browser **never talks to FastAPI and never sees a token**. This app is a backend-for-frontend:

- Server components, server actions and the proxy call FastAPI through `src/lib/api/client.ts` (server-only). Public catalog reads use `publicApi` (no cookies, no visitor headers, cacheable with `"use cache"`). Personal reads use `await getApi()`, which reads cookies and headers, so that UI renders inside `<Suspense>` (Cache Components).
- Errors from the backend (`{"error": {"code", "message", "details"}}`) become a typed `ApiError`. Show `errorMessage(error)`, which prefers the backend's Arabic message, then the fallback for the code in `messages/ar.json`.

The admin panel is a separate project; nothing admin lives here.

### Cookies

All are set by server code only (`src/lib/auth/session.ts`): **httpOnly**, `SameSite=Lax`, `path=/`; in production `Secure` with the `__Host-` prefix (no `Domain`, so no subdomain can set them). Locally over http the prefix and `Secure` are dropped. Production must be served over https (browsers treat only `localhost` as secure over http).

| Cookie                  | Holds                                                           | maxAge                         |
| ----------------------- | --------------------------------------------------------------- | ------------------------------ |
| `__Host-lamsa_at`       | access token                                                    | `expires_in` (900 s)           |
| `__Host-lamsa_rt`       | refresh token                                                   | `refresh_expires_in` (60 days) |
| `__Host-lamsa_pwc`      | `1` while `user.must_change_password` is true                   | like the refresh token         |
| `__Host-lamsa_su`       | Google `signup_token` (+ Google name and email)                 | 10 minutes                     |
| `lamsa_devg` (dev only) | stable fake Google subject of the dev button                    | 1 year                         |
| `__Host-lamsa_gcart`    | guest cart (see [Cart and favorites](#cart-and-favorites))      | 90 days                        |
| `__Host-lamsa_gfav`     | guest favorites                                                 | 90 days                        |
| `__Host-lamsa_gmerge`   | `1` after a failed merge at login (retried once)                | 90 days                        |
| `lamsa_flash`           | a one-shot toast code (**not** httpOnly; codes and counts only) | 60 s                           |

Tokens are never in localStorage, props, URLs or logs. The e2e tests assert that they never appear in the HTML, the JS/RSC payloads, storage or `document.cookie`.

### Silent refresh in the proxy

`src/proxy.ts` runs for page and RSC requests (not static files, images, API routes or prefetches):

1. If the access cookie is missing or expires within 60 s, and a refresh cookie exists, it calls `POST /auth/refresh`. The token's `exp` is decoded **without** verification, only to decide this; the backend is the only verifier.
2. **Single-flight per process** (`src/lib/auth/refresh.ts`): requests with the same refresh token share one call (a map keyed by the token's SHA-256). A successful result is kept for 10 s, so requests that still carry the old cookie get the same new pair instead of re-using the old token. The backend's 20 s grace covers duplicates across processes.
3. Success: both new cookies go on the response **and** on the forwarded request (`NextResponse.next({ request: { headers } })`), so server components see the new token in the same request.
4. `TOKEN_REUSED` / `TOKEN_INVALID` / `TOKEN_EXPIRED` (or a disabled account): the session cookies are cleared and the request continues as a guest. Backend down or slow (3 s): continue as is, never a redirect loop.

Server actions are POSTs and skip that step. The two that need the access token (change password, logout from all devices) use `withAccess()` (`src/lib/auth/action-session.ts`), which refreshes through the same single-flight refresher when needed and retries once on `TOKEN_EXPIRED`.

`getSession()` / `getCurrentUser()` (`src/lib/auth/user.ts`) read the access cookie and call `GET /users/me` once per request (React `cache()`); they never throw for auth problems. `requireUser(path)` is the real check on account pages.

### Gates

In the proxy, from the cookies (optimistic; pages re-check with `requireUser()`):

- `/account/*` and `/checkout/*` without a session → `/login?next=<path>`.
- A temporary password (`lamsa_pwc`) → every page except `/account/change-password` redirects there (with `?next=`). The page explains that the store gave a temporary password and offers only "تسجيل الخروج": until the password is changed, the backend blocks `logout-all` and everything else except `/users/me`, change password, logout and refresh.
- `/login` and `/register` with a session the backend accepts (`GET /users/me`) → `next` or `/`. A rejected session is cleared, so a stale cookie can't bounce the visitor between `/login` and `/`.
- `/complete-profile` without the Google signup cookie → `/login`.

Every `next` goes through `safeNext()` (`src/lib/auth/next-param.ts`): only same-site paths starting with `/` (not `//` or `/\`, no backslashes or control characters, same origin once resolved); anything else becomes `/`. Server actions rely on the Origin check built into Next.js; there are no state-changing route handlers.

Backend behaviour to know: logout-all and an admin password reset end the refresh tokens at once, but an access token already issued stays valid until it expires (at most 15 minutes).

### Flows and forms

Login, register, Google completion and change password are react-hook-form + zod forms (`src/features/auth`). The same schemas (`schemas.ts`, `zod/mini`, loaded only on the auth pages) are re-validated in the server actions (`actions.ts`). The phone field is the prototype `.ph-row`: the country code (`phoneCountryCodes` in `src/config/site.ts`) plus the number without its trunk `0`; the backend normalizes it. New passwords show the backend rules live (8–128 characters, not only digits, not the phone).

Backend errors → fields (`errors.ts`, unit-tested):

- `PHONE_TAKEN`, `INVALID_PHONE` → the phone field.
- `WEAK_PASSWORD`, `SAME_PASSWORD` → the password field.
- `INVALID_CREDENTIALS` → form error (the same text for a wrong password and an unknown phone).
- `ALREADY_REGISTERED` → form error with a login link.
- `TOO_MANY_ATTEMPTS` → a live countdown from `Retry-After`; submit stays disabled until it ends.
- `ACCOUNT_DISABLED` → form error with the store's phone.
- `SERVICE_BUSY` → the action waits `Retry-After` (at most 5 s) and retries once, then shows the message.
- `VALIDATION_ERROR` → its `details` on the fields.

The backend's Arabic message always wins. Buttons are disabled while pending and until hydrated, and the forms use `method="post"`, so a password never lands in a URL. The first invalid field gets the focus; errors use `aria-invalid` and `aria-describedby`.

"نسيت كلمة المرور؟" opens a dialog: there is no self-service reset, so the store gives a temporary password by phone (`NEXT_PUBLIC_SUPPORT_PHONE`, `NEXT_PUBLIC_SUPPORT_WHATSAPP`).

### Google sign-in

- With `NEXT_PUBLIC_GOOGLE_CLIENT_ID`: the official Google Identity Services button, loaded only on `/login` and `/register` (`afterInteractive`), in Google's own styling (outline, "continue with", Arabic). The ID token goes to a server action → `POST /auth/google`. Registered: session and redirect. Not registered: the `signup_token` goes into its own 10-minute httpOnly cookie, and the visitor continues at `/complete-profile` (name prefilled from Google, plus the phone).
- Without it: in development a "دخول تجريبي بـ Google" button (prototype `.btn.google`) sends `dev-google|<sub>|<email>|<name>`, which needs the backend's `GOOGLE_DEV_MODE=true`. The sub is random once and kept in `lamsa_devg`, so repeated clicks are the same user. In production Google is hidden.
- **Google Cloud setup:** APIs & Services → Credentials → Create credentials → OAuth client ID → **Web application**. Authorized JavaScript origins: `http://localhost:3000` and `http://localhost` (development) and the production origin `https://<domain>`. No redirect URIs are needed (popup mode). Put the client id in `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (then rebuild) **and** add the same id to the backend's `GOOGLE_CLIENT_IDS`.
- CSP (still a TODO in `next.config.ts`): allow `https://accounts.google.com/gsi/client` (script), `https://accounts.google.com/gsi/` (frame, connect) and `https://accounts.google.com/gsi/style` (style).

### Session-dependent UI

The shell stays static. Small `<Suspense>` holes depend on the session, each with a fallback of the same size: the desktop header's account entry ("تسجيل الدخول" → `/login`, or the first name → `/account`), the tabbar's "حسابي" link (`/login` or `/account`), the four count badges (no fallback; they are absolutely positioned) and the commerce controller (renders nothing). The account label has a fixed width (the guest label's; longer names end in "…"), so nothing moves (CLS 0).

### Client IP forwarding

Every server-side call to the backend sends `X-Forwarded-For` (the visitor's IP), `User-Agent` and `X-Request-ID` (`src/lib/http/client-context.ts`; the proxy stamps the id on each request). The backend's per-IP login limits and session list then see visitors, not this server. `publicApi` never sends them (its cached responses are shared).

- `WEB_TRUST_PROXY_HEADERS=false` (default, development): the IP is always `127.0.0.1`, and whatever the browser sends is ignored (e2e-tested with a capture server).
- `WEB_TRUST_PROXY_HEADERS=true` (production, behind our Nginx only): `X-Real-IP`, else the rightmost `X-Forwarded-For` entry, both set by Nginx from the socket address (`proxy_set_header X-Real-IP $remote_addr;`). Never enable it when browsers can reach Next.js directly.

**Production settings:**

| Project       | Setting                                                                                                                                                                                                                       |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| lamsa-web     | `WEB_TRUST_PROXY_HEADERS=true`. Its Nginx sets `X-Real-IP $remote_addr` and overwrites `X-Forwarded-For`; Next.js listens only to that Nginx.                                                                                 |
| lamsa-backend | `TRUSTED_PROXY_IPS=<API Nginx IP>,<website server IP>` (only those) and Uvicorn with `--no-proxy-headers`. In the API's Nginx, `set_real_ip_from` lists only the website server (backend README, "Client IP behind proxies"). |

The mobile apps call the API directly or through Nginx. They are never in `TRUSTED_PROXY_IPS` or `set_real_ip_from`, so any `X-Forwarded-For` they send is ignored.

## Running backend + web together

1. Backend (see its README for the first-time setup: venv, MySQL, `.env`, migrations, seeds):

   ```powershell
   cd ..\lamsa-backend
   .\venv\Scripts\fastapi.exe dev app/main.py --no-proxy-headers   # http://127.0.0.1:8000/docs
   ```

   Optional demo data: `.\venv\Scripts\python.exe -m scripts.seed_demo_catalog`.

   Backend `.env` for local work with the website: `TRUSTED_PROXY_IPS=127.0.0.1,::1` (so it accepts the visitor IP this server forwards) and, for the dev Google button, `GOOGLE_DEV_MODE=true` (development only).

2. Web:

   ```powershell
   npm ci
   copy .env.example .env.local
   npm run dev                                         # http://localhost:3000
   ```

   The backend's `CORS_ORIGINS` doesn't matter for the BFF (server-to-server), but leave `http://localhost:3000` in it for tools.

## Environment variables

`.env.local` is git-ignored; `.env.example` is the template. Files must be UTF-8 **without BOM**: don't write them with PowerShell 5.1 `Set-Content` or `Out-File`. Missing or invalid values stop the app at startup with a clear message.

| Variable                       | Scope       | Example                                                            |
| ------------------------------ | ----------- | ------------------------------------------------------------------ |
| `API_BASE_URL`                 | server only | `http://127.0.0.1:8000/api/v1`                                     |
| `NEXT_PUBLIC_SITE_URL`         | public      | `http://localhost:3000`                                            |
| `NEXT_PUBLIC_MEDIA_BASE_URL`   | public      | `http://127.0.0.1:8000/media`                                      |
| `WEB_TRUST_PROXY_HEADERS`      | server only | `false` (`true` only behind our Nginx, see _Client IP forwarding_) |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | public      | empty: the dev button in development, no Google in production      |
| `NEXT_PUBLIC_SUPPORT_PHONE`    | public      | `+49 30 1234567` (optional, "forgot password")                     |
| `NEXT_PUBLIC_SUPPORT_WHATSAPP` | public      | `4915112345678` (optional)                                         |

`NEXT_PUBLIC_*` values are inlined at **build** time; rebuild after changing them.

## Scripts

| Script                            |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run dev`                     | Dev server (Turbopack)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `npm run build`                   | Production build (`.next/standalone`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `npm run start`                   | Start the standalone build (`scripts/start-standalone.mjs`: loads `.env*` files like `next start`, copies static assets; `-- --port 3100`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `npm run lint`                    | ESLint                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `npm run typecheck`               | `next typegen` (route types) + `tsc --noEmit`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `npm run format` / `format:check` | Prettier write / check                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `npm run test`                    | Vitest unit tests                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `npm run test:e2e`                | Playwright (run `npm run build` first; the backend must run with `TRUSTED_PROXY_IPS=127.0.0.1,::1` and `GOOGLE_DEV_MODE=true`): `chromium` against the production build, then `stock` alone (changes demo stock and the out-of-stock setting through the admin API and restores them; `--project=stock --no-deps` runs it by itself), `backend-down` against `next dev` with an unreachable backend, `auth-dev` + `ip-forwarding` against one `next dev` behind a recording proxy (dev Google button, forwarded headers). Test accounts are named `e2e-…` and deleted by each test; the global setup creates and deletes a test admin. First time: `npx playwright install chromium` |
| `npm run gen:api`                 | Regenerate the API types from the running backend                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `npm run audit`                   | `npm audit --omit=dev --audit-level=high` (fails on high/critical runtime issues)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

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
- **Formatting:** prices always receive their backend currency: `formatPrice("15000.00", "SYP")` → `15,000 ل.س`; USD keeps meaningful decimals. Dates use Arabic with Latin digits in `Asia/Damascus`.
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
# Git Bash: MSYS_NO_PATHCONV=1 node scripts/visual-compare.mjs --base http://localhost:3300 --feature 2 --path /c/care
```

This screenshots a prototype feature (`--feature`: 1 home, 2 care list → `/c/care`, 3 velvet lipstick → `/p/demo-velvet-lipstick`, 4 brands → `/brands`; its frames expanded to full height) and the site at the same widths (1158 and 346px) and at 1280×800 and 390×844, in light and dark mode, into `e2e/screenshots/feature-<n>/`. Compare the pairs and fix differences. `npm run test:e2e` also checks 360, 768, 1024 and 1440px: no horizontal scroll, tabbar only below 768px, desktop nav from 768px, nothing hidden behind the tabbar.

**Known, intentional differences:** all customer-facing wording uses Modern Standard Arabic even where the prototype uses Levantine Arabic; real product photos instead of the prototype drawings (the demo images carry their own light backgrounds, also in dark mode); brand logos inside the round mark, with the monogram only as a fallback; rail order follows the backend (newest first); category tiles show every top-level category with products, and the desktop columns avoid an orphan tile (1–4 tiles in one row, 5–8 in two balanced rows); the subtitle of the "new" fallback banner is static. Auth (prototype feature 7, `--feature 7 --path /login`): the prototype logs in with an SMS code, the site with a password, so the password field (with a show/hide toggle and the rule hints), the register / forgot-password links and the forgot-password dialog are additions in the prototype's `.fld` / `.inp` / `.link` styles; the real Google button uses Google's own styling; the header's account label has a fixed width (no layout shift); the profile card has a second button (logout from all devices). Cart and favorites (features 6 and 5; `--prepare cart|favorites` fills a guest cart or favorites through the site, then `--state e2e/screenshots/state-<kind>.json`): the item count uses Arabic plural forms ("قطعتان"); the cart adds a "وفّرت" row when there are savings, an issues notice with "تحديث السلة", issue texts under lines, a disabled checkout button with a hint while the cart has issues, and "إفراغ السلة" after the lines; the line price keeps an 8px gap between the struck and the current price (as `.c-price`).

## Cart and favorites

Everything that decides prices, stock, visibility, issues and limits stays in the backend. The site only stores what a guest picked and renders what the backend computes.

Shipping availability comes from each delivery method's `allowed_governorates`. `rif_dimashq` (ريف دمشق) uses provincial shipping by default; an administrator can later add it to the Damascus courier's allowed governorates without a code change.

### Guest storage

`src/features/cart/guest-codec.ts` (pure) and `guest-store.ts`: two httpOnly cookies, read only by server code, `"v1." + base64url(JSON)`:

- `__Host-lamsa_gcart`: `[[product_id, variant_id or 0, quantity, product_slug], …]`, at most 50 lines, quantity 1..99;
- `__Host-lamsa_gfav`: `[[product_id, product_slug], …]`, oldest first, at most 200.

The limits are `guestLimits` in `src/config/site.ts` (the backend defaults). An encoded cookie stays under 3,800 bytes: a cart that would not fit is refused (`CART_LIMIT_REACHED`); 200 favorites always fit, because the slugs of the oldest are dropped (they are only hints). A malformed cookie (another version, bad base64, JSON or shape) is reset by the proxy and logged once per process; single bad entries are dropped. Nothing in them is trusted:

- **Guest cart:** every change writes the cookie and renders `POST /cart/preview`, the same CartOut as `GET /cart` (lines keyed `"<product>:<variant or 0>"`). Add to cart previews the cart **with** the new quantity first; an issue on that line becomes the error the logged-in `POST /cart/items` returns (`INSUFFICIENT_STOCK` with `available`, `OUT_OF_STOCK`, `QUANTITY_LIMIT_EXCEEDED` with `max`, `VARIANT_REQUIRED`, `PRODUCT_NOT_FOUND`); a 51st line is `CART_LIMIT_REACHED`. The cookie is written only when the change is valid.
- **Guest favorites:** a new id is checked with `GET /products?ids=` (visible products, out-of-stock included); the favorites page reads them the same way (two calls of 100 for 200), newest first.

### Merge after login

`src/features/cart/merge.ts`: login, register, Google, complete-profile and the forced password change call `POST /favorites/merge`, then `POST /cart/merge` with the cookies, then clear them (favorites first: merging them twice is harmless). A failure never blocks the sign-in: the cookies stay and `__Host-lamsa_gmerge` asks the proxy to retry **once** on the next page view. The result is a one-shot toast: "أعدنا <counted products> إلى سلتك" (lines added, merged or capped), plus "عُدّلت بعض المنتجات وفقًا للمخزون المتوفر" when anything was capped or skipped. Nothing merged: no toast.

**Flash toasts** (`src/features/cart/flash.ts`): `lamsa_flash` = `v1.<random id>.<kind>[.<a>[.<b>]]` (merge, cartAdded, favAdded, favRemoved, moved, error code). It is readable by JavaScript, so it never holds names, ids or tokens. The client controller shows it once (the id is remembered in sessionStorage) and deletes it. On a document request the proxy hands it to the page in a header and expires it, so a form posted without JavaScript shows it too, as a CSS-only toast.

### Hearts

There is no client component per card. Every heart is `HeartForm`: a real `<form>` posting to a server action, with a `<button aria-pressed>` holding both icons; CSS shows the filled one when pressed (prototype `.fav.on`), so nothing moves. Without JavaScript it toggles and redirects back. Product cards stay cacheable server components and render unpressed.

**One** client component, `CommerceController`, is mounted once in the layout. It:

- reads the visitor's favorite ids once per page view (a server action: `GET /favorites/ids`, or the cookie) and marks every `[data-product-id]` heart, including hearts that appear later (MutationObserver);
- takes over heart, "انقل إلى السلة" and remove-favorite submits by event delegation (capture phase, before React). It flips every heart of that product on the page at once and calls the action. On failure (`FAVORITES_LIMIT_REACHED`, `PRODUCT_NOT_FOUND`) it reverts and shows the error. It shows the toast ("أُضيف إلى المفضلة" + "المفضلة", "أُزيل من المفضلة") and updates the badges;
- shows flash toasts.

On cached pages, favorited hearts are drawn as outlines until the controller has run (a few hundred ms; color only). The favorites page renders them pressed on the server.

### Badges

Prototype `.badge`, on the desktop heart and bag and on the tabbar's favorites and cart tabs; hidden at 0, "99+" above 99. `CountBadge` subscribes to one tiny store (`badge-store.ts`, `useSyncExternalStore`):

- Small server holes seed it with this request's counts. Logged in: `GET /cart/count` and the length of `GET /favorites/ids`, read once per request. Guests: the cookies.
- Every cart or favorites action returns the new counts, so all badges follow without a reload.

The guest cart badge counts the cookie's quantities; the cart page re-seeds it from the preview's `items_count`, which leaves out lines with an issue.

### Product page

The add button is a form (`addToCart`) with a pending state and no double submit. Success shows the toast "أُضيف إلى السلة" + "عرض السلة". Errors:

- `INSUFFICIENT_STOCK`: "لم يتبقَّ سوى <n>", and the stepper is clamped;
- `OUT_OF_STOCK`: the button is disabled;
- `QUANTITY_LIMIT_EXCEEDED`: the maximum is shown.

Without JavaScript the same form adds and redirects back with a flash toast. Out of stock: "نفدت الكمية", the button disabled, the heart still working, and the hint "أضِفه إلى المفضلة وسنُعلمك عند توفّره من جديد".

### Cart page `/cart`

Prototype `pCart()`: the stored cart (logged in) or the guest preview, rendered by **one** client component, `cart-view.tsx`. It contains:

- `.line` rows: image, name → `/p/<slug>?v=<variant>`, brand + "، " + variant, prices, `.qty.sm`, `.l-rm`;
- the issue under a faded line: "لم يعد المنتج متوفرًا", "لم يعد هذا الخيار متوفرًا", "نفدت الكمية", "لم يتبقَّ سوى <n>" or "الحد الأقصى <n>";
- a notice bar with "تحديث السلة" when there are issues. Logged in: `POST /cart/resolve-issues`. Guests: the same fixes applied to the cookie from the preview's issues;
- the `.summary`:
  - subtotal and home shipping (or "مجاني");
  - the free-shipping bar from `amount_to_free_shipping`, hidden when the method has no `free_from`;
  - "وفّرت" when there are savings, then the total;
  - "إتمام الطلب", disabled with a hint while `can_checkout` is false;
- "إفراغ السلة" with a confirmation dialog, and the empty state.

**State:** `server` is the last cart the backend computed.

- **Optimistic updates:** quantities change at once (`useOptimistic`), debounced per line (300 ms). "−" at 1 removes the line (prototype).
- **Reconciliation:** every action returns the new cart, which replaces `server`. Server actions run one at a time, in order, so the last answer is the newest state.
- **Totals:** never computed in the browser; the backend returns per-currency subtotals, delivery fees and totals, which the summary renders unchanged.
- **Errors:** an error reverts only that line and shows the message under it.

`/cart` and `/favorites` are **blocking routes** (`export const instant = false`). They are personal, so they are rendered in full per request instead of being streamed into a Suspense hole: they work without JavaScript and nothing is swapped in after the first paint. Both are `noindex` and never cached. If the backend is unavailable, the page is a 200 with "تعذّر تحميل سلتك الآن، يُرجى المحاولة لاحقًا". Pages never write cookies, so the guest cart is never lost.

### Favorites page `/favorites`

Prototype `pFavs()`: product cards with `.l-actions`, "انقل إلى السلة" (disabled "نفدت الكمية" when out of stock) and remove. Out-of-stock favorites stay listed.

- **Paging:** logged in, 24 per page with the list pager; guests, all of them (at most 200).
- **Move to cart:** logged in, `POST /favorites/{id}/move-to-cart`. Guests add to the guest cart (variable products: the first variant in stock, from the cached product detail) and the product leaves the guest favorites. Toast "نُقل إلى السلة" + "السلة".

### Out of stock while browsing

The backend leaves out-of-stock products out of lists, search, facets and `product_count` (store setting `catalog_hide_out_of_stock`; see "Out of stock while browsing" in the backend README). The site has no filtering logic of its own and no "المتوفر فقط" toggle any more. A category or brand whose products are all sold out shows its "سنضيف منتجات … قريبًا" state and drops out of the home tiles, the category grid and the sitemap. Product pages, favorites and the cart still show such products. The site's own caches follow within 45 s for lists and 120 s for product pages and related rails.

### Tests

- `npm run test`: the cookie codec, flash codes, the merge toast, error mapping, guest fixes and the badge store.
- `e2e/cart.spec.ts`: guest and logged-in flows, the merge, badges on desktop and mobile, the debounce, limits, bad cookies, forms without JavaScript, CLS.
- `e2e/stock.spec.ts`: the `stock` project. It runs alone after the parallel tests because it changes demo stock, activation and the setting through the admin API, and restores them.

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
- **Backend down:** every page still returns 200 with the chrome and the fallbacks. In development a dismissible "الخادم غير متاح حاليًا" notice shows at the top.
- Unknown routes use `not-found.tsx` (the prototype `.empty-st`).

## Catalog pages

Category `/c/[slug]`, brand `/brands/[slug]`, `/new`, `/sale` and `/search` share one list template; `/brands` is the brand grid and `/p/[slug]` the product page. Data comes only from `src/features/catalog/queries.ts`.

**List template** (`src/features/catalog/components/list-results.tsx`, prototype `pList()`): list head with the count, one chips row (the category's first select attribute, then its child categories), the selects (brand, price, sort) and "المزيد من الفلاتر" with every facet, removable chips for the active filters, the grid, empty states and the pager (24 per page). The page passes a `scope` (`category`, `brand`, `new`, `sale` or `search`) that fixes the backend parameter of the page (`category`, `brand`, `is_new`, `on_sale`); the rest comes from the URL.

**Filter URL format:** the backend parameter names, so a list URL maps one to one onto `GET /products`:

| Parameter                 | Example                             | Notes                                                                                |
| ------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------ |
| `brand` (repeatable)      | `?brand=demo-baity&brand=demo-ward` | not on a brand page                                                                  |
| `min_price`, `max_price`  | `?min_price=5&max_price=14.99`      | the price select writes these (`lt5`, `5to15`, `gt15` are only accepted as `price=`) |
| `attr.<key>` (repeatable) | `?attr.skin_type=جافة`              | select / multiselect / boolean attributes; numbers as `attr.<key>.min/.max`          |
| `opt.<key>` (repeatable)  | `?opt.color=أحمر`                   | variant options (swatches, sizes)                                                    |
| `on_sale`                 | `?on_sale=true`                     | no `in_stock`: browsing never lists out-of-stock products (an old one is ignored)    |
| `sort`                    | `?sort=price_asc`                   | `newest` (default), `price_asc`, `price_desc`; `relevance` on search                 |
| `q`                       | `/search?q=عطر`                     | search only                                                                          |
| page (in the path)        | `/c/care/page/2?brand=x`            | page 1 is the list path; search keeps `?page=2` (noindex)                            |
| `filters=1`               | `?filters=1`                        | opens the filter form inline (the no-JS form of the sheet)                           |

`parseFilters()` (`filters.ts`) validates and sorts the parameters, so one result has one URL and one cache key. If the backend rejects a parameter (`INVALID_FILTER`), the list drops it, retries (up to three times) and shows a notice. Every change is a navigation (`router.push` with `scroll: false`), so back and forward restore the filters.

**Pages in the path:** page 2+ of a category, brand, new or sale list is `/…/page/[n]` (routes `c/[slug]/page/[n]`, `brands/[slug]/page/[n]`, `new/page/[n]`, `sale/page/[n]`; the views live next to the routes in `category-list.tsx`, `brand-list.tsx` and `flag-list.tsx`). So list metadata reads no search params and stays in the static `<head>` (metadata that reads `searchParams` is streamed into the body, which crawlers without JavaScript and Lighthouse do not see), every page has its own canonical, and pages 2+ are prerendered (up to 10 per list), including for visitors without JavaScript. `hrefWith()` builds these URLs; the old `?page=N` URLs and `…/page/1` redirect (308) in the Proxy.

**Without JavaScript:** streamed Suspense content is revealed by an inline script, so the filtered result needs JavaScript. The category, brand, new and sale lists therefore use the unfiltered first page (`ListPreview`, part of the prerendered shell) as the Suspense fallback: without JavaScript the visitor sees products, links work, and the selects and the filter form below the results are plain GET forms (they navigate; the result stays unfiltered). On a hard load of a filtered URL with JavaScript, a tiny inline script dims the preview with a loading bar (`data-pending`, no layout shift) until the filtered result streams in. Client-side filter changes keep the previous result until the new one is ready. Search keeps the skeleton fallback.

**Product page** (`/p/[slug]`, prototype `pProduct()`): a single client component (`product-purchase.tsx`) for the gallery, variants, quantity and add button. Thumbnails only with two or more images. A variant is selected with `?v=<variant id>`: the server renders that variant (price, availability, images), and changing it client-side updates the URL with `history.replaceState` (no navigation, no history entry). Without `?v` the first variant in stock is selected. The quantity stepper is bounded by `1..min(10, stock_left)`. Add to cart and the heart: see [Cart and favorites](#cart-and-favorites).

**404 status:** pages stream their static shell before `notFound()` can run, so an unknown slug would answer 200 (with noindex). `src/proxy.ts` therefore checks document requests to `/p/*`, `/c/*` and `/brands/*` against the backend detail endpoint, and list pages `…/page/[n]` against the product list (a page exists when it has items; 1.5 s timeout), and rewrites unknown ones to the not-found page with status 404. Invalid page segments (`/page/0`, `/page/x`) are a 404 without a backend call. Not checked: RSC requests (client navigations, where the page's own `notFound()` shows the not-found UI), router prefetches (`Next-Router-Prefetch`, `Next-Router-Segment-Prefetch`) and browser prefetches (`Purpose: prefetch`, `Sec-Purpose: prefetch…`). Results are cached in memory per server process (`existence.ts`: existing slugs 5 minutes, unknown slugs 60 seconds, at most 5,000 entries, least recently used evicted). Backend down, slow or 5xx: passed through, and the page shows its unavailable state.

**SEO:** `generateMetadata` on every catalog page; canonicals drop filters and sort and keep only the page (`/c/care/page/2`); search is `noindex, follow`. JSON-LD: `Product` with an `Offer` (an `AggregateOffer` over the variants for variable products) and a `BreadcrumbList`. `sitemap.ts` lists the static pages, categories, brands (with their pages 2+, from the product counts) and products from the API (at most 50 pages of 100 products), cached for an hour, with the static pages as fallback when the backend is down.

**Caching:** every query is a `"use cache"` function with a `cacheLife` and tags for on-demand revalidation:

| Data                    | Lifetime | Tags                                                              |
| ----------------------- | -------- | ----------------------------------------------------------------- |
| category detail         | 300 s    | `categories`, `category:<slug>`                                   |
| brand detail            | 300 s    | `brands`, `brand:<slug>`                                          |
| product detail, related | 120 s    | `products`, `product:<slug>`                                      |
| product lists, facets   | 45 s     | `products`, plus `category:<slug>` or `brand:<slug>` of the scope |
| sitemap index           | 1 h      | `categories`, `brands`, `products`                                |

A failed backend call is cached for about a second only (`settle()`), never for the full lifetime.

**Page chrome:** every page renders `<PageChrome path title activeTab>` (`src/components/layout/page-chrome.tsx`): the mobile header with the real page title (product, category or brand name), and the active desktop tab (on product pages, the product's top-level category). An e2e test checks that every page renders exactly one mobile header.

**Responsive check:** `node scripts/responsive-check.mjs --base http://localhost:3300` loads every page at 360×740, 390×844, 430×932, 844×390, 768×1024, 1024×768, 1280×800, 1440×900 and 1920×1080 (dark mode too at 390 and 1280). It reports horizontal scroll, elements outside the viewport, clipped labels, overlapping controls, the wrong chrome for the breakpoint, tap targets under 44px (counting `::before` hit areas), the filter sheet (side, inside the viewport, internal scroll) and 70-character names. Screenshots go to `e2e/screenshots/responsive/`.

## Performance

Measure before changing anything:

```powershell
npx next analyze --output                  # bundle analyzer data in .next/diagnostics/analyze
node scripts/bundle-report.mjs             # client JS per route, by package, our client modules
npm run build; npm run start -- --port 3300
node scripts/lighthouse-runs.mjs --runs 5  # mobile; add --desktop for desktop
```

Rules that keep the client small:

- **No client component per item.** Cards, tiles, images and hearts are server components; client code is limited to the tabbar (active tab), the back button, the section error boundaries, the deferred Toaster, the list filter controls, the product purchase box, the count badges, the one commerce controller (hearts, toasts) and the cart view. Use `clsx` (not `cn()`, which pulls tailwind-merge) in client components with static class lists.
- **Fonts:** only the weights the prototype uses: IBM Plex Sans Arabic 400/500/600/700 (Arabic + Latin preloaded, as the body font) and Reem Kufi 600/700 (not preloaded). The logo is an SVG wordmark (`scripts/build-wordmark.py` shapes "لمسة" in Reem Kufi 700 with HarfBuzz and writes `src/components/shared/wordmark-data.ts`), so no font swap can move it (CLS 0).
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
