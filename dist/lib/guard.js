import { execa } from "execa";
import chalk from "chalk";
import { isGitRepo, currentBranch, defaultBranchName } from "./git.js";
export async function ensureGitOrThrow(forceEnv = process.env.LC_FORCE === "1") {
    if (await isGitRepo())
        return;
    if (forceEnv) {
        console.warn(chalk.yellow("[WARN] Not inside a git repo; proceeding due to LC_FORCE=1"));
        return;
    }
    throw new Error("Not inside a git repository. Run `lc install` or set LC_FORCE=1 to override.");
}
export async function warnIfDefaultBranchDirty() {
    try {
        const branch = await currentBranch();
        const def = await defaultBranchName();
        if (branch !== def)
            return;
        const { stdout } = await execa("git", ["status", "--porcelain"]);
        if (stdout.trim()) {
            console.warn(chalk.yellow(`[WARN] You are on ${def} with uncommitted changes.`));
        }
    }
    catch { }
}
