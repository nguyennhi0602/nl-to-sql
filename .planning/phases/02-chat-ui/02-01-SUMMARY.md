---
phase: 02-chat-ui
plan: "01"
subsystem: frontend
tags: [css, javascript, chat-ui, history-card, xss-safety]
dependency_graph:
  requires: []
  provides: [CSS .history-card anatomy, JS buildHistoryCard, JS buildPlaceholderCard, JS formatTimestamp]
  affects: [backend/public/index.html]
tech_stack:
  added: []
  patterns: [inline-onclick for card toggle, document.createElement + innerHTML for card assembly, escHtml XSS safety on all user content]
key_files:
  created: []
  modified:
    - backend/public/index.html
decisions:
  - "Card chevron placed left of question text, mirroring existing .table-card-header sidebar pattern"
  - "buildHistoryCard uses document.createElement + innerHTML string assembly (consistent with renderSqlBox/renderTable pattern)"
  - "escHtml() called on entry.question, entry.error, and formatted timestamp — not on badgeHtml or bodyHtml which use renderSqlBox/renderTable (already escape internally)"
  - "entry.columns || [] and entry.rows || [] defensive defaults guard HTTP 422 error path where columns/rows are absent"
metrics:
  duration: "1 minute"
  completed_date: "2026-05-21"
  tasks_completed: 2
  files_modified: 1
---

# Phase 2 Plan 01: CSS Card Components and JS Builder Helpers Summary

**One-liner:** Dark-themed history card CSS anatomy (.history-card, .history-card-header, .card-badge, .history-card-body, .placeholder-card, .clear-history-btn) plus formatTimestamp, buildPlaceholderCard, and buildHistoryCard JS builder functions added to index.html — structural foundation for Plan 02 control flow wiring.

## What Was Built

Added all structural CSS and JS building blocks to `backend/public/index.html` needed for the chat history feed. No behavioral change — loadHistory, ask refactor, and clearHistory are Plan 02.

### CSS (13 new rules)

- `.history-feed` — flex column with 24px gap; added as second class on existing `#results` div
- `.history-card` — dark card with `#1a1f2e` background, `#2d3748` border, 12px border-radius
- `.history-card-header` — flex row with 44px min-height touch target; hover state `#16213e`
- `.card-chevron` — 0.15s transform transition; `color: #718096`; rotates 90deg when `.expanded`
- `.history-card.expanded .card-chevron` — `transform: rotate(90deg)` state rule
- `.card-question` — flex:1, ellipsis truncation, `#e2e8f0` text
- `.card-timestamp` — 12px/muted `#718096`, nowrap, flex-shrink:0
- `.card-badge` — pill badge with `#a78bfa` text (row count); `.card-badge.error` variant with `#fc8181` (destructive red)
- `.history-card-body` — `display: none` by default; `display: flex` column when `.expanded`
- `.history-card.expanded .history-card-body` — show state rule
- `.placeholder-card` — non-expandable in-flight card; flex row with spinner area
- `.clear-history-btn` — danger-styled (`#fc8181` border/text), `display: none`, 0.15s opacity hover
- `.clear-history-btn:hover` — `opacity: 0.8`

### DOM Changes

- `<button id="clearHistoryBtn" class="clear-history-btn" onclick="clearHistory()">Clear history</button>` inserted between `.input-section` and `#results`
- `#results` div: added `history-feed` class alongside existing `result-section`

### JS Functions (3 new)

**`formatTimestamp(isoString)`** — Formats ISO 8601 string to human-readable "May 21, 2026 14:32" using `Date.toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })`.

**`buildPlaceholderCard(question)`** — Creates `.placeholder-card` DOM element with escHtml(question) in `.card-question`, `.spinner`, and "Generating SQL…" label. Returns element for Plan 02 to append.

**`buildHistoryCard(entry, expanded)`** — Creates `.history-card` DOM element (with `.expanded` if truthy). Handles three states:
- **Success with rows:** `.card-badge` showing "N rows" + body with renderSqlBox + renderTable
- **Success 0 rows:** `.card-badge` showing "0 rows" + body with renderSqlBox + "Query executed — no rows returned."
- **Error:** `.card-badge.error` "Error" badge + body with `.error-box` containing escHtml(entry.error)

XSS mitigations applied per threat model T-02-01/02/03/04/05:
- `escHtml(entry.question)` in card header
- `escHtml(entry.error)` in error body
- `escHtml(ts)` on formatted timestamp string
- No double-escaping: renderSqlBox/renderTable call escHtml internally
- `escHtml(question)` in buildPlaceholderCard

## Tasks Completed

| Task | Commit | Files Modified |
|------|--------|----------------|
| Task 1: CSS classes + clear-history button DOM node | 0bca122 | backend/public/index.html |
| Task 2: formatTimestamp, buildPlaceholderCard, buildHistoryCard | 35e8026 | backend/public/index.html |

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. All new surfaces are client-side DOM builder functions. XSS mitigations per STRIDE threat register (T-02-01 through T-02-05) are fully implemented.

## Known Stubs

None — this plan establishes helper functions and CSS only. No data wiring occurs here. The functions are ready to be called by Plan 02 (loadHistory, ask refactor, clearHistory).

## Self-Check: PASSED

- backend/public/index.html: FOUND
- Commit 0bca122 (Task 1): FOUND
- Commit 35e8026 (Task 2): FOUND
- npm test: PASSED (1 suite, 1 test)
- All CSS acceptance criteria: PASSED (13 new CSS rules, none duplicate existing)
- All JS acceptance criteria: PASSED (3 new functions with correct signatures and XSS handling)
