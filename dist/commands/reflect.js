import fs from "fs-extra";
import path from "path";
import { execa } from "execa";
import prompts from "prompts";
import { ensureLocalScaffold, repoRoot, LOCAL_DIR } from "../lib/paths.js";
import { currentBranch, currentTicket } from "../lib/git.js";
export async function cmdReflect(opts = {}) {
    const root = await repoRoot();
    const { progress } = await ensureLocalScaffold(root);
    // gather snapshot
    const branch = await currentBranch();
    const ticket = await currentTicket();
    let lastCommits = [];
    try {
        const { stdout } = await execa("git", ["log", "-n", "10", "--pretty=format:%H|%ad|%s", "--date=iso-strict"], { cwd: root });
        lastCommits = stdout.split(/\r?\n/).filter(Boolean).map((l) => { const [hash, date, message] = l.split("|"); return { hash, date, message }; });
    }
    catch { }
    let changedFiles = [];
    try {
        const { stdout } = await execa("git", ["diff", "--name-only"], { cwd: root });
        const { stdout: staged } = await execa("git", ["diff", "--name-only", "--cached"], { cwd: root });
        changedFiles = Array.from(new Set([...stdout.split(/\r?\n/).filter(Boolean), ...staged.split(/\r?\n/).filter(Boolean)
        ])).sort();
    }
    catch { }
    // interactive Q&A
    let qna = {};
    if (opts.interactive) {
        qna = await prompts([
            { type: "text", name: "what", message: "What happened since last snapshot?" },
            { type: "text", name: "why", message: "Why did you take this approach?" },
            { type: "text", name: "risks", message: "Any risks or blockers?" },
            { type: "number", name: "percent", message: "Progress % (0-100)", min: 0, max: 100 },
        ]);
        if (typeof qna.percent === "number") {
            const ts = new Date().toISOString();
            await fs.appendFile(progress, JSON.stringify({ ts, percent: Math.floor(qna.percent), gist: (qna.what || "").slice(0, 120) }) + "\n");
        }
    }
    const ts = new Date().toISOString();
    const relDir = path.join(LOCAL_DIR, "context");
    const outDir = path.join(root, relDir);
    await fs.ensureDir(outDir);
    const base = `reflect-${ts.replace(/[:.]/g, "-")}`;
    const mdPath = path.join(outDir, `${base}.md`);
    const jsonPath = path.join(outDir, `${base}.json`);
    const md = [
        `# Reflect ${ts}`,
        ``,
        `- Branch: ${branch}`,
        ticket ? `- Ticket: ${ticket.id}` : `- Ticket: (none)`,
        `- Changed files: ${changedFiles.length}`,
        ``,
        `## Last commits`,
        ...lastCommits.map(c => `- ${c.date} ${c.hash.slice(0, 7)} ${c.message}`),
        ``,
        ...(opts.interactive ? [
            `## Notes`,
            qna.what ? `- What: ${qna.what}` : `- What:`,
            qna.why ? `- Why: ${qna.why}` : `- Why:`,
            qna.risks ? `- Risks: ${qna.risks}` : `- Risks:`,
            typeof qna.percent === 'number' ? `- Progress: ${Math.floor(qna.percent)}%` : `- Progress: (n/a)`,
            ``,
        ] : [])
    ].join("\n");
    const payload = {
        ts,
        branch,
        ticket,
        changedFiles,
        lastCommits,
        ...(opts.interactive ? { qna } : {})
    };
    await fs.outputFile(mdPath, md);
    await fs.outputFile(jsonPath, JSON.stringify(payload, null, 2));
    console.log("[INFO] reflect written:", path.relative(root, mdPath), path.relative(root, jsonPath));
}
