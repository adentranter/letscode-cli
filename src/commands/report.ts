import fs from "fs-extra";
import path from "path";
import { execa } from "execa";
import { ensureLocalScaffold, repoRoot, LOCAL_DIR, BASE_DIR } from "../lib/paths.js";
import { currentTicket } from "../lib/git.js";

function bar(percent: number, width = 20) {
  const p = Math.max(0, Math.min(100, Math.floor(percent)));
  const filled = Math.round((p / 100) * width);
  return `[${"#".repeat(filled)}${".".repeat(width - filled)}] ${p}%`;
}

export async function cmdReport() {
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

  // print
  console.log("\nLETSCODE REPORT\n================\n");
  console.log(`Branch   : ${ticket?.branch ?? '(not on ticket)'}`);
  console.log(`Tickets  : total=${f+b} features=${f} bugs=${b}`);
  if (lastProg) {
    console.log(`Progress : ${bar(lastProg.percent)}  ${lastProg.gist ? '- ' + lastProg.gist : ''}`);
  } else {
    console.log("Progress : [....................] 0%" );
  }
  console.log("");
  console.log(`TODOs    : ${openTodos.length} open`);
  openTodos.slice(0,5).forEach((t,i)=>console.log(`  ${i+1}. ${t.title}${t.files?.length? ' ['+t.files.join(', ')+']':''}`));
  if (openTodos.length > 5) console.log(`  ... +${openTodos.length-5} more`);
  console.log("");
  console.log("Commits  :");
  commits.forEach(c=>console.log(`  ${c.date} ${c.hash} ${c.message}`));
  if (velocity) {
    console.log("");
    console.log(`Velocity : ${velocity.dailyVelocity || 0}%/day  | ETA: ${velocity.etaDate || 'n/a'}`);
  }
  console.log("");
}


