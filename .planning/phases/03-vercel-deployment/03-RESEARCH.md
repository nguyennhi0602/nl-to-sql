# Phase 3: Vercel Deployment - Research

**Researched:** 2026-05-22
**Domain:** Vercel serverless deployment, NestJS server entrypoint, Neon Postgres migration
**Confidence:** MEDIUM — core findings verified against official Vercel docs and npm registry; Neon env var details confirmed from Neon native integration docs; @vercel/postgres internals verified by inspecting installed package source

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Keep `better-sqlite3` for local development. Use `@vercel/postgres` in production (when deployed to Vercel). No local Postgres install required.
- **D-02:** Switch controlled by presence of `DATABASE_URL` environment variable. If `DATABASE_URL` is set → use Postgres (`@vercel/postgres`). If absent → fall back to SQLite (`better-sqlite3`). One `DatabaseService` with two driver paths, branched at `onModuleInit`.
- **D-03:** On Vercel, `POSTGRES_URL` (auto-injected by Vercel Postgres / Neon) should be aliased or mapped to `DATABASE_URL` via the Vercel dashboard env var settings.
- **D-04:** Use `@vercel/postgres` as the Postgres client (not bare `pg`). It wraps `pg` with Neon's HTTP driver for serverless-safe connection pooling — no manual pool management needed, auto-reads Vercel's injected `POSTGRES_URL`.
- **D-05:** Seed demo data (customers, products, orders, order_items) on first boot in `onModuleInit`. When Postgres driver is active: check if `customers` table has rows; if empty, run the INSERT seed block. Same pattern as the existing SQLite seed guard. Safe to run on every cold start.
- **D-06 (Claude's Discretion):** Single catch-all serverless function at `api/index.ts` that boots the NestJS app and handles all `/api/*` routes. Simpler than splitting per-endpoint; NestJS routing handles the rest internally.

### Claude's Discretion
- TypeScript compilation strategy for `api/index.ts` (tsconfig paths, Vercel's ts-node vs esbuild)
- Exact `vercel.json` routing rules for static vs API routes
- Connection pool size / timeout settings for `@vercel/postgres`
- Whether to use `@nestjs/serve-static` in the serverless function or let Vercel's CDN handle `public/` entirely

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DEPLOY-01 | App accessible at a public Vercel URL — NestJS runs as serverless function, static frontend served from Vercel CDN | Vercel server entrypoint detection auto-converts `src/main.ts` listen() call to serverless function; `public/` served by CDN when `outputDirectory` is set correctly |
| DEPLOY-02 | Chat history persists across requests — `better-sqlite3` replaced with Vercel Postgres (Neon); `query_history` table and demo seed data live in cloud database | `@vercel/postgres` `createPool()` verified; DDL equivalents for all SQLite constructs researched; dual-driver `DatabaseService` pattern documented |
| DEPLOY-03 | Secrets managed as Vercel environment variables (`GROQ_API_KEY`, `POSTGRES_URL`) — no credentials in codebase or committed `.env` files | Vercel dashboard env var injection confirmed; `@vercel/postgres` reads `POSTGRES_URL` automatically; Neon native integration injects `DATABASE_URL` (must be aliased) |
| DEPLOY-04 | Every push to `main` on GitHub automatically triggers a Vercel production deployment (GitHub integration via Vercel dashboard) | Vercel GitHub integration is dashboard-only, no YAML needed; confirmed by Vercel deployment docs |
| DEPLOY-05 | Every pull request gets a unique Vercel preview URL for isolated testing | Preview deployments are automatic when GitHub integration is connected; no additional config required |
</phase_requirements>

---

## Summary

Vercel now detects NestJS as a first-class framework. The preferred entry point is the existing `backend/src/main.ts` — Vercel detects the `server.listen()` call and wraps the entire server as a single serverless function. No `api/index.ts` is strictly required by Vercel's framework detection, but the CONTEXT.md locked decision D-06 specifies creating `api/index.ts` using the `ExpressAdapter` pattern. Both approaches work; the `api/index.ts` approach gives more explicit control over the NestJS bootstrap lifecycle.

The critical database finding: **Vercel Postgres was deprecated in December 2024** and migrated to Neon as a Marketplace integration. The `@vercel/postgres` npm package still exists at v0.10.0 (last published September 2024) and still works, but it reads `POSTGRES_URL` by default for `createPool()`, while Neon's Marketplace integration injects `DATABASE_URL`. Decision D-03 (aliasing `POSTGRES_URL` to `DATABASE_URL` in the Vercel dashboard) resolves this gap. Alternatively, `createPool({ connectionString: process.env.DATABASE_URL })` bypasses the auto-detection entirely. The `@vercel/postgres` pooled connection string must contain `-pooler.` in the hostname — Neon's PgBouncer URL satisfies this.

The `tsconfig.json` currently uses `"module": "nodenext"`. Vercel's TS compilation supports most `tsconfig.json` options but NOT Path Mappings or Project References. The `nodenext` module setting works for the Vercel runtime. However, the `api/` directory is outside `src/` and not covered by `nest build` (which uses `tsconfig.build.json` with `sourceRoot: src`). Vercel handles `api/index.ts` compilation independently using its own TypeScript toolchain — the file does NOT need to go through `nest build`.

**Primary recommendation:** Use `src/main.ts` as the server entrypoint (Vercel detects it automatically via `server.listen()`), keep `api/index.ts` as the explicit D-06 entry point with NestApp singleton caching, use `rewrites` in `vercel.json` to route all requests to the function, set `outputDirectory: "public"` to serve the static frontend, and pass `DATABASE_URL` explicitly to `createPool()`.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Static frontend (index.html) | CDN / Static | — | Vercel serves `public/` as static files from CDN; `ServeStaticModule` still works locally but Vercel CDN takes over in prod |
| API routing (`/api/*`) | API / Backend (serverless) | — | NestJS `@Controller('api')` handles all routes inside the single Vercel Function |
| Database (Postgres) | Database / Storage | — | Neon Postgres via Vercel Marketplace; connection managed by `@vercel/postgres` pool |
| Database (SQLite local) | Database / Storage | — | `better-sqlite3` for local dev only; branched at `onModuleInit` |
| Env var management | Frontend Server (Vercel Platform) | — | Vercel dashboard injects env vars; `@nestjs/config` reads them via `process.env` |
| CI/CD | CDN / Static (Vercel Platform) | — | Vercel GitHub integration auto-deploys on push to `main`; preview on PRs |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@vercel/postgres` | 0.10.0 | Postgres client for Vercel (wraps `@neondatabase/serverless`) | Locked decision D-04; reads `POSTGRES_URL` automatically; serverless-safe pooling |
| `@vercel/node` | 5.8.3 | TypeScript types for `VercelRequest`/`VercelResponse` | Required for `api/index.ts` handler typing; published 2026-05-19 |

[VERIFIED: npm registry] — `@vercel/postgres` (github.com/vercel/storage), `@vercel/node` (github.com/vercel/vercel)

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@neondatabase/serverless` | 1.1.0 (transitive) | HTTP transport for Postgres queries | Pulled in by `@vercel/postgres`; no direct install needed |
| `better-sqlite3` | 12.10.0 (existing) | SQLite for local dev | Already installed; keep in `dependencies` — Vercel build will include it but it is only exercised when `DATABASE_URL` is absent |

[VERIFIED: npm registry] — packages confirmed at github.com/neondatabase/serverless

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@vercel/postgres` | bare `pg` or `@neondatabase/serverless` directly | Both work but require manual pool setup; D-04 locks us to `@vercel/postgres` |
| `vercel.json` rewrites approach | Vercel's zero-config server detection via `src/main.ts` | Zero-config approach is simpler but gives less explicit control; D-06 specifies `api/index.ts` |

**Installation:**
```bash
cd backend
npm install @vercel/postgres
npm install --save-dev @vercel/node
```

**Version verification:**
```bash
npm view @vercel/postgres version   # 0.10.0 — confirmed
npm view @vercel/node version       # 5.8.3 — confirmed
```

---

## Package Legitimacy Audit

> slopcheck was unavailable at research time. Packages verified via npm registry + official GitHub source repos.

| Package | Registry | Age | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-------------|-----------|-------------|
| `@vercel/postgres` | npm | 2+ yrs (first release 2023) | github.com/vercel/storage | not run | [ASSUMED] — well-known Vercel official package |
| `@vercel/node` | npm | 5+ yrs | github.com/vercel/vercel | not run | [ASSUMED] — well-known Vercel official package |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*slopcheck was unavailable at research time. Both packages are from the official Vercel GitHub organization (`vercel/vercel` and `vercel/storage`), which is a strong legitimacy signal. Planner should add `checkpoint:human-verify` before each install per protocol.*

---

## Architecture Patterns

### System Architecture Diagram

```
Browser
   |
   | GET /                    (static)
   v
Vercel CDN  <─────────────────────────────────────────────────────
   |                          (serves backend/public/index.html)
   |
   | POST /api/ask, GET /api/history, DELETE /api/history, etc.
   v
Vercel Serverless Function (Node.js, fluid compute)
   |
   |  api/index.ts  ──── NestApp singleton (cached after cold start)
   |                          |
   |                    AppModule
   |                    ├── ConfigModule (reads env vars)
   |                    ├── ServeStaticModule (local dev only, no-op on Vercel)
   |                    ├── QueryModule
   |                    │     ├── QueryController (POST /api/ask, POST /api/execute, GET /api/schema)
   |                    │     ├── ClaudeService (Groq API)
   |                    │     └── DatabaseModule (imported)
   |                    └── HistoryModule
   |                          ├── HistoryController (GET /api/history, DELETE /api/history)
   |                          ├── HistoryService
   |                          └── DatabaseModule (imported)
   |
   v
DatabaseService.onModuleInit()
   |
   ├── DATABASE_URL present? ──── YES ──── Postgres path (@vercel/postgres pool)
   │                                           └── CREATE TABLE IF NOT EXISTS (PG DDL)
   │                                           └── Seed guard (SELECT COUNT(*) FROM customers)
   |
   └── DATABASE_URL absent? ──── YES ──── SQLite path (better-sqlite3, local dev)

Postgres path calls:                   SQLite path calls:
  pool.query(sql, [params])              db.prepare(sql).run(params)
  pool.query(sql, [params])              db.prepare(sql).all()
  (all async, returns Promise)           (sync, returns value directly)
```

### Recommended Project Structure

```
backend/
├── api/
│   └── index.ts         # Vercel serverless entry point (D-06)
├── src/
│   ├── database/
│   │   └── database.service.ts  # REWRITE: dual driver (SQLite + Postgres)
│   ├── history/
│   │   ├── history.service.ts   # REWRITE: all methods become async
│   │   └── history.controller.ts # UPDATE: add await
│   ├── query/
│   │   └── query.controller.ts  # UPDATE: add await for execute/getSchema
│   ├── app.module.ts            # MINOR: ServeStaticModule note
│   └── main.ts                  # UNCHANGED (local dev entry)
├── public/
│   └── index.html               # UNCHANGED
├── vercel.json                  # NEW: routing + build config
├── tsconfig.json                # UPDATE: add "include": ["api/**/*", "src/**/*"]
└── package.json                 # UPDATE: add @vercel/postgres
```

### Pattern 1: Vercel Server Entrypoint (Zero-Config)

**What:** Vercel auto-detects `src/main.ts` because it calls `server.listen()`. No `vercel.json` builds array required.
**When to use:** Simplest path; Vercel handles TS compilation and routing.

```typescript
// Source: https://vercel.com/docs/frameworks/backend/nestjs (last_updated: 2025-10-28)
// src/main.ts (UNCHANGED — already satisfies Vercel detection)
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}
bootstrap();
```

[CITED: https://vercel.com/docs/frameworks/backend/nestjs]

### Pattern 2: Explicit api/index.ts with NestApp Singleton (D-06)

**What:** Export the Express underlying instance from a NestJS app initialized once per cold start. Cached in module scope so warm invocations skip bootstrap.
**When to use:** Required by D-06; gives explicit control over initialization.

```typescript
// Source: pattern synthesized from vercel.com/docs/functions/runtimes/node-js +
//         community implementations (evgeniistuditskikh.com, dev.to/mahdavipanah)
// backend/api/index.ts
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import { AppModule } from '../src/app.module';

const server = express();
let isReady = false;

const createApp = async () => {
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server));
  app.enableCors();
  await app.init();
  isReady = true;
  return app;
};

