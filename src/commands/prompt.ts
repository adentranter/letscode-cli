import fs from "fs-extra";
import path from "path";
import { repoRoot, BASE_DIR } from "../lib/paths.js";
import { currentTicket } from "../lib/git.js";
import { execa } from "execa";
import { has } from "../lib/system.js";

export async function cmdPromptStart(opts: { open?: boolean } = {}) {
  const root = await repoRoot();
  const t = await currentTicket();
  if (!t) throw new Error("Not on a ticket branch");
  const dir = path.join(root, BASE_DIR, t.kind === 'feature' ? 'features' : 'bugs', `${t.index}-${t.slug}`);
  await fs.ensureDir(dir);
  const file = path.join(dir, "PROMPT.md");
  if (!(await fs.pathExists(file))) {
    const body = `# Prompt: ${t.slug}\n\nYou are helping with ${t.kind} ${t.index}. Goal: (fill from ticket).\n\nPlease draft a short PRD in this folder.\n`;
    await fs.outputFile(file, body);
  }
  if (opts.open) {
    try { await execa("open", [file], { stdio: "inherit" }); } catch { /* noop */ }
  }
  console.log("[INFO] prompt ready:", path.relative(root, file));
}

export async function cmdPromptVoice(opts: { mic?: boolean } = {}) {
  const root = await repoRoot();
  const t = await currentTicket();
  if (!t) throw new Error("Not on a ticket branch");
  const dir = path.join(root, BASE_DIR, t.kind === 'feature' ? 'features' : 'bugs', `${t.index}-${t.slug}`);
  await fs.ensureDir(dir);
  const promptFile = path.join(dir, "PROMPT.md");
  if (!(await fs.pathExists(promptFile))) {
    await fs.outputFile(promptFile, `# Prompt: ${t.slug}\n\nPlease draft a PRD for this ${t.kind}.\n`);
  }
  const seed = [
    `You are connected to this repo. Ticket: ${t.id} (${t.branch}).`,
    `Task: Create a concise PRD for this work. Save content to: ${path.relative(root, promptFile)}.`,
    `Rules: Keep it actionable: goals, scope, acceptance, risks, milestones.`,
    `Acknowledge and begin by outlining the PRD sections, then fill them.`
  ].join("\n");
  if (!(await has("claude"))) {
    console.log("[WARN] Claude CLI not found. Open the file instead:", promptFile);
    try { await execa("open", [promptFile], { stdio: "inherit" }); } catch {}
    return;
  }
  const args = ["-p", seed];
  if (opts.mic) args.push("--mic");
  await execa("claude", args, { cwd: root, stdio: "inherit" });

  // After session ends, run retake and analysis
  try {
    const { cmdRetake } = await import("./retake.js");
    await cmdRetake({ updateReadme: false });
  } catch {}
  try {
    await cmdPromptAnalyze();
  } catch {}
}

export async function cmdPromptAnalyze() {
  const root = await repoRoot();
  const t = await currentTicket();
  if (!t) throw new Error("Not on a ticket branch");
  const dir = path.join(root, BASE_DIR, t.kind === 'feature' ? 'features' : 'bugs', `${t.index}-${t.slug}`);
  const promptFile = path.join(dir, "PROMPT.md");
  if (!(await fs.pathExists(promptFile))) {
    const seed = `# Prompt: ${t.slug}\n\nGoal: \nScope: \nAcceptance: \nRisks: \nMilestones: \n`;
    await fs.ensureDir(dir);
    await fs.outputFile(promptFile, seed);
    console.log("[INFO] created missing PROMPT.md");
  }
  const input = await fs.readFile(promptFile, "utf8");
  const out = path.join(dir, "ANALYSIS.md");
  if (!(await has("claude"))) {
    await fs.outputFile(out, "(Claude CLI not found)\n" + input);
    console.log("[WARN] Claude CLI not found; wrote ANALYSIS.md with prompt content");
    return;
  }
  const seed = [
    "You are an engineering lead. Analyze the attached PRD prompt in the context of the repo.",
    "Output a brief analysis covering: complexity (S/M/L), key risks, dependencies, test strategy, and a 3-step plan.",
    "Be concrete and concise.",
  ].join("\n");
  const { stdout } = await execa("claude", ["-p", seed], { cwd: root, input });
  const text = stdout.trim();
  await fs.outputFile(out, text+"\n");
  // parse rough estimate from analysis (e.g., "~8h", "2d", S/M/L)
  let estH: number | null = null;
  const m = text.match(/(~?\s*(\d+(?:\.\d+)?)([hdw]))/i) || text.match(/\b(S|M|L)\b/i);
  if (m) {
    if (m[2]) {
      const n = parseFloat(m[2]);
      const unit = m[3].toLowerCase();
      estH = unit === 'h' ? n : unit === 'd' ? n*8 : unit === 'w' ? n*40 : null;
    } else if (m[1]) {
      estH = m[1].toUpperCase()==='S' ? 4 : m[1].toUpperCase()==='M' ? 16 : 40; // heuristics
    }
  }
  if (estH!==null) {
    const t = await currentTicket();
    if (t) {
      const metaPath = path.join(root, BASE_DIR, t.kind === 'feature' ? 'features' : 'bugs', `${t.index}-${t.slug}`, "README.md");
      const ticketMeta = path.join(root, ".letscode", "tickets", t.id, "ticket.json");
      try {
        const cur = await fs.readJSON(ticketMeta).catch(()=>({}));
        await fs.outputJSON(ticketMeta, { ...cur, aiEstimateHours: Number(estH.toFixed(1)) }, { spaces: 2 });
      } catch {}
    }
  }
  console.log("[INFO] analysis written:", path.relative(root, out));
}

