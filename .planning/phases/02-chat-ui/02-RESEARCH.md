# Phase 2: Chat UI - Research

**Researched:** 2026-05-21
**Domain:** Vanilla HTML/CSS/JS frontend transformation — chat feed, collapsible cards, history API integration
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Input bar stays pinned at the top (current position) — no layout restructure needed. The history feed scrolls in the content area below it.
- **D-02:** "Clear history" button sits above the feed (between the input section and the history cards). Plain danger-styled button matching the existing visual language.
- **D-03:** Cards are collapsed by default. A collapsed card shows: question text, timestamp, and row-count badge. An expand/collapse toggle (▶/▼ chevron) opens the full card: SQL block + Copy SQL button + explanation + result table.
- **D-04:** The latest card (most recently appended, after a query completes) should auto-expand so the user sees their result immediately. All history-loaded cards from previous sessions start collapsed.
- **D-05:** Error cards follow the same collapsed anatomy. Collapsed view shows question + timestamp + an "Error" badge instead of a row-count badge. Expanded view shows the error message in the existing `.error-box` style.
- **D-06:** On page load, call `GET /api/history`. Entries render oldest-first (reverse the `id DESC` array from the API). After rendering, auto-scroll to bottom so the most recent entry is visible. All loaded cards start collapsed.
- **D-07:** `GET /api/history` returns entries ordered by `id DESC` (newest first). The frontend reverses this to display oldest-first in the feed.
- **D-08:** When the user submits a question, append a minimal placeholder card to the feed immediately — shows the question text and a spinner ("Generating SQL…"). The Ask button also disables. When the response arrives, replace the placeholder card with the real result card and auto-expand it. Auto-scroll to the new card.
- **D-09:** Use `window.confirm('Clear all history?')` for the confirmation step — browser native dialog, no custom UI needed. On confirm: call `DELETE /api/history`, then clear the feed DOM.
- **D-10:** Human-readable format: "May 21, 2026 14:32" using `Date.toLocaleString` with explicit options (month long, day numeric, year numeric, hour/minute 2-digit). No third-party library.
- **D-11:** Plain HTML/CSS/JS only — no framework, no build step. Edits to `public/index.html` take effect immediately.
- **D-12:** Zero new npm dependencies.

### Claude's Discretion

- Exact CSS for the collapsed vs expanded card states (should match existing dark theme: `#1a1f2e` card bg, `#2d3748` borders, `#7c3aed` accent)
- Whether the chevron toggle is on the left or right of the question text
- Exact wording of the spinner label ("Generating SQL…" or similar)
- Row-count badge styling in collapsed view (reuse `.row-count` class from existing table header if possible)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HIST-02 | Each new Q&A result appends to the history feed instead of replacing it | Append-card DOM pattern; replace `results.innerHTML =` overwrites with feed append |
| HIST-03 | Each history entry displays a timestamp (human-readable format) | `Date.toLocaleString` with explicit locale options; `created_at` string from DTO |
| HIST-04 | The viewport automatically scrolls to the latest entry after each new query | `scrollIntoView({ behavior: 'smooth' })` on newest card element |
| HIST-05 | A per-message loading state (spinner) displays while the AI is generating SQL | Placeholder card with existing `.spinner` CSS; removed and replaced on response |
| HIST-08 | Each history card has a "Copy SQL" button that copies the generated SQL to clipboard | Reuse existing `copyText(text, btn)` function inside expanded card body |
| HIST-09 | Each history card's result table displays the row count (e.g. "42 rows") | `.card-badge` in collapsed header; existing `rows.length` pattern from `renderTable()` |
| HIST-10 | A "Clear history" button deletes all history entries after user confirmation | `window.confirm`, `DELETE /api/history`, DOM clear — all defined in D-09 |
</phase_requirements>

---

## Summary

Phase 2 is a single-file frontend transformation. All work lives in `backend/public/index.html` — no backend changes, no new dependencies, no build tooling. The current page replaces the `#results` div on every query (`results.innerHTML = ...`); this phase converts that div into a persistent feed that accumulates `.history-card` elements across queries and page loads.

