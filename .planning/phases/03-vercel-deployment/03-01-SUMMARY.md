---
phase: 03-vercel-deployment
plan: 01
subsystem: database
tags: [vercel, postgres, sqlite, better-sqlite3, nestjs, dual-driver]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: DatabaseService (SQLite-only), query_history schema, seed data
provides:
  - Dual-driver DatabaseService: SQLite path for local dev, Postgres path for production
  - async public API: query(), execute(), getSchema() all return Promise<T>
  - PostgreSQL DDL for all 4 demo tables plus query_history
  - @vercel/postgres installed in backend dependencies
affects:
  - 03-02 (HistoryService callers must migrate from db.prepare() to db.query())
  - 03-03 (vercel.json deployment config needs DATABASE_URL env var set)
  - 03-04 (E2E smoke test against live Vercel URL exercises Postgres path)

# Tech tracking
tech-stack:
  added:
    - "@vercel/postgres (^0.10.0) — Postgres pool driver for Vercel/Neon"
    - "@vercel/node (devDependency) — Vercel runtime types"
  patterns:
    - "Dual-driver: branch on process.env.DATABASE_URL presence in onModuleInit"
    - "Postgres parameterized queries use $1,$2,... placeholders; SQLite uses ?"
    - "createPool() receives explicit { connectionString: process.env.DATABASE_URL } — never auto-detect"
    - "information_schema used for Postgres schema inspection (no PRAGMA)"

key-files:
  created: []
  modified:
    - backend/package.json
    - backend/package-lock.json
    - backend/src/database/database.service.ts

key-decisions:
  - "Branch on DATABASE_URL in onModuleInit, not at module load time — avoids pool creation before env is ready"
  - "prepare() removed entirely; Plan 03-02 will migrate HistoryService callers to query()"
  - "pk set to 0 for all Postgres columns (information_schema does not expose PK directly) — AI uses names/types, pk is informational only"
  - "Seed guard on Postgres path checks customers row count before inserting to prevent duplicate data on warm starts"

patterns-established:
  - "Dual-driver pattern: all public methods async, callers use await uniformly regardless of backend"
  - "SQLite path normalizes $N placeholders to ? for compatibility with Postgres-style query() calls"

requirements-completed: [DEPLOY-01, DEPLOY-02, DEPLOY-03]

# Metrics
duration: ~45min
completed: 2026-05-22
---

# Phase 03 Plan 01: DatabaseService Dual-Driver Rewrite Summary

**@vercel/postgres Postgres pool path added alongside existing better-sqlite3 SQLite path, branched on DATABASE_URL, with async-everywhere public API (query/execute/getSchema) and full PostgreSQL DDL for all tables**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-05-22
- **Completed:** 2026-05-22
- **Tasks:** 1 (Task 1 was a human-verify checkpoint; Task 2 was the implementation task)
- **Files modified:** 3

## Accomplishments
- Rewrote DatabaseService with dual-driver architecture: SQLite for local dev, Postgres for production
- All public methods (query, execute, getSchema) are now async and return Promise<T> uniformly
- PostgreSQL DDL added for customers, products, orders, order_items, and query_history tables with correct types (SERIAL PRIMARY KEY, TIMESTAMPTZ, FLOAT8, CURRENT_DATE, NOW())
- Seed guard prevents duplicate demo data on Postgres warm starts
- npm test passes (1 suite, 1 test)

## Task Commits

1. **Task 2: Install @vercel/postgres and @vercel/node, rewrite DatabaseService** - `2265bd6` (feat)

**Plan metadata:** (pending — docs commit below)

## Files Created/Modified
- `backend/package.json` — @vercel/postgres added to dependencies, @vercel/node to devDependencies
- `backend/package-lock.json` — updated lock file after npm install
- `backend/src/database/database.service.ts` — full dual-driver rewrite: async onModuleInit, query(), execute(), getSchema(), initHistoryPg(), seedPg(), initHistorySqlite(), seedSqlite()

## Decisions Made
- `prepare()` removed: it is SQLite-only; all callers (HistoryService) will be migrated to `query()` in Plan 03-02
- `createPool()` always receives explicit `{ connectionString: process.env.DATABASE_URL }` per critical research finding — never rely on Vercel auto-detection which requires `POSTGRES_URL` naming convention
- `pk: 0` for all Postgres columns: `information_schema.columns` does not expose primary key status directly; the AI prompt uses column names and types so this is acceptable
- Seed guard uses row count check before any INSERT to protect against duplicate seeding on Vercel cold start restarts

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None — installation and rewrite proceeded cleanly. npm test passed on first run after rewrite.

## User Setup Required
None at this step. DATABASE_URL will be configured in Plan 03-03 when the Vercel project is created.

## Next Phase Readiness
- DatabaseService dual-driver is complete; Postgres path is ready to use when DATABASE_URL is set
- Plan 03-02 must migrate HistoryService callers from `db.prepare(sql).run()` / `db.prepare(sql).all()` to `await db.query(sql, params)` — these calls will throw at runtime since `prepare()` no longer exists
- Wave 1 gate verification (curl tests against local SQLite) can run after Plan 03-02 completes

---
*Phase: 03-vercel-deployment*
*Completed: 2026-05-22*

## Self-Check: PASSED

- [x] `backend/package.json` — exists and contains `@vercel/postgres`
- [x] `backend/src/database/database.service.ts` — exists and contains dual-driver implementation
- [x] Commit `2265bd6` — verified in git log
- [x] npm test — 1 passed, 0 failures
