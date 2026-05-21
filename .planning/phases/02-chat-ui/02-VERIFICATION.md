---
phase: 02-chat-ui
verified: 2026-05-21T03:26:27Z
status: human_needed
score: 14/14 must-haves verified
overrides_applied: 1
overrides:
  - must_have: "After page refresh, all previous Q&A entries appear in the feed oldest-first with no manual action required"
    reason: "User explicitly requested newest-first order at the Plan 02 human-verify checkpoint. The SUMMARY.md Deviations section documents this as a user-requested change committed in a96cb84. The feed renders id DESC (newest-first) directly without reversing, and scrolls to feed.firstElementChild instead of lastElementChild. The original oldest-first requirement in D-06/D-07 is superseded by this approved change."
    accepted_by: "user (at Plan 02 checkpoint)"
    accepted_at: "2026-05-21"
human_verification:
  - test: "History loads on page refresh (HIST-02)"
    expected: "Reopening http://localhost:3000 after submitting queries shows previous cards in the feed without any user action"
    why_human: "Requires a running backend server and a real browser — cannot verify DOM rendering state with grep"
  - test: "New query appends to feed (HIST-02)"
    expected: "Submitting a question prepends a placeholder card (newest-first) immediately; existing cards remain visible; placeholder is replaced by the real result card on response"
    why_human: "Requires observing live DOM mutation — cannot verify with static file inspection"
  - test: "Timestamp format (HIST-03)"
    expected: "Each collapsed card header shows a timestamp in the form 'May 21, 2026 14:32' (no AM/PM)"
    why_human: "Date.toLocaleString rendering depends on browser locale and OS — only verifiable in a running browser"
  - test: "Auto-scroll to latest card (HIST-04)"
    expected: "After each query completes, the viewport scrolls to the newest card so it is visible without manual scrolling"
    why_human: "scrollIntoView behavior requires a live browser with viewport; grep confirms the call is present"
  - test: "In-flight placeholder spinner (HIST-05)"
    expected: "On submit, before the API response arrives, the placeholder card shows the question text, a spinning circle, and 'Generating SQL...' text"
    why_human: "Requires observing the interim DOM state before the fetch resolves"
  - test: "Copy SQL button (HIST-08)"
    expected: "Expanding a history card shows a 'Copy' button in the SQL box header; clicking it writes the SQL to clipboard and briefly shows 'Copied!'"
    why_human: "Clipboard interaction requires a live browser with permissions"
  - test: "Row count badge (HIST-09)"
    expected: "Collapsed card header shows 'N rows' (or '1 row' singular) badge in purple; error cards show 'Error' badge in red"
    why_human: "Requires a live query result to observe the badge value"
  - test: "Clear history (HIST-10)"
    expected: "Clicking 'Clear history' shows a browser confirm dialog; confirming deletes all cards, restores empty-state, and verifying via page refresh shows the feed is empty"
    why_human: "Requires browser confirm dialog interaction, DOM mutation observation, and a real DELETE /api/history round-trip"
---

# Phase 2: Chat UI Verification Report

