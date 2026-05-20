---
phase: 01-backend-persistence
reviewed: 2026-05-20T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - backend/src/database/database.service.ts
  - backend/src/history/history.controller.ts
  - backend/src/history/history.dto.ts
  - backend/src/history/history.module.ts
  - backend/src/history/history.service.ts
  - backend/src/query/query.controller.ts
  - backend/src/query/query.module.ts
findings:
  critical: 3
  warning: 4
  info: 2
  total: 9
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-05-20T00:00:00Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Seven files covering the backend persistence layer were reviewed: the database service, history module (controller, service, DTO, module), and query module (controller, module). The overall structure is clean and the parameterized-insert pattern is correctly applied for all history writes. However, three critical issues exist: an unauthenticated, bulk-destructive DELETE endpoint with no guard; raw arbitrary SQL execution exposed as an unauthenticated HTTP endpoint; and a SQL injection vector via unparameterized `PRAGMA table_info(name)` in the schema introspection path. Four warnings cover missing input validation plumbing, a silent swallow of JSON parse errors, an inconsistent sort order between `save` and `findAll`, and overly broad CORS. Two info items cover a DTO that carries no runtime enforcement and a `console.error` debug artifact.

---

## Critical Issues

### CR-01: Unauthenticated Bulk-Delete Endpoint Permanently Destroys All History

**File:** `backend/src/history/history.controller.ts:13`

**Issue:** `DELETE /api/history` issues `DELETE FROM query_history` with no authorization guard, no soft-delete, no confirmation token, and no rate-limit. Because the project stores conversation history as its core value ("their full query history is always there when they come back"), a single accidental or malicious HTTP call wipes all persistent data with no recovery path. Although auth is out of scope for this phase, an unguarded destructive endpoint on a tool with no auth at all is a data-loss risk that ships with the feature.

**Fix:** At minimum, require an explicit `?confirm=true` query parameter so accidental calls (e.g., browser pre-fetch, errant client bug) cannot silently destroy data. If the single-user constraint holds permanently, a process-restart guard or a `TRUNCATE`-behind-flag pattern is safer than a bare DELETE with no friction:

```typescript
@Delete('history')
deleteAll(@Query('confirm') confirm: string) {
  if (confirm !== 'true') {
    throw new HttpException(
      'Pass ?confirm=true to delete all history',
      HttpStatus.BAD_REQUEST,
    );
  }
  const deleted = this.historyService.deleteAll();
  return { deleted };
}
```

---

### CR-02: Arbitrary SQL Execution Endpoint Exposed Without Any Guard

**File:** `backend/src/query/query.controller.ts:62-73`

**Issue:** `POST /api/execute` accepts a raw SQL string from the HTTP request body and executes it directly against the SQLite database via `this.db.execute(dto.sql)`. There is no authentication, no authorization, no allow-list, and no read-only enforcement. Any client (or attacker who can reach the port) can issue `DROP TABLE customers`, `DELETE FROM query_history`, `PRAGMA writable_schema=ON`, or any other destructive statement. The `execute` method in `DatabaseService` also calls `stmt.run()` for non-reader statements, so DML and DDL both succeed.

This endpoint appears to exist for a "manual SQL" UI feature. Even in a single-user context, exposing unrestricted DDL/DML over HTTP is a security vulnerability — any tab on the machine, any XSS in any other page, any misconfigured reverse proxy can reach it.

**Fix:** If this endpoint is needed for the UI, restrict it to read-only queries at the service level:

```typescript
// database.service.ts — read-only execute variant
executeReadOnly(sql: string): { columns: string[]; rows: unknown[][] } {
  const stmt = this.db.prepare(sql);
  if (!stmt.reader) {
    throw new Error('Only SELECT queries are allowed via executeReadOnly');
  }
  const rows = stmt.all() as Record<string, unknown>[];
  if (rows.length === 0) return { columns: [], rows: [] };
  const columns = Object.keys(rows[0]);
  return { columns, rows: rows.map((r) => columns.map((c) => r[c])) };
}
```

Replace `this.db.execute(dto.sql)` in the controller with `this.db.executeReadOnly(dto.sql)`.

---

### CR-03: SQL Injection in `getSchema()` via Unparameterized `PRAGMA table_info`

**File:** `backend/src/database/database.service.ts:155`

**Issue:** `getSchema()` iterates over table names returned by `sqlite_master` and builds the PRAGMA string by direct string interpolation:

```typescript
this.db.prepare(`PRAGMA table_info(${name})`)
```

`better-sqlite3` does not support parameterized PRAGMA calls, so this pattern is unavoidable for legitimate table names — however, the table names themselves come from `sqlite_master`, which an attacker can influence: if an attacker can cause a table to be created with a crafted name (e.g., via the `POST /api/execute` endpoint identified in CR-02) containing a closing parenthesis and injected SQL, the PRAGMA string becomes injectable. The combined CR-02 + CR-03 chain allows full exploitation. Even standalone, the correct defensive posture is to validate that each `name` matches `[A-Za-z_][A-Za-z0-9_]*` before interpolating it.

**Fix:** Add a table-name allowlist check before interpolation:

```typescript
const safeName = /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : null;
if (!safeName) throw new Error(`Unsafe table name encountered: ${name}`);
const columns = this.db
  .prepare(`PRAGMA table_info(${safeName})`)
  .all() as { name: string; type: string; notnull: number; pk: number }[];
```

