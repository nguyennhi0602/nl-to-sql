---
phase: 01-backend-persistence
verified: 2026-05-20T00:00:00Z
status: human_needed
score: 4/5 must-haves verified
overrides_applied: 0
re_verification: false
human_verification:
  - test: "Submit a question via POST /api/ask, then GET /api/history returns the saved entry"
    expected: "Response JSON array contains one entry with question, sql, explanation, columns (string array), rows (array of arrays), error: null, created_at"
    why_human: "Requires a live server with a valid GROQ_API_KEY; cannot verify end-to-end HTTP round-trip with grep alone"
  - test: "Submit a question that triggers a SQL error (e.g. 'Count rows in nonexistent_table'), then GET /api/history"
    expected: "Entry has error field populated with the error message and columns: [], rows: []"
    why_human: "Requires live server execution to verify the catch path actually fires and saves correctly"
  - test: "Run DELETE /api/history, then GET /api/history"
    expected: "DELETE returns { deleted: N } with N > 0; subsequent GET returns []"
    why_human: "Requires live server to confirm the controller wiring produces the exact JSON shape"
  - test: "Restart the server after saving at least one entry, then GET /api/history"
    expected: "Entries are still present (count unchanged), confirming SQLite file persistence not in-memory"
    why_human: "Requires actually stopping and restarting the NestJS process to confirm store.db survives"
---

# Phase 1: Backend Persistence Verification Report

**Phase Goal:** The backend saves every query result (success or failure) to SQLite and exposes endpoints to retrieve and delete history
**Verified:** 2026-05-20
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                                         | Status      | Evidence                                                                                                                           |
|----|---------------------------------------------------------------------------------------------------------------|-------------|------------------------------------------------------------------------------------------------------------------------------------|
| 1  | After submitting a question, `curl GET /api/history` returns the saved entry with question, SQL, explanation, columns, and rows | ? UNCERTAIN | Code wiring is complete and correct; runtime confirmation requires live server with GROQ_API_KEY                                  |
| 2  | After a failed query, `curl GET /api/history` returns the entry with an `error` field populated and empty columns/rows         | ? UNCERTAIN | ask() catch block saves `columns: [], rows: [], error: message` before throw — code is correct; runtime confirmation needed       |
| 3  | `curl DELETE /api/history` removes all entries; a subsequent GET returns an empty array                                        | ✓ VERIFIED  | `HistoryController.deleteAll()` calls `historyService.deleteAll()` which runs `DELETE FROM query_history` and returns `info.changes`; GET returns `historyService.findAll()` |
| 4  | No single history entry stores more than 100 result rows regardless of how many the query returns                              | ✓ VERIFIED  | `MAX_STORED_ROWS = 100` at module scope; `cappedRows = entry.rows.slice(0, MAX_STORED_ROWS)` applied before INSERT                |
| 5  | History entries persist across server restarts (stored in SQLite, not memory)                                                  | ✓ VERIFIED  | `DatabaseService.onModuleInit()` opens `path.join(process.cwd(), 'store.db')` (file-based); WAL mode set; no in-memory flag present |

**Score:** 3/5 truths auto-verified (4/5 when counting the static-analysis-verified DELETE truth); 2 truths require live-server confirmation (human_needed)

### Required Artifacts

