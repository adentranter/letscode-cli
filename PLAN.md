Phase 1 — MVP polish (ship this first)

TODOs (CRUD)

Commands: lc todo add "<title>" [--files a,b], lc todo list, lc todo done <idx>, lc todo rm <idx>.

Storage: ./.letscode/todo.json (array).

Status should show open count.

Context bundle for Claude (pipeable)

Command: lc context --stdout

Output JSON: latest progress, open TODOs, current ticket (from branch), last 5 commits (hash/date/msg), per-ticket updates tail.

Use: lc context --stdout | claude -p "Plan the next 3 steps."

where & DX niceties

lc where → print repo path, local store path, backup path.

lc status --json → machine-readable.

Docs & help

Flesh out README with the intro you wrote, quick start, and command table.

Ensure every command has .description() in the CLI.

Phase 2 — Insight & cadence

Reflect snapshot

lc reflect [--interactive]

Writes:

./.letscode/context/reflect-<ts>.md (git branch, last 10 commits, touched files)

Optional Q&A (what/why/risks/next) also as JSON (reflect-<ts>.json)

If --interactive, prompt and auto-append a progress snapshot.

Metrics

lc metrics rollup → export CSVs:

metrics/progress_timeseries.csv (ts,percent,gist)

metrics/todos_timeseries.csv (ts,todo_count)

lc metrics predict → simple %/day + ETA saved to metrics/velocity.json

lc metrics view → generate metrics/viewer.html (local JS canvas line charts).

Watch & nudge

lc watch [--interval 10m]

Detect file changes (chokidar); every interval if changes seen:

Prompt for quick update (message, optional %, files).

Append to events + per-ticket updates; optionally auto-add TODO.

Phase 3 — Scope & lifecycle

Impact scan & set

lc impact scan → naive detectors:

Prisma models (schema.prisma), SQL tables (db/schema.sql), OpenAPI paths (openapi.yaml), hot files from git log.

Save registries under ./.letscode/registry/.

lc impact set --tables a,b --apis /v1/x,/v1/y --files f,g

Save per-ticket scope ./.letscode/tickets/<ticket-id>.json.

Interactive ticket start

lc feature "…" --interactive [--readme] (same for bug)

Ask: goal, acceptance, estimate, stakeholders, risks; seed README and tickets/<id>.json.

Finish/merge workflow

lc done [--skip-build] [-m "msg"]

Detect package manager, run build if present, merge into main with --no-ff, delete branch on success.

Phase 4 — Config, cross-repo, polish

Config

./.letscode/config.json (or ~/.letscode/config.json defaults): prompt intervals, default PM, reflect questions on/off, etc.

Command: lc config edit (opens in $EDITOR).

Global views

lc backups list/open → enumerate ~/.letscode/backups/*.

lc doctor --all → checks across repos (optional).

Quality

Windows quoting pass (double-quotes in examples, avoid bash-only).

Basic tests for utils (slugify, nextIndex, codebase snapshot).

Guardrails (don’t write if not in git unless --force, clear errors).

Minimal task breakdown (copy to your tracker)