// Initialize once; reuse across warm invocations
const appPromise = createApp();

export default async function handler(req: any, res: any) {
  if (!isReady) {
    await appPromise;
  }
  server(req, res);
}
```

[ASSUMED] — `ExpressAdapter` import pattern is standard NestJS but the exact cold-start singleton pattern varies across community sources; verify against `@nestjs/platform-express` docs before finalizing.

**Note:** `@nestjs/platform-express` is already in `backend/package.json` dependencies — no new install needed for ExpressAdapter.

### Pattern 3: vercel.json for Backend-as-Root Deployment

**What:** Since the Vercel project root should be set to `backend/` in the Vercel dashboard, `vercel.json` lives in `backend/`. It rewrites all requests to `api/index.ts` and tells Vercel what to build.

```json
// Source: https://vercel.com/docs/project-configuration/vercel-json (last_updated: 2026-03-11)
// backend/vercel.json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "npm run build",
  "outputDirectory": ".",
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/index" },
    { "source": "/(.*)", "destination": "/public/index.html" }
  ]
}
```

[ASSUMED] — The exact `outputDirectory` and static routing behavior when `ServeStaticModule` is also present needs verification. See Open Questions.

**Alternative (simpler, zero-config server approach):**

```json
// If using src/main.ts detection (no api/index.ts), vercel.json can be minimal or absent
// Vercel detects src/main.ts listen() call and handles routing automatically
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "npm run build"
}
```

[CITED: https://vercel.com/docs/functions/runtimes/node-js — server entrypoint detection docs]

### Pattern 4: Dual-Driver DatabaseService

**What:** Single `DatabaseService` that branches on `DATABASE_URL` presence in `onModuleInit`. SQLite path uses sync `better-sqlite3` API; Postgres path uses async `@vercel/postgres` pool.

**Key API differences:**

| Operation | SQLite (current) | Postgres (new) |
|-----------|-----------------|----------------|
| INSERT | `db.prepare(sql).run(p1, p2, ...)` | `await pool.query(sql, [p1, p2, ...])` |
| SELECT all | `db.prepare(sql).all()` | `(await pool.query(sql, [...])).rows` |
| SELECT one | `db.prepare(sql).get()` | `(await pool.query(sql, [...])).rows[0]` |
| DDL | `db.exec(sql)` | `await pool.query(sql)` |
| Schema inspect | `PRAGMA table_info(name)` | `SELECT * FROM information_schema.columns WHERE table_name = $1` |
| Table list | `sqlite_master WHERE type='table'` | `information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'` |

