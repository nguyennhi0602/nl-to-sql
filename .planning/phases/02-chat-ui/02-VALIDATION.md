---
phase: 2
slug: chat-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-21
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest (NestJS default — guards Phase 1 regressions) |
| **Config file** | `backend/package.json` |
| **Quick run command** | `cd backend && npm test` |
| **Full suite command** | `cd backend && npm run test:e2e` |
| **Estimated runtime** | ~10 seconds |

**Note:** Phase 2 is entirely a frontend HTML/CSS/JS change inside `backend/public/index.html`. The Jest suite has no DOM access and cannot test `index.html` directly. Automated tests serve as regression guards for Phase 1 backend code. All Phase 2 HIST requirements are **manual-only** (see below).

---

## Sampling Rate

- **After every task commit:** Run `cd backend && npm test` (guards Phase 1 regressions)
- **After every plan wave:** Run `cd backend && npm run test:e2e`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| Structural refactor | 02-01 | 1 | HIST-02 | manual-only | n/a | ❌ | ⬜ pending |
| loadHistory() | 02-01 | 1 | HIST-02, HIST-03 | manual-only | n/a | ❌ | ⬜ pending |
| Placeholder card + spinner | 02-01 | 1 | HIST-05 | manual-only | n/a | ❌ | ⬜ pending |
| Error card rendering | 02-01 | 1 | HIST-02 (error) | manual-only | n/a | ❌ | ⬜ pending |
| Copy SQL button | 02-01 | 1 | HIST-08 | manual-only | n/a | ❌ | ⬜ pending |
| Row count badge | 02-01 | 1 | HIST-09 | manual-only | n/a | ❌ | ⬜ pending |
| Auto-scroll | 02-01 | 1 | HIST-04 | manual-only | n/a | ❌ | ⬜ pending |
| Clear history | 02-01 | 1 | HIST-10 | manual-only | n/a | ❌ | ⬜ pending |
| Backend regression guard | 02-01 | 1 | — | unit | `cd backend && npm test` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new test files needed — Phase 2 has no automatable frontend tests given the no-build-step, no-framework constraint (D-11, D-12).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| New query appends card instead of replacing feed | HIST-02 | DOM test, no test harness | Submit 2 queries; verify both cards visible in feed |
| Timestamp shows in "Month DD, YYYY HH:MM" format | HIST-03 | DOM test, no test harness | Check timestamp on any card matches expected format |
| Viewport auto-scrolls to latest card after query | HIST-04 | DOM test, no test harness | Submit query with feed below fold; verify scroll to new card |
| Spinner placeholder appears on submit | HIST-05 | DOM test, no test harness | Submit query; verify placeholder card with spinner appears before result |
| History persists and loads on page refresh | HIST-02 (persist) | DOM test, no test harness | Submit query, refresh page, verify history card appears |
| Copy SQL button copies SQL to clipboard | HIST-08 | Clipboard API requires browser | Click Copy SQL; paste into text field; verify correct SQL |
| Row count badge shows correct count | HIST-09 | DOM test, no test harness | Submit query returning N rows; verify badge shows "N rows" |
| Clear history deletes all entries | HIST-10 | DOM test, no test harness | Click Clear history, confirm; verify feed is empty and GET /api/history returns [] |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or are documented as manual-only above
- [x] Sampling continuity: backend regression suite runs after every task commit
- [x] Wave 0: existing backend test infrastructure covers regression guard; no new files needed
- [ ] No watch-mode flags
- [x] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
