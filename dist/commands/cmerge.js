import chalk from "chalk";
import { execa } from "execa";
import prompts from "prompts";
import fs from "fs-extra";
import path from "path";
import { ensureLocalScaffold, repoRoot, LOCAL_DIR } from "../lib/paths.js";
import { appendNdjson } from "../lib/util.js";
import { currentBranch, currentTicket } from "../lib/git.js";
import { cmdCommit } from "./commit.js";
async function defaultBranch(cwd) {
    try {
        const { stdout } = await execa("git", ["symbolic-ref", "refs/remotes/origin/HEAD"], { cwd });
        const m = stdout.trim().match(/origin\/(.+)$/);
        if (m)
            return m[1];
    }
    catch { }
    // Fallbacks
    for (const name of ["main", "master", "develop"]) {
        try {
            await execa("git", ["show-ref", "--verify", "--quiet", `refs/heads/${name}`], { cwd });
            return name;
        }
        catch { }
    }
    return "main";
}
export async function cmdCmerge(opts = {}) {
    const root = await repoRoot();
    const { events } = await ensureLocalScaffold(root);
    const source = await currentBranch();
    const target = await defaultBranch(root);
    if (source === target)
        throw new Error("Already on default branch");
    // Interactive prompt if no message provided
    const startedInteractive = !opts.message;
    if (startedInteractive) {
        const { finished } = await prompts({
            type: "confirm",
            name: "finished",
            message: `Finish and merge ${source} into ${target}?`,
            initial: true,
        });
        if (!finished) {
            console.log("[INFO] Merge aborted by user.");
            return;
        }
        const ticket = await currentTicket();
        const suggested = ticket
            ? `Merge ${ticket.branch} (${ticket.kind} ${ticket.index}-${ticket.slug}) into ${target}`
            : `Merge ${source} into ${target}`;
        const { msg } = await prompts({ type: "text", name: "msg", message: "Merge message", initial: suggested });
        opts.message = msg || suggested;
        // Acceptance criteria check (if ticket has metadata)
        const t = await currentTicket();
        if (t) {
            const metaPath = path.join(root, LOCAL_DIR, "tickets", t.id, "ticket.json");
            try {
                const meta = await fs.readJSON(metaPath);
                const ac = Array.isArray(meta?.acceptance) ? meta.acceptance : [];
                const alreadyClosed = !!meta?.closedAt;
                if (ac.length && !alreadyClosed) {
                    console.log("\nAcceptance criteria:");
                    ac.forEach((a, i) => console.log(`  ${i + 1}. ${a}`));
                    const { ok } = await prompts({ type: "confirm", name: "ok", message: "Have all acceptance criteria been met?", initial: true });
                    if (!ok) {
                        const { cont } = await prompts({ type: "confirm", name: "cont", message: "Proceed with merge anyway?", initial: false });
                        if (!cont) {
                            console.log("[INFO] Merge aborted.");
                            return;
                        }
                    }
                    else {
                        const { note } = await prompts({ type: "text", name: "note", message: "Acceptance note (optional)" });
                        const ts = new Date().toISOString();
                        await fs.outputFile(metaPath, JSON.stringify({ ...meta, closedAt: ts, acceptanceNote: note || "" }, null, 2));
                        await appendNdjson(events, { type: "ticket.accepted", ts, ticket: t.id, acceptance: ac, note: note || "" });
                    }
                }
            }
            catch { }
        }
    }
    // Ensure working tree is clean (or offer to commit in interactive mode)
    let dirty = false;
    try {
        await execa("git", ["diff", "--quiet"], { cwd: root });
        await execa("git", ["diff", "--cached", "--quiet"], { cwd: root });
    }
    catch {
        dirty = true;
    }
    if (dirty) {
        if (!startedInteractive) {
            // Non-interactive (message provided) -> do not surprise-user; require clean tree
            throw new Error("Uncommitted changes present. Commit or stash before merging.");
        }
        const { doCommit } = await prompts({ type: "confirm", name: "doCommit", message: "Uncommitted changes detected. Commit them now and continue?", initial: true });
        if (!doCommit) {
            console.log("[INFO] Merge aborted due to dirty working tree.");
            return;
        }
        const t = await currentTicket();
        const suggestedCommit = t ? `chore(${t.kind}/${t.index}-${t.slug}): finish before merge` : `chore(${source}): finish before merge`;
        const { cm } = await prompts({ type: "text", name: "cm", message: "Commit message", initial: suggestedCommit });
        await cmdCommit(cm || suggestedCommit, { stage: true });
    }
    // Optional: run build if package.json has it and not skipped
    if (!opts.skipBuild) {
        try {
            await execa("npm", ["run", "build"], { cwd: root, stdio: "inherit" });
        }
        catch { }
    }
    // Fetch latest
    try {
        await execa("git", ["fetch", "--all"], { cwd: root, stdio: "inherit" });
    }
    catch { }
    // Switch to target and merge
    await execa("git", ["checkout", target], { cwd: root, stdio: "inherit" });
    try {
        await execa("git", ["merge", "--no-ff", source, "-m", opts.message || `Merge ${source} into ${target}`], { cwd: root, stdio: "inherit" });
    }
    catch (e) {
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