```typescript
// Source: @vercel/postgres source verified by inspecting installed package
// (npm view @vercel/postgres; source: github.com/vercel/storage)
import { createPool } from '@vercel/postgres';
import type { VercelPool } from '@vercel/postgres';

// In onModuleInit:
if (process.env.DATABASE_URL) {
  // Postgres path — createPool reads POSTGRES_URL by default,
  // but passing connectionString explicitly is safer given env var alias complexity
  this.pgPool = createPool({ connectionString: process.env.DATABASE_URL });
  await this.initHistoryPg();
  await this.seedPg();
}

// Pool query API:
const result = await this.pgPool.query(
  'INSERT INTO query_history (question, sql, explanation, columns, rows, error) VALUES ($1, $2, $3, $4, $5, $6)',
  [question, sql, explanation, columnsJson, rowsJson, error]
);
const { rows } = await this.pgPool.query('SELECT * FROM query_history ORDER BY id DESC');
```

[VERIFIED: npm registry] — API confirmed by inspecting `/tmp/vercel-postgres-check/node_modules/@vercel/postgres/dist/chunk-BZ4XJVIW.cjs`

### Pattern 5: PostgreSQL DDL Equivalents

**What:** Replace all SQLite-specific DDL with standard PostgreSQL DDL.

```sql
-- SQLite (current)
CREATE TABLE IF NOT EXISTS query_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question TEXT NOT NULL,
  sql TEXT NOT NULL,
  explanation TEXT NOT NULL DEFAULT '',
  columns TEXT NOT NULL DEFAULT '[]',
  rows TEXT NOT NULL DEFAULT '[]',
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_query_history_created_at ON query_history (created_at DESC);

-- PostgreSQL equivalent
CREATE TABLE IF NOT EXISTS query_history (
  id SERIAL PRIMARY KEY,
  question TEXT NOT NULL,
  sql TEXT NOT NULL,
  explanation TEXT NOT NULL DEFAULT '',
  columns TEXT NOT NULL DEFAULT '[]',
  rows TEXT NOT NULL DEFAULT '[]',
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_query_history_created_at ON query_history (created_at DESC);
```

