import path from "path";
import chokidar from "chokidar";
import prompts from "prompts";
import { repoRoot, LOCAL_DIR } from "../lib/paths.js";
import { cmdUpdate } from "./update.js";

function parseIntervalToMs(input: string | number | undefined): number {
  if (typeof input === "number" && Number.isFinite(input)) return Math.max(10_000, input * 1000);
  if (typeof input === "string") {
    const m = input.trim().match(/^(\d+)(s|m)?$/i);
    if (m) {
      const n = parseInt(m[1], 10);
      const unit = (m[2] || "s").toLowerCase();
      return Math.max(10_000, n * (unit === "m" ? 60_000 : 1_000));
    }
  }
  return 10 * 60 * 1000; // default 10 minutes
}

export async function cmdWatch(opts: { interval?: string | number } = {}) {
  const root = await repoRoot();
  const intervalMs = parseIntervalToMs(opts.interval);

  const rel = (p: string) => path.relative(root, p) || p;
  const changed = new Set<string>();

  const ignored = [
    (p: string) => p.includes(`${path.sep}.git${path.sep}`),
    (p: string) => p.includes(`${path.sep}node_modules${path.sep}`),
    (p: string) => p.includes(`${path.sep}${LOCAL_DIR}${path.sep}`),
  ];

  const watcher = chokidar.watch(root, {
    ignoreInitial: true,
    persistent: true,
    depth: 99,
    ignored: (p: string) => ignored.some(fn => fn(p)),
  });

  const track = (file: string) => {
    const r = rel(file);
    if (!r || r.startsWith("..")) return;
    changed.add(r);
  };

  watcher
    .on("add", track)
    .on("change", track)
    .on("unlink", track);

  console.log(`[INFO] watching for changes under ${root} (interval=${Math.round(intervalMs/1000)}s). Ctrl-C to stop.`);

  const tick = async () => {
    if (changed.size === 0) return;
    const files = Array.from(changed).sort();
    const ans = await prompts([
      { type: "text", name: "message", message: "Quick update — what changed?", initial: "" },
      { type: "number", name: "progress", message: "Progress % now (0-100)?", min: 0, max: 100 },
      { type: "text", name: "files", message: "Files (comma-separated)", initial: files.join(",") },
    ]);

    const msg: string = (ans.message || "").trim();
    const pct: number | undefined = typeof ans.progress === "number" ? ans.progress : undefined;
    const chosenFiles = String(ans.files || files.join(",")).split(",").map((s) => s.trim()).filter(Boolean);

    if (!msg) {
      changed.clear();
      return;
    }

    try {
      await cmdUpdate(msg, {
        progress: typeof pct === "number" ? pct : undefined,
        files: chosenFiles.join(","),
      });
    } finally {
      changed.clear();
    }
  };

  const timer = setInterval(() => { tick().catch(()=>{}); }, intervalMs);

  // Keep process alive
  process.on("SIGINT", async () => {
    clearInterval(timer);
    await watcher.close();
    console.log("\n[INFO] watch stopped");
    process.exit(0);
  });
}


