---
plan: 01-02
phase: 01-backend-persistence
status: complete
completed: 2026-05-20
self_check: PASSED
---

# Plan 01-02 Summary: QueryController Wiring + HistoryController GET/DELETE

## What Was Built

- **`QueryModule`** — now imports `HistoryModule` alongside `DatabaseModule` and `ClaudeModule`
- **`QueryController.ask()`** — saves every result (success and failure) to `query_history` before returning; save failures are non-fatal (logged via `console.error`, never propagated to caller)
- **`HistoryService.deleteAll()`** — new method; runs `DELETE FROM query_history` and returns `info.changes`
- **`HistoryController`** — `@Controller('api')` with `@Get('history')` returning `HistoryEntryDto[]` and `@Delete('history')` returning `{ deleted: N }`
- **`HistoryModule`** — updated to register `HistoryController` in `controllers` array

## Verification

Human-verified all 5 success criteria:
1. ✓ `curl GET /api/history` returns saved entry with question, SQL, explanation, columns, rows
2. ✓ Failed query entry has `error` populated and `columns: [], rows: []`
3. ✓ `curl DELETE /api/history` returns `{ deleted: N }` and subsequent GET returns `[]`
4. ✓ Row cap is enforced (MAX_STORED_ROWS=100 in Plan 01-01)
5. ✓ Entries persist across server restart (SQLite, not in-memory)

## Deviations

None — implementation matches plan exactly.

## Key Files

### Created
- `backend/src/history/history.controller.ts`

### Modified
- `backend/src/query/query.controller.ts` — added `historyService` injection + save calls in both paths
- `backend/src/query/query.module.ts` — added `HistoryModule` to imports
- `backend/src/history/history.service.ts` — added `deleteAll()` method
- `backend/src/history/history.module.ts` — added `controllers: [HistoryController]`

## Self-Check: PASSED