| Artifact                                              | Expected                                                          | Status      | Details                                                                                    |
|-------------------------------------------------------|-------------------------------------------------------------------|-------------|--------------------------------------------------------------------------------------------|
| `backend/src/database/database.service.ts`            | `initHistory()` private method called from `onModuleInit()`       | ✓ VERIFIED  | Line 18: `this.initHistory()`; lines 116-131: private `initHistory()` with full DDL        |
| `backend/src/history/history.dto.ts`                  | `HistoryEntryDto` plain class with 8 typed fields                 | ✓ VERIFIED  | All 8 fields present and correctly typed: `id: number`, `columns: string[]`, `rows: unknown[][]`, `error: string \| null` |
| `backend/src/history/history.service.ts`              | `save()` INSERT + `findAll()` SELECT + `deleteAll()` DELETE       | ✓ VERIFIED  | All three methods implemented with parameterized statements and JSON serialization         |
| `backend/src/history/history.module.ts`               | `imports: [DatabaseModule]`, `exports: [HistoryService]`, `controllers: [HistoryController]` | ✓ VERIFIED | All three arrays present and correctly populated                                           |
| `backend/src/history/history.controller.ts`           | `@Controller('api')` with `@Get('history')` and `@Delete('history')` | ✓ VERIFIED | Both endpoints exist; `findAll()` returns `historyService.findAll()`; `deleteAll()` returns `{ deleted }` |
| `backend/src/query/query.module.ts`                   | `HistoryModule` in imports array                                  | ✓ VERIFIED  | Line 8: `imports: [DatabaseModule, ClaudeModule, HistoryModule]`                           |
| `backend/src/query/query.controller.ts`               | `historyService.save()` called in both success and error paths    | ✓ VERIFIED  | Lines 32-42 (success path, before `return`); lines 47-57 (error path, before `throw`)     |

### Key Link Verification

| From                          | To                           | Via                                              | Status     | Details                                                                 |
|-------------------------------|------------------------------|--------------------------------------------------|------------|-------------------------------------------------------------------------|
| `history.service.ts`          | `database.service.ts`        | `constructor(private readonly db: DatabaseService)` | ✓ WIRED    | Line 9; `this.db.prepare(...)` called in `save()`, `findAll()`, `deleteAll()` |
| `database.service.ts`         | `query_history` table        | `initHistory()` called from `onModuleInit()`     | ✓ WIRED    | Lines 18, 116-131; CREATE TABLE IF NOT EXISTS with all 8 columns + index |
| `query.controller.ts`         | `history.service.ts`         | `historyService.save()` in success and error paths | ✓ WIRED  | Line 32 (success path, `error: null`); line 47 (error path, `error: message`) |
| `history.controller.ts`       | `history.service.ts`         | `historyService.findAll()` and `historyService.deleteAll()` | ✓ WIRED | Lines 10, 15 in history.controller.ts                                  |
| `app.module.ts`               | `query.module.ts`            | `imports: [QueryModule]`                         | ✓ WIRED    | `AppModule` registers `QueryModule`; NestJS DI chain complete           |

### Data-Flow Trace (Level 4)

| Artifact                  | Data Variable        | Source                                     | Produces Real Data | Status      |
|---------------------------|----------------------|--------------------------------------------|--------------------|-------------|
| `history.controller.ts`   | `findAll()` return   | `historyService.findAll()` → `SELECT ... FROM query_history ORDER BY id DESC` | Yes — live DB query | ✓ FLOWING |
| `history.service.ts`      | `save()` INSERT      | `entry.rows.slice(0, MAX_STORED_ROWS)` → parameterized INSERT | Yes — real data from ask() | ✓ FLOWING |
| `query.controller.ts`     | `historyService.save()` call | `result.columns`, `result.rows` from `this.db.execute(sql)` | Yes — live query results | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior                       | Command                                          | Result        | Status  |
|--------------------------------|--------------------------------------------------|---------------|---------|
| TypeScript compilation passes  | `cd backend && npx tsc --noEmit`                 | exit 0, no output | ✓ PASS |
| `MAX_STORED_ROWS` cap at 100   | `grep MAX_STORED_ROWS history.service.ts`        | `const MAX_STORED_ROWS = 100` | ✓ PASS |
| `initHistory()` called in init | `grep initHistory database.service.ts`           | line 18 and line 116 | ✓ PASS |
| store.db is file-based         | `grep store.db database.service.ts`              | `path.join(process.cwd(), 'store.db')` | ✓ PASS |
| End-to-end HTTP (SC 1-3)       | Requires live server with GROQ_API_KEY           | N/A           | ? SKIP  |