---

## Warnings

### WR-01: No Runtime Validation on `AskDto` or `ExecuteDto` — Validation Guard Is Not Wired

**File:** `backend/src/query/query.dto.ts:1-7` / `backend/src/main.ts`

**Issue:** `AskDto` and `ExecuteDto` are plain classes with no `class-validator` decorators, and `main.ts` does not register a `ValidationPipe`. The null-checks in the controller (`!dto?.question?.trim()`) partially compensate, but they do not enforce types. If `question` is sent as a non-string JSON value (e.g., `{"question": 12345}`), `dto.question.trim()` will throw a runtime `TypeError` that bypasses the HttpException path and returns a 500 instead of a 400. The same applies to `dto.sql`.

**Fix:** Either register a global `ValidationPipe` with `class-validator` decorators on the DTOs, or add an explicit `typeof` check before calling `.trim()`:

```typescript
if (typeof dto?.question !== 'string' || !dto.question.trim()) {
  throw new HttpException('question must be a non-empty string', HttpStatus.BAD_REQUEST);
}
```

---

### WR-02: Silent JSON.parse Failure in `findAll()` Corrupts All History on Bad Row

**File:** `backend/src/history/history.service.ts:57-58`

**Issue:** `findAll()` calls `JSON.parse(r.columns)` and `JSON.parse(r.rows)` on every row with no try/catch. If any single history row has a malformed `columns` or `rows` value in the database (caused by a bug, a direct DB edit, or a future code change), `JSON.parse` throws and the entire `GET /api/history` endpoint returns a 500 error, wiping out the user's view of all history — not just the bad row. Because the `query_history` table has `NOT NULL DEFAULT '[]'` on both columns, a truncation or encoding error during save could silently produce un-parseable text.

**Fix:** Wrap the parse with a fallback so one bad row does not break the entire response:

```typescript
return raw.map((r) => ({
  ...r,
  columns: (() => { try { return JSON.parse(r.columns) as string[]; } catch { return []; } })(),
  rows: (() => { try { return JSON.parse(r.rows) as unknown[][]; } catch { return []; } })(),
}));
```

Or, preferably, add a private `safeParse` helper in the service.

---

### WR-03: Sort Order Inconsistency — `save` Uses `AUTOINCREMENT` but `findAll` Sorts by `id DESC` While Schema Index Is on `created_at DESC`

**File:** `backend/src/history/history.service.ts:52` / `backend/src/database/database.service.ts:129`

**Issue:** `initHistory()` creates `idx_query_history_created_at ON query_history (created_at DESC)` to optimize sorting by timestamp. But `findAll()` sorts by `ORDER BY id DESC`, which does not use that index. This is a minor inconsistency now, but the more important problem is that the index was created to support a `created_at`-based sort and the query ignores it entirely. If history rows are ever bulk-imported or inserted out of chronological order, `id DESC` and `created_at DESC` will diverge and present results in the wrong order to the user. The design intent (show newest first) should be enforced by `created_at DESC` consistently, and the index should match the query.

**Fix:** Change the query in `findAll()` to `ORDER BY created_at DESC` so it matches the index and the semantic intent, or drop the index and keep `ORDER BY id DESC` — but pick one and be consistent.

---

### WR-04: `app.enableCors()` Permits All Origins With No Restriction

**File:** `backend/src/main.ts:6`

**Issue:** `app.enableCors()` with no options sets `Access-Control-Allow-Origin: *`, which allows any web page on any origin to call `POST /api/execute` (raw SQL execution) and `DELETE /api/history` in the user's browser context. Given that CR-01 and CR-02 are open, a malicious third-party page loaded in any tab on the user's machine can silently wipe history or exfiltrate all data.

**Fix:** Restrict CORS to the actual frontend origin. For a local single-user tool, `localhost` origins suffice:

```typescript
app.enableCors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
});
```

---

## Info

### IN-01: `HistoryEntryDto` Has No Runtime Enforcement

**File:** `backend/src/history/history.dto.ts:1-10`

**Issue:** `HistoryEntryDto` is a plain TypeScript class with no `class-transformer` decorators and is not used as a NestJS validation target anywhere. It provides only compile-time type safety for the `findAll()` return value. The name "Dto" implies it participates in NestJS's request/response pipeline, but it does not. This is a naming confusion that will mislead future contributors.

**Fix:** Rename to `HistoryEntryResult` or `HistoryEntry` to signal it is an internal result shape, not a validated transport DTO. Alternatively, add `@Expose()` decorators and use `ClassSerializerInterceptor` if output serialization is desired.

---

### IN-02: `console.error` Debug Artifacts in Production Path

**File:** `backend/src/query/query.controller.ts:41`, `backend/src/query/query.controller.ts:56`

**Issue:** `console.error('History save failed (success path):', saveErr)` and its sibling on the error path are the only error telemetry for history save failures. While better than silently swallowing the error, raw `console.error` in a NestJS service should use the framework's `Logger` to allow log-level control, structured output, and interception by log aggregators.

**Fix:** Inject NestJS `Logger` and use it:

```typescript
import { Logger } from '@nestjs/common';

private readonly logger = new Logger(QueryController.name);

// then:
this.logger.error('History save failed (success path)', saveErr);
```

---

_Reviewed: 2026-05-20T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
