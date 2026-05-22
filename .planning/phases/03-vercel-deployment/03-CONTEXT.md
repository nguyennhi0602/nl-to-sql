# Phase 3: Vercel Deployment - Context

**Gathered:** 2026-05-22
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase makes the app publicly accessible on Vercel. It covers three things: (1) migrating the database layer from SQLite to Vercel Postgres so history persists across cold starts, (2) adding a NestJS serverless entry point and `vercel.json` so Vercel can serve the app, and (3) wiring up secrets as env vars and GitHub auto-deploy via Vercel's GitHub integration.

All work is in the `backend/` directory plus a top-level `vercel.json`. The frontend (`public/index.html`) is unchanged — Vercel's CDN serves it as a static file.

Requirements in scope: DEPLOY-01, DEPLOY-02, DEPLOY-03, DEPLOY-04, DEPLOY-05.

</domain>

<decisions>
## Implementation Decisions

### Database: Local vs Production
- **D-01:** Keep `better-sqlite3` for **local development**. Use `@vercel/postgres` in **production** (when deployed to Vercel). No local Postgres install required.
- **D-02:** The switch is controlled by the presence of the `DATABASE_URL` environment variable. If `DATABASE_URL` is set → use Postgres (`@vercel/postgres`). If absent → fall back to SQLite (`better-sqlite3`). One `DatabaseService` with two driver paths, branched at `onModuleInit`.
- **D-03:** On Vercel, `POSTGRES_URL` (auto-injected by Vercel Postgres) should be aliased or mapped to `DATABASE_URL` via the Vercel dashboard env var settings.

### Postgres Client
- **D-04:** Use **`@vercel/postgres`** as the Postgres client (not bare `pg`). It wraps `pg` with Neon's HTTP driver for serverless-safe connection pooling — no manual pool management needed, auto-reads Vercel's injected `POSTGRES_URL`.

### Seed Data
- **D-05:** Seed demo data (customers, products, orders, order_items) **on first boot** in `onModuleInit`. When Postgres driver is active: check if `customers` table has rows; if empty, run the INSERT seed block. Same pattern as the existing SQLite seed guard. Safe to run on every cold start.

### NestJS Serverless Shape
- **D-06 (Claude's Discretion):** Single catch-all serverless function at `api/index.ts` that boots the NestJS app and handles all `/api/*` routes. Simpler than splitting per-endpoint; NestJS routing handles the rest internally.

### Claude's Discretion
- TypeScript compilation strategy for `api/index.ts` (tsconfig paths, Vercel's ts-node vs esbuild)
- Exact `vercel.json` routing rules for static vs API routes
- Connection pool size / timeout settings for `@vercel/postgres`
- Whether to use `@nestjs/serve-static` in the serverless function or let Vercel's CDN handle `public/` entirely

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Source Files to Modify
- `backend/src/database/database.service.ts` — current SQLite DatabaseService; rewrite for dual SQLite/Postgres driver
- `backend/src/history/history.service.ts` — sync methods become async for Postgres path
- `backend/src/history/history.controller.ts` — needs async/await
- `backend/src/query/query.controller.ts` — needs async/await for execute() and getSchema()
- `backend/src/app.module.ts` — may need ServeStaticModule adjustment for Vercel
- `backend/src/main.ts` — local dev entry; serverless entry is separate

### Files to Create
- `backend/api/index.ts` — Vercel serverless entry point (NestJS bootstrapped as Express handler)
- `backend/vercel.json` — deployment config (routes, build settings)

### Project Config
- `backend/package.json` — add `@vercel/postgres`; keep `better-sqlite3` for local dev
- `backend/tsconfig.json` — may need `rootDir` or `include` adjustment to cover `api/` directory
- `backend/.env` — add `DATABASE_URL` for local Postgres testing (gitignored)

### Planning Artifacts
- `.planning/REQUIREMENTS.md` — DEPLOY-01 through DEPLOY-05 requirement text
- `.planning/ROADMAP.md` — Phase 3 success criteria (5 items)

No external specs — all decisions captured above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`DatabaseService.seed()`** — existing seed guard pattern (`SELECT COUNT(*) as n FROM customers` → skip if n > 0); replicate this for the Postgres path
- **`DatabaseService.initHistory()`** — existing `CREATE TABLE IF NOT EXISTS query_history` DDL; adapt for PostgreSQL syntax (`SERIAL PRIMARY KEY` instead of `INTEGER PRIMARY KEY AUTOINCREMENT`)
- **`@nestjs/platform-express`** — already in dependencies; needed for the `ExpressAdapter` pattern in `api/index.ts`
- **`ConfigModule.forRoot({ isGlobal: true })`** — already wired; `DATABASE_URL` will be read from `.env` via this

### Established Patterns
- **Sync SQLite API (`better-sqlite3`)**: all current DB calls are synchronous (`prepare().run()`, `prepare().all()`). Postgres path must be fully async — all affected methods change return type to `Promise<T>`.
- **`ServeStaticModule`** serves `public/` in local dev — keep this for `npm run start:dev` to continue working; Vercel's CDN takes over in production.
- **Module structure**: `DatabaseModule` exports `DatabaseService`; `HistoryModule` imports `DatabaseModule`; `QueryModule` imports both. This wiring stays the same.

### Integration Points
- `HistoryService.save()`, `.deleteAll()`, `.findAll()` all call `this.db.prepare(...)` — the `prepare()` method is SQLite-specific and must be replaced with an async `query(sql, params?)` method on `DatabaseService` for the Postgres path
- `QueryController.execute()` calls `this.db.execute(sql)` — needs `await` when Postgres is active
- `QueryController.getSchema()` calls `this.db.getSchema()` — needs `await` when Postgres is active
- PostgreSQL schema introspection uses `information_schema.columns` + `information_schema.table_constraints` instead of SQLite's `PRAGMA table_info()`

</code_context>

<specifics>
## Specific Ideas

- Vercel's GitHub integration (not GitHub Actions) is the preferred CI/CD path — connect the GitHub repo in the Vercel dashboard; this auto-creates production deployments on `main` push and preview deployments on PRs with zero YAML config.
- `DATABASE_URL` is the single env var that drives the SQLite→Postgres switch. Locally: absent (SQLite). On Vercel: set to the Neon Postgres connection string (Vercel auto-injects `POSTGRES_URL`; alias it to `DATABASE_URL` in Vercel env var settings).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 3-vercel-deployment*
*Context gathered: 2026-05-22*