The phase is low-risk technically: every required UI capability (spinner, copy button, error box, table, SQL box) is already implemented as reusable CSS classes and JS functions in the existing file. The implementation task is primarily structural — introducing the `.history-card` / `.history-card-body` collapsible anatomy, a `loadHistory()` function that calls `GET /api/history` on page load, and a `clearHistory()` function. The biggest surgical change is refactoring the `ask()` function from "replace innerHTML" to "append card and replace placeholder".

The UI-SPEC.md provides a complete visual contract: every new CSS class is named, every interaction is sequenced, and all copywriting is pinned. Research confirms all decisions are consistent with the existing codebase and no contradictions exist between CONTEXT.md, UI-SPEC.md, and the live source files.

**Primary recommendation:** Implement in two logical units — (1) CSS additions and card HTML templates, (2) JS: `loadHistory()`, refactored `ask()`, and `clearHistory()`. Both units touch only `index.html`.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Chat feed rendering | Browser/Client | — | Pure DOM — no server-side rendering in this stack |
| History data fetch on load | Browser/Client | API/Backend | Client calls `GET /api/history`; backend already built in Phase 1 |
| Per-query persistence | API/Backend | — | Already handled by `QueryController.ask()` save calls; frontend reads, never writes |
| Collapsible card toggle | Browser/Client | — | CSS class toggle + aria attribute; no server involvement |
| In-flight placeholder state | Browser/Client | — | DOM append/replace pattern local to `ask()` |
| Clear history | Browser/Client + API/Backend | — | Client triggers `DELETE /api/history`; backend executes delete |
| Timestamp formatting | Browser/Client | — | `Date.toLocaleString` in JS; `created_at` string provided by API |
| XSS safety | Browser/Client | — | `escHtml()` function already present; must be applied to all user content |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vanilla JS (ES2020+) | Browser-native | DOM manipulation, fetch API, event handlers | D-11/D-12 — no framework; all needed APIs are browser-native |
| Vanilla CSS | Browser-native | Collapsible card states, transitions, layout | D-11 — no build step; CSS class toggle is the collapse mechanism |

[VERIFIED: live codebase] — no external JS libraries are loaded in `index.html`; the file uses no `<script src>` tags pointing to CDNs.

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `Date.toLocaleString` | Browser-native | Timestamp formatting | Format `created_at` from API into "May 21, 2026 14:32" (D-10) |
| `navigator.clipboard.writeText` | Browser-native | Copy SQL to clipboard | Already used in `copyText()` helper — reuse without change |
| `scrollIntoView` | Browser-native | Auto-scroll to latest card | `{ behavior: 'smooth' }` per CONTEXT.md specifics |
| `window.confirm` | Browser-native | Clear history confirmation | D-09 — native browser dialog, no custom UI |
| `fetch` | Browser-native | `GET /api/history` and `DELETE /api/history` | Already used in `ask()` — same pattern for `loadHistory()` and `clearHistory()` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `Date.toLocaleString` | `Intl.DateTimeFormat` | Both are standard; `toLocaleString` with explicit options is simpler for a one-off format and was explicitly chosen in D-10 |
| Inline `onclick` attribute on card header | `addEventListener` in `loadHistory()` | `addEventListener` is cleaner but requires traversal after innerHTML injection; inline `onclick` is consistent with existing patterns in `buildExamples()` and `loadSchema()` — either is acceptable, project convention leans inline |
| CSS class toggle for expand/collapse | `details`/`summary` HTML elements | `details`/`summary` would be simpler but doesn't allow the exact card anatomy (chevron placement, badge in header, aria attributes) specified in UI-SPEC.md; class toggle is the right choice here |

**Installation:** No installation step — zero new dependencies.

---

## Package Legitimacy Audit

Not applicable — D-12 mandates zero new npm dependencies. No packages to audit.

