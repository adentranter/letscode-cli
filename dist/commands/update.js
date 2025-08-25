import path from "path";
import fs from "fs-extra";
import prompts from "prompts";
import { ensureLocalScaffold, repoRoot, LOCAL_DIR } from "../lib/paths.js";
import { ensureGitOrThrow, warnIfDefaultBranchDirty } from "../lib/guard.js";
import { currentTicket } from "../lib/git.js";
import { execa } from "execa";
export async function cmdUpdate(message, opts = {}) {
    const root = await repoRoot();
    await ensureGitOrThrow();
    await warnIfDefaultBranchDirty();
    const { events, progress } = await ensureLocalScaffold(root);
    const ticket = await currentTicket();
    if (!ticket)
        throw new Error("Not on a ticket branch (feature/<idx>-<slug> or bug/<idx>-<slug>).");
    let msg = message ?? "";
    let pct = (typeof opts.progress === "number" ? opts.progress : undefined);
    let files = opts.files ? opts.files.split(",").map(s => s.trim()).filter(Boolean) : [];
    let tag = opts.tag;
    if (opts.ask || !msg) {
        const ans = await prompts([
            { type: msg ? null : "text", name: "message", message: "What changed?" },
            { type: pct === undefined ? "number" : null, name: "progress", message: "Progress % now (0-100)?", min: 0, max: 100 },
            { type: files.length ? null : "text", name: "files", message: "Files touched (comma-separated)?", initial: "" },
            { type: tag ? null : "text", name: "tag", message: "Tag (optional)", initial: "" },
        ]);
        msg = msg || ans.message || "";
        pct = pct === undefined ? (typeof ans.progress === "number" ? ans.progress : undefined) : pct;
        files = files.length ? files : (ans.files ? String(ans.files).split(",").map((s) => s.trim()).filter(Boolean) : []);
        tag = tag || (ans.tag ? String(ans.tag) : undefined);
    }
    if (!msg.trim())
        throw new Error("Update message is required (pass it or use --ask).");
    const ts = new Date().toISOString();
    const tdir = path.join(root, LOCAL_DIR, "tickets", ticket.id);
    // elapsed since previous ticket.update
    let elapsedMs = undefined;
    try {
        const ufile = path.join(tdir, "updates.ndjson");
        const content = await fs.readFile(ufile, "utf8");
        const lines = content.trim().split(/\r?\n/).filter(Boolean);
        const last = lines.length ? JSON.parse(lines[lines.length - 1]) : null;
        if (last?.ts)
            elapsedMs = (+new Date(ts)) - (+new Date(last.ts));
    }
    catch { }
    // working tree diff metrics (staged + unstaged)
    let filesChanged = 0;
    let insertions = 0;
    let deletions = 0;
    try {
        const { stdout: unstaged } = await execa("git", ["diff", "--numstat"], { cwd: root });
        const { stdout: staged } = await execa("git", ["diff", "--cached", "--numstat"], { cwd: root });
        const lines = (unstaged + "\n" + staged).split(/\r?\n/).filter(Boolean);
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
    const payload = {
        type: "ticket.update",
        ts,
        ticket: ticket.id,
        branch: ticket.branch,
        message: msg.trim(),
        ...(files.length ? { files } : {}),
        ...(files.length ? { filesTouched: files.length } : {}),
        ...(elapsedMs !== undefined ? { elapsedMs } : {}),
        workingDiff: { filesChanged, insertions, deletions },
        ...(tag ? { tag } : {})
    };
    await fs.appendFile(events, JSON.stringify(payload) + "\n");
    await fs.ensureDir(tdir);
    await fs.appendFile(path.join(tdir, "updates.ndjson"), JSON.stringify(payload) + "\n");
    if (typeof pct === "number" && pct >= 0 && pct <= 100) {
        await fs.appendFile(progress, JSON.stringify({ ts, percent: Math.floor(pct), gist: msg.slice(0, 120) }) + "\n");
        await fs.appendFile(events, JSON.stringify({ type: "progress.set", ts, percent: Math.floor(pct), gist: msg.slice(0, 120) }) + "\n");
    }
    console.log("[INFO] Update recorded", (pct !== undefined ? `| ${pct}%` : ""));
}
