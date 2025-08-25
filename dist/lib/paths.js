import os from "os";
import path from "path";
import fs from "fs-extra";
import { execa } from "execa";
export const BRAND = "LETSCODE";
export const LOCAL_DIR = ".letscode";
export const BASE_DIR = "srcPlanning";
export function globalDir() {
    return process.env.LC_GLOBAL_DIR
        ?? path.join(process.env.XDG_STATE_HOME ?? path.join(os.homedir(), ".letscode"));
}
export async function repoRoot() {
    try {
        const { stdout } = await execa("git", ["rev-parse", "--show-toplevel"]);
        return stdout.trim();
    }
    catch {
        return process.cwd();
    }
}
export async function ensureLocalScaffold(root) {
    const log = path.join(root, LOCAL_DIR);
    await fs.ensureDir(path.join(root, BASE_DIR, "features"));
    await fs.ensureDir(path.join(root, BASE_DIR, "bugs"));
    await fs.ensureDir(path.join(log, "context"));
    await fs.ensureDir(path.join(log, "tickets"));
    await fs.ensureDir(path.join(log, "registry"));
    await fs.ensureDir(path.join(log, "metrics"));
    await fs.ensureDir(path.join(log, "qa"));
    const events = path.join(log, "events.ndjson");
    const progress = path.join(log, "progress.ndjson");
    const todo = path.join(log, "todo.json");
    if (!(await fs.pathExists(events)))
        await fs.outputFile(events, JSON.stringify({ type: "header", version: 1, created_at: new Date().toISOString() }) + "\n");
    if (!(await fs.pathExists(progress)))
        await fs.outputFile(progress, "");
    if (!(await fs.pathExists(todo)))
        await fs.outputJSON(todo, []);
    // .gitignore the local store
    const gi = path.join(root, ".gitignore");
    try {
        let cur = (await fs.pathExists(gi)) ? await fs.readFile(gi, "utf8") : "";
        if (!cur.split(/\r?\n/).includes(`${LOCAL_DIR}/`)) {
            cur += (cur.endsWith("\n") ? "" : "\n") + `${LOCAL_DIR}/\n`;
            await fs.outputFile(gi, cur);
        }
    }
    catch { }
    return { log, events, progress, todo };
}
export async function ensureGlobalScaffold() {
    const gd = globalDir();
    await fs.ensureDir(gd);
    const events = path.join(gd, "events.ndjson");
    const repos = path.join(gd, "repos.ndjson");
    if (!(await fs.pathExists(events)))
        await fs.outputFile(events, JSON.stringify({ type: "header", version: 1, created_at: new Date().toISOString() }) + "\n");
    if (!(await fs.pathExists(repos)))
        await fs.outputFile(repos, "[]");
    return { gd, events, repos };
}
