import chalk from "chalk";
import { execa } from "execa";
import { ensureLocalScaffold, repoRoot } from "../lib/paths.js";
import { appendNdjson } from "../lib/util.js";
import { currentBranch, currentTicket } from "../lib/git.js";
export async function cmdCommit(message, opts = { stage: true }) {
    const root = await repoRoot();
    const { events } = await ensureLocalScaffold(root);
    if (!message || !message.trim())
        throw new Error("Commit message is required");
    if (opts.stage !== false) {
        await execa("git", ["add", "-A"], { cwd: root });
    }
    try {
        await execa("git", ["commit", "-m", message], { cwd: root, stdio: "inherit" });
    }
    catch (e) {
        // Exit early if nothing to commit
        if (e?.exitCode) {
            throw new Error("git commit failed (maybe nothing to commit?)");
        }
        throw e;
    }
    const { stdout: hash } = await execa("git", ["rev-parse", "HEAD"], { cwd: root });
    const { stdout: meta } = await execa("git", ["log", "-1", "--pretty=format:%H|%ad|%s", "--date=iso-strict"], { cwd: root });
    const [h, date, subject] = meta.split("|");
    const branch = await currentBranch();
    const ticket = await currentTicket();
    // diff metrics for this commit
    let filesChanged = 0;
    let insertions = 0;
    let deletions = 0;
    try {
        const { stdout: numstat } = await execa("git", ["show", "--numstat", "--format=", h || hash.trim()], { cwd: root });
        const lines = numstat.split(/\r?\n/).filter(Boolean);
        filesChanged = lines.length;
        for (const line of lines) {
            const parts = line.split(/\t/);
            if (parts.length >= 3) {
                const ins = parseInt(parts[0], 10);
                const del = parseInt(parts[1], 10);
                if (Number.isFinite(ins))
                    insertions += ins;
                if (Number.isFinite(del))
                    deletions += del;
            }
        }
    }
    catch { }
    await appendNdjson(events, {
        type: "git.commit",
        ts: new Date().toISOString(),
        hash: h || hash.trim(),
        date,
        subject,
        branch,
        metrics: { filesChanged, insertions, deletions },
        ...(ticket ? { ticket: ticket.id } : {}),
    });
    console.log(chalk.green("[GIT] committed"), hash.trim(), chalk.gray(`(${subject})`));
}
