---
phase: 03-vercel-deployment
verified: 2026-05-25T00:00:00Z
status: human_needed
score: 9/10 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Open a pull request on GitHub and confirm Vercel posts a preview URL comment"
    expected: "Within 2 minutes Vercel posts a comment on the PR with a unique preview deployment URL, and that URL serves the working app"
    why_human: "Cannot create a PR and observe the GitHub comment programmatically from this environment; requires browser + GitHub + Vercel interaction"
---

# Phase 3: Vercel Deployment Verification Report

**Phase Goal:** The app runs in production on Vercel — NestJS served as a serverless function, history persisted in Vercel Postgres (Neon), environment variables configured, and every push to main triggers an automatic deployment
**Verified:** 2026-05-25
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `https://<project>.vercel.app` serves the chat UI and all API routes respond correctly | VERIFIED | `curl https://nl-to-sql-pi.vercel.app/api/schema` returns 5 tables (customers, order_items, orders, products, query_history); `/api/ask` returns SQL + rows; `/api/history` returns persisted entries |
| 2 | History entries persist across cold starts and multiple requests (stored in Vercel Postgres, not SQLite) | VERIFIED | `GET /api/history` returns 2 entries with real questions ("Top 5 products by revenue", "Customers who have spent more than $150"); DatabaseService branches to Postgres path when DATABASE_URL is set; query_history table uses TIMESTAMPTZ (Postgres DDL) |
| 3 | GROQ_API_KEY and DATABASE_URL are set as Vercel environment variables — no secrets in the codebase | VERIFIED | `git grep` finds no connection strings or API keys; `git ls-files backend/.env` returns empty; `.gitignore` contains `.env`; code only references `process.env.DATABASE_URL` and `process.env.GROQ_API_KEY` |
| 4 | Pushing a commit to the `main` branch on GitHub automatically triggers a Vercel deployment | VERIFIED | git log shows commits `6d84baa`, `b53a7c5`, `0ef2c2c` pushed to main during deployment fixing; plan 03-04 SUMMARY confirms "Every commit triggered a new production deployment" |
| 5 | A preview deployment is created for every pull request | UNCERTAIN | SUMMARY claims GitHub integration is active on project; no programmatic way to verify without opening a live PR — needs human confirmation |
| 6 | DatabaseService.onModuleInit branches on DATABASE_URL: Postgres path when set, SQLite path when absent | VERIFIED | Lines 18-33 in database.service.ts: `if (process.env.DATABASE_URL) { this.pgPool = createPool(...) }` else SQLite |
| 7 | createPool() receives explicit connectionString: process.env.DATABASE_URL | VERIFIED | Line 20: `createPool({ connectionString: process.env.DATABASE_URL })` |
| 8 | All DatabaseService public methods return Promise<T> on both paths | VERIFIED | `async query()`, `async execute()`, `async getSchema()` all declared async; SQLite path uses `Promise.resolve()` wrappers |
| 9 | PostgreSQL DDL uses SERIAL PRIMARY KEY, NOW(), CURRENT_DATE, information_schema — no SQLite-only syntax | VERIFIED | `SERIAL PRIMARY KEY` (5 occurrences), `TIMESTAMPTZ`, `NOW()`, `CURRENT_DATE`, `information_schema` all present; SQLite DDL isolated to `seedSqlite()` / `initHistorySqlite()` |
| 10 | HistoryService and all controllers use async/await throughout the stack | VERIFIED | `history.service.ts`: `async save`, `async deleteAll`, `async findAll`, zero `.prepare()` calls; `history.controller.ts`: `async findAll`, `async deleteAll` with `await`; `query.controller.ts`: `await this.db.getSchema()`, `await this.db.execute()`, `await this.historyService.save()` (both success and error paths) |