**Demo data tables (PostgreSQL):**
```sql
-- customers, products, orders, order_items
-- Same as SQLite but: INTEGER PRIMARY KEY AUTOINCREMENT → SERIAL PRIMARY KEY
-- TEXT DEFAULT (date('now')) → TIMESTAMPTZ DEFAULT NOW() or DATE DEFAULT CURRENT_DATE
-- REAL → NUMERIC or FLOAT8
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  city TEXT NOT NULL,
  created_at DATE NOT NULL DEFAULT CURRENT_DATE
);
-- (same pattern for products, orders, order_items)
```

[ASSUMED] — DDL equivalents are standard PostgreSQL knowledge; validate against a live Neon connection.

### Anti-Patterns to Avoid

- **Calling `NestFactory.create()` on every request:** Cold-start cost is 500ms–2s. Cache the initialized app in module scope; Vercel's fluid compute reuses instances across requests.
- **Using `@vercel/postgres` with a direct (non-pooler) connection string:** `createPool()` validates that the string contains `-pooler.` in the hostname. Neon's PgBouncer URL (the `DATABASE_URL` injected by the Neon integration) satisfies this; the `DATABASE_URL_UNPOOLED` URL does not.
- **Passing `better-sqlite3` `prepare().run()` return value as if it were a Promise:** After the dual-driver refactor, all `DatabaseService` methods that call the Postgres path return `Promise<T>`. Callers must `await` them.
- **Using `PRAGMA table_info()` in the Postgres path:** PostgreSQL has no `PRAGMA`; use `information_schema.columns` instead.
- **Importing from `'../src/app.module'` using `.js` extension in `api/index.ts`:** `"module": "nodenext"` requires `.js` extensions for relative imports in ESM. But Vercel compiles `api/index.ts` with its own toolchain — if it uses CommonJS output, omit extensions. Use `../src/app.module` without extension and test both.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Serverless Postgres pooling | Custom PgBouncer config | `@vercel/postgres` `createPool()` | Already wraps `@neondatabase/serverless` with proper serverless connection management; manually managing a `pg.Pool` leads to "too many connections" in serverless |
| SQL parameterization | String interpolation `sql = 'WHERE id = ' + id` | `pool.query(sql, [id])` or `pool.sql\`WHERE id = ${id}\`` | PostgreSQL is vulnerable to injection via string interpolation; parameterized queries are mandatory |
| Schema migration | Writing migration runner | Raw `CREATE TABLE IF NOT EXISTS` DDL in `onModuleInit` | Sufficient for this app's single-schema, first-boot-seed pattern; TypeORM/Prisma would add complexity without benefit (locked out by CLAUDE.md) |
| TypeScript compilation for `api/` | Adding `api/` to `nest build` | Let Vercel compile `api/index.ts` independently | Vercel's runtime handles `api/*.ts` compilation automatically; adding it to `tsconfig.build.json` would try to emit it to `dist/api/` which Vercel doesn't use |

