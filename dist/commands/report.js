import fs from "fs-extra";
import path from "path";
import { execa } from "execa";
import { ensureLocalScaffold, repoRoot, LOCAL_DIR, BASE_DIR } from "../lib/paths.js";
import { currentTicket } from "../lib/git.js";
import { has } from "../lib/system.js";
import { cmdContext } from "./context.js";
function bar(percent, width = 20) {
    const p = Math.max(0, Math.min(100, Math.floor(percent)));
    const filled = Math.round((p / 100) * width);
    return `[${"#".repeat(filled)}${".".repeat(width - filled)}] ${p}%`;
}
export async function cmdReport(opts) {
    const root = await repoRoot();
    const { progress, todo } = await ensureLocalScaffold(root);
    // progress
    let lastProg = null;
    try {
        const s = await fs.readFile(progress, "utf8");
        const last = s.trim().split(/\r?\n/).filter(Boolean).pop();
        if (last)
            lastProg = JSON.parse(last);
    }
    catch { }
    // todos
    const todos = await fs.readJSON(todo).catch(() => []);
    const openTodos = todos.filter(t => !t.doneAt);
    // ticket
    const ticket = await currentTicket();
    // commits
    let commits = [];
    try {
        const { stdout } = await execa("git", ["log", "-n", "5", "--pretty=format:%h|%ad|%s", "--date=short"], { cwd: root });
        commits = stdout.split(/\r?\n/).filter(Boolean).map(l => { const [h, d, m] = l.split("|"); return { hash: h, date: d, message: m }; });
    }
    catch { }
    // velocity
    let velocity = null;
    try {
        velocity = await fs.readJSON(path.join(root, LOCAL_DIR, "metrics", "velocity.json"));
    }
    catch { }
    // counts
    const fdir = path.join(root, BASE_DIR, "features");
    const bdir = path.join(root, BASE_DIR, "bugs");
    const f = (await fs.pathExists(fdir)) ? (await fs.readdir(fdir)).length : 0;
    const b = (await fs.pathExists(bdir)) ? (await fs.readdir(bdir)).length : 0;
    if (opts?.ai) {
        // Ensure context is fresh, then ask Claude for a concise narrative report
        try {
            await cmdContext({ stdout: false });
        }
        catch { }
        const ctxFile = path.join(root, LOCAL_DIR, "claude-context.json");
        let input = "{}";
        try {
            input = await fs.readFile(ctxFile, "utf8");
        }
        catch { }
        if (await has("claude")) {
            const prompt = [
                "You are a repository assistant. Read the provided JSON context and produce a brief, high-signal status report.",
                "Structure:",
                "- Ticket/branch (if any)",
                "- Latest progress (% + gist)",
                "- Top 3 TODOs",
                "- Recent commits (up to 5)",
                "- Risks and next steps (concise)",
                "Output as plain text, no code fences.",
            ].join("\n");
            try {
                const { stdout } = await execa("claude", ["-p", prompt], { cwd: root, input });
                const outPath = path.join(root, LOCAL_DIR, "report-ai.md");
                await fs.outputFile(outPath, stdout.trim() + "\n");
                process.stdout.write(stdout.trim() + "\n");
                return;
            }
            catch {
                // fall through to ASCII if Claude fails
            }
        }
    }
    // print ASCII report
    console.log("\nLETSCODE REPORT\n================\n");
    console.log(`Branch   : ${ticket?.branch ?? '(not on ticket)'}`);
    console.log(`Tickets  : total=${f + b} features=${f} bugs=${b}`);
    if (lastProg) {
        console.log(`Progress : ${bar(lastProg.percent)}  ${lastProg.gist ? '- ' + lastProg.gist : ''}`);
    }
    else {
        console.log("Progress : [....................] 0%");
    }
    console.log("");
    console.log(`TODOs    : ${openTodos.length} open`);
    openTodos.slice(0, 5).forEach((t, i) => console.log(`  ${i + 1}. ${t.title}${t.files?.length ? ' [' + t.files.join(', ') + ']' : ''}`));
    if (openTodos.length > 5)
        console.log(`  ... +${openTodos.length - 5} more`);
    console.log("");
    console.log("Commits  :");
    commits.forEach(c => console.log(`  ${c.date} ${c.hash} ${c.message}`));
    if (velocity) {
        console.log("");
        console.log(`Velocity : ${velocity.dailyVelocity || 0}%/day  | ETA: ${velocity.etaDate || 'n/a'}`);
    }
    console.log("");
}
