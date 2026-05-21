---
status: partial
phase: 02-chat-ui
source: [02-VERIFICATION.md]
started: 2026-05-21T00:00:00Z
updated: 2026-05-21T00:00:00Z
---

## Current Test

User approved all items at the human-verify checkpoint during /gsd:execute-phase 2.

## Tests

### 1. History loads on page refresh (HIST-02)
expected: Reopening http://localhost:3000 after submitting queries shows previous cards in the feed without any user action
result: approved at checkpoint

### 2. New query appends to feed (HIST-02)
expected: Submitting a question prepends a placeholder card (newest-first) immediately; existing cards remain visible; placeholder is replaced by the real result card on response
result: approved at checkpoint

### 3. Timestamp format (HIST-03)
expected: Each collapsed card header shows a timestamp in the form 'May 21, 2026 14:32' (no AM/PM)
result: approved at checkpoint

### 4. Auto-scroll to latest card (HIST-04)
expected: After each query completes, the viewport scrolls to the newest card so it is visible without manual scrolling
result: approved at checkpoint

### 5. In-flight placeholder spinner (HIST-05)
expected: On submit, before the API response arrives, the placeholder card shows the question text, a spinning circle, and 'Generating SQL...' text
result: approved at checkpoint

### 6. Copy SQL button (HIST-08)
expected: Expanding a history card shows a 'Copy' button in the SQL box header; clicking it writes the SQL to clipboard and briefly shows 'Copied!'
result: approved at checkpoint

### 7. Row count badge (HIST-09)
expected: Collapsed card header shows 'N rows' (or '1 row' singular) badge in purple; error cards show 'Error' badge in red
result: approved at checkpoint

### 8. Clear history (HIST-10)
expected: Clicking 'Clear history' shows a browser confirm dialog; confirming deletes all cards, restores empty-state, and verifying via page refresh shows the feed is empty
result: approved at checkpoint

## Summary

total: 8
passed: 8
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
