---
plan: 03-03
phase: 03-vercel-deployment
status: complete
completed: 2026-05-22
self_check: PASSED
key_files:
  created:
    - backend/api/index.ts
    - backend/vercel.json
  modified:
    - backend/tsconfig.json
---

# Plan 03-03 Summary: Vercel Serverless Entry + Deployment Config

## What Was Built

- **`backend/api/index.ts`** — NestJS serverless entry point for Vercel. Bootstraps NestJS once via `ExpressAdapter`, caches via module-level `initPromise` to avoid re-bootstrapping on every request (cold start cost). Exports a default async handler `(req, res)` that awaits `init()` then delegates to the Express app.

- **`backend/vercel.json`** — Deployment configuration:
  - `buildCommand: "npm run build"` — runs `nest build` before deploy
  - `outputDirectory: "public"` — Vercel CDN serves `backend/public/` as static root (resolves RESEARCH.md Assumption A2)
  - Rewrite `/api/:path*` → `/api/index` — all API requests routed to the serverless function
  - Rewrite `/:path*` → `/index.html` — SPA fallback for direct URL access

- **`backend/tsconfig.json`** — Added `"include": ["src/**/*", "api/**/*", "test/**/*"]` so Vercel's TypeScript compiler covers `api/index.ts` alongside the NestJS source.

## Verification

- `npm test` passes: 1 suite, 1 test — no regressions
- `backend/api/index.ts` exists and contains `initPromise` caching pattern
- `backend/vercel.json` exists with correct `outputDirectory` and rewrites

## Deviations

- Import path uses `'../src/app.module'` without `.js` extension (as documented in plan — `.js` extension is the fallback if first deploy fails under `nodenext` module resolution)

## Self-Check: PASSED