---

## Architecture Patterns

### System Architecture Diagram

```
Page Load
    |
    v
loadHistory() ──► GET /api/history ──► HistoryController.findAll()
    |                                        |
    |                                        v
    |                              HistoryService.findAll()
    |                                        |
    |                            [ id DESC from SQLite ]
    |                                        |
    v                                        v
reverse array ◄──────────────── HistoryEntryDto[]
    |
    v
for each entry: buildHistoryCard(entry, collapsed=true)
    |
    v
append to #results (.history-feed)
    |
    v
lastCard.scrollIntoView({ behavior: 'smooth' })

─────────────────────────────────────────────

User Submit
    |
    v
ask() ─► disable #askBtn ─► append placeholderCard ─► POST /api/ask
                                  (spinner visible)         |
                                                            v
                                                    response (success/error)
                                                            |
                    ┌───────────────────────────────────────┤
                    v                                       v
            buildHistoryCard(data, expanded=true)   buildErrorCard(data, expanded=true)
                    |                                       |
                    v                                       v
            replace placeholderCard              replace placeholderCard
                    |                                       |
                    └──────────────┬────────────────────────┘
                                   v
                    newCard.scrollIntoView({ behavior: 'smooth' })
                    re-enable #askBtn

─────────────────────────────────────────────

Clear History
    |
    v
window.confirm('Clear all history?')
    |
    ├── cancelled ──► no action
    |
    └── confirmed ──► DELETE /api/history ──► HistoryController.deleteAll()
                            |
                            v
                      clear #results innerHTML
                      show .empty-state
                      hide .clear-history-btn
```

### Recommended Project Structure

This phase modifies one file only:

```
backend/public/
└── index.html       ← only file changed
    ├── <style>      ← add new CSS classes (history-card anatomy)
    ├── <body>       ← add .clear-history-btn button, rename #results
    └── <script>     ← add loadHistory(), clearHistory(); refactor ask()
```

### Pattern 1: Card HTML Template (innerHTML string assembly)

**What:** Build card HTML as a string using template literals, then inject via `innerHTML`. Mirrors the existing `renderSqlBox()` and `renderTable()` patterns.

**When to use:** Every time a `HistoryEntryDto` needs to become a DOM element — both in `loadHistory()` (batch) and in the `ask()` success path (single).

**Example:**
```javascript
// Source: [ASSUMED] — mirrors existing renderSqlBox/renderTable pattern in index.html
function buildHistoryCard(entry, expanded) {
  const rowCount = (entry.columns && entry.columns.length > 0)
    ? entry.rows.length
    : null;
  const badgeHtml = entry.error
    ? `<span class="card-badge error">Error</span>`
    : `<span class="card-badge">${rowCount} row${rowCount !== 1 ? 's' : ''}</span>`;

  const bodyHtml = entry.error
    ? `<div class="error-box">${escHtml(entry.error)}</div>`
    : `${renderSqlBox(entry.sql, entry.explanation)}${renderTable(entry.columns, entry.rows)}`;

  const ts = new Date(entry.created_at).toLocaleString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false
  });

  const div = document.createElement('div');
  div.className = 'history-card' + (expanded ? ' expanded' : '');
  div.innerHTML = `
    <div class="history-card-header"
         aria-expanded="${expanded}"
         aria-label="Toggle result"
         onclick="this.closest('.history-card').classList.toggle('expanded');
                  this.setAttribute('aria-expanded',
                    this.closest('.history-card').classList.contains('expanded'))">
      <svg class="card-chevron" aria-hidden="true" width="14" height="14"
           viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
      <span class="card-question">${escHtml(entry.question)}</span>
      <span class="card-timestamp">${escHtml(ts)}</span>
      ${badgeHtml}
    </div>
    <div class="history-card-body">${bodyHtml}</div>
  `;
  return div;
}
```

### Pattern 2: Placeholder Card (in-flight state)

**What:** A non-expandable card appended immediately on submit, removed when response arrives.

