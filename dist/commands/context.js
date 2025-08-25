import fs from "fs-extra";
import path from "path";
import { execa } from "execa";
import { ensureLocalScaffold, repoRoot, LOCAL_DIR } from "../lib/paths.js";
import { currentTicket } from "../lib/git.js";
function parseLastNonEmptyLine(s) {
    const lines = s.trim().split(/\r?\n/).filter(Boolean);
    if (!lines.length)
        return null;
    try {
        return JSON.parse(lines[lines.length - 1]);
    }
    catch {
        return null;
    }
}
export async function cmdContext(opts = { stdout: false }) {
    const root = await repoRoot();
    const { progress, todo } = await ensureLocalScaffold(root);
    const latestProgress = await fs.readFile(progress, "utf8").then(parseLastNonEmptyLine).catch(() => null);
    const todos = await fs.readJSON(todo).catch(() => []);
    const openTodos = todos.filter((t) => !t.doneAt).map((t) => ({ title: t.title, files: t.files, createdAt: t.createdAt }));
    // git info
    let commits = [];
    try {
        const { stdout } = await execa("git", ["log", "-n", "5", "--pretty=format:%H|%ad|%s", "--date=iso-strict"], { cwd: root });
        commits = stdout.split(/\r?\n/).filter(Boolean).map((line) => {
            const [hash, date, message] = line.split("|");
            return { hash, date, message };
        });
    }
    catch { }
    const ticket = await currentTicket();
    let ticketUpdatesTail = [];
    if (ticket) {
        const tfile = path.join(root, LOCAL_DIR, "tickets", ticket.id, "updates.ndjson");
        try {
            const content = await fs.readFile(tfile, "utf8");
            const lines = content.trim().split(/\r?\n/).filter(Boolean);
            const tail = lines.slice(-10);
            ticketUpdatesTail = tail.map((l) => { try {
                return JSON.parse(l);
            }
            catch {
                return null;
            } }).filter(Boolean);
        }
        catch { }
    }
    const out = {
        ts: new Date().toISOString(),
        branch: ticket?.branch ?? null,
        ticket: ticket ?? null,
        latestProgress,
        todosOpen: openTodos,
        lastCommits: commits,
        ticketUpdatesTail,
    };
    // Always refresh the file Claude reads
    const outFile = path.join(root, ".letscode", "claude-context.json");
    await fs.outputFile(outFile, JSON.stringify(out, null, 2));
    if (opts.stdout) {
        process.stdout.write(JSON.stringify(out, null, 2) + "\n");
    }
    else {
        console.log("[INFO] context updated:", outFile);
    }
}
