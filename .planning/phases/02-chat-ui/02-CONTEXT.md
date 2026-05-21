# Phase 2: Chat UI - Context

**Gathered:** 2026-05-21
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase transforms the frontend from a single replace-in-place result panel into a scrollable chat feed. All work is in `backend/public/index.html` — zero backend changes. On page load the feed calls `GET /api/history` and renders past entries. Each new `POST /api/ask` appends a card to the feed without clearing previous ones. The feed supports: timestamps, collapsible card anatomy, per-message loading state, Copy SQL, row count, and Clear history.

Requirements in scope: HIST-02, HIST-03, HIST-04, HIST-05, HIST-06 (display), HIST-08, HIST-09, HIST-10.

</domain>

<decisions>
## Implementation Decisions

### Layout
- **D-01:** Input bar stays pinned at the **top** (current position) — no layout restructure needed. The history feed scrolls in the content area below it.
- **D-02:** "Clear history" button sits **above the feed** (between the input section and the history cards). Plain danger-styled button matching the existing visual language.

### Card Anatomy
- **D-03:** Cards are **collapsed by default**. A collapsed card shows: question text, timestamp, and row-count badge. An expand/collapse toggle (▶/▼ chevron) opens the full card: SQL block + Copy SQL button + explanation + result table.
- **D-04:** The **latest card** (most recently appended, after a query completes) should auto-expand so the user sees their result immediately. All history-loaded cards from previous sessions start collapsed.
- **D-05:** Error cards (failed queries from Phase 1) follow the same collapsed anatomy. Collapsed view shows question + timestamp + an "Error" badge instead of a row-count badge. Expanded view shows the error message in the existing `.error-box` style.

### History Loading
- **D-06:** On page load, call `GET /api/history`. Entries render **oldest-first** (reverse the `id DESC` array from the API). After rendering, **auto-scroll to bottom** so the most recent entry is visible. All loaded cards start collapsed.
- **D-07:** `GET /api/history` returns entries ordered by `id DESC` (newest first). The frontend reverses this to display oldest-first in the feed.

### In-Flight State (HIST-05)
- **D-08:** When the user submits a question, **append a minimal placeholder card** to the feed immediately — shows the question text and a spinner ("Generating SQL…"). The Ask button also disables. When the response arrives, replace the placeholder card with the real result card and auto-expand it. Auto-scroll to the new card.

### Clear History (HIST-10)
- **D-09:** Use `window.confirm('Clear all history?')` for the confirmation step — browser native dialog, no custom UI needed. On confirm: call `DELETE /api/history`, then clear the feed DOM.

### Timestamp Format (HIST-03)
- **D-10:** Human-readable format: `"May 21, 2026 14:32"` using `Date.toLocaleString` with explicit options (month long, day numeric, year numeric, hour/minute 2-digit). No third-party library.

### Pre-decided (carried from Phase 1 / project setup)
- **D-11:** Plain HTML/CSS/JS only — no framework, no build step. Edits to `public/index.html` take effect immediately.
- **D-12:** Zero new npm dependencies.

### Claude's Discretion
- Exact CSS for the collapsed vs expanded card states (should match existing dark theme: `#1a1f2e` card bg, `#2d3748` borders, `#7c3aed` accent)
- Whether the chevron toggle is on the left or right of the question text
- Exact wording of the spinner label ("Generating SQL…" or similar)
- Row-count badge styling in collapsed view (reuse `.row-count` class from existing table header if possible)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Source Files to Modify
- `backend/public/index.html` — the only file changed in this phase; read in full before editing

### API Contracts (from Phase 1)
- `backend/src/history/history.controller.ts` — `GET /api/history` returns `HistoryEntryDto[]` ordered `id DESC`; `DELETE /api/history` returns `{ deleted: N }`
- `backend/src/history/history.dto.ts` — response shape: `{ id, question, sql, explanation, columns: string[], rows: unknown[][], error: string|null, created_at: string }`

### Planning Artifacts
- `.planning/REQUIREMENTS.md` — HIST-02 through HIST-10 requirement text
- `.planning/ROADMAP.md` — Phase 2 success criteria (6 items)
- `.planning/phases/01-backend-persistence/01-02-SUMMARY.md` — what Phase 1 built; confirms GET/DELETE endpoints are live

No external specs — all decisions captured above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`.spinner` CSS + `@keyframes spin`** — already defined in `index.html`; use for placeholder card spinner
- **`.sql-box` + `.sql-box-header` + `pre`** — existing SQL display block; reuse inside expanded card
- **`.explanation` div** — existing explanation style; reuse inside expanded card
- **`.table-wrap` + `.table-wrap-header` + `.row-count` badge** — existing results table; reuse inside expanded card
- **`.error-box`** — existing error display; reuse for error cards
- **`copyText(text, btn)`** — existing copy-to-clipboard helper; reuse for Copy SQL button
- **`escHtml(str)`** — existing XSS-safe string escaping; use for all user-visible text
- **`renderSqlBox(sql, explanation)`** and **`renderTable(columns, rows)`** — existing render helpers; reuse or adapt inside card expand logic

### Established Patterns
- **Dark theme palette:** bg `#0f1117`, card bg `#1a1f2e`, border `#2d3748`, accent `#7c3aed`/`#3b82f6`, muted text `#718096`
- **Async fetch pattern:** `async function ask()` with try/catch/finally — follow same pattern for `loadHistory()`
- **DOM manipulation:** vanilla JS `innerHTML` and `document.getElementById` — no virtual DOM, direct updates
- **`escHtml` on all user content** — already enforced in existing render functions; maintain this for history question text

### Integration Points
- Replace the `#results` div behavior: instead of overwriting `innerHTML` on each query, append new cards
- `loadSchema()` and `buildExamples()` calls in the script's init block — add `loadHistory()` call alongside them
- The `ask()` function's success/error paths need to: (1) remove the placeholder card, (2) append the real card, (3) auto-expand it, (4) auto-scroll

</code_context>

<specifics>
## Specific Ideas

- The placeholder card during in-flight state should show the question the user typed (so they have visual confirmation of what was submitted) plus the spinner
- Auto-scroll should use `scrollIntoView({ behavior: 'smooth' })` on the newly appended card

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 2-chat-ui*
*Context gathered: 2026-05-21*