**When to use:** Start of `ask()` function, before the `fetch` call.

**Example:**
```javascript
// Source: [ASSUMED] — per CONTEXT.md D-08 and UI-SPEC.md .placeholder-card spec
function buildPlaceholderCard(question) {
  const div = document.createElement('div');
  div.className = 'placeholder-card';
  div.innerHTML = `
    <span class="card-question">${escHtml(question)}</span>
    <span class="spinner"></span>
    <span style="font-size:0.75rem;color:#718096">Generating SQL…</span>
  `;
  return div;
}
```

### Pattern 3: loadHistory() initialization

**What:** Called at page init alongside `loadSchema()` and `buildExamples()`. Fetches, reverses, renders, scrolls.

**When to use:** Once on page load.

**Example:**
```javascript
// Source: [ASSUMED] — per D-06, D-07, UI-SPEC.md Page Load Sequence
async function loadHistory() {
  try {
    const res = await fetch('/api/history');
    const entries = await res.json(); // id DESC from API
    entries.reverse();               // oldest-first for display

    const feed = document.getElementById('results');
    if (entries.length === 0) return; // keep .empty-state

    feed.innerHTML = ''; // clear empty-state
    entries.forEach(e => feed.appendChild(buildHistoryCard(e, false)));

    document.querySelector('.clear-history-btn').style.display = 'block';
    feed.lastElementChild?.scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    console.error('loadHistory failed:', err);
  }
}
```

### Anti-Patterns to Avoid

- **Overwriting `results.innerHTML` on new query:** The current `ask()` function does `results.innerHTML = ...` — this wipes the entire feed. Replace with placeholder-append pattern.
- **Using `renderSqlBox()` / `renderTable()` without wrapping in card body:** These functions return raw HTML strings for direct injection. Inside cards, inject their output into `.history-card-body` container only.
- **Calling `escHtml()` inside `renderSqlBox()` and `renderTable()` again on already-escaped content:** Both helpers already call `escHtml` internally. Pass raw strings, not pre-escaped strings.
- **Not reverting button text correctly:** Existing `ask()` restores `btn.textContent = 'Ask Claude'` (line 530) but the button label is `'Query'`. This is a pre-existing bug — the refactored `ask()` must restore `btn.textContent = 'Query'` (matching the HTML button label on line 418). [VERIFIED: live codebase — confirmed by inspection of index.html lines 418 and 530]
- **Attaching event listeners with `addEventListener` in a loop during loadHistory:** Each card built by `buildHistoryCard` uses an inline `onclick` attribute. This is consistent with existing sidebar pattern. Do not mix styles.
- **Appending to the wrong container:** The feed container is `#results`. The `buildHistoryCard` result (a DOM element) must be appended with `feed.appendChild(card)`, not `feed.innerHTML +=` (which re-parses all existing HTML and destroys event handlers).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Clipboard write | Custom `execCommand('copy')` | `navigator.clipboard.writeText` (already in `copyText()`) | `execCommand` is deprecated; `clipboard.writeText` is the standard |
| Timestamp formatting | Custom date string concat | `Date.toLocaleString` with explicit locale options (D-10) | Handles locale, DST, padding automatically |
| XSS prevention | Manual string replacement | `escHtml()` already in file | `escHtml` covers all 4 vectors (`&`, `<`, `>`, `"`); hand-rolled replacements routinely miss `"` |
| Smooth scroll | CSS `scroll-behavior` + `scrollTop` arithmetic | `scrollIntoView({ behavior: 'smooth' })` | Native, works with dynamic content height |
| Confirmation dialog | Custom modal UI | `window.confirm` (D-09) | Zero implementation cost; explicitly chosen |

**Key insight:** Every UI primitive this phase needs is already in the browser or already in `index.html`. The implementation is assembly, not invention.

---

## Common Pitfalls

