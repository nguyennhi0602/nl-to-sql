# Roadmap: NL-to-SQL Chat History Milestone

## Overview

The existing NL-to-SQL tool has a working backend and query UI. This milestone adds persistent chat history: a SQLite-backed history table on the server, REST endpoints to read and delete it, and a frontend transformation from a single replace-in-place result panel to an append-based chat feed. Two phases — backend first, then UI — with each phase independently verifiable via curl before the next begins.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Backend Persistence** - History table, HistoryModule, save-on-ask, GET/DELETE /api/history
- [ ] **Phase 2: Chat UI** - Append-based chat feed with timestamps, loading states, copy SQL, row count, and clear history

## Phase Details

### Phase 1: Backend Persistence

**Goal**: The backend saves every query result (success or failure) to SQLite and exposes endpoints to retrieve and delete history
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: HIST-01, HIST-06, HIST-07
**Success Criteria** (what must be TRUE):

  1. After submitting a question, `curl GET /api/history` returns the saved entry with question, SQL, explanation, columns, and rows
  2. After a failed query, `curl GET /api/history` returns the entry with an `error` field populated and empty columns/rows
  3. `curl DELETE /api/history` removes all entries; a subsequent GET returns an empty array
  4. No single history entry stores more than 100 result rows regardless of how many the query returns
  5. History entries persist across server restarts (stored in SQLite, not memory)

**Plans**: 2 plans

Plans:
**Wave 1**

- [ ] 01-01-PLAN.md — Schema DDL + HistoryService + HistoryModule (data layer foundation)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 01-02-PLAN.md — QueryController wiring + HistoryController GET/DELETE (full vertical slice)

### Phase 2: Chat UI

**Goal**: The frontend replaces the single result panel with a scrollable chat feed that loads history on refresh and appends new results
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: HIST-02, HIST-03, HIST-04, HIST-05, HIST-08, HIST-09, HIST-10
**Success Criteria** (what must be TRUE):

  1. After page refresh, all previous Q&A entries appear in the feed oldest-first with no manual action required
  2. Submitting a new question appends a new card to the bottom of the feed; previous cards remain visible
  3. Each history card displays a human-readable timestamp (e.g. "May 20, 2026 14:32")
  4. While a query is in flight, a spinner appears in the feed at the bottom; it is replaced by the result card on completion
  5. Each history card shows a "Copy SQL" button that writes the SQL to clipboard, and displays the result row count (e.g. "42 rows")
  6. Clicking "Clear history" and confirming removes all cards from the feed and sends DELETE /api/history

**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Backend Persistence | 0/2 | Not started | - |
| 2. Chat UI | 0/TBD | Not started | - |