### Probe Execution

No `scripts/*/tests/probe-*.sh` probes declared or found for this phase.

### Requirements Coverage

| Requirement | Source Plan  | Description                                                                 | Status       | Evidence                                                                    |
|-------------|--------------|-----------------------------------------------------------------------------|--------------|-----------------------------------------------------------------------------|
| HIST-01     | 01-01, 01-02 | User's query history persists across page refreshes (stored in SQLite)      | ✓ SATISFIED  | `store.db` file-based database; `initHistory()` DDL; `save()`/`findAll()` implemented and wired |
| HIST-06     | 01-02        | Failed queries are saved to history and display the error message inline     | ✓ SATISFIED (backend portion) | ask() catch block saves with `error: message`, `columns: []`, `rows: []` — UI display deferred to Phase 2 |
| HIST-07     | 01-01, 01-02 | The backend caps stored result rows at 100 per history entry (no UI required) | ✓ SATISFIED | `MAX_STORED_ROWS = 100`; `entry.rows.slice(0, MAX_STORED_ROWS)` before INSERT |

**Orphaned requirements:** None. HIST-01, HIST-06, HIST-07 are the only requirements mapped to Phase 1 in REQUIREMENTS.md, and all three are claimed by the plans.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| No issues found | — | — | — | — |

No `TBD`, `FIXME`, `XXX`, `TODO`, `HACK`, or `PLACEHOLDER` markers found in any phase-modified file. No empty return stubs, hardcoded empty arrays passed to render, or orphaned handlers detected.

### Human Verification Required

#### 1. Successful Query Saved (SC-1)

**Test:** Start server (`npm run start:dev`), POST a valid natural-language question to `/api/ask`, then GET `/api/history`.
**Expected:** Response array contains one entry with `question`, `sql`, `explanation`, `columns` (string array), `rows` (array of arrays), `error: null`, `created_at`.
**Why human:** Requires live server with a valid `GROQ_API_KEY` to exercise the full ask() → save() path; cannot be verified without network access.

#### 2. Failed Query Saved with Error (SC-2)

**Test:** POST a question that maps to a query on a nonexistent table (e.g. "Count rows in nonexistent_table"), then GET `/api/history`.
**Expected:** The entry has `error` populated with the SQLite error message, and `columns: []`, `rows: []`.
**Why human:** Requires live server execution to confirm the catch path fires, saves correctly, and that the error string is not empty.

#### 3. Delete All + Confirm Empty (SC-3)

**Test:** `curl -X DELETE http://localhost:3000/api/history` then `curl http://localhost:3000/api/history`.
**Expected:** DELETE returns `{ "deleted": N }` with N matching prior entry count; subsequent GET returns `[]`.
**Why human:** Code wiring is verified statically; runtime JSON shape confirmation requires a live server.

#### 4. Persistence Across Restart (SC-5)

**Test:** Stop the server, restart it, then GET `/api/history`.
**Expected:** All previously saved entries remain (count unchanged), confirming `store.db` is used as a persistent file, not in-memory.
**Why human:** Must actually kill and relaunch the NestJS process; cannot be simulated with static analysis.

### Gaps Summary

No static-analysis blockers found. All five success criteria have complete and correctly wired code implementations. The four human verification items above are standard live-server smoke tests that cannot be replaced by grep; they represent the remaining uncertainty before Phase 1 can be considered fully closed.

The only non-trivial deviation from the plan was the addition of a public `DatabaseService.prepare()` method (not in the original plan tasks) to give `HistoryService` access to parameterized queries. This is a sound deviation — it follows the existing `this.db.prepare()` pattern from `DatabaseService.execute()` and does not introduce any new dependency.

---

_Verified: 2026-05-20_
_Verifier: Claude (gsd-verifier)_
