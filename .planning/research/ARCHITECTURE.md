# Architecture Research: Chat History Integration

**Project:** NL-to-SQL
**Researched:** 2026-05-20
**Confidence:** HIGH — Based on direct reading of all existing source files

---

## Module Structure

**Decision: New `history/` module, imported by `QueryModule`.**

```
backend/src/
├── app.module.ts
├── claude/
├── database/
│   └── database.service.ts   ← add history table creation in onModuleInit
├── history/                  ← NEW
│   ├── history.module.ts
│   ├── history.service.ts    ← save() and findAll()
│   └── history.dto.ts
└── query/
    ├── query.module.ts        ← import HistoryModule
    └── query.controller.ts   ← inject HistoryService, add GET /api/history
```

`DatabaseModule` re-imported by `HistoryModule` is not a problem — NestJS DI deduplicates module imports and provides the same `DatabaseService` singleton.

---

## Database Schema

Add one table inside `DatabaseService.onModuleInit()`, called separately from `seed()`:

```sql
CREATE TABLE IF NOT EXISTS query_history (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  question    TEXT    NOT NULL,
  sql         TEXT    NOT NULL,
  explanation TEXT    NOT NULL DEFAULT '',
  columns     TEXT    NOT NULL DEFAULT '[]',   -- JSON array of column names
  rows        TEXT    NOT NULL DEFAULT '[]',   -- JSON array of arrays
  error       TEXT,                            -- NULL on success
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
```

**Single table, not conversations/messages split** — no sessions, no users, no named conversations. Every row IS a complete Q&A atom.

**Store full result JSON** — the demo returns dozens of rows at most; storage cost is kilobytes. Re-executing SQL on page load would return different data if tables changed.

**Failed queries are saved** — when SQL execution throws, save with `error` populated and `columns`/`rows` as empty arrays. History shows failures, which helps debugging.

---

## API Design

### Existing endpoint — behavior unchanged, save added server-side

```
POST /api/ask
Body:    { "question": string }
Response: unchanged — { sql, explanation, columns, rows }
```

`QueryController.ask()` calls `historyService.save(...)` after execution, before returning.

### New endpoints

```
GET    /api/history    → HistoryEntryDto[]  (newest-first from DB, rendered oldest-first in UI)
DELETE /api/history    → clears all history
```

No pagination now — single-user, bounded dataset.

**Response shape:**
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

## Frontend Integration

No framework, no build step — all changes inside existing `<script>` and `<style>` blocks in `index.html`.

### DOM change

```html
<div class="history-feed" id="results">
  <div class="empty-state" id="emptyState">...</div>
  <!-- cards appended here, newest at bottom -->
</div>
```

### New JS functions

```javascript
async function loadHistory() {
  const res = await fetch('/api/history');
  if (!res.ok) return;
  const entries = await res.json();          // newest-first from API
  if (entries.length === 0) return;
  document.getElementById('emptyState').style.display = 'none';
  const feed = document.getElementById('results');
  entries.slice().reverse().forEach(e => appendHistoryCard(feed, e)); // oldest-first render
  feed.scrollTop = feed.scrollHeight;
}

function appendHistoryCard(feed, entry) {
  document.getElementById('emptyState').style.display = 'none';
  const card = document.createElement('div');
  card.className = 'history-card';
  const ts = new Date(entry.created_at).toLocaleString();
  const body = entry.error
    ? `<div class="error-box">Error: ${escHtml(entry.error)}</div>`
    : renderSqlBox(entry.sql, entry.explanation) + renderTable(entry.columns, entry.rows);
  card.innerHTML = `
    <div class="history-card-header">
      <span class="history-question">${escHtml(entry.question)}</span>
      <span class="history-ts">${ts}</span>
    </div>
    ${body}
  `;
  feed.appendChild(card);
}
```

### New CSS

```css
.history-feed { display: flex; flex-direction: column; gap: 1.5rem; overflow-y: auto; flex: 1; }
.history-card { display: flex; flex-direction: column; gap: 0.75rem; padding-bottom: 1.5rem; border-bottom: 1px solid #2d3748; }
.history-card:last-child { border-bottom: none; }
.history-card-header { display: flex; justify-content: space-between; align-items: baseline; gap: 1rem; }
.history-question { font-weight: 600; color: #a78bfa; font-size: 0.95rem; }
.history-ts { font-size: 0.75rem; color: #4a5568; white-space: nowrap; }
```

---

## Data Flow

### New query
```
1. User submits question
2. ask() disables button, shows spinner
3. POST /api/ask { question }
4. QueryController.ask()
   a. db.getSchema()
   b. claude.naturalLanguageToSql(question, schema) → { sql, explanation }
   c. db.execute(sql) → { columns, rows }  (or throws)
   d. historyService.save({ question, sql, explanation, columns, rows, error: null })
   e. return { sql, explanation, columns, rows }
5. appendHistoryCard(feed, data)
6. feed.scrollTop = scrollHeight
7. Re-enable button
```

### Page load
```
1. DOMContentLoaded
2. loadHistory() → GET /api/history
3. historyService.findAll() → SELECT ... ORDER BY id DESC
4. JS reverses array → oldest-first render
5. forEach(appendHistoryCard)
6. feed.scrollTop = scrollHeight
```

---

## Build Order

1. **Schema** — add `CREATE TABLE IF NOT EXISTS query_history` in `DatabaseService`
2. **HistoryService** — `save(dto)` (INSERT) and `findAll()` (SELECT ORDER BY id DESC)
3. **HistoryModule** — import `DatabaseModule`, provide+export `HistoryService`
4. **QueryModule wiring** — import `HistoryModule`, inject into controller, wire `ask()` + add `GET /api/history`
5. **Frontend** — CSS classes, `loadHistory()`, `appendHistoryCard()`, modify `ask()`, call `loadHistory()` at init

**Module dependency graph:**
```
AppModule
  └── QueryModule
        ├── DatabaseModule
        ├── ClaudeModule
        └── HistoryModule
              └── DatabaseModule  (NestJS deduplicates singleton)
```

**Timing guarantee:** `DatabaseService.onModuleInit()` always runs before HTTP connections are accepted — `query_history` table always exists by the time any request reaches `HistoryService`.
