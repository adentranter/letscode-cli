import fs from "fs-extra";
import path from "path";
import { BASE_DIR, repoRoot, ensureLocalScaffold } from "../lib/paths.js";
import { currentTicket } from "../lib/git.js";

export async function cmdStatus(opts?: { json?: boolean }) {
  const root = await repoRoot();
  const { progress, todo } = await ensureLocalScaffold(root);
  const fdir = path.join(root, BASE_DIR, "features");
  const bdir = path.join(root, BASE_DIR, "bugs");
  const f = (await fs.pathExists(fdir)) ? (await fs.readdir(fdir)).length : 0;
  const b = (await fs.pathExists(bdir)) ? (await fs.readdir(bdir)).length : 0;
  const last =
  (await fs
    .readFile(progress, "utf8")
    .catch(() => "")
    .then((s: string) =>
      s.trim().split("\n").filter(Boolean).pop()
    )) || "";
  const todos = await fs.readJSON(todo).catch(()=>[]) as any[];
  const ticket = await currentTicket();

  if (opts?.json) {
    const payload = {
      tickets: { total: f+b, features: f, bugs: b },
      progress: (()=>{ try { return last ? JSON.parse(last) : null; } catch { return null; } })(),
      todos: { total: todos.length, open: todos.filter((t:any)=>!t.doneAt).length },
      ticket,
    };
    console.log(JSON.stringify(payload));
    return;
  }

  console.log(`[INFO] tickets total=${f+b} features=${f} bugs=${b}`);
  if (last) { try { const j = JSON.parse(last); console.log(`[PROGRESS] ${j.percent}% ${j.gist ?? ""}`); } catch {} }
  console.log(`[TODO] ${todos.length} items`);
}
