<!-- GSD:project-start source:PROJECT.md -->

## Project

**NL-to-SQL Chat Tool**

A web-based tool that lets any user — technical or not — query a SQLite database using plain English. Users type natural language questions into a chat interface, the backend generates SQL via an AI model, executes it, and returns results. Conversation history persists across page refreshes so users can scroll back through previous queries.

**Core Value:** Users get data answers instantly without knowing SQL, and their full query history is always there when they come back.

### Constraints

- **Tech Stack**: NestJS + TypeScript (backend), plain HTML/CSS/JS (frontend) — no React/Vue
- **Database**: SQLite (better-sqlite3) — no external database
- **AI Provider**: Groq API — configured via `GROQ_API_KEY` env var
- **Frontend**: No build step — edits to `public/index.html` take effect immediately

<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->

## Technology Stack

## Recommended Approach

## Schema Pattern

- `columns`: `JSON.stringify(string[])` — e.g. `'["name","city","total"]'`
- `rows`: `JSON.stringify(unknown[][])` — e.g. `'[["Alice","NYC",200]]'`
- `error`: null on success, plain string on failure
- Results are fetched with their parent 100% of the time — no benefit to joining
- Row counts are small (UI query results are display-sized, not analytical exports)
- JSON TEXT in SQLite is fast for reads at this cardinality
- Avoids a second INSERT per result row, keeping the write path atomic

## API Pattern

## Frontend Pattern

## What NOT to Do

- **No `result_rows` child table** — adds a JOIN on every read, gains nothing
- **No localStorage as primary store** — 5-10 MB limit, cleared by privacy settings
- **No separate client-side save call** — desync risk if network fails between ask response and save
- **No TypeORM/Prisma/ORM** — raw better-sqlite3 is consistent with existing codebase
- **No session_id now** — auth is out of scope; add `ALTER TABLE` column later if needed

## Confidence

| Recommendation | Confidence | Basis |
|----------------|------------|-------|
| Single `query_history` table with JSON TEXT columns | HIGH | Matches better-sqlite3 pattern; verified against live codebase |
| `JSON.stringify`/`JSON.parse` serialization | HIGH | better-sqlite3 stores TEXT; no library needed |
| Save in `ask` handler server-side | HIGH | Eliminates client-server desync |
| `HistoryModule` mirroring `QueryModule` structure | HIGH | Directly observed pattern in source |
| localStorage as optional read cache only | HIGH | Industry standard; does not affect data integrity |
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
