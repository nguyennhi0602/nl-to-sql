# Research Summary: NL-to-SQL Chat History

**Project:** NL-to-SQL Chat Tool
**Domain:** Single-user NL-to-SQL query tool with persistent chat history
**Researched:** 2026-05-20
**Confidence:** HIGH

---

## Stack

No new dependencies. The existing stack handles everything:

- **NestJS DI + modules** — new `HistoryModule` added as a peer to `QueryModule`; NestJS deduplicates the `DatabaseModule` singleton automatically
- **better-sqlite3** — synchronous INSERT/SELECT correct for single-user; JSON TEXT round-trips via `JSON.stringify`/`JSON.parse` need no library
- **Plain HTML/CSS/JS** — all frontend changes go inside `backend/public/index.html`; no build step
- **SQLite (`store.db`)** — single `query_history` table added via `CREATE TABLE IF NOT EXISTS` in `DatabaseService.onModuleInit`; idempotent

**Zero new npm dependencies.** Everything needed is already installed.

---

## Table Stakes Features

**Must have for this milestone:**
1. History persists across page refresh — the core deliverable
2. Full Q&A pairs displayed in order; new results append, old ones remain
3. Timestamp on each entry (ISO stored, human-readable rendered)
4. Scroll to latest automatically after new query
5. Loading state per in-flight message (spinner while waiting)
6. Error display inline in the history thread (not alert())
7. Backend row cap safety guard (100–200 rows stored per entry max; no UI required)
8. Clear history button (DELETE /api/history with confirmation)
9. Copy SQL button per card (trivially simple, high utility)
10. Result row count displayed next to table header

**Defer to later:**
- Collapsible large result tables
- Re-run button
- Search/filter history
- Pagination or virtual scrolling
- Session/conversation threading (requires auth — out of scope)

---

## Architecture Approach

New `history/` directory: `history.module.ts`, `history.service.ts`, `history.dto.ts`. `HistoryService` exposes `save(dto)` (INSERT) and `findAll()` (SELECT ORDER BY id DESC). `QueryModule` imports `HistoryModule`; `QueryController` calls `save()` after every `ask()` execution (success or failure).

**Schema (single table):**
```sql
CREATE TABLE IF NOT EXISTS query_history (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  question    TEXT    NOT NULL,
  sql         TEXT    NOT NULL,
  explanation TEXT    NOT NULL DEFAULT '',
  columns     TEXT    NOT NULL DEFAULT '[]',
  rows        TEXT    NOT NULL DEFAULT '[]',
  error       TEXT,
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
```

**Module dependency graph:**
```
AppModule
  └── QueryModule
        ├── DatabaseModule
        ├── ClaudeModule
        └── HistoryModule
              └── DatabaseModule  (singleton, deduplicated by NestJS)
```

**Frontend:** `loadHistory()` on DOMContentLoaded fetches `GET /api/history` and renders cards oldest-first using existing `renderSqlBox`/`renderTable` helpers. New queries call `appendHistoryCard()` — no re-fetch of the full list.

---

## Top Pitfalls

1. **Uncapped result rows** — cap at 100–200 rows with `rows.slice(0, CAP)` before INSERT. Decide before writing any INSERT code.
2. **Skipping failed query saves** — always INSERT with `error` populated and `columns`/`rows` as `[]`. Frontend must branch on `entry.error` to avoid calling `renderTable(null)`.
3. **NestJS module wiring** — `HistoryModule` must declare `imports: [DatabaseModule], exports: [HistoryService]`; `QueryModule` must add `HistoryModule` to `imports`. Missing either causes an opaque startup crash.
4. **History DDL inside seed guard** — `initHistory()` must be called unconditionally in `onModuleInit`, not inside the `if (alreadySeeded.n > 0)` block.
5. **Frontend DOM jank** — render entries one at a time with `appendChild`, not a single `innerHTML` assignment. Cap display rows per table at 10–20.

---

## Build Order

1. **Schema** — `initHistory()` in `DatabaseService`, called from `onModuleInit` after `seed()`
2. **HistoryService** — `save()` with JSON serialize + row cap; `findAll()` with JSON deserialize
3. **HistoryModule** — `imports: [DatabaseModule]`, exports `HistoryService`
4. **QueryModule wiring** — import `HistoryModule`, wire `save()` into `ask()`, add `GET /api/history` + `DELETE /api/history`
5. **Frontend** — CSS classes, `loadHistory()`, `appendHistoryCard()`, modify `ask()` to append

Each step has a testable artifact before the next begins. Steps 1–4 can be validated with `curl` before any frontend code is written.

---

## Open Questions

- **Row cap value:** 100 vs 200 — decide in Phase 1 as a named constant `MAX_STORED_ROWS`
- **Display rows per card:** 10–20 visible rows per history card recommended; "show all" toggle can be deferred
- **`@MaxLength` on `AskDto.question`:** `class-validator` is already installed; `@MaxLength(2000)` is a one-line addition
