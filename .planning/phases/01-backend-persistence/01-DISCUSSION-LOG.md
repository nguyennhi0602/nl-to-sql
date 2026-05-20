# Discussion Log — Phase 1: Backend Persistence

**Date:** 2026-05-20
**Duration:** Single session

---

## Area: Failed Query Saves

**Question:** When SQL execution fails, should the error entry still be saved to history?

**Options presented:**
1. Always save — including failures (save with error field populated, empty columns/rows)
2. Only save successes (simpler history, no noise)

**Selected:** Always save — including failures

**Notes:** Append-only log stays complete. Users can scroll back to see what went wrong.

---

## Area: Save Failure Behavior

**Question:** If the history INSERT itself throws (SQLite write error), should we fail the user's request or log silently and return results anyway?

**Options presented:**
1. Log silently, return results anyway (non-fatal; history hiccup doesn't break query)
2. Fail the request (strict consistency — results and history always in sync)

**Selected:** Log silently, return results anyway

**Notes:** History save failure is non-fatal. `console.error` the exception, return query result as normal.

---

## Area: Endpoint Location

**Question:** Should GET/DELETE /api/history live in QueryController or a new HistoryController?

**Options presented:**
1. QueryController — keep all API routes together (consistent with existing structure)
2. New HistoryController — separate concerns (history/history.controller.ts)

**Selected:** New HistoryController — separate concerns

**Notes:** Cleaner separation of query-related vs history-related concerns.

---

## Deferred Ideas

None.

## Claude's Discretion Items

- Exact DTO shape for history response
- Column naming for `query_history` table (snake_case per existing convention)
- Specific path style for `@Delete` decorator