**Key insight:** The `@vercel/postgres` package exists specifically to handle the serverless connection lifecycle — don't bypass it for custom connection pooling.

---

## Runtime State Inventory

> Phase 3 is NOT a rename/refactor/migration phase — this section is omitted.

---

## Common Pitfalls

### Pitfall 1: @vercel/postgres reads POSTGRES_URL, Neon injects DATABASE_URL

**What goes wrong:** After connecting the Neon Marketplace integration, `createPool()` throws "no 'POSTGRES_URL' env var was found" even though `DATABASE_URL` is present.
**Why it happens:** `@vercel/postgres`'s `postgresConnectionString("pool")` reads `process.env.POSTGRES_URL` specifically (verified in source). Neon's native integration injects `DATABASE_URL` as the primary connection string (confirmed from Neon Vercel integration docs).
**How to avoid:** Two options: (1) In Vercel dashboard, add env var `POSTGRES_URL = <Neon PgBouncer URL>` manually (D-03 approach). (2) Always call `createPool({ connectionString: process.env.DATABASE_URL })` explicitly, bypassing auto-detection.
**Warning signs:** `VercelPostgresError: missing_connection_string` in function logs on first deploy.

### Pitfall 2: createPool() rejects direct (non-pooler) connection strings

**What goes wrong:** `createPool()` throws `"invalid_connection_string: This connection string is meant to be used with a direct connection."` even when DATABASE_URL is set.
**Why it happens:** The function calls `isPooledConnectionString()` which checks for `-pooler.` in the hostname. Neon provides two URLs: `DATABASE_URL` (PgBouncer, contains `-pooler.`) and `DATABASE_URL_UNPOOLED` (direct connection). Using the wrong one fails.
**How to avoid:** Use the `DATABASE_URL` (pooled, PgBouncer) value from Neon, not `DATABASE_URL_UNPOOLED`. The Neon dashboard labels these clearly.
**Warning signs:** Error message explicitly says "use a pooled connection string or try `createClient()` instead."

### Pitfall 3: Sync DatabaseService methods called without await after refactor

**What goes wrong:** `historyService.save()` appears to succeed but no row is written; `getSchema()` returns stale/empty data.
**Why it happens:** The Postgres path makes all `DatabaseService` methods return `Promise<T>`. If a caller doesn't `await` the call, the promise is silently discarded.
**How to avoid:** Change ALL `DatabaseService` method signatures to return `Promise<T>` for both paths. Force async even for the SQLite path (wrap sync return in `Promise.resolve()`). Then TypeScript will enforce `await` at call sites.
**Warning signs:** History saves silently not appearing; no runtime error (fire-and-forget promise).

### Pitfall 4: @vercel/postgres createPool() called at module level instead of onModuleInit

**What goes wrong:** `createPool()` throws during module load on Vercel if `POSTGRES_URL` is not yet in `process.env` at import time, or throws locally when `DATABASE_URL` is absent.
**Why it happens:** Module-level initialization runs before NestJS DI wiring, before env vars are guaranteed to be loaded.
**How to avoid:** Call `createPool()` inside `onModuleInit()` after the `DATABASE_URL` presence check.
**Warning signs:** `VercelPostgresError` stack trace pointing to module-level code, not a request handler.

### Pitfall 5: better-sqlite3 native binary included in Vercel function bundle

**What goes wrong:** Vercel build bundles `better-sqlite3`'s `.node` native binary, either inflating the function beyond 250 MB or failing to load on Vercel's Linux runtime.
**Why it happens:** `better-sqlite3` compiles a native addon with `node-gyp`. When included in the Vercel function bundle, the binary may be built for the wrong architecture (macOS vs Linux x64).
**How to avoid:** Keep `better-sqlite3` in `dependencies` but ensure the Postgres path is always active on Vercel (i.e., `DATABASE_URL` is always set in Vercel env). The SQLite code path never runs in production. Vercel's bundler may still include the `.node` file; if bundle size becomes an issue, move `better-sqlite3` to `optionalDependencies` with a try/catch import.
**Warning signs:** Vercel build log showing "bundle size exceeds limit" or runtime error "cannot open shared object file" for `better_sqlite3.node`.

