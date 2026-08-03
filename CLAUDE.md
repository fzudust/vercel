# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands
- Development server: `pnpm dev` (lockfile is `pnpm-lock.yaml`; `npm run dev`/`yarn dev` also work via the `package.json` scripts)
- Build: `pnpm build`
- Start (production): `pnpm start`
- Lint: `pnpm lint`
- Prisma (DB): `pnpm prisma db pull | generate | studio`
- Update dependencies: `pnpm outdated | grep https | awk '{print $1}' | xargs pnpm upgrade -L`

## Architecture Overview
Next.js **Pages Router** app deployed on Vercel. Codebase is mixed TypeScript/JavaScript: pages are `.tsx`/`.jsx`, reusable helpers/components are `.js`/`.jsx`. UI is built with **Ant Design v4** (`antd` + `@ant-design/icons`); global antd CSS is imported in `pages/_app.tsx`. Sass is enabled (`sass` + `sassOptions` in `next.config.js`); SCSS and CSS modules coexist under `styles/`.

### Main feature: RSS reader (`pages/rss.tsx`)
The primary app — a three-pane client-side RSS reader (feed list / item list / content). Feed data persists **in the browser** via IndexedDB (`components/indexdb.js`), not on the server. Core parsing logic lives in `components/rss-helper.js`:
- `getRss(url)` fetches a feed through the `/api/proxy` endpoint, then parses it. Two formats are supported: XML RSS/Atom (via `DOMParser`, see `getItemsFrommRss`/`getItemsFromFeed`) and **readhub JSON** (detected by `Content-Type`, handled by `formatReadhubItems`).
- `mergeRss` dedupes items by `id` when refreshing a feed.
- `charFilter` unescapes `&lt;`/`&gt;`/`&amp;`/CDATA and strips `<script>`/`<style>`/`<link>` from feed content before it is rendered with `dangerouslySetInnerHTML`.

### API routes (`pages/api/`)
- `proxy.ts` — central to the RSS reader. Fetches arbitrary remote URLs (bypasses browser CORS) with a permissive HTTPS agent (`rejectUnauthorized: false`), strips `x-frame-options`/`set-cookie`/`transfer-encoding` from the response, rewrites `<script>` → `<noscript>`, and injects a `<base href>` plus an `iframe.css` link so fetched pages render inside a sandboxed iframe. This is a Node runtime route.
- `generate.ts`, `daily.ts`, `turnstile.ts` — **Edge runtime** routes (`runtime: 'edge'`). `generate.ts` streams OpenAI-compatible chat completions through `eventsource-parser`. `turnstile.ts` verifies Cloudflare Turnstile tokens. `daily.ts` fetches and base64-encodes a daily-news image.
- `hello.ts` — default starter route.

### Middleware (`middleware.ts`)
Matches only `/api/proxy`; appends CORS (`Access-Control-Allow-Origin: *`) and a `server` header to responses.

### Other pages
- `index.tsx` — default create-next-app landing page with a link to `/rss`.
- `daily.tsx` — "每天60秒读懂世界" image viewer; calls `/api/daily` and caches results in IndexedDB.
- `chatgpt.jsx` — ChatGPT-style chat UI that streams responses from `/api/generate`.

### Persistence & data layer
- **Client-side:** `components/indexdb.js` is a hand-rolled IndexedDB wrapper (raw IDB requests, promise-based CRUD). The RSS reader and the daily page each instantiate their own database/table.
- **Server-side:** `prisma/schema.prisma` defines a MongoDB schema (`Rss`/`RssItem`), but the Prisma client is **not imported by any page, API route, or component** — feeds currently live only in the browser. The MongoDB/Prisma layer is effectively vestigial; treat it as unused unless reintroducing server-side storage.

### Other notes
- `public/sw.js` — service worker registered by the RSS page; handles push notifications and notification clicks.
- `lisp.ts` (repo root) — standalone TypeScript type-level arithmetic experiment (tuple-length-based `Add`/`Subtract`/`Multiply`/`Divide`); not imported by the app.

## Environment Variables (`.env`)
- `MONGO_DB` — MongoDB connection string for Prisma.
- `OPENAI_API_KEY`, `OPENAI_API_URL` — used by `/api/generate` (defaults to `https://api.openai.com/v1/chat/completions`).
- `SECRET_KEY` — Cloudflare Turnstile secret, used by `/api/turnstile`.