**Score:** 9/10 truths verified (1 uncertain — DEPLOY-05 PR preview)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/package.json` | @vercel/postgres in dependencies, @vercel/node in devDependencies | VERIFIED | `@vercel/postgres: ^0.10.0` in dependencies; `@vercel/node: ^5.8.3` in devDependencies |
| `backend/src/database/database.service.ts` | Dual-driver DatabaseService with async public API | VERIFIED | 424 lines; branches on DATABASE_URL; `query()`, `execute()`, `getSchema()` all async; full Postgres DDL; lazy `require('better-sqlite3')` in SQLite branch |
| `backend/api/index.ts` | Vercel serverless entry point with NestJS singleton | VERIFIED | Exports `default async function handler`; module-scope `expressApp` and `initPromise`; NestFactory.create inside `init()` not handler body; CORS enabled |
| `backend/vercel.json` | Deployment configuration with rewrites, buildCommand, outputDirectory | VERIFIED | `buildCommand: "npm run build"`, `outputDirectory: "public"`, rewrites `/api/:path*` → `/api/index` and `/:path*` → `/index.html`; explicit `functions` block with `maxDuration: 30` |
| `backend/tsconfig.json` | Includes api/ directory | VERIFIED | `"include": ["src/**/*", "api/**/*", "test/**/*"]`; valid JSON |
| `backend/src/history/history.service.ts` | Async HistoryService using db.query() | VERIFIED | All three methods async; 3 `this.db.query()` calls; zero `.prepare()` calls |
| `backend/src/history/history.controller.ts` | Async HistoryController | VERIFIED | `async findAll()` with `await`; `async deleteAll()` with `await` |
| `backend/src/query/query.controller.ts` | Async QueryController | VERIFIED | `await this.db.getSchema()`, `await this.db.execute()`, `await this.historyService.save()` (2 occurrences) |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `database.service.ts` | `@vercel/postgres` | `createPool({ connectionString: process.env.DATABASE_URL })` | WIRED | Line 20 — explicit connectionString argument present |
| `database.service.ts` | `information_schema` | `getSchema()` Postgres path | WIRED | Lines 91-108 — two information_schema queries for tables and columns |
| `history.service.ts` | `database.service.ts` | `this.db.query(sql, params)` | WIRED | 3 calls confirmed; zero legacy `.prepare()` calls |
| `query.controller.ts` | `history.service.ts` | `await this.historyService.save()` | WIRED | 2 occurrences (success path line 32, error path line 47) |
| `api/index.ts` | `src/app.module.ts` | `import { AppModule } from '../src/app.module'` | WIRED | Line 4 — no .js extension (documented deviation; works on Vercel's toolchain) |
| `vercel.json` | `api/index.ts` | `rewrites destination /api/index` + `functions block` | WIRED | Both routing and explicit function declaration present |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `history.service.ts findAll()` | `result.rows` | `db.query('SELECT ... FROM query_history')` → Postgres pool | Yes — live production returns 2 real entries | FLOWING |
| `query.controller.ts ask()` | `schema`, `result` | `db.getSchema()` → information_schema; `db.execute(sql)` → Postgres | Yes — `/api/ask` returns real SQL + rows from Postgres | FLOWING |
| `query.controller.ts getSchema()` | return value of `db.getSchema()` | information_schema tables and columns queries | Yes — `/api/schema` returns 5 tables with real column metadata | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `/api/schema` returns real table list | `curl https://nl-to-sql-pi.vercel.app/api/schema` | 5 tables: customers, order_items, orders, products, query_history | PASS |
| `/api/ask` returns AI-generated SQL + rows | `POST /api/ask {"question":"how many products are in stock"}` | 201, `sql: "select count(id) as total_products_in_stock from products where stock > 0"`, 1 row | PASS |
| `/api/history` returns persisted entries | `curl https://nl-to-sql-pi.vercel.app/api/history` | 200, 2 entries with real questions and SQL | PASS |
| TypeScript build compiles cleanly | `npm run build` (local) | `nest build` completes with 0 errors | PASS |
| Unit tests pass | `npm test` (local) | 1 suite, 1 test passed | PASS |

---

### Probe Execution

No probe scripts defined for this phase. Step 7c: SKIPPED (manual deployment phase — live URL smoke tests performed directly via curl).

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DEPLOY-01 | 03-01, 03-03, 03-04 | App accessible at public Vercel URL — NestJS serverless, static frontend CDN | SATISFIED | `https://nl-to-sql-pi.vercel.app` live; `/api/schema`, `/api/ask`, `/api/history` all respond correctly |
| DEPLOY-02 | 03-01, 03-02, 03-04 | History persists across requests in Vercel Postgres (Neon); query_history and demo data in cloud DB | SATISFIED | Postgres path active when DATABASE_URL set; initHistoryPg() + seedPg() in DatabaseService; 5 tables returned from schema including query_history; live history entries confirmed |
| DEPLOY-03 | 03-04 | Secrets as Vercel env vars only — no credentials in codebase | SATISFIED | `git grep` clean for connection strings and API keys; backend/.env not tracked; .gitignore covers .env |
| DEPLOY-04 | 03-04 | Push to main triggers automatic Vercel production deployment | SATISFIED | Multiple deployment-fix commits (6d84baa, b53a7c5, 0ef2c2c) each triggered a production build; GitHub integration confirmed in plan 03-04 |
| DEPLOY-05 | 03-04 | Every PR gets a unique Vercel preview URL | UNCERTAIN | GitHub integration active per SUMMARY; cannot verify without live PR — needs human confirmation |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `database.service.ts` | 51 | Comment: "SQLite path: normalize $N placeholders to ?" | Info | This is a code comment describing the placeholder normalization, not a stub or debt marker. No action needed. |
| `query.controller.ts` | 40-43, 54-57 | `console.error('History save failed ...')` | Info | These are error-path guard logs in try/catch — intentional failure visibility, not a stub indicator. |

No TBD, FIXME, or XXX markers found in any phase-modified files. No unresolved debt markers.

---

### Human Verification Required

#### 1. DEPLOY-05: PR Preview Deployment

**Test:** Create a new branch, make a trivial commit, push it, and open a pull request on GitHub at `nguyennhi0602/nl-to-sql`.
**Expected:** Within 2 minutes, Vercel posts a comment on the PR containing a unique preview URL (e.g., `https://nl-to-sql-XXXX-git-branchname.vercel.app`). Opening that URL should show the working chat UI.
**Why human:** Cannot programmatically create a PR and observe the Vercel GitHub bot comment from the CLI environment. Requires browser access to GitHub and confirmation that the Vercel app is still connected to the repository.

---

### Gaps Summary

No gaps found. All 9 verifiable must-haves pass with codebase and live production evidence. The single uncertain item (DEPLOY-05) is gated on human verification only — all infrastructure for PR previews (GitHub integration, Vercel project connected to repo) is confirmed active per the deployment process and SUMMARY. The uncertainty is observability, not a likely implementation failure.

**Deployment fixes note:** Three unplanned code changes were required during Plan 03-04 deployment (explicit `functions` block in vercel.json, lazy `require()` for better-sqlite3, manual DATABASE_URL setup). All three are present and correct in the codebase. These were deviations from the plan, not from the goal — the goal is fully achieved.

---

_Verified: 2026-05-25_
_Verifier: Claude (gsd-verifier)_
