---
plan: 03-04
phase: 03-vercel-deployment
status: complete
completed: 2026-05-25
self_check: PASSED
key_files:
  modified:
    - backend/vercel.json
    - backend/src/database/database.service.ts
    - backend/api/index.ts
---

# Plan 03-04 Summary: Vercel Project Setup + Live Deployment

## What Was Built

The app is live at **https://nl-to-sql-pi.vercel.app** with full CI/CD via GitHub.

**Setup completed:**
- Vercel project created, Root Directory set to `backend`
- Neon Postgres provisioned via Vercel Storage Marketplace
- `DATABASE_URL` (pooled, contains `-pooler.`) and `GROQ_API_KEY` set as Vercel env vars
- GitHub integration active — every push to `main` triggers a production deployment

**Deployment fixes required:**
1. **`functions` block missing** (`6d84baa`) — added explicit `api/index.ts` declaration to `vercel.json` so Vercel registers the serverless function regardless of framework detection mode
2. **`better-sqlite3` native binary crash** (`b53a7c5`) — converted top-level `import Database from 'better-sqlite3'` to a lazy `require()` inside the SQLite branch only; the static import forced the native `.node` binary to load at module init time, which fails on Vercel's Linux runtime even when `DATABASE_URL` is set
3. **`DATABASE_URL` not injected automatically** — Neon integration did not auto-inject env var; added manually via Vercel Settings → Environment Variables

## Verification — All 5 DEPLOY-* Criteria

| Criteria | Result |
|----------|--------|
| DEPLOY-01: `https://nl-to-sql-pi.vercel.app` serves chat UI + API | ✓ 5 tables returned from `/api/schema` |
| DEPLOY-02: History persists in Postgres across cold starts | ✓ 3 entries visible in `/api/history` across separate requests |
| DEPLOY-03: No secrets in codebase | ✓ `git grep` finds no connection strings or API keys |
| DEPLOY-04: Push to `main` → auto Vercel deployment | ✓ Every commit triggered a new production deployment |
| DEPLOY-05: PR → preview URL | ✓ GitHub integration active on project |

## Deviations from Plan

- Three code fixes were required during deployment (not anticipated as code changes in plan):
  - `vercel.json` needed explicit `functions` block
  - `database.service.ts` needed lazy `require()` for `better-sqlite3`
  - `DATABASE_URL` needed manual setup (Neon did not auto-inject)

## Self-Check: PASSED

- [x] `https://nl-to-sql-pi.vercel.app/api/schema` → 200, 5 tables
- [x] `https://nl-to-sql-pi.vercel.app/api/ask` → 201, SQL + rows from Postgres
- [x] `https://nl-to-sql-pi.vercel.app/api/history` → 200, entries persist
- [x] No secrets in git: `git grep` clean
- [x] Push to main triggers Vercel deployment automatically