**Phase Goal:** The frontend replaces the single result panel with a scrollable chat feed that loads history on refresh and appends new results
**Verified:** 2026-05-21T03:26:27Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A `.history-card` element rendered in the feed shows question text, timestamp, and row-count (or Error) badge in collapsed state | VERIFIED | `buildHistoryCard` assembles `.card-question`, `.card-timestamp`, and `badgeHtml` (`.card-badge` or `.card-badge error`) in `.history-card-header`. CSS rules for all three classes present (lines 429, 439, 445, 456). |
| 2 | Clicking a collapsed card header expands the card body revealing SQL, explanation, and result table (or error-box) | VERIFIED | Inline `onclick` on `.history-card-header` (line 773) calls `classList.toggle('expanded')`. `.history-card.expanded .history-card-body { display: flex }` CSS rule present (line 469). `bodyHtml` contains `renderSqlBox + renderTable` for success or `.error-box` for error. |
| 3 | The `.card-chevron` rotates 90deg when the card is expanded | VERIFIED | CSS rule `.history-card.expanded .card-chevron { transform: rotate(90deg) }` present (line 425). SVG with `class="card-chevron"` injected inside card header (line 776). |
| 4 | A `.placeholder-card` displays question text + spinner + 'Generating SQL...' label and is not expandable | VERIFIED | `buildPlaceholderCard` (line 741) creates `.placeholder-card` div with `escHtml(question)`, `.spinner`, and `"Generating SQL..."` text. No expand toggle mechanism on this element. |
| 5 | The `.clear-history-btn` renders with danger styling between the input section and feed | VERIFIED | DOM node `<button class="clear-history-btn" id="clearHistoryBtn" onclick="clearHistory()">Clear history</button>` at line 533, positioned between `.input-section` and `#results` in HTML. CSS at line 483 sets `border: 1px solid #fc8181; color: #fc8181`. |
| 6 | All user content from API (question, error, timestamp) is passed through escHtml() before injection into innerHTML | VERIFIED | `escHtml(entry.question)` at line 780, `escHtml(entry.error)` at line 764, `escHtml(ts)` at line 781, `escHtml(question)` in `buildPlaceholderCard` at line 745. |
| 7 | After page refresh, all previous Q&A entries appear in the feed (newest-first per approved deviation) with no manual action required | PASSED (override) | `loadHistory()` fetches `GET /api/history` (line 791), renders `buildHistoryCard(e, false)` for each entry via `feed.appendChild` (line 796). API returns `id DESC` (newest-first); `entries.reverse()` is intentionally absent per user-approved deviation. `loadHistory()` called in init block at line 819 alongside `loadSchema()` and `buildExamples()`. Override: feed order changed from oldest-first to newest-first per user request at checkpoint — accepted by user on 2026-05-21. |
| 8 | Submitting a new question appends a placeholder card immediately; it is replaced by the real result card on completion; previous cards remain visible | VERIFIED | `feed.prepend(placeholderCard)` at line 621 (newest-first). `placeholderCard.replaceWith(newCard)` at line 645 (success). `placeholderCard.replaceWith(errCard)` at line 659 (error). `feed.prepend` does not disturb existing DOM nodes. |
| 9 | Each history card displays a timestamp in 'May 21, 2026 14:32' format | VERIFIED | `formatTimestamp` (line 730) uses `Date.toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })`. Output format matches spec. Browser rendering is human-verified. |
| 10 | The viewport scrolls to the latest card after each new query completes | VERIFIED | `newCard.scrollIntoView({ behavior: 'smooth', block: 'start' })` at line 646 (success). `errCard.scrollIntoView({ behavior: 'smooth', block: 'start' })` at line 660 (error). `placeholderCard.scrollIntoView({ behavior: 'smooth' })` at line 622 (on submit). |
| 11 | The newest result card is auto-expanded; history-loaded cards start collapsed | VERIFIED | `buildHistoryCard(entry, true)` at line 644 (success — `expanded=true`). `buildHistoryCard(errEntry, true)` at line 658 (error — `expanded=true`). `buildHistoryCard(e, false)` at line 796 (loadHistory — `expanded=false`). |
| 12 | Clicking 'Clear history' and confirming removes all cards and sends DELETE /api/history | VERIFIED | `clearHistory()` (line 804): `window.confirm('Clear all history?')` at line 805, `await fetch('/api/history', { method: 'DELETE' })` at line 806, feed DOM cleared, empty-state restored, button hidden. |
| 13 | The Ask button label restores to 'Query' (not 'Ask Claude') after each query | VERIFIED | `btn.textContent = 'Query'` in `finally` block at line 663. `grep -c "btn.textContent = 'Ask Claude'"` returns 0. |
| 14 | No results.innerHTML = assignment remains in the ask() function | VERIFIED | `grep -c "results.innerHTML = " public/index.html` returns 0. All `feed.innerHTML = ''` inside `ask()` (line 617) are empty-string clears only (removing empty-state), not content assignments. |

**Score:** 14/14 truths verified (1 via approved override for feed order deviation)

---

### Deferred Items

