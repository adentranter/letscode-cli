import chalk from "chalk";
import { execa } from "execa";
import { ensureLocalScaffold, ensureGlobalScaffold, repoRoot, globalDir } from "../lib/paths.js";
import { has } from "../lib/system.js";
export async function cmdDoctor() {
    console.log(chalk.cyan("[LETSCODE] Doctor"));
    try {
        await execa("git", ["rev-parse", "--git-dir"]);
        console.log("[INFO] git OK");
    }
    catch {
        throw new Error("Run inside a git repo (or run lc install to init)");
    }
    const root = await repoRoot();
    const local = await ensureLocalScaffold(root);
    await ensureGlobalScaffold();
    console.log("[INFO] Local:", local.log);
    console.log("[INFO] Global:", globalDir());
    console.log(await has("claude") ? "[INFO] Claude CLI found" : "[WARN] Claude CLI NOT found");
    console.log(chalk.green("Ready ✅"));
}
