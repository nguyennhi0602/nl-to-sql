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
  - "loadHistory reverses id DESC API array before rendering so cards display oldest-first in feed"
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

**One-liner:** loadHistory() fetches and renders collapsed history cards on page load, clearHistory() awaits DELETE and restores empty-state, and ask() now uses buildPlaceholderCard/replaceWith lifecycle replacing all innerHTML overwrites — completing the end-to-end Phase 2 chat feed experience.

## What Was Built

Wired up the complete chat history feed behavior in `backend/public/index.html` by adding `loadHistory()`, `clearHistory()`, and replacing the existing `ask()` body with the placeholder card lifecycle. No new files created, no new dependencies added.

### Task 1: loadHistory() and clearHistory()

**`loadHistory()`** (async):
- Fetches `GET /api/history` with try/catch (Pitfall 6 guard)
- Reverses the id DESC API array to display oldest-first in feed (D-07)
- Returns early if no entries (keeps empty-state as-is)
- Clears empty-state and appends `buildHistoryCard(entry, false)` for each entry (collapsed per D-04/D-06)
- Shows `#clearHistoryBtn` after rendering
- Calls `feed.lastElementChild.scrollIntoView({ behavior: 'smooth' })` to auto-scroll to most recent entry

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
- **Added:** `buildPlaceholderCard(question)` appended immediately on submit + `scrollIntoView`
- **Added:** `#clearHistoryBtn` shown when first card is appended
- **Success path:** `buildHistoryCard(entry, true)` with `columns: data.columns || []` and `rows: data.rows || []` guards for HTTP 422; `placeholderCard.replaceWith(newCard)`; `newCard.scrollIntoView`
- **Error path:** `buildHistoryCard(errEntry, true)` using partial data from response if available; `placeholderCard.replaceWith(errCard)`; `errCard.scrollIntoView`
- **Fixed pre-existing bug:** `btn.textContent = 'Query'` in finally block (was `'Ask Claude'`)

## Tasks Completed

| Task | Commit | Files Modified |
|------|--------|----------------|
| Task 1: Implement loadHistory() and clearHistory() | 0ea3848 | backend/public/index.html |
| Task 2: Refactor ask() to use placeholder card lifecycle | 3b48f5a | backend/public/index.html |

## Deviations from Plan

None — plan executed exactly as written.

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
- Commit 0ea3848 (Task 1): FOUND
- Commit 3b48f5a (Task 2): FOUND
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
