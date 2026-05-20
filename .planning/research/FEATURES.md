# Features Research: Chat History

**Domain:** Chat-style NL-to-SQL query tool with persistent history
**Researched:** 2026-05-20
**Confidence:** MEDIUM — based on established UX patterns from ChatGPT, Observable, Jupyter, Metabase, and open-source text2sql tools

---

## Table Stakes (must have)

These are the minimum features users expect from any chat-style interface with history. Missing any of these makes the product feel broken or unfinished.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Messages persist across page refresh | Core promise of the milestone — without this, "history" doesn't exist | Low | Store to SQLite on every query; reload on page init |
| Full Q&A pairs visible in order | Users expect to see their question AND the result together, in sequence | Low | Each history item = {question, sql, results, timestamp} |
| New results append, not replace | Chat paradigm: scroll down to see new answers, old ones stay visible | Low | Fundamental UX shift from replace-in-place |
| Timestamp on each entry | Users orient themselves ("I ran this an hour ago") | Low | ISO timestamp stored server-side, displayed human-readable |
| Scroll to latest automatically | After submitting a query, viewport lands on the new result | Low | Standard chat behavior — scrollIntoView on new message |
| Visual distinction between question and answer | Clear sender/receiver delineation | Low | Question bubble vs result card, or clear label |
| Loading state per message | Spinner or skeleton while AI processes | Low | Prevents confusion about whether query was submitted |
| Error display in-thread | Failed queries show inline, not as alert() | Low | Error as a message bubble in the correct position |

---

## Differentiators (nice to have)

Features that make history meaningfully useful beyond just scrollback.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Copy SQL button on each result | Power users take generated SQL to dashboards or other tools | Low | navigator.clipboard.writeText() per message |
| Re-run button on past queries | Re-execute a previous question without retyping | Low | Pre-fill input with past question text |
| Clear history button | Gives users a reset; respects agency | Low | DELETE /api/history; requires confirmation |
| Result row count displayed | "42 rows" gives immediate context before reading the table | Low | Count rows on render, display next to table header |
| Collapsed/expandable large result tables | Long results overwhelm scroll; collapse by default if > N rows | Medium | Show first 5 rows + "show all" toggle |
| Sticky example chips | Keep example queries visible as reference even after history fills screen | Low | Position example chips outside the scroll container |

---

## Anti-Features (avoid)

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Search/filter history | Adds search bar, index logic, query state — not valuable for typical history depth | Use browser Ctrl+F; revisit only if history grows to 100+ entries |
| History export (JSON/CSV) | Scope creep; niche use case for this tool | Defer; data is in SQLite if ever needed |
| Per-message edit and re-run | Requires branching history state — significant complexity | Use re-run (copy-to-input) instead |
| Pagination or virtualized list | Premature optimization before a real performance problem exists | Limit history to last 50 entries server-side |
| Conversation sessions or threads | Requires auth, session IDs, naming UI — far beyond this milestone | Single flat history; defer until auth is added |
| Syntax highlighting on SQL output | Adds a highlight.js/Prism.js dependency for marginal readability gain | Plain pre/code is sufficient |
| Auto-save draft questions | Very low value; users type short NL questions | Not needed |

---

## Notes

### Append-Only Is the Right Mental Model

History entries should never be mutated after creation. Re-running a query creates a new entry. This makes the persistence layer trivially simple (INSERT only, no UPDATE) and matches how users think about chat history.

### Keep the Result Payload Lean

Store question, generated SQL, and result rows in the history record. Do not store the full schema context sent to the AI — it is reproducible and inflates storage. Storing result rows as JSON TEXT in SQLite is appropriate at this scale.

### Row Safety Cap Belongs in the Backend from Day One

If a query returns 10,000 rows, rendering them all into the DOM will freeze the browser. Cap result rows at 200 (or similar) server-side and note truncation. This is a hard safety guard, not pagination.

### Single-Session Assumption Is Correct

Auth and multi-session are explicitly out of scope. The history table should include a nullable session_id column to allow future migration without breaking existing rows — but do not implement session logic now.

### The Existing UI Pattern Shapes Scope

Schema sidebar and example chips remain useful reference points and should not disappear behind a growing chat thread. History UI extends the existing layout, it does not replace it.

### SQLite as History Store Is Correct

No new infrastructure. better-sqlite3 synchronous inserts are fine for a single-user tool. Confidence: HIGH.

---

## MVP Recommendation

Include in this milestone:
1. Messages persist across refresh (the core deliverable)
2. Full Q&A pairs in order, new results appending
3. Timestamps on each entry
4. Scroll-to-latest on new message
5. Loading state per message (in-thread)
6. Error display in-thread
7. Copy SQL button (trivially simple, high utility)
8. Result row count display (one line of render logic)
9. Clear history button (simple DELETE endpoint)
10. Backend row cap safety guard (200 rows max, no UI required)

Defer to a later polish milestone:
- Collapsible large result tables
- Re-run button
- Row truncation notice in UI
