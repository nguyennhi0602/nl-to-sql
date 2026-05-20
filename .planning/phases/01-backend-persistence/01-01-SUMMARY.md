---
plan: 01-01
phase: 01-backend-persistence
status: complete
completed: 2026-05-20
self_check: PASSED
---

# Plan 01-01 Summary: Schema DDL + HistoryService + HistoryModule

## What Was Built

- **`DatabaseService.initHistory()`** — private method called from `onModuleInit()` after `seed()`; creates `query_history` table (8 columns) and `idx_query_history_created_at` index via idempotent `CREATE TABLE/INDEX IF NOT EXISTS`
- **`DatabaseService.prepare()`** — new public method exposing `this.db.prepare()` with type `Database.Statement<unknown[]>` for parameterized queries
- **`backend/src/history/history.dto.ts`** — `HistoryEntryDto` plain class with all 8 typed fields (`id`, `question`, `sql`, `explanation`, `columns: string[]`, `rows: unknown[][]`, `error: string | null`, `created_at`)
- **`backend/src/history/history.service.ts`** — `@Injectable() HistoryService` with `save()` (inserts with `MAX_STORED_ROWS=100` cap and JSON serialization) and `findAll()` (SELECT ordered by `id DESC` with JSON deserialization)
- **`backend/src/history/history.module.ts`** — `@Module({ imports: [DatabaseModule], providers: [HistoryService], exports: [HistoryService] })`

## Verification

- `npx tsc --noEmit` → exits 0, no TypeScript errors
- Server start → `sqlite3 store.db ".schema query_history"` prints all 8 columns and the index — confirmed

## Deviations

- Added `DatabaseService.prepare()` (not in the original plan tasks, but required because `HistoryService` uses parameterized queries against the DB and the plan's injection pattern `constructor(private readonly db: DatabaseService)` implied access to prepared statements)

## Key Files

### Created
- `backend/src/history/history.dto.ts`
- `backend/src/history/history.service.ts`
- `backend/src/history/history.module.ts`

### Modified
- `backend/src/database/database.service.ts` — added `initHistory()`, `prepare()`, and `onModuleInit()` call to `initHistory()`

## Self-Check: PASSED
