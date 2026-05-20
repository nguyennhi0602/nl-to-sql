# Pitfalls Research: Chat History

**Project:** NL-to-SQL — adding persistent chat history
**Researched:** 2026-05-20
**Confidence:** HIGH — all findings grounded in direct codebase inspection

---

## Pitfall 1: Unbounded Result Set Storage Bloats store.db

**Risk**: `DatabaseService.execute()` returns every row with no limit. Serializing `rows: unknown[][]` as JSON can create multi-KB blobs per history entry. A cartesian join or full table scan could produce entries that are individually harmless but cumulatively make the history table expensive to scan.

**Warning signs**: `store.db` grows disproportionately; GET /api/history becomes slow after ~50 entries; slow page parse with many DOM nodes.

**Prevention**: Cap stored rows at a fixed limit (100 recommended) before inserting. Slice `rows.slice(0, 100)` and store a `truncated: boolean` flag. Write queries (INSERT/UPDATE/DELETE) already return only 2 values — no cap needed there.

**Phase**: History table schema design — decide the cap before writing any INSERT code.

---

## Pitfall 2: Saving Failed Queries Without a Status Column

**Risk**: The existing `/api/ask` controller throws `HttpException(UNPROCESSABLE_ENTITY)` on SQL execution failure. History-save logic placed naively will either (a) skip failed entries — silently dropping history — or (b) insert them with `columns: null` / `rows: null`, causing `TypeError` in `renderTable()` on page load when it tries to call `.map()` on null.

**Warning signs**: Questions missing from history after errors; `TypeError: Cannot read properties of null` in browser console; error-status entries render as "0 rows".

**Prevention**: Always save failed entries with `error` populated and `columns`/`rows` as empty arrays `[]`. Frontend load path must branch on presence of `error` field to show error-box styling instead of calling `renderTable`.

**Phase**: History table schema design and history-save controller logic — must be decided together.

---

## Pitfall 3: History Table Lives in store.db and Disappears on Re-Seed Reset

**Risk**: `DatabaseService.seed()` uses `CREATE TABLE IF NOT EXISTS` with an `if (alreadySeeded.n > 0)` guard for rows. If history DDL is placed adjacent to `seed()`, deleting `store.db` to reset e-commerce data silently deletes all history too.

**Warning signs**: History disappears after a developer "resets" the database.

**Prevention**: Add `query_history` `CREATE TABLE IF NOT EXISTS` in a dedicated `initHistory()` private method in `DatabaseService`, called from `onModuleInit` separately from `seed()`. Do NOT place history DDL inside the `if (alreadySeeded.n > 0)` block — that guard is for seed data rows, not schema.

**Phase**: NestJS module integration and HistoryService initialisation.

---

## Pitfall 4: NestJS Module Wiring Fails Silently Until Startup

**Risk**: Two common mistakes:
1. `HistoryModule` doesn't import `DatabaseModule` → `Nest can't resolve dependencies of HistoryService (?)`
2. `QueryController` injects `HistoryService` but `QueryModule` doesn't import `HistoryModule` → same error

**Warning signs**: Application fails to start entirely with `Nest can't resolve dependencies` error.

**Prevention**: Follow existing pattern exactly:
- `HistoryModule` → `imports: [DatabaseModule]`, `exports: [HistoryService]`
- `QueryModule` → add `HistoryModule` to `imports`

Write the module dependency graph before coding: `QueryModule` → `HistoryModule` → `DatabaseModule`.

**Phase**: NestJS module wiring — must be done before writing any service injection.

---

## Pitfall 5: Frontend Re-Renders Entire History Synchronously on Page Load

**Risk**: Building one giant HTML string and assigning it to `results.innerHTML` creates thousands of DOM nodes synchronously. With `white-space: nowrap` on `td`, multiple result tables trigger browser layout recalculation — perceptible jank after ~30 entries.

**Warning signs**: Page feels sluggish on load after many history entries; Chrome DevTools shows "Layout" task >50 ms.

**Prevention**:
- Render at most 10–20 rows per history entry table (collapsible "show all" for large results)
- Append entries one at a time with `insertAdjacentHTML` rather than one giant innerHTML swap
- Fetch only the most recent 20–50 entries on page load

**Phase**: Frontend chat-style UI rendering — row cap decision must align with backend API.

---

## Pitfall 6: NULL and Buffer Values Break JSON Round-Trips for Result Rows

**Risk**: `better-sqlite3` maps BLOB columns to `Buffer`. `JSON.stringify(Buffer.from('abc'))` produces `{"type":"Buffer","data":[...]}` — on deserialization you get a plain object, not the original value. The seeded schema has no BLOBs, but a user querying SQLite system tables could encounter one. `BigInt` (if `safeIntegers: true` is ever added) throws `TypeError: Do not know how to serialize a BigInt`.

**Warning signs**: Blob data renders as `[object Object]`; `TypeError` in NestJS logs.

**Prevention**: Add a `sanitiseRow(row: unknown[]): unknown[]` helper before any `JSON.stringify`: convert `Buffer` → `"[BLOB]"`; convert `BigInt` → `String(value)`; pass everything else as-is. Low immediate risk on the seeded schema; medium risk if bring-your-own-database is added later.

**Phase**: History data serialization layer, alongside history INSERT logic.

---

## Pitfall 7: No Length Cap on Stored Question Text

**Risk**: `AskDto` only validates that `question` is non-empty. No max length. A very long question gets stored verbatim and may cause Groq API errors, creating a history entry with failure status but a valid (large) question field.

**Warning signs**: Groq returning 400 errors; history entries larger than expected.

**Prevention**: Add `@MaxLength(2000)` to `AskDto.question` via `class-validator`. Wire `ValidationPipe` globally in `main.ts` if not already present. One decorator, prevents the Groq call and history save from seeing oversized input.

**Phase**: DTO validation — can be added during history feature work.

---

## Summary

**Top 3 most important things to watch for:**

1. **Cap stored result rows before writing any INSERT code** (Pitfall 1). Every other pitfall is a recoverable schema mistake; uncapped result storage compounds with every query and is painful to migrate away from. Decide on 100 rows max before the first line of history code.

2. **Always save failed queries; branch on `error` field in frontend** (Pitfall 2). Only saving on success silently drops history and sets up a `TypeError` on the next page load. The schema must support nullable `error` TEXT before any data is inserted.

3. **Write out the NestJS module dependency graph before coding** (Pitfall 4). `HistoryModule` → imports `DatabaseModule`, exports `HistoryService`. `QueryModule` → imports `HistoryModule`. Three lines. The startup error NestJS gives when this is wrong is correct but takes time to diagnose.
