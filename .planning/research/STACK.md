# Stack Research: Chat History for NL-to-SQL

**Project:** NL-to-SQL (persistent chat history milestone)
**Researched:** 2026-05-20
**Confidence:** HIGH — findings derived from direct source inspection of the live codebase

---

## Recommended Approach

Store each Q&A turn as a single row in a `query_history` table. Serialize the result columns and rows as JSON text in two TEXT columns. No new dependencies needed — better-sqlite3 already supports `JSON.stringify`/`JSON.parse` round-trips natively.

Do not create a separate rows table. The result data is read-only, append-only, and always accessed as a unit alongside its parent question — normalization adds complexity with zero benefit.

Add a `HistoryModule` (service + controller) that mirrors the existing `QueryModule` pattern: one service method to insert, one to list. Wire the save call into the existing `POST /api/ask` handler so history is always written transparently.

Do not use localStorage as a primary store. Use it only as a page-load optimization (cache the last-fetched list client-side so the page feels instant on refresh), always treating the SQLite backend as the source of truth.

---

## Schema Pattern

```sql
CREATE TABLE IF NOT EXISTS query_history (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  question    TEXT    NOT NULL,
  sql         TEXT    NOT NULL,
  explanation TEXT    NOT NULL DEFAULT '',
  columns     TEXT    NOT NULL DEFAULT '[]',   -- JSON array of column names
  rows        TEXT    NOT NULL DEFAULT '[]',   -- JSON array of arrays
  error       TEXT,                            -- NULL on success, message on failure
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_query_history_created_at
  ON query_history (created_at DESC);
```

**Serialization contract:**
- `columns`: `JSON.stringify(string[])` — e.g. `'["name","city","total"]'`
- `rows`: `JSON.stringify(unknown[][])` — e.g. `'[["Alice","NYC",200]]'`
- `error`: null on success, plain string on failure

**Why single-table:**
- Results are fetched with their parent 100% of the time — no benefit to joining
- Row counts are small (UI query results are display-sized, not analytical exports)
- JSON TEXT in SQLite is fast for reads at this cardinality
- Avoids a second INSERT per result row, keeping the write path atomic

**Migration:** Add the `CREATE TABLE IF NOT EXISTS` call to `DatabaseService.onModuleInit` (after `seed()`). The `IF NOT EXISTS` guard makes it idempotent.

---

## API Pattern

```
GET    /api/history       → list all entries, ordered created_at DESC
DELETE /api/history       → clear all history
```

No `POST /api/history` exposed externally. The save is triggered server-side inside the existing `ask()` handler — inject `HistoryService` into `QueryController`.

**List response shape** (service deserializes JSON columns before returning):

```json
[
  {
    "id": 42,
    "question": "Top 5 products by revenue",
    "sql": "select p.name, sum(...) as revenue ...",
    "explanation": "Returns the five products with the highest total revenue.",
    "columns": ["name", "revenue"],
    "rows": [["Wireless Headphones", 4499.50]],
    "error": null,
    "created_at": "2026-05-20T10:32:11.047Z"
  }
]
```

---

## Frontend Pattern

**On page load:** Call `GET /api/history` and render all entries into `#results` oldest-first (newest at bottom). Replace the empty-state placeholder only if history is truly empty.

**On new query:** After `POST /api/ask` returns, append a new history card to `#results` using the response payload directly. Do not re-fetch the full list.

**localStorage as optional read cache:**
```javascript
async function loadHistory() {
  const cached = localStorage.getItem('nl_sql_history_v1');
  if (cached) renderHistory(JSON.parse(cached));  // instant paint

  const res = await fetch('/api/history');
  const items = await res.json();
  renderHistory(items);
  localStorage.setItem('nl_sql_history_v1', JSON.stringify(items));
}
```

**Rendering:** Reuse existing `renderSqlBox` and `renderTable` helper functions unchanged. Wrap each history entry in a `<div class="history-card">` with the question text as a visible header.

---

## What NOT to Do

- **No `result_rows` child table** — adds a JOIN on every read, gains nothing
- **No localStorage as primary store** — 5-10 MB limit, cleared by privacy settings
- **No separate client-side save call** — desync risk if network fails between ask response and save
- **No TypeORM/Prisma/ORM** — raw better-sqlite3 is consistent with existing codebase
- **No session_id now** — auth is out of scope; add `ALTER TABLE` column later if needed

---

## Confidence

| Recommendation | Confidence | Basis |
|----------------|------------|-------|
| Single `query_history` table with JSON TEXT columns | HIGH | Matches better-sqlite3 pattern; verified against live codebase |
| `JSON.stringify`/`JSON.parse` serialization | HIGH | better-sqlite3 stores TEXT; no library needed |
| Save in `ask` handler server-side | HIGH | Eliminates client-server desync |
| `HistoryModule` mirroring `QueryModule` structure | HIGH | Directly observed pattern in source |
| localStorage as optional read cache only | HIGH | Industry standard; does not affect data integrity |
