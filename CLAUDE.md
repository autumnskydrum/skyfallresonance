# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

A Next.js (App Router, TypeScript, Tailwind) blog with four feature areas: a post board (게시판), Q&A (묻고 답하기), crawled-news display (주요뉴스), and a multi-source weather comparison dashboard (날씨). The electricity bill calculator from [ElectricBillCalc](../ElectricBillCalc) is planned to be folded into this workspace later — it is not here yet.

Currently only read/list views exist for all three features; there is no auth, no write UI (posting/answering), and no real crawler implementation yet. See README.md's "구현 상태" section for the current state.

## Commands

```bash
npm run dev                              # dev server (localhost:3000)
npm run build                            # production build — run this after any non-trivial change to verify
npm run lint                             # ESLint
npx prisma migrate dev --name <desc>     # after editing prisma/schema.prisma
npx prisma generate                      # regenerate client only (no schema/DB change)
npx prisma studio                        # inspect dev.db contents in a GUI
```

There is no test suite configured yet.

## Architecture

**Data layer:** `prisma/schema.prisma` defines four models — `Post`, `Question`/`Answer`, `NewsArticle`, `WeatherReading` — backed by **Prisma Postgres** (hosted, same DB for local dev and production — no more local SQLite file). `src/lib/prisma.ts` exports a singleton `PrismaClient`, cached on `globalThis` in dev to survive Next.js hot-reload without exhausting DB connections — always import `prisma` from there rather than instantiating a new client.

Prisma 7 requires an explicit driver adapter for SQL providers (no more implicit connection via the URL alone). This project uses `@prisma/adapter-pg` (standard Node.js Postgres driver adapter — not the edge/HTTP `@prisma/adapter-ppg` variant, since routes run on the Node runtime), wired up in `src/lib/prisma.ts`. The project moved off `@prisma/adapter-better-sqlite3` when it moved off SQLite; if the datasource provider ever changes again, swap both the adapter package and the `datasource` block in `schema.prisma` together, then **run `npx prisma generate` — the generated client bakes in the provider, so forgetting this step produces a `PrismaClientInitializationError` about adapter/provider mismatch at build time, not a schema error.** `npx prisma init` (re-run in an existing project) installs `.agents/skills/prisma-database-setup/references/` with per-provider adapter setup docs; these are gitignored local tooling, not committed.

The generated Prisma client lives at `src/generated/prisma` (per the custom `output` in `schema.prisma`) and is gitignored. Its entry point is `client.ts`, not `index.ts` — always import from `@/generated/prisma/client`, not `@/generated/prisma`. Run `npx prisma generate` after a fresh clone or any schema change.

**Routes** (`src/app/`): `/posts`, `/qna`, `/news` are server components that query Prisma directly and render a list or an empty-state message — no client-side data fetching. Each has `export const dynamic = "force-dynamic"` so it re-queries on every request instead of being statically prerendered at build time (the Next.js default for a page with no dynamic APIs) — without this, new posts/questions/articles wouldn't show up until the next `next build`. Keep that export on any new DB-backed page. When adding write functionality (create post, submit question/answer), follow the same server-first pattern (Server Actions or route handlers) rather than introducing a client-side API layer.

**News crawling:** `src/app/api/news/crawl/route.ts` is the intended entry point — a `POST` handler meant to be triggered by an external scheduler, not by users. It upserts articles into `NewsArticle` keyed on `url`. The actual fetch/parse logic belongs in `fetchLatestArticles()`, currently a stub returning `[]`. If a `NEWS_CRAWL_SECRET` env var is set, the route requires a matching `Authorization: Bearer <secret>` header — set this before exposing the route publicly.

**Scheduling:** `.github/workflows/collect-data.yml` is the external scheduler — GitHub Actions, not Vercel Cron, because Vercel's Hobby-plan cron is capped at once/day (Pro-only for anything more frequent), which is too coarse for a "current weather" feature. The workflow calls weather collection every 30 minutes and news crawl hourly (via `github.event.schedule` matching to route to the right job — GitHub Actions doesn't support distinct schedules per job natively). It POSTs to `${{ vars.SITE_URL }}` (a repo variable, not secret — must be updated to the real deployment URL after each redeploy/domain change: `gh variable set SITE_URL --body "https://..."`) with the matching `Authorization: Bearer` header from repo secrets (`NEWS_CRAWL_SECRET` / `WEATHER_COLLECT_SECRET`, set via `gh secret set`). These repo secrets must stay in sync with the same-named Vercel env vars, or the scheduler's calls will 401.