None.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/public/index.html` | New CSS classes, buildHistoryCard, buildPlaceholderCard, formatTimestamp | VERIFIED | All 13 CSS rules present (lines 392–500). Three JS builder functions present (lines 730–787). |
| `backend/public/index.html` | loadHistory(), clearHistory(), refactored ask() | VERIFIED | `async function loadHistory` at line 789, `async function clearHistory` at line 804, `ask()` refactored with placeholder lifecycle (lines 606–665). |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `buildHistoryCard()` | `renderSqlBox() / renderTable() / escHtml()` | HTML string assembly in history-card-body | WIRED | `renderSqlBox(entry.sql, entry.explanation)` at line 765. `renderTable(entry.columns \|\| [], entry.rows \|\| [])` at line 765. `escHtml(entry.question)` at line 780. `escHtml(entry.error)` at line 764. |
| `.history-card.expanded` | `.history-card-body` | CSS class toggle | WIRED | `.history-card.expanded .history-card-body { display: flex }` at line 469. Inline `onclick` calls `classList.toggle('expanded')` at line 773. |
| `loadHistory()` | `GET /api/history` | `fetch('/api/history')` | WIRED | `fetch('/api/history')` at line 791 inside `loadHistory()`. |
| `clearHistory()` | `DELETE /api/history` | `fetch('/api/history', { method: 'DELETE' })` | WIRED | `await fetch('/api/history', { method: 'DELETE' })` at line 806. |
| `ask() placeholder lifecycle` | `buildHistoryCard / buildPlaceholderCard` | `feed.prepend(placeholderCard)` then `placeholderCard.replaceWith(newCard)` | WIRED | `feed.prepend(placeholderCard)` at line 621. `placeholderCard.replaceWith(newCard)` at line 645. `placeholderCard.replaceWith(errCard)` at line 659. |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `loadHistory()` renders `buildHistoryCard(e, false)` | `entries` array from `GET /api/history` | `fetch('/api/history')` → backend `HistoryService.findAll()` (Phase 1) | Yes — Phase 1 backend verified; real SQLite query | FLOWING |
| `ask()` renders `buildHistoryCard(entry, true)` | `data` from `POST /api/ask` | `fetch('/api/ask', { method: 'POST' })` → backend query controller | Yes — existing Phase 0 functionality; real Groq AI + SQLite | FLOWING |
| `buildHistoryCard` | `entry.question`, `entry.sql`, `entry.explanation`, `entry.error`, `entry.created_at` | Passed in from `loadHistory` (API data) or `ask()` (API data + `new Date()`) | Yes — API fields or live fetch response | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 5 required JS functions defined exactly once | `grep -c "function loadHistory\|buildHistoryCard\|buildPlaceholderCard\|formatTimestamp\|clearHistory"` | Each returns 1 | PASS |
| `btn.textContent = 'Ask Claude'` removed | `grep -c "btn.textContent = 'Ask Claude'"` in index.html | 0 | PASS |
| `results.innerHTML =` removed | `grep -c "results.innerHTML = "` in index.html | 0 | PASS |
| `placeholderCard.replaceWith` appears twice (success + error) | `grep -c "placeholderCard.replaceWith"` in index.html | 2 | PASS |
| `loadHistory()` in init block alongside `loadSchema()` and `buildExamples()` | Lines 817–819 | `loadSchema(); buildExamples(); loadHistory();` | PASS |
| Backend regression suite | `cd backend && npm test` | 1 suite, 1 test, PASSED | PASS |
| No debt markers (TBD/FIXME/XXX) | `grep -n "TBD\|FIXME\|XXX"` in index.html | No output | PASS |
| `hour12: false` present for 24h timestamp | `grep -c "hour12: false"` | 1 | PASS |

---

### Probe Execution

Step 7c SKIPPED — no `scripts/*/tests/probe-*.sh` files declared or found for this phase. Phase is a frontend HTML/CSS/JS transformation with no runnable probe scripts.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| HIST-02 | 02-01, 02-02 | Each new Q&A result appends to the history feed instead of replacing it | SATISFIED (human verify) | `feed.prepend(placeholderCard)` + `placeholderCard.replaceWith(newCard)` in `ask()`; existing cards preserved. Browser verification needed to observe live behavior. |
| HIST-03 | 02-01, 02-02 | Each history entry displays a timestamp (human-readable format) | SATISFIED (human verify) | `formatTimestamp()` uses `Date.toLocaleString('en-US', {..., hour12: false})`. Output format matches spec. Browser locale rendering is human-verified. |
| HIST-04 | 02-02 | Viewport automatically scrolls to latest entry after each new query | SATISFIED (human verify) | `newCard.scrollIntoView({ behavior: 'smooth', block: 'start' })` at line 646. Code verified; smooth scroll behavior requires browser observation. |
| HIST-05 | 02-01, 02-02 | Per-message loading state (spinner) displays while AI is generating SQL | SATISFIED (human verify) | `buildPlaceholderCard` creates `.placeholder-card` with `.spinner` and "Generating SQL..." text. Prepended on submit, replaced on response. Interim DOM state requires browser observation. |
| HIST-08 | 02-01, 02-02 | Each history card has a "Copy SQL" button that copies SQL to clipboard | SATISFIED (human verify) | `renderSqlBox()` (reused inside `buildHistoryCard`) generates `.copy-btn` with `onclick="copyText(sql, this)"`. `copyText()` uses `navigator.clipboard.writeText`. Clipboard interaction requires browser. |
| HIST-09 | 02-01, 02-02 | Each history card's result table displays the row count | SATISFIED (human verify) | `.card-badge` in collapsed header shows `rowCount + ' row(s)'` from `buildHistoryCard`. `renderTable()` also shows `.row-count` in expanded table header. Live query result needed to observe badge value. |
| HIST-10 | 02-02 | "Clear history" button deletes all history entries after user confirmation | SATISFIED (human verify) | `clearHistory()`: `window.confirm`, `await fetch('/api/history', { method: 'DELETE' })`, DOM cleared, empty-state restored. Requires browser interaction to observe. |

**Orphaned requirements check:** HIST-01 (Phase 1), HIST-06 (Phase 1), HIST-07 (Phase 1) are mapped to Phase 1 in REQUIREMENTS.md — not in Phase 2 scope. No orphaned requirements found for Phase 2.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | — |

No `TBD`, `FIXME`, `XXX` debt markers. No stub implementations. No `results.innerHTML =` content assignments. No `btn.textContent = 'Ask Claude'` stale label. The four `feed.innerHTML = ''` assignments are all legitimate empty-string clears (removing the empty-state node before appending cards, not content stubs).

**Note on `entries.reverse()` absence:** `loadHistory()` does NOT call `entries.reverse()` — this is the approved user-requested deviation (newest-first order) documented in 02-02-SUMMARY.md and the override above. The API returns `id DESC` (newest-first) which is now used directly. This is not a missing implementation; it is an intentional removal.

---

### Human Verification Required

These items require a running backend server and a real browser. All HIST requirements (HIST-02 through HIST-10) are frontend DOM behaviors — the RESEARCH.md validation architecture section explicitly documents this as "manual-only" with no automated test harness for vanilla HTML/JS DOM behavior.

**Server start command:** `cd /Users/touchbar/openwt/nl-to-sql/backend && npm run start:dev`

#### 1. History Loads on Page Refresh (HIST-01/HIST-02)

**Test:** Open http://localhost:3000 after submitting at least one query, close the tab, reopen it.
**Expected:** Previous Q&A cards appear in the feed (newest at top) without any user action.
**Why human:** Requires live browser rendering and a real GET /api/history round-trip.

#### 2. New Query Appends to Feed (HIST-02)

**Test:** With existing history visible, submit a new question.
**Expected:** A placeholder card appears at the top immediately with spinner + question text + "Generating SQL...". When response arrives, placeholder is replaced by the real result card (auto-expanded). Previous cards remain visible below.
**Why human:** Requires observing the transient placeholder DOM state and the append-not-replace behavior live.

#### 3. Timestamp Format (HIST-03)

**Test:** Observe any history card's collapsed header.
**Expected:** Timestamp shows as "May 21, 2026 10:26" (or current date/time) — long month name, no AM/PM.
**Why human:** `Date.toLocaleString` output depends on browser/OS locale; must verify in a real browser.

#### 4. Auto-Scroll to Latest Card (HIST-04)

**Test:** With a long history list requiring scrolling, submit a new question.
**Expected:** Viewport scrolls smoothly so the new card is visible at the top after the response.
**Why human:** `scrollIntoView` behavior only observable with a live browser viewport.

#### 5. In-Flight Spinner Placeholder (HIST-05)

**Test:** Submit a question and observe the feed before the response arrives.
**Expected:** A card with the question text, a spinning circle, and "Generating SQL..." label appears immediately at the top.
**Why human:** Requires observing the brief in-flight state before the fetch completes.

#### 6. Copy SQL Button (HIST-08)

**Test:** Expand a history card by clicking its header. Click the "Copy" button in the SQL box.
**Expected:** Button text changes to "Copied!" for ~1.5 seconds, then reverts to "Copy". SQL is in clipboard.
**Why human:** Clipboard API interaction and DOM feedback require a live browser.

#### 7. Row Count Badge (HIST-09)

**Test:** Observe the collapsed header of a successful query card.
**Expected:** Badge shows "N rows" (e.g. "5 rows", "1 row" singular) in purple. For a failed query, badge shows "Error" in red.
**Why human:** Requires a real API response with actual row data to verify badge value accuracy.

#### 8. Clear History (HIST-10)

**Test:** With history visible, click "Clear history". Confirm in the browser dialog. Then refresh the page.
**Expected:** All cards disappear and empty-state is shown. After refresh, no cards appear (server was actually cleared).
**Why human:** `window.confirm` interaction, DOM clearing, and real DELETE /api/history round-trip require browser observation.

---

### Gaps Summary

No automated gaps found. All 14 must-have truths are VERIFIED or PASSED (override) against the actual codebase. The `status: human_needed` reflects that HIST-02 through HIST-10 are browser-only behaviors that cannot be verified by static code analysis — this is documented in the RESEARCH.md validation architecture as an inherent property of a vanilla HTML/JS frontend with no test harness. The code wiring for all these behaviors is complete and correct; human verification is the final gate.

---

_Verified: 2026-05-21T03:26:27Z_
_Verifier: Claude (gsd-verifier)_
