# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

A Next.js (App Router, TypeScript, Tailwind) blog with three planned feature areas: a post board (게시판), Q&A (묻고 답하기), and crawled-news display (주요뉴스). The electricity bill calculator from [ElectricBillCalc](../ElectricBillCalc) is planned to be folded into this workspace later — it is not here yet.

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

**Data layer:** `prisma/schema.prisma` defines three models — `Post`, `Question`/`Answer`, `NewsArticle` — backed by SQLite (`prisma/dev.db`, gitignored) for local dev. `src/lib/prisma.ts` exports a singleton `PrismaClient`, cached on `globalThis` in dev to survive Next.js hot-reload without exhausting DB connections — always import `prisma` from there rather than instantiating a new client.

Prisma 7 requires an explicit driver adapter for SQL providers (no more implicit connection via the URL alone). This project uses `@prisma/adapter-better-sqlite3`, wired up in `src/lib/prisma.ts`. If the datasource provider ever changes (e.g. to Postgres for production), swap both the adapter package and the `datasource` block in `schema.prisma` together — `npx prisma init` (re-run in an existing project) installs `.agents/skills/prisma-database-setup/references/` with per-provider adapter setup docs; these are gitignored local tooling, not committed.

The generated Prisma client lives at `src/generated/prisma` (per the custom `output` in `schema.prisma`) and is gitignored. Its entry point is `client.ts`, not `index.ts` — always import from `@/generated/prisma/client`, not `@/generated/prisma`. Run `npx prisma generate` after a fresh clone or any schema change.

**Routes** (`src/app/`): `/posts`, `/qna`, `/news` are server components that query Prisma directly and render a list or an empty-state message — no client-side data fetching. Each has `export const dynamic = "force-dynamic"` so it re-queries on every request instead of being statically prerendered at build time (the Next.js default for a page with no dynamic APIs) — without this, new posts/questions/articles wouldn't show up until the next `next build`. Keep that export on any new DB-backed page. When adding write functionality (create post, submit question/answer), follow the same server-first pattern (Server Actions or route handlers) rather than introducing a client-side API layer.

**News crawling:** `src/app/api/news/crawl/route.ts` is the intended entry point — a `POST` handler meant to be triggered by an external scheduler (Vercel Cron, GitHub Actions, etc.), not by users. It upserts articles into `NewsArticle` keyed on `url`. The actual fetch/parse logic belongs in `fetchLatestArticles()`, currently a stub returning `[]`. If a `NEWS_CRAWL_SECRET` env var is set, the route requires a matching `Authorization: Bearer <secret>` header — set this before exposing the route publicly.

**Environment:** `DATABASE_URL` lives in `.env` (gitignored). `prisma.config.ts` loads it via `dotenv/config` — Prisma does not auto-load `.env` on its own in this version, so don't remove that import.

## Conventions

- All user-facing text is Korean; match the existing tone when adding UI copy.
- Tailwind only, no CSS files beyond `globals.css` — keep styling inline with utility classes as in the existing pages.