### Pitfall 6: tsconfig "nodenext" module requires explicit .js extensions for local imports

**What goes wrong:** `api/index.ts` imports `'../src/app.module'` but TypeScript with `"module": "nodenext"` requires `'../src/app.module.js'` for ESM compatibility.
**Why it happens:** NodeNext module resolution enforces explicit file extensions for relative imports.
**How to avoid:** Vercel compiles `api/index.ts` using its own toolchain (not `tsc`), which may be more permissive. Test with and without `.js` extension. If Vercel uses esbuild or ts-node (CommonJS mode), the extension is optional. If it uses native ESM, `.js` is required.
**Warning signs:** Build error "Cannot find module '../src/app.module'" in Vercel build logs.

### Pitfall 7: ServeStaticModule competes with Vercel CDN static serving

**What goes wrong:** `GET /` returns a 404 or the wrong file in production.
**Why it happens:** `ServeStaticModule` tries to serve `public/` relative to `__dirname` (which is the compiled `dist/` directory). On Vercel, `dist/` path resolution may differ from local.
**How to avoid:** For the `api/index.ts` serverless approach, disable `ServeStaticModule` when `DATABASE_URL` is present (i.e., on Vercel). Vercel's CDN serves static files from `outputDirectory` automatically. Add a conditional import of `ServeStaticModule` or use the `vercel.json` rewrite to route `/(.*) → /public/index.html` for non-API paths.
**Warning signs:** Static frontend not loading at the Vercel URL.

---

## Code Examples

### @vercel/postgres createPool() with explicit connectionString

```typescript
// Source: @vercel/postgres source (verified from installed package source, github.com/vercel/storage)
import { createPool } from '@vercel/postgres';
import type { VercelPool } from '@vercel/postgres';

// Call inside onModuleInit after DATABASE_URL check:
const pool = createPool({
  connectionString: process.env.DATABASE_URL,  // Neon PgBouncer URL (contains -pooler.)
});

// Parameterized query (INSERT):
await pool.query(
  `INSERT INTO query_history (question, sql, explanation, columns, rows, error)
   VALUES ($1, $2, $3, $4, $5, $6)`,
  [question, sqlText, explanation, columnsJson, rowsJson, error ?? null]
);

// Parameterized query (SELECT, returns { rows: T[] }):
const { rows } = await pool.query<{ id: number; question: string }>(
  'SELECT id, question, sql, explanation, columns, rows, error, created_at FROM query_history ORDER BY id DESC'
);

// DELETE:
const result = await pool.query('DELETE FROM query_history');
const deleted = result.rowCount ?? 0;
```

### PostgreSQL schema introspection (replaces PRAGMA table_info)

```typescript
// Source: PostgreSQL information_schema is ANSI SQL standard [ASSUMED: standard SQL]
const tableResult = await pool.query<{ table_name: string }>(
  `SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
   ORDER BY table_name`
);
const tables = tableResult.rows.map(r => r.table_name);

for (const name of tables) {
  const colResult = await pool.query<{
    column_name: string;
    data_type: string;
    is_nullable: string;
  }>(
    `SELECT column_name, data_type, is_nullable
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    [name]
  );
  // Map to SchemaTable shape the AI uses
}
```

### NestJS app singleton caching for api/index.ts

```typescript
// Source: community pattern from evgeniistuditskikh.com, dev.to/mahdavipanah [ASSUMED]
// Pattern also endorsed by NestJS docs (serverless FAQ) for reuse across invocations
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express, { type Express } from 'express';
import { AppModule } from '../src/app.module';

const expressApp: Express = express();
let nestReady = false;
let initPromise: Promise<void> | null = null;

function init(): Promise<void> {
  if (!initPromise) {
    initPromise = NestFactory.create(AppModule, new ExpressAdapter(expressApp))
      .then(async (app) => {
        app.enableCors();
        await app.init();
        nestReady = true;
      });
  }
  return initPromise;
}

export default async function handler(req: any, res: any) {
  if (!nestReady) await init();
  expressApp(req, res);
}
```

### vercel.json for backend-as-root deployment

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "npm run build",
  "outputDirectory": ".",
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/index" },
    { "source": "/(.*)", "destination": "/public/index.html" }
  ]
}
```

