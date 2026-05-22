# Phase 3: Vercel Deployment - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-22
**Phase:** 3-vercel-deployment
**Areas discussed:** Local dev after migration, Postgres client & pooling

---

## Local Dev After Migration

| Option | Description | Selected |
|--------|-------------|----------|
| Neon dev branch | Point local .env at a Neon development database — same DB engine as prod, no local install | |
| Local Postgres via Docker | Run Postgres in a Docker container locally | |
| Keep SQLite for local only | Use better-sqlite3 locally, @vercel/postgres in production | ✓ |

**User's choice:** Keep SQLite for local only
**Notes:** Avoids requiring any local Postgres setup; local dev workflow unchanged.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Environment variable flag | Single DatabaseService, branches on DATABASE_URL presence | ✓ |
| Two separate DatabaseService classes | SqliteDatabaseService + PostgresDatabaseService via factory | |
| You decide | Leave branching strategy to planner | |

**User's choice:** Environment variable flag
**Notes:** One service, two driver paths — simpler to maintain than two classes.

---

| Option | Description | Selected |
|--------|-------------|----------|
| DATABASE_URL presence | If DATABASE_URL is set → Postgres; absent → SQLite | ✓ |
| NODE_ENV=production | Use Postgres when NODE_ENV is production | |

**User's choice:** DATABASE_URL presence
**Notes:** Idiomatic; works with Vercel's auto-injected POSTGRES_URL aliased to DATABASE_URL.

---

## Postgres Client & Pooling

| Option | Description | Selected |
|--------|-------------|----------|
| @vercel/postgres | Vercel-native, serverless-safe pooling via Neon HTTP driver, auto-reads POSTGRES_URL | ✓ |
| pg (node-postgres) | Standard client, portable, but manual pool management risky in serverless | |

**User's choice:** @vercel/postgres
**Notes:** Zero config on Vercel; handles connection exhaustion automatically.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Seed on first boot | onModuleInit checks if customers table is empty — inserts once | ✓ |
| One-time seed script | Separate npm script run manually after provisioning | |

**User's choice:** Seed on first boot
**Notes:** Same pattern as existing SQLite seed guard; safe to run on every cold start.

---

## Claude's Discretion

- NestJS serverless shape: single catch-all `api/index.ts` vs split per-endpoint functions
- TypeScript compilation strategy for `api/index.ts`
- Exact `vercel.json` routing rules
- Connection pool settings for `@vercel/postgres`
- Whether `ServeStaticModule` stays in the serverless function or gets removed

## Deferred Ideas

None — discussion stayed within phase scope.
