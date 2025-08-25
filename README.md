# letscode (lc)

Local-first project planning, ticket updates, and Claude Code wiring.

## Install (dev)
```bash
npm install
npm run build
npm link     # exposes `lc` globally
```

## One-shot setup
```bash
lc install   # verify git, scaffold .letscode & ~/.letscode, add Claude hook
lc doctor
lc status
```

## Start work
```bash
lc feature "Auth refresh" --readme
lc update "scaffolded session routes" --progress 15 --files src/auth.ts,src/session.ts
lc backup sync
```

Everything is stored per-repo in `./.letscode/` and mirrored backup in `~/.letscode/backups/<id-repo>/.letscode`.


letscode (lc)

Local-first work journal + ticket glue for git repos.
lc turns each branch into a lightweight “ticket,” logs quick updates/progress as you work, and mirrors everything to a home-directory backup. It also wires in Claude Code so your repo context is always at your fingertips.

What it does

Starts work with intent: lc feature "…" [--readme] / lc bug "…" creates a ticket folder and branch (feature/<idx>-<slug>), optional README scaffold.

Captures updates fast: lc update "what changed" [--progress N] [--files a,b] [--ask] appends a timestamped note tied to the current ticket branch (and, optionally, a % snapshot).

Keeps a clean local store: writes everything to ./.letscode/ (events, progress, ticket updates, todos later).

Backs up automatically: lc backup sync|watch|restore mirrors ./.letscode/ to ~/.letscode/backups/<id-repo>/.letscode.

Claude Code ready: lc install adds a SessionStart hook so Claude automatically ingests .letscode/claude-context.json when you open it in the repo.

Why it’s useful

Zero cloud, zero friction: append-only NDJSON + JSON files you can diff, grep, and script.

Timeline you can replay: updates + progress snapshots create a living audit of scope and pace.

Cross-repo safety: your home backup mirrors the exact local data—portable and restorable.

AI in the loop: Claude sees your repo context by default; ask it for next steps, risks, or summaries.

What gets stored

Per repo (./.letscode/):

events.ndjson – everything notable (ticket.update, feature.create, progress.set, …)

progress.ndjson – { ts, percent, gist } snapshots

tickets/<kind-idx-slug>/updates.ndjson – notes tied to that ticket/branch

claude-context.json – seed/summary file Claude can read (expand as you go)

Global backup (~/.letscode/backups/<id-repo>/.letscode):

One-to-one mirror of the repo’s .letscode/ for easy restore (lc backup restore --force).

Typical workflow

# one-time setup in a repo
lc install        # verifies git, scaffolds .letscode, adds Claude hook

# start work
lc feature "Auth refresh" --readme
# ...code...
lc update "scaffolded session routes" --progress 15 --files src/auth.ts,src/session.ts
# ...more code...
lc update --ask   # prompts for message/%/files/tag

# backup
lc backup sync    # or `lc backup watch` while you work

# quick glance
lc status

## Command quick reference

Common:
- status: `lc status` (alias: `lc s`)
- feature: `lc feature "Title" --readme` (alias: `lc f`)
- bug: `lc bug "Title" --readme` (alias: `lc b`)
- update: `lc update "msg" --progress 25 --files a,b` (aliases: `lc u`, `lc ua` for prompt)
- todos: `lc todo add/list/done/rm` (aliases: `lc ta/tl/td/tr`)
- context: `lc context --stdout` (alias: `lc x`)
- watch: `lc watch --interval 10m` (alias: `lc w`)
- commit: `lc commit "msg"` (alias: `lc c`)
- merge: `lc merge` (alias: `lc m`) — interactive, can auto-commit dirty changes
- reflect: `lc reflect [--interactive]` (aliases: `lc r`, `lc ri`)
- metrics: `lc metrics rollup|predict|view` (aliases: `lc mr/mp/mv`)
- impact: `lc impact scan|set` (aliases: `lc is/it`)
- baseline: `lc baseline [--force]`
- backup: `lc backup sync|watch|restore [--force]`

## Examples

- Start a feature quickly
```bash
lc f "Auth refresh" --readme
```

- Log a quick prompted update every 10 minutes
```bash
lc w --interval 10m
```

- Merge current ticket interactively
```bash
lc m
```

- Generate baseline via Claude/local
```bash
lc baseline
```

## Data captured & insights

What lc records to help you reason about work and pace:

- Events (`.letscode/events.ndjson`)
  - feature.create / bug.create: id, branch, createdAt
  - ticket.update: message, files, filesTouched, elapsedMs since last update, workingDiff { filesChanged, insertions, deletions }, optional tag
  - progress.set: { ts, percent, gist }
  - git.commit: hash, subject, metrics { filesChanged, insertions, deletions }
  - git.merge: source→target, metrics accumulated over merge range
  - ticket.accepted: acceptance list, note, duration_hours (created→closed)

- Tickets (`.letscode/tickets/<id>/`)
  - ticket.json: metadata from --interactive (goal, acceptance, estimate, stakeholders, risks), closure { closedAt, actualHours }, aiEstimateHours
  - updates.ndjson: per-ticket notes timeline
  - progress.ndjson: per-ticket percent snapshots (from `lc fin`)

- Context & baselines
  - claude-context.json: snapshot used for AI reports
  - baseline.json: Claude (or local) repo baseline summary
  - project-summary.md: retake-generated high-level summary

- Metrics (`.letscode/metrics/`)
  - progress_timeseries.csv, todos_timeseries.csv
  - velocity.json: dailyVelocity and ETA
  - tickets.csv: estimates vs actuals (hours, variance)
  - viewer.html: simple charts for progress/TODOs

- Registry (`.letscode/registry/`)
  - impact-scan.json: prisma models, SQL tables, OpenAPI paths, recent hot files

AI-powered summaries
- `lc report --ai`: concise narrative status report saved to `.letscode/report-ai.md`
- `lc retake`: refresh scan/context/baseline and write `project-summary.md` (optionally inject into README between `<!-- lc:summary:start -->` and `<!-- lc:summary:end -->`)
- `lc prompt start|voice|analyze`: scaffold `srcPlanning/.../PROMPT.md`, run a Claude session, then generate `ANALYSIS.md` and store `aiEstimateHours`

Finish flow
- `lc fin` records a final ticket note and per-ticket progress, runs interactive merge with acceptance check, marks the ticket closed, then runs a `retake` to refresh summaries.
