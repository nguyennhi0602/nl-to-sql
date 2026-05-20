# Phase 1: Backend Persistence - Context

**Gathered:** 2026-05-20
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase adds persistent chat history to the NestJS backend. Deliverables: a `query_history` SQLite table, a `HistoryModule` (service + controller), server-side save on every `ask()` call (success and failure), and two new REST endpoints — `GET /api/history` and `DELETE /api/history`. No frontend changes in this phase.

Requirements in scope: HIST-01 (history persists across page refresh), HIST-06 (failed queries saved), HIST-07 (row cap at 100).

</domain>

<decisions>
## Implementation Decisions

### Failed Query Persistence
- **D-01:** Always save history entries including failures. When SQL execution throws, save the entry with `error` field populated and `columns`/`rows` as empty arrays `[]`. Partial saves (Groq succeeded but SQLite execution failed) are also saved.

### Save Failure Handling
- **D-02:** History save failure is non-fatal. If `HistoryService.save()` throws (SQLite write error), log to `console.error` and return the query result to the user anyway. The user's primary request (getting data) is not blocked by a storage failure.

### Endpoint Location
- **D-03:** Create a dedicated `HistoryController` in `backend/src/history/history.controller.ts`. `GET /api/history` and `DELETE /api/history` live there — not bolted onto `QueryController`. Keeps query-related and history-related concerns in separate files.

### Pre-decided (from project setup)
- **D-04:** Row cap constant `MAX_STORED_ROWS = 100`. Slice `rows.slice(0, MAX_STORED_ROWS)` before INSERT. No UI indication of truncation in Phase 1.
- **D-05:** Zero new npm dependencies. All needed packages (better-sqlite3, NestJS DI) already installed.
- **D-06:** History DDL lives in a dedicated `initHistory()` private method in `DatabaseService`, called unconditionally from `onModuleInit()` AFTER `seed()`. NOT inside the `if (alreadySeeded.n > 0)` guard.
- **D-07:** `HistoryModule` declares `imports: [DatabaseModule], exports: [HistoryService]`. `QueryModule` adds `HistoryModule` to its `imports` array. `QueryController` injects `HistoryService`.
- **D-08:** Store `columns` and `rows` as separate JSON TEXT columns (not a combined blob) for future flexibility. Serialize with `JSON.stringify`, deserialize in `HistoryService.findAll()` before returning.

### Claude's Discretion
- Exact NestJS DTO shape for history response — follow existing `AskDto`/`ExecuteDto` pattern (plain class, no validators since `class-validator` is not set up)
- Column name choices for `query_history` table — follow snake_case convention used in existing seeded tables
- Whether to use `@Delete('history')` on controller or a more specific path — keep consistent with REST conventions

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Source Files (read before creating analogous new files)
- `backend/src/database/database.module.ts` — pattern for module that exports a service; `HistoryModule` must mirror this
- `backend/src/database/database.service.ts` — `onModuleInit` pattern, `seed()` structure, `better-sqlite3` usage, `CREATE TABLE IF NOT EXISTS` idiom
- `backend/src/query/query.module.ts` — how to import and consume external modules; `HistoryModule` goes into `imports` here
- `backend/src/query/query.controller.ts` — existing `ask()` handler to modify; inject `HistoryService` and wire `save()` call
- `backend/src/query/query.dto.ts` — DTO pattern (plain class, no validators) to replicate for `HistoryEntryDto`
- `backend/src/app.module.ts` — top-level module; no changes expected but read to understand the full graph
- `backend/src/main.ts` — bootstrap; no `ValidationPipe` present, no changes expected

### Planning Artifacts
- `.planning/REQUIREMENTS.md` — HIST-01, HIST-06, HIST-07 requirement text
- `.planning/research/ARCHITECTURE.md` — detailed module structure, schema, API design, data flow, and build order
- `.planning/research/STACK.md` — JSON serialization approach, API shape, what NOT to do
- `.planning/research/PITFALLS.md` — top pitfalls: row cap before INSERT, always save failures, module wiring order, DDL outside seed guard

No external specs — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `DatabaseService` (already injectable via `DatabaseModule`) — `HistoryService` uses it for INSERT and SELECT via `this.db.prepare(...)`
- `better-sqlite3` synchronous API — all existing DB calls are synchronous; `HistoryService` follows the same pattern, no async needed
- `@Get`, `@Post`, `@Delete`, `@Body`, `@Controller` decorators from `@nestjs/common` — already in use; `HistoryController` imports the same set

### Established Patterns
- **Module pattern**: `@Module({ imports: [...], providers: [...], exports: [...], controllers: [...] })` — copy `DatabaseModule` shape for `HistoryModule`
- **Service injection**: `constructor(private readonly db: DatabaseService)` — same pattern as `ClaudeService` and `QueryController`
- **plain class DTOs**: no `class-validator` decorators — match `AskDto`/`ExecuteDto` exactly
- **`CREATE TABLE IF NOT EXISTS` in `onModuleInit`**: idempotent DDL, safe on every restart — same approach as `seed()`
- **`stmt.reader` branching**: existing `execute()` branches on read vs write — `HistoryService` does not call `execute()`; it uses its own `prepare()` calls

### Integration Points
- `QueryController.ask()` — add `historyService.save(...)` in both the success path (after `db.execute(sql)`) and the catch block (with error populated), wrapped in try/catch so save failure never propagates
- `QueryModule.imports` — add `HistoryModule` alongside existing `DatabaseModule` and `ClaudeModule`
- `DatabaseService.onModuleInit()` — add `this.initHistory()` call after `this.seed()`

</code_context>

<specifics>
## Specific Ideas

- Response shape for `GET /api/history`: `{ id, question, sql, explanation, columns: string[], rows: unknown[][], error: string | null, created_at: string }[]` — `HistoryService.findAll()` deserializes JSON before returning so the controller and frontend always see native arrays
- `DELETE /api/history` deletes ALL history entries (no per-entry delete in Phase 1). Returns `{ deleted: number }` with the row count.
- SQLite timestamp: `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')` — ISO 8601 with milliseconds, consistent with research recommendation

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. Frontend changes are Phase 2.

</deferred>

---

*Phase: 01-backend-persistence*
*Context gathered: 2026-05-20*
