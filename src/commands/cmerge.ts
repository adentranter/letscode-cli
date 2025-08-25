import chalk from "chalk";
import { execa } from "execa";
import { ensureLocalScaffold, repoRoot } from "../lib/paths.js";
import { appendNdjson } from "../lib/util.js";
import { currentBranch } from "../lib/git.js";

async function defaultBranch(cwd: string): Promise<string> {
  try {
    const { stdout } = await execa("git", ["symbolic-ref", "refs/remotes/origin/HEAD"], { cwd });
    const m = stdout.trim().match(/origin\/(.+)$/);
    if (m) return m[1];
  } catch {}
  // Fallbacks
  for (const name of ["main", "master", "develop"]) {
    try { await execa("git", ["show-ref", "--verify", "--quiet", `refs/heads/${name}`], { cwd }); return name; } catch {}
  }
  return "main";
}

export async function cmdCmerge(opts: { message?: string; skipBuild?: boolean } = {}) {
  const root = await repoRoot();
  const { events } = await ensureLocalScaffold(root);
  const source = await currentBranch();
  const target = await defaultBranch(root);

  if (source === target) throw new Error("Already on default branch");

  // Optional: run build if package.json has it and not skipped
  if (!opts.skipBuild) {
    try { await execa("npm", ["run", "build"], { cwd: root, stdio: "inherit" }); } catch {}
  }

  // Ensure working tree is clean
  try { await execa("git", ["diff", "--quiet"], { cwd: root }); await execa("git", ["diff", "--cached", "--quiet"], { cwd: root }); }
  catch { throw new Error("Uncommitted changes present. Commit or stash before merging."); }

  // Fetch latest
  try { await execa("git", ["fetch", "--all"], { cwd: root, stdio: "inherit" }); } catch {}

  // Switch to target and merge
  await execa("git", ["checkout", target], { cwd: root, stdio: "inherit" });
  try {
    await execa("git", ["merge", "--no-ff", source, "-m", opts.message || `Merge ${source} into ${target}`], { cwd: root, stdio: "inherit" });
  } catch (e) {
    console.error(chalk.red("[GIT] merge failed. Resolve conflicts and commit manually."));
    throw e;
  }

  // Append event
  await appendNdjson(events, {
    type: "git.merge",
    ts: new Date().toISOString(),
    source,
    target,
  });

  console.log(chalk.green("[GIT] merged"), source, chalk.gray("→"), target);
}


