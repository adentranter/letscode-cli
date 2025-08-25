import fs from "fs-extra";
import path from "path";
import { ensureLocalScaffold, repoRoot, LOCAL_DIR } from "../lib/paths.js";

type ProgressRow = { ts: string; percent: number; gist?: string };

async function readProgress(root: string): Promise<ProgressRow[]> {
  const { progress } = await ensureLocalScaffold(root);
  const txt = await fs.readFile(progress, "utf8").catch(() => "");
  return txt
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter((j: any): j is ProgressRow => !!j && typeof j.ts === "string" && typeof j.percent === "number");
}

async function readTodosCount(root: string): Promise<number> {
  const { todo } = await ensureLocalScaffold(root);
  const arr = await fs.readJSON(todo).catch(() => []) as any[];
  return arr.filter((t: any) => !t.doneAt).length;
}

export async function metricsRollup() {
  const root = await repoRoot();
  const outDir = path.join(root, LOCAL_DIR, "metrics");
  await fs.ensureDir(outDir);

  const prog = await readProgress(root);
  const pCsv = ["ts,percent,gist", ...prog.map((r) => `${r.ts},${r.percent},"${String(r.gist ?? "").replace(/"/g, '""')}"`)].join("\n");
  await fs.outputFile(path.join(outDir, "progress_timeseries.csv"), pCsv);

  const todoCount = await readTodosCount(root);
  const tCsvPath = path.join(outDir, "todos_timeseries.csv");
  const now = new Date().toISOString();
  let headerWritten = false;
  if (!(await fs.pathExists(tCsvPath))) {
    await fs.outputFile(tCsvPath, "ts,todo_count\n");
    headerWritten = true;
  }
  await fs.appendFile(tCsvPath, `${now},${todoCount}\n`);

  console.log("[INFO] metrics written:", path.relative(root, path.join(outDir, "progress_timeseries.csv")), path.relative(root, tCsvPath), headerWritten ? "(new)" : "");
}

export async function metricsPredict() {
  const root = await repoRoot();
  const outDir = path.join(root, LOCAL_DIR, "metrics");
  await fs.ensureDir(outDir);
  const prog = await readProgress(root);
  if (prog.length < 2) {
    const payload = { computedAt: new Date().toISOString(), currentPercent: prog[0]?.percent ?? 0, dailyVelocity: 0, etaDays: null as number | null, etaDate: null as string | null };
    await fs.outputFile(path.join(outDir, "velocity.json"), JSON.stringify(payload, null, 2));
    console.log("[WARN] Not enough data for prediction; wrote velocity.json with zeros.");
    return;
  }
  const sorted = [...prog].sort((a, b) => +new Date(a.ts) - +new Date(b.ts));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const ms = +new Date(last.ts) - +new Date(first.ts);
  const days = Math.max(ms / (1000 * 60 * 60 * 24), 0.0001);
  const dv = (last.percent - first.percent) / days; // % per day
  const remaining = Math.max(0, 100 - last.percent);
  const etaDays = dv > 0 ? remaining / dv : null;
  const etaDate = etaDays ? new Date(Date.now() + etaDays * 24 * 60 * 60 * 1000).toISOString() : null;
  const payload = {
    computedAt: new Date().toISOString(),
    currentPercent: last.percent,
    dailyVelocity: Number(dv.toFixed(2)),
    etaDays: etaDays ? Number(etaDays.toFixed(1)) : null,
    etaDate,
  };
  await fs.outputFile(path.join(outDir, "velocity.json"), JSON.stringify(payload, null, 2));
  console.log("[INFO] metrics predicted:", path.relative(root, path.join(outDir, "velocity.json")));
}

export async function metricsView() {
  const root = await repoRoot();
  const outDir = path.join(root, LOCAL_DIR, "metrics");
  await fs.ensureDir(outDir);
  const html = `<!doctype html>
<meta charset="utf-8" />
<title>letscode metrics</title>
<style>body{font-family: system-ui, sans-serif; padding: 20px;} canvas{max-width: 800px; width: 100%; height: 240px; border:1px solid #ddd; margin: 12px 0;} pre{background:#f7f7f7;padding:8px;}</style>
<h1>letscode metrics</h1>
<h2>Progress %</h2>
<canvas id="prog"></canvas>
<h2>TODOs count</h2>
<canvas id="todos"></canvas>
<script>
async function csv(url){
  const t = await fetch(url).then(r=>r.text()).catch(()=>"");
  const [head,...rows] = t.trim().split(/\r?\n/);
  const cols = head.split(',');
  return rows.filter(Boolean).map(r=>{
    const parts = r.match(/\"[^\"]*\"|[^,]+/g)||[]; // naive CSV
    const obj = {}; cols.forEach((c,i)=>obj[c]= (parts[i]||"").replace(/^\"|\"$/g, ''));
    return obj;
  });
}
function line(canvasId, points, xKey, yKey, yMax){
  const c = document.getElementById(canvasId);
  const ctx = c.getContext('2d');
  ctx.clearRect(0,0,c.width,c.height);
  const pad = 30; const W = c.width, H = c.height;
  const xs = points.map(p=>new Date(p[xKey]).getTime());
  const ys = points.map(p=>Number(p[yKey]));
  if (points.length<2){ ctx.fillText('Not enough data', 10, 20); return; }
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = 0, yMaxVal = yMax || Math.max(...ys, 100);
  function X(t){ return pad + ( (t - xMin) / (xMax - xMin || 1) ) * (W - 2*pad); }
  function Y(v){ return H - pad - ( (v - yMin) / (yMaxVal - yMin || 1) ) * (H - 2*pad); }
  ctx.strokeStyle = '#999'; ctx.beginPath(); ctx.moveTo(pad, H-pad); ctx.lineTo(W-pad, H-pad); ctx.moveTo(pad, pad); ctx.lineTo(pad, H-pad); ctx.stroke();
  ctx.strokeStyle = '#2a6'; ctx.beginPath(); ctx.moveTo(X(xs[0]), Y(ys[0]));
  for (let i=1;i<xs.length;i++){ ctx.lineTo(X(xs[i]), Y(ys[i])); }
  ctx.stroke();
}
async function main(){
  const prog = await csv('progress_timeseries.csv');
  const todos = await csv('todos_timeseries.csv');
  line('prog', prog, 'ts', 'percent', 100);
  line('todos', todos, 'ts', 'todo_count');
}
main();
</script>`;
  const out = path.join(outDir, "viewer.html");
  await fs.outputFile(out, html);
  console.log("[INFO] metrics viewer:", path.relative(root, out));
}