### Pitfall 1: `results.innerHTML =` vs. `.appendChild()`
**What goes wrong:** Any code path that sets `results.innerHTML = ...` destroys all existing card DOM nodes, wiping the history feed.
**Why it happens:** The current `ask()` function has three `results.innerHTML = ...` assignments (lines 503, 515-520, 522-525) plus the catch block (line 527). All must be converted.
**How to avoid:** Remove all `results.innerHTML =` in `ask()`. Replace with: append placeholder, on response remove placeholder and append real card.
**Warning signs:** After a second query, first query card disappears.

### Pitfall 2: Wrong button label on restore
**What goes wrong:** The existing `ask()` finally block restores `btn.textContent = 'Ask Claude'` (line 530) but the button HTML reads `Query` (line 418). A naive copy-and-refactor preserves the wrong restore value.
**Why it happens:** Pre-existing bug in the current file — label and restore value are out of sync.
**How to avoid:** Restore `btn.textContent = 'Query'` in the refactored finally block. [VERIFIED: live codebase]
**Warning signs:** After any query, button reads "Ask Claude" instead of "Query".

### Pitfall 3: `innerHTML +=` destroys event handlers
**What goes wrong:** `feed.innerHTML += newCardHtml` re-serializes and re-parses the entire feed, losing all onclick handlers on previously rendered cards (they become dead HTML strings).
**Why it happens:** `+=` on innerHTML is a common shortcut that works only for static content.
**How to avoid:** Use `feed.appendChild(cardElement)` where `cardElement` is a real DOM element built with `document.createElement`.
**Warning signs:** Clicking a card header that was rendered in a previous session (loaded from history) does nothing — inline `onclick` still fires, but any `addEventListener` attachments would be lost.

### Pitfall 4: Double-escaping user content
**What goes wrong:** Calling `escHtml(escHtml(str))` produces visible `&amp;lt;` in the rendered output.
**Why it happens:** `renderSqlBox()` and `renderTable()` already call `escHtml()` internally. If the caller also pre-escapes, the content is double-escaped.
**How to avoid:** Always pass raw strings to `renderSqlBox()` and `renderTable()`. Only call `escHtml()` directly when building card header content (question, timestamp) outside those helpers.
**Warning signs:** SQL containing `<` or `>` renders as `&lt;` or `&gt;` in the expanded SQL block.

### Pitfall 5: History load before DOM is ready
**What goes wrong:** `loadHistory()` runs before `#results` is in the DOM, so `document.getElementById('results')` returns null and the append fails silently.
**Why it happens:** If `loadHistory()` call is placed before the closing `</body>` during script restructuring.
**How to avoid:** `loadHistory()` call site must stay alongside `loadSchema()` and `buildExamples()` at the bottom of the script block, which runs after DOM is parsed. The current pattern is correct — maintain it.
**Warning signs:** Console error "Cannot read properties of null (reading 'appendChild')".

### Pitfall 6: `GET /api/history` error response not handled
**What goes wrong:** If the history API is down on page load, `res.json()` throws or returns non-array, causing a crash that breaks the page before the user even types a query.
**Why it happens:** No try/catch around `loadHistory()` fetch.
**How to avoid:** Wrap entire `loadHistory()` body in try/catch; on error, log and return silently. The feed stays in its empty-state — query functionality is unaffected.
**Warning signs:** Page loads but input section disappears due to uncaught exception.

### Pitfall 7: `DELETE /api/history` called without awaiting
**What goes wrong:** The DOM clears before the delete completes. If the user refreshes immediately, history is still present.
**Why it happens:** Forgetting `await` on the `fetch` call inside `clearHistory()`.
**How to avoid:** `clearHistory()` must be `async` and `await fetch('/api/history', { method: 'DELETE' })`.
**Warning signs:** On slow connections, history reappears after refresh despite clicking "Clear".

---

## Code Examples

Verified patterns from live source:

