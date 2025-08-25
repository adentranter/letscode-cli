import { backupDir } from "../lib/backup.js";
import { ensureLocalScaffold, repoRoot, globalDir } from "../lib/paths.js";
export async function cmdWhere() {
    const root = await repoRoot();
    const { log } = await ensureLocalScaffold(root);
    const backup = await backupDir();
    console.log("repo:", root);
    console.log("local store:", log);
    console.log("backup root:", backup);
    console.log("global home:", globalDir());
}
