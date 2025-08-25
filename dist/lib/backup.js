import path from "path";
import fs from "fs-extra";
import chokidar from "chokidar";
import crypto from "crypto";
import { ensureLocalScaffold, repoRoot, globalDir } from "./paths.js";
const REL = ".letscode";
function repoId(absPath) {
    return crypto.createHash("sha1").update(absPath).digest("hex").slice(0, 10);
}
export async function backupDir() {
    const root = await repoRoot();
    const name = path.basename(root);
    const id = repoId(root);
    return path.join(globalDir(), "backups", `${id}-${name}`);
}
export async function backupSync() {
    const root = await repoRoot();
    const local = path.join(root, REL);
    await ensureLocalScaffold(root);
    const bd = await backupDir();
    const dest = path.join(bd, REL);
    await fs.ensureDir(dest);
    await fs.copy(local, dest, {
        overwrite: true,
        errorOnExist: false,
        filter: (src) => {
            const base = path.basename(src);
            if (base.endsWith(".tmp") || base.endsWith("~"))
                return false;
            return true;
        },
    });
    await fs.outputJSON(path.join(bd, ".backup.json"), {
        repo: root,
        backedUpAt: new Date().toISOString(),
        globalRoot: globalDir(),
    }, { spaces: 2 });
    return { local, dest };
}
export async function backupWatch() {
    const root = await repoRoot();
    const bd = await backupDir();
    const local = path.join(root, REL);
    const dest = path.join(bd, REL);
    await fs.ensureDir(dest);
    const watcher = chokidar.watch(local, { ignoreInitial: false, persistent: true, depth: 99 });
    const copyOne = async (srcPath) => {
        const rel = path.relative(local, srcPath);
        const out = path.join(dest, rel);
        await fs.ensureDir(path.dirname(out));
        await fs.copy(srcPath, out, { overwrite: true });
    };
    const removeOne = async (srcPath) => {
        const rel = path.relative(local, srcPath);
        const out = path.join(dest, rel);
        await fs.remove(out);
    };
    console.log("[INFO] backup watching:", local, "→", dest);
    watcher
        .on("add", copyOne)
        .on("change", copyOne)
        .on("addDir", async (p) => fs.ensureDir(path.join(dest, path.relative(local, p))))
        .on("unlink", removeOne)
        .on("unlinkDir", removeOne)
        .on("ready", () => console.log("[INFO] initial scan complete — mirroring live. Ctrl-C to stop."));
}
export async function backupRestore(force = false) {
    const root = await repoRoot();
    const local = path.join(root, REL);
    const bd = await backupDir();
    const src = path.join(bd, REL);
    if (!(await fs.pathExists(src)))
        throw new Error("No backup found for this repo.");
    if (!force)
        throw new Error("Refusing to overwrite local .letscode without --force");
    await fs.copy(src, local, { overwrite: true });
    return { from: src, to: local };
}
