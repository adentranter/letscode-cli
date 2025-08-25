import fs from "fs-extra";
import path from "path";
import { execa } from "execa";
import { ensureLocalScaffold, repoRoot, LOCAL_DIR } from "../lib/paths.js";
import { has } from "../lib/system.js";

type Baseline = {
  name: string;
  summary: string;
  techStack: string[];
  directories: string[];
  keyFiles: string[];
  commands: string[];
  scripts?: Record<string, string>;
  domains?: string[];
  services?: string[];
  apis?: string[];
  dataModels?: string[];
  risks?: string[];
  nextSteps?: string[];
  generatedAt: string;
};

async function readPackageJson(root: string): Promise<any> {
  try { return await fs.readJSON(path.join(root, "package.json")); } catch { return {}; }
}

async function readImpact(root: string) {
  try { return await fs.readJSON(path.join(root, LOCAL_DIR, "registry", "impact-scan.json")); } catch { return {}; }
}

async function listTopDirs(root: string): Promise<string[]> {
  const all = await fs.readdir(root).catch(()=>[] as string[]);
  return all.filter(n=>!n.startsWith('.') && !["node_modules", LOCAL_DIR, ".git"].includes(n) && !n.endsWith(".log"));
}

async function listKeyFiles(root: string): Promise<string[]> {
  const candidates = ["README.md", "PLAN.md", "tsconfig.json", "package.json", "openapi.yaml", "prisma/schema.prisma"]; 
  const out: string[] = [];
  for (const rel of candidates) { if (await fs.pathExists(path.join(root, rel))) out.push(rel); }
  return out;
}

async function recentCommits(root: string): Promise<string[]> {
  try {
    const { stdout } = await execa("git", ["log", "-n", "20", "--pretty=format:%ad %h %s", "--date=short"], { cwd: root });
    return stdout.split(/\r?\n/).filter(Boolean);
  } catch { return []; }
}

function buildPrompt(): string {
  return [
    "You are a repository analyst. Generate a baseline.json that summarizes this repo.",
    "Input on stdin is a JSON context describing current ticket, progress, todos, and last commits.",
    "Output MUST be a single JSON object only (no prose), with keys:",
    "{",
    "  name: string,",
    "  summary: string,",
    "  techStack: string[],",
    "  directories: string[],",
    "  keyFiles: string[],",
    "  commands: string[],",
    "  scripts?: { [name]: string },",
    "  domains?: string[], services?: string[], apis?: string[], dataModels?: string[],",
    "  risks?: string[], nextSteps?: string[]",
    "}",
    "Keep it concise and factual based on the input and typical JS/TS repos.",
  ].join("\n");
}

function tryParseJson(output: string): any | null {
  const t = output.trim();
  const fence = t.match(/```(?:json)?\n([\s\S]*?)```/i);
  if (fence) { try { return JSON.parse(fence[1]); } catch {} }
  try { return JSON.parse(t); } catch {}
  const i = t.indexOf("{"); const j = t.lastIndexOf("}");
  if (i !== -1 && j !== -1 && j > i) { try { return JSON.parse(t.slice(i, j+1)); } catch {} }
  return null;
}

async function localBaseline(root: string): Promise<Baseline> {
  const pj = await readPackageJson(root);
  const impact = await readImpact(root);
  const dirs = await listTopDirs(root);
  const files = await listKeyFiles(root);
  const commits = await recentCommits(root);

  const tech = [
    pj?.type === 'module' ? 'esm' : '',
    pj?.devDependencies?.typescript ? 'typescript' : '',
    pj?.dependencies?.['commander'] ? 'commander' : '',
    pj?.dependencies?.['fs-extra'] ? 'fs-extra' : '',
  ].filter(Boolean);

  const bl: Baseline = {
    name: pj?.name || path.basename(root),
    summary: `Local-first work journal and ticket glue. Tracks updates, todos, progress, backups, and emits context for Claude. Recent: ${(commits[0]||'').slice(0,80)}`,
    techStack: tech,
    directories: dirs,
    keyFiles: files,
    commands: Object.keys(pj?.scripts || {}),
    scripts: pj?.scripts || {},
    domains: [],
    services: [],
    apis: (impact.openapiPaths||[]) as string[],
    dataModels: (impact.prismaModels||impact.sqlTables||[]) as string[],
    risks: ["Early-stage CLI; polish and docs ongoing"],
    nextSteps: ["Add tests", "Document command table", "Refine metrics visuals"],
    generatedAt: new Date().toISOString(),
  };
  return bl;
}

export async function cmdBaseline(opts: { force?: boolean } = {}) {
  const root = await repoRoot();
  const { log } = await ensureLocalScaffold(root);
  const outFile = path.join(log, "baseline.json");
  if (await fs.pathExists(outFile) && !opts.force) throw new Error("baseline.json exists; use --force to overwrite");

  // ensure context is fresh
  try {
    const { cmdContext } = await import("./context.js");
    await cmdContext({ stdout: false });
  } catch {}
  const ctxFile = path.join(log, "claude-context.json");
  let ctx = "{}";
  try { ctx = await fs.readFile(ctxFile, "utf8"); } catch {}

  let result: any | null = null;
  if (await has("claude")) {
    try {
      const prompt = buildPrompt();
      const { stdout } = await execa("claude", ["-p", prompt], { cwd: root, input: ctx });
      result = tryParseJson(stdout);
    } catch {}
  }

  if (!result) {
    result = await localBaseline(root);
  }

  await fs.outputFile(outFile, JSON.stringify(result, null, 2));
  console.log("[INFO] baseline written:", path.relative(root, outFile), (result && !await has("claude")) ? "(local)" : "");
}