### Existing `renderTable()` — returns HTML string with row count badge
```javascript
// Source: index.html line 547-580 [VERIFIED: live codebase]
function renderTable(columns, rows) {
  if (!columns || columns.length === 0) {
    return `<div class="table-wrap"><div style="padding:1rem;color:#718096;font-size:.88rem">Query executed — no rows returned.</div></div>`;
  }
  return `
  <div class="table-wrap">
    <div class="table-wrap-header">
      <span>Results</span>
      <span class="row-count">${rows.length} row${rows.length !== 1 ? 's' : ''}</span>
    </div>
    ...
  </div>`;
}
```

### Existing `copyText()` — copy-to-clipboard helper
```javascript
// Source: index.html line 583-587 [VERIFIED: live codebase]
function copyText(text, btn) {
  navigator.clipboard.writeText(text);
  btn.textContent = 'Copied!';
  setTimeout(() => (btn.textContent = 'Copy'), 1500);
}
```

### Existing async fetch pattern to model `loadHistory()` on
```javascript
// Source: index.html line 455-479 [VERIFIED: live codebase]
async function loadSchema() {
  const res = await fetch('/api/schema');
  const tables = await res.json();
  const container = document.getElementById('schemaContainer');
  container.innerHTML = tables.map(...).join('');
  container.querySelector('.table-card')?.classList.add('open');
}
```

### HistoryEntryDto shape (confirmed from live source)
```typescript
// Source: backend/src/history/history.dto.ts [VERIFIED: live codebase]
export class HistoryEntryDto {
  id: number;
  question: string;
  sql: string;
  explanation: string;
  columns: string[];   // JSON.parse'd by HistoryService.findAll()
  rows: unknown[][];   // JSON.parse'd by HistoryService.findAll()
  error: string | null;
  created_at: string;  // ISO 8601 string from SQLite CURRENT_TIMESTAMP
}
```

### API error path shape (confirmed from live source)
```typescript
// Source: backend/src/query/query.controller.ts line 58 [VERIFIED: live codebase]
// On SQL execution error, ask() returns HTTP 422 with body:
{ sql: string, explanation: string, error: string }
// columns and rows are NOT in the 422 body — the frontend must default them to []
```

