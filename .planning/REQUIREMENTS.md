# Requirements: NL-to-SQL Chat Tool

**Defined:** 2026-05-20
**Core Value:** Users get data answers instantly without knowing SQL, and their full query history is always there when they come back.

## v1 Requirements

### Existing (Validated)

These capabilities are already implemented in the codebase and are not planned work.

- ✓ **EXIST-01**: User can type a natural language question and receive generated SQL + results
- ✓ **EXIST-02**: System introspects the SQLite schema and passes it to the AI model
- ✓ **EXIST-03**: User can see the generated SQL and a plain-English explanation
- ✓ **EXIST-04**: User can view results as a formatted table
- ✓ **EXIST-05**: User can see the database schema in a collapsible sidebar
- ✓ **EXIST-06**: User can click example chips to auto-fill and submit preset questions

### Chat History (New Work)

#### Persistence & Display

- [x] **HIST-01**: User's query history persists across page refreshes (stored in SQLite)
- [x] **HIST-02**: Each new Q&A result appends to the history feed instead of replacing it
- [x] **HIST-03**: Each history entry displays a timestamp (human-readable format)
- [x] **HIST-04**: The viewport automatically scrolls to the latest entry after each new query

#### In-Flight & Error States

- [x] **HIST-05**: A per-message loading state (spinner) displays while the AI is generating SQL
- [x] **HIST-06**: Failed queries are saved to history and display the error message inline in the feed

#### Safety & Controls

- [x] **HIST-07**: The backend caps stored result rows at 100 per history entry (no UI required)
- [x] **HIST-08**: Each history card has a "Copy SQL" button that copies the generated SQL to clipboard
- [x] **HIST-09**: Each history card's result table displays the row count (e.g. "42 rows")
- [x] **HIST-10**: A "Clear history" button deletes all history entries after user confirmation

## v2 Requirements

### Chat History Enhancements

- **HIST-V2-01**: Collapsible large result tables (show first 10 rows, "show all" toggle)
- **HIST-V2-02**: Re-run button on past entries (pre-fills input with previous question)
- **HIST-V2-03**: Truncation notice in UI when result rows exceed the cap

### Future Capabilities

- **FUTURE-01**: Multi-turn conversation (AI retains context from prior turns)
- **FUTURE-02**: Bring-your-own database (connect to a custom DB instead of the demo schema)
- **FUTURE-03**: User authentication and per-user history sessions

## Out of Scope

| Feature | Reason |
|---------|--------|
| Search / filter history | Low value at typical history depth; browser Ctrl+F suffices |
| History export (JSON/CSV) | Niche use case; data is in SQLite if ever needed |
| Conversation sessions / threads | Requires auth and session IDs — far beyond this milestone |
| Syntax highlighting | Adds a dependency (Prism/highlight.js) for marginal readability gain |
| Pagination / virtual scrolling | Premature optimization; cap at 50 most recent entries server-side |
| Per-message edit and re-run | Requires branching history state — deferred to v2 re-run button |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| HIST-01 | Phase 1 | Pending |
| HIST-06 | Phase 1 | Pending |
| HIST-07 | Phase 1 | Pending |
| HIST-02 | Phase 2 | Pending |
| HIST-03 | Phase 2 | Pending |
| HIST-04 | Phase 2 | Pending |
| HIST-05 | Phase 2 | Pending |
| HIST-08 | Phase 2 | Pending |
| HIST-09 | Phase 2 | Pending |
| HIST-10 | Phase 2 | Pending |

**Coverage:**
- v1 requirements (new work): 10 total
- Mapped to phases: 10
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-20*
*Last updated: 2026-05-20 after roadmap creation (phase assignments corrected)*
