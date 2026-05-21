---
phase: 02-chat-ui
plan: "02"
subsystem: frontend
tags: [javascript, chat-ui, history-feed, loadHistory, clearHistory, ask-refactor, xss-safety]
dependency_graph:
  requires: [02-01]
  provides: [loadHistory(), clearHistory(), refactored ask() with placeholder card lifecycle]
  affects: [backend/public/index.html]
tech_stack:
  added: []
  patterns: [placeholder-card lifecycle, feed.appendChild instead of innerHTML overwrite, scrollIntoView smooth scroll, window.confirm native dialog, await DELETE fetch]
key_files:
  created: []
  modified:
    - backend/public/index.html
decisions:
  - "loadHistory() wrapped in try/catch per Pitfall 6 — error logged silently, feed stays in empty-state"
  - "User requested newest-first feed order at checkpoint — removed entries.reverse() in loadHistory(), switched ask() to feed.prepend(), and scrolls to firstElementChild for newest-at-top UX"
  - "clearHistory awaits DELETE /api/history before clearing DOM — prevents race condition on slow connections (Pitfall 7)"
  - "ask() uses let data declared before try so catch block can access partial response for error card"
  - "ask() empty-state guard uses feed.querySelector('.empty-state') to detect and clear before appending placeholder"
  - "btn.textContent = 'Query' in finally block — fixes pre-existing 'Ask Claude' bug confirmed in Pitfall 2"
metrics:
  duration: "5 minutes"
  completed_date: "2026-05-21"
  tasks_completed: 2
  files_modified: 1
---

# Phase 2 Plan 02: Wire History Feed — loadHistory, clearHistory, ask() Refactor Summary

**One-liner:** loadHistory() fetches and renders collapsed history cards on page load (newest-first per user request at checkpoint), clearHistory() awaits DELETE and restores empty-state, and ask() uses buildPlaceholderCard/replaceWith lifecycle via feed.prepend() — completing the end-to-end Phase 2 chat feed experience.

## What Was Built

Wired up the complete chat history feed behavior in `backend/public/index.html` by adding `loadHistory()`, `clearHistory()`, and replacing the existing `ask()` body with the placeholder card lifecycle. No new files created, no new dependencies added.

### Task 1: loadHistory() and clearHistory()

**`loadHistory()`** (async):
- Fetches `GET /api/history` with try/catch (Pitfall 6 guard)
- Does NOT reverse the id DESC API array — keeps newest-first order directly (user-requested at checkpoint; see Deviations)
- Returns early if no entries (keeps empty-state as-is)
- Clears empty-state and appends `buildHistoryCard(entry, false)` for each entry (collapsed per D-04/D-06)
- Shows `#clearHistoryBtn` after rendering
- Calls `feed.firstElementChild.scrollIntoView({ behavior: 'smooth', block: 'start' })` to auto-scroll to newest (top) entry

**`clearHistory()`** (async):
- Guards with `window.confirm('Clear all history?')` (D-09)
- Awaits `fetch('/api/history', { method: 'DELETE' })` (Pitfall 7 — prevents race condition)
- Clears feed DOM and restores static empty-state HTML
- Hides `#clearHistoryBtn`

**Init block**: `loadHistory()` added alongside `loadSchema()` and `buildExamples()` (Pitfall 5 — DOM ready)

### Task 2: ask() Refactor

Replaced entire ask() function body with placeholder card lifecycle. Key changes:

- **Removed:** All `results.innerHTML =` assignments (3 content overwrites + 1 loading state)
- **Added:** Empty-state guard clears feed when first query submitted
- **Added:** `buildPlaceholderCard(question)` prepended at top of feed on submit (feed.prepend) + `scrollIntoView`
- **Added:** `#clearHistoryBtn` shown when first card is appended
- **Success path:** `buildHistoryCard(entry, true)` with `columns: data.columns || []` and `rows: data.rows || []` guards for HTTP 422; `placeholderCard.replaceWith(newCard)`; `newCard.scrollIntoView({ block: 'start' })`
- **Error path:** `buildHistoryCard(errEntry, true)` using partial data from response if available; `placeholderCard.replaceWith(errCard)`; `errCard.scrollIntoView({ block: 'start' })`
- **Fixed pre-existing bug:** `btn.textContent = 'Query'` in finally block (was `'Ask Claude'`)

## Tasks Completed

| Task | Commit | Files Modified |
|------|--------|----------------|
| Task 1: Implement loadHistory() and clearHistory() | 0ea3848 | backend/public/index.html |
| Task 2: Refactor ask() to use placeholder card lifecycle | 3b48f5a | backend/public/index.html |
| User deviation: Newest-first feed order (post-checkpoint) | a96cb84 | backend/public/index.html |

## Deviations from Plan

### User-requested change at checkpoint

**1. [User request] Feed order changed from oldest-first to newest-first**
- **Found during:** Checkpoint (human-verify) between Task 2 and plan completion
- **Issue:** Plan specified oldest-first feed order (entries.reverse() in loadHistory, feed.appendChild in ask). User reviewed the running app and preferred newest queries at the top.
- **Fix:**
  - `loadHistory()`: Removed `entries.reverse()` — API returns id DESC (newest first) which is now used directly. Scroll target changed from `feed.lastElementChild` to `feed.firstElementChild` with `block: 'start'`.
  - `ask()`: Changed `feed.appendChild(placeholderCard)` to `feed.prepend(placeholderCard)`. Scroll target for placeholder and result cards changed to `block: 'start'` (top alignment).
- **Files modified:** backend/public/index.html
- **Committed in:** a96cb84 (post-checkpoint user change)

---

**Total deviations:** 1 (user-requested UX change at checkpoint)
**Impact on plan:** Feed order inverted relative to plan specification. All other acceptance criteria remain satisfied — loadHistory(), clearHistory(), ask() lifecycle, XSS mitigations, and bug fix all unchanged.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. All threat mitigations from threat model applied:

- T-02-06 (XSS via loadHistory): `buildHistoryCard` calls `escHtml(entry.question)` and `escHtml(entry.error)` — confirmed present from Plan 01
- T-02-07 (XSS via ask() error path): `errMsg` flows into `errEntry.error` field, then through `buildHistoryCard` which applies `escHtml(entry.error)` — mitigated
- T-02-08 (clearHistory empty-state): Static literal HTML, no user data injected — accepted as per threat register
- T-02-09 (loadHistory crash): Entire body wrapped in try/catch — mitigated

## Known Stubs

None — all data wiring is complete. loadHistory() fetches real API data, ask() posts to real API and renders real results.

## Self-Check: PASSED

- backend/public/index.html: FOUND
- Commit 0ea3848 (Task 1 — loadHistory/clearHistory): FOUND
- Commit 3b48f5a (Task 2 — ask() refactor): FOUND
- Commit a96cb84 (user deviation — newest-first order): FOUND
- npm test: PASSED (1 suite, 1 test)
- Source assertions (all pass):
  - function loadHistory(: 1
  - function clearHistory(: 1
  - placeholderCard.replaceWith: 2 (success + error paths)
  - btn.textContent = 'Ask Claude': 0 (bug removed)
  - btn.textContent = 'Query': 1 (bug fixed)
  - results.innerHTML =: 0 (all overwrites removed)
  - escHtml(entry.question): 1
  - escHtml(entry.error): 1
  - hour12: false: 1
  - feed.prepend(placeholderCard): 1 (newest-first — post-checkpoint deviation)