[ASSUMED] — `outputDirectory: "."` is taken from the mahdavipanah guide (Nov 2024); exact behavior with `public/` as CDN root needs testing. [CITED: https://dev.to/mahdavipanah/fast-and-simple-nestjs-app-deployment-on-vercel-1lo3]

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Vercel Postgres (native) | Neon via Marketplace integration | December 2024 | New projects must use Marketplace; `@vercel/postgres` package still works but reads `POSTGRES_URL` while Neon injects `DATABASE_URL` |
| api/index.ts required for NestJS | Zero-config: `src/main.ts` with `listen()` is auto-detected | ~2025 (Vercel framework detection) | Can skip `api/index.ts` entirely if using server entrypoint approach; `vercel.json` `builds` array no longer required |
| `version: 2` + `builds` array in vercel.json | `rewrites`/`redirects` in vercel.json without `builds` | Vercel v3+ | `builds` array is legacy config; prefer `rewrites` |

**Deprecated/outdated:**
- Vercel Postgres (managed by Vercel): shut down December 2024; migrated users to Neon
- `"builds": [{"src": "...", "use": "@vercel/node"}]` in `vercel.json`: deprecated in favor of framework auto-detection and `rewrites`
- `@vercel/postgres` `0.10.0`: last published September 2024; still functional but no longer actively maintained by Vercel

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `api/index.ts` imports `'../src/app.module'` without `.js` extension works with Vercel's TS compiler | Code Examples, Pitfall 6 | Build fails; fix: add `.js` extension or configure Vercel to use CommonJS output |
| A2 | `vercel.json` with `outputDirectory: "."` correctly causes Vercel CDN to serve `public/index.html` from the backend root | vercel.json pattern, Architecture Diagram | Static frontend not served; fix: set `outputDirectory: "public"` or adjust rewrite |
| A3 | `ServeStaticModule` in `AppModule` is harmless on Vercel (CDN serves static before reaching the function) | Architecture Patterns, Pitfall 7 | `ServeStaticModule` intercepts requests it shouldn't; fix: conditionally disable on Vercel |
| A4 | `NestFactory.create()` with `new ExpressAdapter(expressApp)` works the same way as in NestJS 11 as in earlier versions | Code Examples (api/index.ts) | Initialization fails; fall back to zero-config `src/main.ts` approach |
| A5 | PostgreSQL DDL equivalents (SERIAL, TIMESTAMPTZ, information_schema) are correct and complete for the schema | Code Examples (DDL) | Schema creation fails; validate against live Neon connection before merge |
| A6 | Neon's `DATABASE_URL` (PgBouncer URL) always contains `-pooler.` in hostname | Pitfall 2 | `createPool()` throws invalid_connection_string; fix: use `createClient()` instead |

---

## Open Questions (RESOLVED)

1. **Vercel project root directory setting** — RESOLVED
   - Resolution: Plan 03-04 Task 1 Step 3 includes setting "Root Directory: backend" in the Vercel dashboard during initial project connection.

2. **Static frontend serving strategy** — RESOLVED
   - Resolution: Plan 03-03 Task 2 uses `outputDirectory: "public"` — Vercel CDN serves `backend/public/` as static root. SPA fallback rewrite `/:path*` → `/index.html` resolves correctly within that directory.

3. **tsconfig coverage for api/index.ts** — RESOLVED
   - Resolution: No change to `tsconfig.build.json` needed. Vercel uses `tsconfig.json` (not `tsconfig.build.json`) to compile `api/index.ts` independently. The `nodenext` module setting may require `.js` extensions on first deploy — Plan 03-03 Task 1 documents this as a fallback if the first deploy fails.

4. **Zero-config `src/main.ts` vs explicit `api/index.ts`** — RESOLVED
   - Resolution: D-06 locks the decision to `api/index.ts` for explicit lifecycle control. Zero-config `src/main.ts` detection is documented as a fallback in Plan 03-03 if `api/index.ts` causes issues.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | NestJS runtime | ✓ | v22.17.1 | — |
| npm | Package install | ✓ | 10.9.2 | — |
| Git repo | GitHub integration | ✓ | — (has origin: github.com/nguyennhi0602/nl-to-sql) | — |
| GitHub remote | DEPLOY-04/DEPLOY-05 | ✓ | `origin git@github.com:nguyennhi0602/nl-to-sql.git` | — |
| Vercel CLI | Local `vercel dev` testing | ✗ | — | Deploy directly via Vercel dashboard; or `npm install -g vercel` during setup |
| Vercel account | All DEPLOY-* | Unknown | — | Must create one at vercel.com |
| Neon account / DB | DEPLOY-02/DEPLOY-03 | Unknown | — | Must connect Neon integration in Vercel Marketplace |

**Missing dependencies with no fallback:**
- Vercel account + project: must be created via vercel.com dashboard before any deployment task can succeed
- Neon Postgres database: must be provisioned via Vercel Marketplace (Neon) before `DATABASE_URL` env var is available

**Missing dependencies with fallback:**
- Vercel CLI (v48.4.0+ required for `vercel dev`): optional; can develop/test by deploying directly or mocking with local NestJS server

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest (configured in `backend/package.json`) |
| Config file | `backend/package.json` (jest key) + `backend/test/jest-e2e.json` |
| Quick run command | `cd backend && npm test` |
| Full suite command | `cd backend && npm run test:e2e` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEPLOY-01 | App accessible at Vercel URL, API responds | smoke | `curl https://<vercel-url>/api/schema` | ❌ manual check |
| DEPLOY-02 | History persists across requests in Postgres | integration | `curl POST /api/ask + GET /api/history` | ❌ manual check |
| DEPLOY-03 | No secrets in codebase | manual | `git grep -r "GROQ_API_KEY\|postgres" --include="*.ts"` | ✅ existing files |
| DEPLOY-04 | Push to main triggers deploy | manual | Push commit, observe Vercel dashboard | ❌ dashboard only |
| DEPLOY-05 | PR gets preview URL | manual | Open PR, observe Vercel dashboard | ❌ dashboard only |

### Sampling Rate
- **Per task commit:** `cd backend && npm test` (unit tests, if any exist)
- **Per wave merge:** `cd backend && npm run test:e2e` + manual curl smoke test
- **Phase gate:** All 5 success criteria verified manually before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] No automated tests exist for DEPLOY-01 through DEPLOY-05 — these are infrastructure requirements verifiable only via live deployment
- [ ] Consider a `test/app.e2e-spec.ts` smoke test that verifies `/api/schema` responds when `DATABASE_URL` is present

