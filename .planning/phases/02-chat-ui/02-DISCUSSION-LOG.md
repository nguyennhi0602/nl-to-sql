# Phase 2: Chat UI - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-21
**Phase:** 02-chat-ui
**Areas discussed:** Input position, Card anatomy, Clear history, Load state, In-flight spinner

---

## Input Position

| Option | Description | Selected |
|--------|-------------|----------|
| Top (keep current) | Input stays pinned at top, feed scrolls below | ✓ |
| Bottom (chat-style) | Input pinned to bottom, feed fills top | |

**User's choice:** Top (keep current)
**Notes:** Less restructuring, feels like a query tool rather than a messaging app.

---

## Card Anatomy

| Option | Description | Selected |
|--------|-------------|----------|
| Fully expanded always | Every card shows full SQL + table | |
| Collapsed by default | Cards show question + timestamp + row count; expand on click | ✓ |
| Latest expanded, rest collapsed | Newest always open, older collapsed | |

**User's choice:** Collapsed by default
**Notes:** Keeps feed scannable as history grows. Latest card auto-expands after a query completes (decided by Claude per query workflow).

---

## Clear History Confirmation

| Option | Description | Selected |
|--------|-------------|----------|
| Browser confirm() dialog | window.confirm() — zero code, universal | ✓ |
| Inline toggle on button | "Sure? Click again" two-click pattern | |

**User's choice:** Browser confirm() dialog

---

## Clear History Button Location

| Option | Description | Selected |
|--------|-------------|----------|
| Header bar (top right) | Always visible, global control position | |
| Above the feed | Between input section and history cards | ✓ |

**User's choice:** Above the feed

---

## Page Load State

| Option | Description | Selected |
|--------|-------------|----------|
| All collapsed, auto-scroll to bottom | All entries collapsed, scroll to newest | ✓ |
| Latest entry expanded, scroll to it | Newest entry auto-opens | |
| All collapsed, scroll to top | Show oldest first | |

**User's choice:** All collapsed, auto-scroll to bottom

---

## In-Flight Spinner (HIST-05)

Initial option "Ask button only" was flagged as conflicting with ROADMAP success criterion #4 ("a spinner appears in the feed at the bottom"). User re-selected:

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal placeholder card | Question text + spinner appended to feed | ✓ |
| Just a spinner row | Centered spinner, no card frame | |

**User's choice:** Minimal placeholder card

---

## Claude's Discretion

- Exact CSS for collapsed/expanded card states
- Chevron toggle position (left or right)
- Spinner label wording
- Row-count badge styling in collapsed view

## Deferred Ideas

None.
