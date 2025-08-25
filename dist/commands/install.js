import chalk from "chalk";
import prompts from "prompts";
import { ensureGlobalScaffold, ensureLocalScaffold, repoRoot } from "../lib/paths.js";
import { ensureGitOrThrow } from "../lib/guard.js";
import { ensureClaudeInstalled, ensureClaudeRepoAccess } from "../lib/claude.js";
import { execa } from "execa";
export async function cmdInstall() {
    console.log(chalk.cyan("[LETSCODE] Install / Setup"));
    try {
        await execa("git", ["--version"]);
    }
    catch {
        throw new Error("git is required; please install git first.");
    }
    const root = await repoRoot();
    await ensureGitOrThrow(true);
    let inRepo = true;
    try {
        await execa("git", ["rev-parse", "--git-dir"], { cwd: root });
    }
    catch {
        inRepo = false;
    }
    if (!inRepo) {
        const { doit } = await prompts({ type: "confirm", name: "doit", message: "Not a git repo. Initialise one here?", initial: true });
        if (doit) {
            await execa("git", ["init"], { cwd: root, stdio: "inherit" });
            await execa("git", ["add", "."], { cwd: root });
            await execa("git", ["commit", "-m", "chore: initialise repo"], { cwd: root }).catch(() => { });
        }
        else {
            console.log(chalk.yellow("Skipping git init; some features may be limited."));
        }
    }
    const local = await ensureLocalScaffold(root);
    const global = await ensureGlobalScaffold();
    console.log("[INFO] Local store:", local.log);
    console.log("[INFO] Global home:", global.gd);
    const ok = await ensureClaudeInstalled(true);
    console.log(ok ? chalk.green("[INFO] Claude CLI detected.") : chalk.yellow("[WARN] Claude CLI not detected. Install it and re-run `lc doctor`."));
    const cfg = await ensureClaudeRepoAccess();
    console.log("[INFO] Claude settings:", cfg);
    await execa("node", ["-e", "require('fs').writeFileSync('.letscode/claude-context.json', JSON.stringify({hello:'letscode', ts:new Date().toISOString()},null,2))"]);
    console.log(chalk.green("✔ Setup complete. Try:"));
    console.log(chalk.gray("   lc doctor"));
    console.log(chalk.gray(`   lc feature "First task" --readme`));
    console.log(chalk.gray(`   lc update "first note" --progress 5`));
}
