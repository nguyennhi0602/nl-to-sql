# NL-to-SQL Chat Tool

## What This Is

A web-based tool that lets any user — technical or not — query a SQLite database using plain English. Users type natural language questions into a chat interface, the backend generates SQL via an AI model, executes it, and returns results. Conversation history persists across page refreshes so users can scroll back through previous queries.

## Core Value

Users get data answers instantly without knowing SQL, and their full query history is always there when they come back.

## Requirements

### Validated

- ✓ NL-to-SQL conversion (Groq + llama-3.3-70b-versatile) — existing
- ✓ SQLite database with seeded e-commerce schema (customers, products, orders, order_items) — existing
- ✓ REST API: GET /api/schema, POST /api/ask, POST /api/execute — existing
- ✓ Query UI: schema sidebar, textarea input, example chips, SQL + results display — existing

### Active

- [ ] Persistent chat history — conversations saved to SQLite, reloaded on page refresh
- [ ] Chat-style UI — Q&A pairs stack up as messages, new results append instead of replace
- [ ] Backend endpoints to save and retrieve chat history

### Out of Scope

- Multi-turn AI context (follow-up questions referencing prior results) — future phase
- Bring-your-own database — future phase
- User authentication / sessions — future phase
- Custom database schemas — deferred

## Context

- Backend lives in `backend/` — NestJS + TypeScript, runs on port 3000
- Frontend is a plain HTML/CSS/JS file served as static from `backend/public/index.html`
- Database: `backend/store.db` (SQLite via better-sqlite3)
- AI model: Groq SDK (`groq-sdk`) calling `llama-3.3-70b-versatile`
- The `ClaudeService` is a naming artifact — it actually calls Groq, not Anthropic
- Module structure: `claude/` (AI), `database/` (SQLite), `query/` (controller + routes)
- No separate frontend project — all UI is served by the NestJS static file middleware

## Constraints

- **Tech Stack**: NestJS + TypeScript (backend), plain HTML/CSS/JS (frontend) — no React/Vue
- **Database**: SQLite (better-sqlite3) — no external database
- **AI Provider**: Groq API — configured via `GROQ_API_KEY` env var
- **Frontend**: No build step — edits to `public/index.html` take effect immediately

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Groq over Anthropic for LLM | Groq provides fast inference for SQL generation use case | — Pending |
| Plain HTML frontend (no framework) | Zero build tooling, served directly by NestJS static middleware | — Pending |
| SQLite for chat history persistence | Already using SQLite; no new infrastructure needed | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-20 after initialization*
