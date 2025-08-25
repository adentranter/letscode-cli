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
