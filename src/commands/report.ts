import fs from "fs-extra";
import path from "path";
import { execa } from "execa";
import { ensureLocalScaffold, repoRoot, LOCAL_DIR, BASE_DIR } from "../lib/paths.js";
import { currentTicket } from "../lib/git.js";
import { has } from "../lib/system.js";
import { cmdContext } from "./context.js";

function bar(percent: number, width = 20) {
  const p = Math.max(0, Math.min(100, Math.floor(percent)));
  const filled = Math.round((p / 100) * width);
  return `[${"#".repeat(filled)}${".".repeat(width - filled)}] ${p}%`;
}

export async function cmdReport(opts?: { ai?: boolean }) {
  const root = await repoRoot();
  const { progress, todo } = await ensureLocalScaffold(root);

  // progress
  let lastProg: any = null;
  try {
    const s = await fs.readFile(progress, "utf8");
    const last = s.trim().split(/\r?\n/).filter(Boolean).pop();
    if (last) lastProg = JSON.parse(last);
  } catch {}

  // todos
  const todos: any[] = await fs.readJSON(todo).catch(()=>[]);
  const openTodos = todos.filter(t=>!t.doneAt);

  // ticket
  const ticket = await currentTicket();

  // commits
  let commits: { hash: string; date: string; message: string }[] = [];
  try {
    const { stdout } = await execa("git", ["log", "-n", "5", "--pretty=format:%h|%ad|%s", "--date=short"], { cwd: root });
    commits = stdout.split(/\r?\n/).filter(Boolean).map(l=>{ const [h,d,m]=l.split("|"); return { hash:h, date:d, message:m }; });
  } catch {}

  // velocity
  let velocity: any = null;
  try { velocity = await fs.readJSON(path.join(root, LOCAL_DIR, "metrics", "velocity.json")); } catch {}

  // counts
  const fdir = path.join(root, BASE_DIR, "features");
  const bdir = path.join(root, BASE_DIR, "bugs");
  const f = (await fs.pathExists(fdir)) ? (await fs.readdir(fdir)).length : 0;
  const b = (await fs.pathExists(bdir)) ? (await fs.readdir(bdir)).length : 0;

  // events-driven insights
  const eventsFile = path.join(root, LOCAL_DIR, "events.ndjson");
  let updates: any[] = [];
  let recentDiff = { filesChanged: 0, insertions: 0, deletions: 0 };
  let ticketAccepted: any | null = null;
  let aiEstimateHours: number | undefined = undefined;
  try {
    const raw = await fs.readFile(eventsFile, "utf8");
    const lines = raw.split(/\r?\n/).filter(Boolean).map(l=>{ try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    if (ticket) {
      updates = lines.filter((e:any)=>e.type==="ticket.update" && e.ticket===ticket.id).slice(-5);
      const accepted = lines.reverse().find((e:any)=>e.type==="ticket.accepted" && e.ticket===ticket.id);
      ticketAccepted = accepted || null;
    } else {
      updates = lines.filter((e:any)=>e.type==="ticket.update").slice(-5);
    }
    // accumulate commit/merge diff metrics from last ~20 events
    for (const e of lines.slice(-50)) {
      if ((e.type==="git.commit" || e.type==="git.merge") && e.metrics) {
        recentDiff.filesChanged += e.metrics.filesChanged||0;
        recentDiff.insertions += e.metrics.insertions||0;
        recentDiff.deletions += e.metrics.deletions||0;
      }
    }
  } catch {}

  // read aiEstimateHours from ticket meta if present
  if (ticket) {
    try {
      const meta = await fs.readJSON(path.join(root, LOCAL_DIR, "tickets", ticket.id, "ticket.json"));
      if (typeof meta?.aiEstimateHours === 'number') aiEstimateHours = meta.aiEstimateHours;
    } catch {}
  }

  if (opts?.ai) {
    // Ensure context is fresh, then ask Claude for a concise narrative report
    try { await cmdContext({ stdout: false }); } catch {}
    const ctxFile = path.join(root, LOCAL_DIR, "claude-context.json");
    let input = "{}";
    try { input = await fs.readFile(ctxFile, "utf8"); } catch {}
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
      } catch {
        // fall through to ASCII if Claude fails
      }
    }
  }

  // print ASCII report
  console.log("\nLETSCODE REPORT\n================\n");
  console.log(`Branch   : ${ticket?.branch ?? '(not on ticket)'}`);
  console.log(`Tickets  : total=${f+b} features=${f} bugs=${b}`);
  if (lastProg) {
    console.log(`Progress : ${bar(lastProg.percent)}  ${lastProg.gist ? '- ' + lastProg.gist : ''}`);
  } else {
    console.log("Progress : [....................] 0%" );
  }
  console.log("");
  if (updates.length) {
    console.log("Updates  : (latest)");
    for (const u of updates) {
      const mins = typeof u.elapsedMs === 'number' ? ` | +${Math.round(u.elapsedMs/60000)}m` : "";
      const diff = u.workingDiff ? ` | Δ ${u.workingDiff.filesChanged}/${u.workingDiff.insertions}+/${u.workingDiff.deletions}-` : "";
      const files = typeof u.filesTouched === 'number' ? ` | files ${u.filesTouched}` : "";
      console.log(`  - ${u.message}${mins}${files}${diff}`);
    }
    console.log("");
  }
  console.log(`TODOs    : ${openTodos.length} open`);
  openTodos.slice(0,5).forEach((t,i)=>console.log(`  ${i+1}. ${t.title}${t.files?.length? ' ['+t.files.join(', ')+']':''}`));
  if (openTodos.length > 5) console.log(`  ... +${openTodos.length-5} more`);
  console.log("");
  console.log("Commits  :");
  commits.forEach(c=>console.log(`  ${c.date} ${c.hash} ${c.message}`));
  if (recentDiff.filesChanged || recentDiff.insertions || recentDiff.deletions) {
    console.log(`  Δ recent: ${recentDiff.filesChanged} files, +${recentDiff.insertions}/-${recentDiff.deletions}`);
  }
  if (velocity) {
    console.log("");
    console.log(`Velocity : ${velocity.dailyVelocity || 0}%/day  | ETA: ${velocity.etaDate || 'n/a'}`);
  }
  if (ticket && (aiEstimateHours!==undefined || ticketAccepted)) {
    const actual = ticketAccepted?.duration_hours;
    console.log("");
    console.log("Estimate :" + (aiEstimateHours!==undefined ? ` AI≈${aiEstimateHours}h` : "") + (actual!==undefined ? ` | actual≈${Number(actual).toFixed(1)}h` : ""));
  }
  console.log("");
}


