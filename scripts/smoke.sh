#!/usr/bin/env bash
set -euo pipefail

echo "[SMOKE] starting"

TMPDIR=$(mktemp -d 2>/dev/null || mktemp -d -t 'lc-smoke')
echo "[SMOKE] temp repo: $TMPDIR"

pushd "$TMPDIR" >/dev/null

# Init git repo with main branch and initial commit
if git init -b main >/dev/null 2>&1; then :; else
  git init >/dev/null
  git checkout -b main >/dev/null 2>&1 || true
fi
echo "# smoke" > README.md
git add .
git commit -m "chore: init smoke repo" >/dev/null

echo "[SMOKE] lc init"
lc init | cat

echo "[SMOKE] lc where"
lc where | cat

echo "[SMOKE] lc status --json"
lc status --json | cat

echo "[SMOKE] create feature"
lc feature "Smoke Feature" --readme | cat

echo "hello" > foo.txt
echo "[SMOKE] lc commit"
lc commit "smoke: add foo" | cat || true

echo "[SMOKE] lc update"
lc update "first note" --progress 15 --files foo.txt | cat

echo "[SMOKE] lc todo add/list"
lc todo add "Task A" --files foo.txt | cat
lc todo list | cat

echo "[SMOKE] lc context --stdout"
lc context --stdout | cat

echo "[SMOKE] merge to main"
lc cmerge --skip-build --message "smoke: merge feature" | cat

echo "[SMOKE] final status --json"
lc status --json | cat

popd >/dev/null

echo "[SMOKE] done"


