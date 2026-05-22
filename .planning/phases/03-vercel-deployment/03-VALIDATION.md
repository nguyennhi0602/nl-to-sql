---
phase: 3
slug: vercel-deployment
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-22
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest (backend) + manual smoke tests (Vercel) |
| **Config file** | `backend/package.json` |
| **Quick run command** | `cd backend && npm test` |
| **Full suite command** | `cd backend && npm run test:e2e` |
| **Estimated runtime** | ~10 seconds (unit suite) |

**Note:** DEPLOY-01, DEPLOY-02, DEPLOY-04, DEPLOY-05 require a live Vercel deployment to verify — they are manual-only. DEPLOY-03 (no secrets in codebase) can be verified via `git grep`. The Jest suite guards Phase 1–2 regressions throughout execution.

---

## Sampling Rate

- **After every task commit:** Run `cd backend && npm test` (guards Phase 1–2 regressions)
- **After Wave 1 (DB migration):** Run `cd backend && npm test` + start app locally and verify `/api/history` works
- **After Wave 2 (Vercel deploy):** Manual smoke test against live Vercel URL
- **Max feedback latency:** ~10 seconds (unit suite)

---

## Per-Task Verification Map

| Task | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|------|------|------|-------------|-----------|-------------------|--------|
| Dual-driver DatabaseService | 03-01 | 1 | DEPLOY-02 | unit + manual | `cd backend && npm test` | ⬜ pending |
| Async HistoryService | 03-02 | 2 | DEPLOY-02 | unit | `cd backend && npm test` | ⬜ pending |
| Async controllers | 03-02 | 2 | DEPLOY-02 | unit | `cd backend && npm test` | ⬜ pending |
| api/index.ts + vercel.json | 03-03 | 2 | DEPLOY-01 | manual smoke | `curl https://<url>/api/schema` | ⬜ pending |
| Secrets in Vercel env vars | 03-04 | 3 | DEPLOY-03 | manual + grep | `git grep -r "gsk_\|DATABASE_URL=" --include="*.ts"` | ⬜ pending |
| GitHub auto-deploy | 03-04 | 3 | DEPLOY-04 | manual | Push commit, observe Vercel dashboard | ⬜ pending |
| PR preview URL | 03-04 | 3 | DEPLOY-05 | manual | Open PR, observe Vercel dashboard | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers regression testing. No new test files needed — DEPLOY requirements are infrastructure/deployment behaviors not testable with Jest.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| App accessible at Vercel URL | DEPLOY-01 | Requires live deployment | `curl https://<url>/api/schema` returns 200 + schema JSON |
| History persists across requests | DEPLOY-02 | Requires live Postgres + deployment | POST /api/ask, then GET /api/history; restart function (redeploy), GET /api/history again — same entries |
| No secrets in codebase | DEPLOY-03 | Grep check | `git grep -rn "gsk_\|POSTGRES_URL\|DATABASE_URL=" --include="*.ts" --include="*.json"` returns 0 results |
| Push to main auto-deploys | DEPLOY-04 | Vercel dashboard only | Push a commit to main; observe new deployment appears in Vercel dashboard |
| PR gets preview URL | DEPLOY-05 | Vercel dashboard only | Open a PR; observe Vercel bot comments a preview URL |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or are documented as manual-only above
- [x] Sampling continuity: backend regression suite (`npm test`) runs after every task
- [x] Wave 0: existing backend test infrastructure covers regression guard
- [ ] No watch-mode flags
- [x] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