*(Most DEPLOY-* requirements are verified manually against the live Vercel deployment — this is expected for deployment phases.)*

---

## Security Domain

> `security_enforcement: true` in config.json. ASVS level 1.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Out of scope (CLAUDE.md: auth is future) |
| V3 Session Management | No | No sessions; stateless API |
| V4 Access Control | No | No user roles; single-user app |
| V5 Input Validation | Yes | SQL parameterization via `pool.query(sql, [params])`; NestJS `@Body()` DTO validation |
| V6 Cryptography | No | No passwords or sensitive data stored |
| V9 Communications | Yes (partial) | HTTPS enforced by Vercel CDN; backend never handles raw TLS |

### Known Threat Patterns for NestJS + PostgreSQL

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection in generated SQL | Tampering | The AI generates arbitrary SQL that is executed directly — this is intentional app behavior. The threat is from malformed Groq output, not user input. NL question itself is parameterized in history INSERT. The `execute()` endpoint runs raw SQL — keep as-is, it's for demo purposes. |
| Secrets in code / git | Information Disclosure | GROQ_API_KEY and POSTGRES_URL must be Vercel env vars only; `.env` files must remain in `.gitignore` (already present in `backend/.gitignore`) |
| Vercel env var leakage | Information Disclosure | Never `console.log(process.env)` in production code; confirm no debug logging of full env |

---

## Sources

### Primary (HIGH confidence)
- `https://vercel.com/docs/frameworks/backend/nestjs` (last_updated: 2025-10-28) — NestJS on Vercel: server entrypoint detection, zero-config deployment
- `https://vercel.com/docs/functions/runtimes/node-js` (last_updated: 2025-12-01) — Node.js serverless functions, server entrypoint pattern, TypeScript support
- `https://vercel.com/docs/project-configuration/vercel-json` (last_updated: 2026-03-11) — vercel.json: rewrites, buildCommand, outputDirectory
- `https://vercel.com/docs/functions/limitations` (last_updated: 2026-02-24) — Function size limits (250 MB), file descriptors
- `/tmp/vercel-postgres-check/node_modules/@vercel/postgres/dist/chunk-BZ4XJVIW.cjs` — @vercel/postgres source: env vars (POSTGRES_URL), createPool(), isPooledConnectionString() logic
- `https://neon.com/docs/guides/vercel-native-integration` — Neon env var names injected: DATABASE_URL, DATABASE_URL_UNPOOLED, PGHOST, etc.

### Secondary (MEDIUM confidence)
- `https://vercel.com/docs/storage/vercel-postgres` — Vercel Postgres deprecation confirmation (December 2024)
- `https://evgeniistuditskikh.com/code/building-serverless-apis-with-nestjs-vercel-functions/` — api/index.ts + ExpressAdapter pattern
- `https://dev.to/mahdavipanah/fast-and-simple-nestjs-app-deployment-on-vercel-1lo3` (November 2024) — vercel.json with outputDirectory and rewrites
- `https://nerd-corner.com/lessons-learned-hosting-nestjs-app-on-vercel/` (2025) — Lessons about NestJS + Vercel pitfalls

### Tertiary (LOW confidence)
- NestJS serverless FAQ (docs.nestjs.com/faq/serverless) — singleton caching pattern for cold starts; page rendered as JS, content not extracted; pattern inferred from community sources

---

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM — `@vercel/postgres` package verified; but it's deprecated and last updated 2024-09
- Architecture: MEDIUM — Vercel NestJS entrypoint docs are HIGH confidence; `api/index.ts` pattern from community sources
- Pitfalls: HIGH — env var mismatch (POSTGRES_URL vs DATABASE_URL) verified from source code; pool validation logic verified from source
- DDL equivalents: MEDIUM — standard PostgreSQL knowledge but not validated against live Neon connection

**Research date:** 2026-05-22
**Valid until:** 2026-06-22 (Vercel framework detection is stable; Neon integration details may shift)