### Date formatting (D-10)
```javascript
// Source: [ASSUMED] — built from D-10 spec and UI-SPEC.md .card-timestamp definition
new Date(entry.created_at).toLocaleString('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
});
// Output: "May 21, 2026 14:32"
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `results.innerHTML = ...` (replace on every query) | Append-to-feed pattern | This phase | History feed accumulates; page load restores prior session |
| No history load on page start | `loadHistory()` on init | This phase | Past queries visible on refresh |
| No in-flight state beyond button disable | Placeholder card with spinner | This phase | User sees visual confirmation of submitted question |
| No clear-history action | `DELETE /api/history` + DOM clear | This phase | User can reset the feed |

**Deprecated/outdated:**
- `results.innerHTML =` assignments in `ask()`: replaced by placeholder card lifecycle pattern — three occurrences must be removed.
- `btn.textContent = 'Ask Claude'` in `ask()` finally: pre-existing stale label — corrected to `'Query'`.

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on This Phase |
|-----------|---------------------|
| Tech Stack: NestJS + TypeScript (backend), plain HTML/CSS/JS (frontend) — no React/Vue | Confirmed: all work is in `index.html`, no framework |
| Frontend: No build step — edits to `public/index.html` take effect immediately | Confirmed: no transpilation, no bundler |
| No TypeORM/Prisma/ORM — raw better-sqlite3 | Not applicable to frontend phase |
| No localStorage as primary store | Not applicable — history is stored in SQLite (Phase 1 complete) |
| No separate client-side save call | Confirmed: save happens server-side in `QueryController.ask()` |

---

## Runtime State Inventory

> This is not a rename/refactor/migration phase. This section is SKIPPED.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Backend server | ✓ | v22.17.1 | — |
| Browser (any modern) | All frontend JS APIs used | ✓ (dev) | — | — |
| `GET /api/history` endpoint | `loadHistory()` | ✓ (Phase 1 complete) | — | Graceful: empty feed |
| `DELETE /api/history` endpoint | `clearHistory()` | ✓ (Phase 1 complete) | — | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

---

## Validation Architecture

> `workflow.nyquist_validation: true` in config.json — section included.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest (NestJS default) |
| Config file | `backend/package.json` (jest config in package.json) |
| Quick run command | `cd backend && npm test` |
| Full suite command | `cd backend && npm run test:e2e` |

**Note on test coverage for this phase:** Phase 2 is entirely a frontend HTML/CSS/JS change. The NestJS Jest suite tests TypeScript backend modules; it has no DOM access and cannot test `index.html` directly. The existing e2e spec tests `GET /` (the served HTML page) but only checks HTTP 200 — it does not assert on DOM content.

Meaningful validation for this phase is **manual visual/functional testing** of the browser. Automated test coverage for frontend-only DOM behavior in a vanilla HTML/JS project with no build step requires either (a) a browser automation tool (Playwright/Cypress) — out of scope per D-12 — or (b) extracting JS logic into importable modules — not the project's pattern. All HIST requirements in this phase are therefore **manual-only**.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HIST-02 | New query appends card instead of replacing feed | manual-only | n/a — DOM test, no test harness | ❌ Wave 0 gap noted |
| HIST-03 | Timestamp shows in "Month DD, YYYY HH:MM" format | manual-only | n/a | ❌ |
| HIST-04 | Viewport scrolls to latest card after query | manual-only | n/a | ❌ |
| HIST-05 | Spinner placeholder card appears on submit | manual-only | n/a | ❌ |
| HIST-08 | Copy SQL button copies SQL to clipboard | manual-only | n/a | ❌ |
| HIST-09 | Row count badge shows correct N | manual-only | n/a | ❌ |
| HIST-10 | Clear history button deletes and clears feed | manual-only | n/a | ❌ |

### Sampling Rate
- **Per task commit:** `cd backend && npm test` (unit suite — backend only, guards against regressions in Phase 1 code)
- **Per wave merge:** Manual browser verification checklist
- **Phase gate:** All 7 HIST requirements verified manually in browser before `/gsd:verify-work`

### Wave 0 Gaps
- No new test files need to be created for this phase — the deliverable is a visual frontend transformation that requires manual browser verification. The existing `npm test` backend suite must remain green throughout (regression guard for Phase 1 code).

---

## Security Domain

> `security_enforcement: true`, `security_asvs_level: 1` in config.json.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Out of scope (no auth in v1) |
| V3 Session Management | No | Out of scope |
| V4 Access Control | No | Out of scope |
| V5 Input Validation / Output Encoding | **Yes** | `escHtml(str)` — already present and must be applied to all user-visible content from history entries |
| V6 Cryptography | No | No crypto in this phase |

### Known Threat Patterns for Vanilla JS / innerHTML

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Stored XSS via question text in history | Tampering / Information Disclosure | `escHtml()` on `entry.question` before injecting into card header |
| Stored XSS via error message in history | Tampering | `escHtml()` on `entry.error` before injecting into `.error-box` |
| Stored XSS via SQL in history | Tampering | `escHtml()` already called inside `renderSqlBox()` — do not double-escape |
| Stored XSS via explanation text | Tampering | `escHtml()` already called inside `renderSqlBox()` — do not double-escape |
| XSS via timestamp string | Tampering | `escHtml()` on the formatted timestamp string — low risk (comes from `Date.toLocaleString`) but good practice |

**Critical enforcement rule:** Every field from `HistoryEntryDto` that reaches `innerHTML` MUST pass through `escHtml()` unless it is already handled by `renderSqlBox()` or `renderTable()`. The fields handled directly in card header HTML are: `question`, formatted timestamp. These are the two new injection points introduced by this phase.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `Date.toLocaleString('en-US', { ... hour12: false })` produces `"May 21, 2026 14:32"` (with no AM/PM) | Code Examples | If the browser ignores `hour12: false` in 'en-US' locale, time shows as "02:32 PM" — cosmetic only; D-10 format is still met in spirit |
| A2 | `buildHistoryCard` using `document.createElement` + `.innerHTML` for inner content is consistent with project DOM patterns | Architecture Patterns | No risk — createElement is always safe; the alternative (innerHTML +=) was explicitly listed as anti-pattern |
| A3 | The `ask()` error path returns `{ sql, explanation, error }` at HTTP 422 with no `columns`/`rows` fields | Code Examples | Confirmed by `query.controller.ts` line 58 [VERIFIED] — no assumption, but frontend must default to `[]` for columns/rows |

**Confirmed non-assumptions (verified):**
- Button label is `'Query'` not `'Ask Claude'` — VERIFIED line 418
- `btn.textContent = 'Ask Claude'` restore is a pre-existing bug — VERIFIED lines 418 vs 530
- `GET /api/history` returns `id DESC` — VERIFIED `history.service.ts` findAll() query
- `columns` and `rows` are already JSON.parse'd by `findAll()` before returning — VERIFIED `history.service.ts` lines 55-58
- Phase 1 persistence and DELETE endpoints are complete and verified — VERIFIED `01-02-SUMMARY.md`

---

## Open Questions

1. **Singular/plural for "1 row" badge**
   - What we know: `renderTable()` already implements `rows.length !== 1 ? 's' : ''` for "1 row" / "N rows"
   - What's unclear: Whether `.card-badge` in the collapsed header should follow the same singular/plural rule
   - Recommendation: Yes — reuse the same `rows.length !== 1 ? 's' : ''` pattern for consistency. UI-SPEC.md copywriting table says `"N row" / "N rows"` with singular/plural notation, confirming this is expected.

2. **`ask()` error response — what to show in collapsed badge when `columns` is absent**
   - What we know: HTTP 422 from `ask()` returns `{ sql, explanation, error }` with no `columns` or `rows`. The card body shows `.error-box`. The collapsed badge should show "Error" (D-05).
   - What's unclear: Nothing — D-05 explicitly resolves this.
   - Recommendation: No open question. Detected no ambiguity.

---

## Sources

### Primary (HIGH confidence)
- `backend/public/index.html` — live source; all reusable assets, existing patterns, and the pre-existing bug verified by direct file inspection [VERIFIED: live codebase]
- `backend/src/history/history.controller.ts` — confirmed `GET /api/history` and `DELETE /api/history` endpoints [VERIFIED: live codebase]
- `backend/src/history/history.service.ts` — confirmed `findAll()` returns `id DESC` with JSON.parse'd columns/rows [VERIFIED: live codebase]
- `backend/src/history/history.dto.ts` — confirmed HistoryEntryDto shape [VERIFIED: live codebase]
- `backend/src/query/query.controller.ts` — confirmed error path shape `{ sql, explanation, error }` at HTTP 422 [VERIFIED: live codebase]
- `.planning/phases/02-chat-ui/02-CONTEXT.md` — all decisions D-01 through D-12 [VERIFIED: planning artifact]
- `.planning/phases/02-chat-ui/02-UI-SPEC.md` — complete component inventory, interaction contract, copywriting contract [VERIFIED: planning artifact]
- `.planning/phases/01-backend-persistence/01-02-SUMMARY.md` — Phase 1 completion confirmed [VERIFIED: planning artifact]

### Secondary (MEDIUM confidence)
- `Date.toLocaleString` with `hour12: false` — standard MDN-documented API; behavior is well-defined but locale rendering can vary by browser/OS

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies; all APIs are browser-native or already in codebase
- Architecture: HIGH — single-file change with fully specified component inventory in UI-SPEC.md
- Pitfalls: HIGH — pre-existing bugs confirmed by direct file inspection; DOM pitfalls are well-understood vanilla JS territory

**Research date:** 2026-05-21
**Valid until:** 2026-06-21 (stable — no external dependencies to drift)
