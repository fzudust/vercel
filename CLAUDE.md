# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands
- Development server: `pnpm dev` (lockfile is `pnpm-lock.yaml`; `npm run dev`/`yarn dev` also work via the `package.json` scripts)
- Build: `pnpm build`
- Start (production): `pnpm start`
- Lint: `pnpm lint` (flat ESLint config in `eslint.config.mjs`; relaxes `@next/next/no-server-import-in-page` and warns on two `react-hooks` v7 strict rules)
- Test: `pnpm test` (runs `node --test "test/**/*.test.js"`; Node's built-in test runner, no extra framework). Tests auto-start a Next.js dev server on port 3939 (`XHTTP_TEST_PORT` to override) and tear it down.
- Update dependencies: `pnpm outdated | grep https | awk '{print $1}' | xargs pnpm upgrade -L`

## Architecture Overview
Next.js **Pages Router** app deployed on Vercel. Codebase is mixed TypeScript/JavaScript: pages are `.tsx`, reusable helpers/components are `.js`. UI is built with **Ant Design v6** (`antd` + `@ant-design/icons`); `pages/_app.tsx` wraps every page in antd's `<AntdApp>` and imports `antd/dist/reset.css` plus global SCSS/CSS. Sass is enabled (`sass` + `sassOptions` in `next.config.js`); SCSS and CSS modules coexist under `styles/`.

### Main feature: RSS reader (`pages/rss.tsx`)
The primary app — a three-pane client-side RSS reader (feed list / item list / content). Feed data persists **in the browser** via IndexedDB (`components/indexdb.js`), not on the server. Core parsing logic lives in `components/rss-helper.js`:
- `getRss(url)` fetches a feed through the `/api/proxy` endpoint, then parses it. Two formats are supported: XML RSS/Atom (via `DOMParser`, see `getItemsFrommRss`/`getItemsFromFeed`) and **readhub JSON** (detected by `Content-Type`, handled by `formatReadhubItems`).
- `mergeRss` dedupes items by `id` when refreshing a feed.
- `charFilter` unescapes `&lt;`/`&gt;`/`&amp;`/CDATA and re-escapes `<script>`/`<style>`/`<link>` in feed content before it is rendered with `dangerouslySetInnerHTML`.

The RSS page also has a cache-inspection UI (modal to view/add Cache API entries) and registers the service worker only in production (`process.env.NODE_ENV === 'production'`) — see `pages/rss.tsx` around the `serviceWorker.register('/sw.js')` call, with a comment noting that SW's cache-first policy on `.js` can serve stale chunks after a dependency upgrade.

### API routes (`pages/api/`)
- `proxy.ts` — central to the RSS reader. Node runtime. Fetches arbitrary remote URLs (bypasses browser CORS) via axios with a permissive HTTPS agent (`rejectUnauthorized: false`), strips `x-frame-options`/`set-cookie`/`transfer-encoding` from the response, rewrites `<script>` → `<noscript>`, strips query strings from static-asset `href`/`src` (to improve SW cache hits), injects a `<base href>` (the remote origin) and a link to `/iframe.css` so fetched pages render inside a sandboxed iframe.
- `generate.ts`, `daily.ts`, `turnstile.ts` — **Edge runtime** routes (`runtime: 'edge'`). `generate.ts` streams OpenAI-compatible chat completions through `eventsource-parser`. `turnstile.ts` verifies Cloudflare Turnstile tokens. `daily.ts` fetches and base64-encodes a daily-news image.
- `xhttp.ts` — **Node runtime** VLESS + XHTTP (stream-one) proxy, ported from `edgetunnel/_worker.js`. Accepts a POST whose body is `[VLESS header][raw TCP payload]`; parses the header (version/UUID/addons/cmd/port/addrType), authenticates the UUID against `process.env.UUID` (default `d342d11e-d424-4583-b36e-524ab1f0afa4` for local debugging), then `net.connect()`s to the target host:port and pumps a bidirectional stream: request body → TCP socket (uplink), TCP socket → response body prefixed with the 2-byte VLESS response header `[version, 0]` (downlink). TCP only (UDP/cmd=2 rejected — no native UDP forwarding in serverless). Must be Node runtime because Edge has no TCP socket API; connection lifetime is bounded by the serverless function timeout.
- `hello.ts` — default starter route.

### Root-level `proxy.ts` (stale)
There is a `proxy.ts` in the repo root that looks like a Next.js middleware (export named `proxy`, matcher `/api/proxy`), but the function is named `proxy` rather than `middleware`, so Next.js does **not** treat it as active middleware. The CORS `Access-Control-Allow-Origin: *` header is actually set inside `pages/api/proxy.ts` itself. Treat this root file as inert/legacy unless you intend to reintroduce real middleware (rename the export to `middleware` and move to `middleware.ts` at the root).

### Service worker (`public/sw.js`)
More than push notifications — it is a Workbox-based (loaded from jsdelivr) caching layer for the RSS reader's iframe content:
- Push-notification handling and `notificationclick` open-window behavior.
- `install` pre-caches a fallback image (`/user.png`) as an **opaque** no-cors response (cross-origin `<img>` requires opaque responses; `basic`/`default` get blocked by Chrome's `ERR_BLOCKED_BY_RESPONSE.NotSameOrigin`). Uses `cache.put` because `cache.add` rejects opaque (status 0) responses.
- `activate` deletes any cache not prefixed `vercel-` and claims clients.
- Registers Workbox `CacheFirst` routes for cross-origin static assets (js/css/images/fonts) and `iframe.html`, accepting opaque responses (`statuses: [0, 200]`). An `imageFallbackPlugin` returns the pre-cached fallback image on fetch failure for image requests, while non-image failures throw (so a broken JS/CSS/font is not silently replaced by an image).

### Other pages
- `index.tsx` — default create-next-app landing page with a link to `/rss`.

### Persistence & data layer
- **Client-side:** `components/indexdb.js` is a hand-rolled IndexedDB wrapper (raw IDB requests, promise-based CRUD: `getAll`/`getItem`/`addItem`/`putItem`/`deleteItem`). The RSS reader instantiates its own database/table keyed by feed URL.
- **Server-side:** effectively none. There is no `prisma/` directory and no `@prisma/client` dependency in `package.json`. `upload-data.js` (repo root) is a standalone, one-off Node script that imported Prisma and `moment` to bulk-insert an `export.json` into MongoDB — it references a hardcoded local path and is not part of the app. The MongoDB/Prisma layer is vestigial; treat it as gone unless reintroducing server-side storage.

### Other notes
- `components/loadjs.js` — tiny promise-based `<script>` loader with dedup; used by the RSS page to load the Cloudflare Turnstile script.
- `lisp.ts` (repo root) — standalone TypeScript type-level arithmetic experiment (tuple-length-based `Add`/`Subtract`/`Multiply`/`Divide`); not imported by the app.
- `.npmrc` sets the registry to `https://registry.npmmirror.com` (China mirror).

## Environment Variables (`.env`)
- `HTTP_PROXY` — currently the only var in the committed `.env` (note: the value is misspelled `httptp://...`).
- `OPENAI_API_KEY`, `OPENAI_API_URL` — read by `/api/generate` (defaults to `https://api.openai.com/v1/chat/completions`); not present in the committed `.env`, so must be provided by the deploy environment.
- `SECRET_KEY` — Cloudflare Turnstile secret, used by `/api/turnstile` (has a hardcoded test fallback `1x...AA`).
- `UUID` — VLESS auth UUID for `/api/xhttp`, must match the client's `uuid` config; falls back to a hardcoded default for local debugging if unset/invalid.