**Weather dashboard:** `src/lib/weather/` holds the whole feature. `sources/*.ts` each export a `fetch<Source>(city): Promise<WeatherReadingResult | null>` with a uniform shape (`types.ts`); `sources/index.ts` fans out to all five concurrently via `fetchAllSources()` and swallows individual failures so one dead source never breaks the rest. `cities.ts` maps ISO country code → one tracked city (`TRACKED_CITIES`, `cityForCountry()`); add countries there as needed. `geo.ts` reads the `x-vercel-ip-country` header (set automatically by Vercel's edge, absent in local dev — falls back to `"KR"`) to pick which city a visitor sees.

**All five sources are fully implemented and verified against their live APIs** (each returned a plausible real Seoul temperature during testing: Open-Meteo 30.8°C, KMA 32.0°C/맑음, WeatherAPI.com 31.2°C/Overcast, plus MET Norway and SMHI). Notes per source:

- **Open-Meteo, MET Norway**: no API key needed.
- **SMHI**: only ever called for Nordic countries (`isNordic()` in `cities.ts`) — outside Scandinavia it has no meaningful data, so `fetchSmhi()` short-circuits to `null` rather than wasting a call. It replaced its `pmp3g` API with `snow1g`/v1 on 2026-03-31 with a different response shape (`data.air_temperature` instead of a `parameters` array) — if `fetchSmhi()` starts silently returning nothing, check whether SMHI changed its API again.
- **KMA (기상청)**: needs `KMA_API_KEY`, only runs for `countryCode === "KR"` (`getUltraSrtNcst`, data.go.kr listing 15084084). The key must be stored as data.go.kr's raw "Encoding" value (already percent-encoded, e.g. contains literal `%2B`) and embedded in the request URL as-is — never pass it through `encodeURIComponent` or `URLSearchParams`, which would double-encode it and silently break auth. There's a second, newer data.go.kr listing (15139470, "기상청API허브 연계") that proxies to KMA's separate apihub.kma.go.kr backend with a longer forecast range, but that backend uses a structurally different (php-style, likely non-JSON) API and its own separate account system — `fetchKma()` targets the classic listing only; switching would be a rewrite, not a config change.
- **WeatherAPI.com**: needs `WEATHERAPI_KEY`, otherwise `fetchWeatherApi()` returns `null`.

Like news, collection is scheduler-driven, not per-request: `POST /api/weather/collect` iterates `TRACKED_CITIES`, calls `fetchAllSources()` for each, and upserts into `WeatherReading` (unique on `[citySlug, source]` — each collection cycle overwrites the prior reading rather than accumulating history). `/weather` only reads from the DB. Same optional bearer-token gate as news crawling, via `WEATHER_COLLECT_SECRET`. The page combines whatever sources returned data for that city into an average (shown large) plus a min–max range (shown as small secondary text/tooltip) — this compromise was chosen deliberately to keep the primary UI clean while not hiding source disagreement entirely; keep both when touching that UI, don't collapse it to a bare average.

**Environment:** `DATABASE_URL`, `DIRECT_DATABASE_URL`, `KMA_API_KEY`, `WEATHERAPI_KEY`, `NEWS_CRAWL_SECRET`, `WEATHER_COLLECT_SECRET` all live in `.env` (gitignored) locally, and must be duplicated into the Vercel project's env vars for production — `.env` is never read at runtime on Vercel. `prisma.config.ts` loads `.env` via `dotenv/config` — Prisma does not auto-load `.env` on its own in this version, so don't remove that import.

**Pooled vs direct Postgres connection — read this before touching `DATABASE_URL`.** Prisma Postgres gives two connection strings for the same database: `db.prisma.io` (direct/unpooled) and `pooled.db.prisma.io` (pooled, same credentials, same underlying servers — just different routing). They are NOT interchangeable:
- `prisma.config.ts`'s `datasource.url` (used by `prisma migrate`/`generate`/CLI) must point at **`DIRECT_DATABASE_URL`** (direct).
- `src/lib/prisma.ts`'s `PrismaPg` adapter (used by the running app) must point at **`DATABASE_URL`** (pooled).

Getting this backwards is a real trap because it fails silently in exactly the wrong place: it works perfectly in `next dev`/`next start` on a persistent local machine, passes `npm run build`, and only breaks once deployed to Vercel's serverless functions — where the direct connection is unreachable and every DB-backed route 500s with a `P1001`/`DatabaseNotReachable` error whose message ("Can't reach database server at `base`") doesn't mention pooling at all, making it look like a totally different problem. If a fresh `npx create-db` run only gives you one URL (it does — the direct one), derive the pooled one yourself by swapping the hostname to `pooled.db.prisma.io` and keeping everything else (credentials, port, `sslmode=require`) identical.

## Conventions

- All user-facing text is Korean; match the existing tone when adding UI copy.
- Tailwind only, no CSS files beyond `globals.css` — keep styling inline with utility classes as in the existing pages.
