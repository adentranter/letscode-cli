import path from "path";
import fs from "fs-extra";
import prompts from "prompts";
import { execa } from "execa";
import { has, platform } from "./system.js";
import { repoRoot } from "./paths.js";
export async function ensureClaudeInstalled(interactive = true) {
    if (await has("claude"))
        return true;
    if (!interactive)
        return false;
    const plat = platform();
    const methods = [];
    if (plat === "mac")
        methods.push({ title: "Install via Homebrew (if available)", value: "brew" });
    if (plat === "win")
        methods.push({ title: "Install via winget (if available)", value: "winget" }, { title: "Install via Chocolatey", value: "choco" });
    if (plat === "linux")
        methods.push({ title: "Skip (install manually, then re-run lc doctor)", value: "skip" });
    const { how } = await prompts({
        type: "select",
        name: "how",
        message: "Claude CLI not found. Choose an install method (or skip):",
        choices: methods
    });
    try {
        if (how === "brew") {
            await execa("brew", ["install", "claude"], { stdio: "inherit" });
        }
        else if (how === "winget") {
            await execa("winget", ["install", "-e", "--id", "Anthropic.Claude"], { stdio: "inherit" });
        }
        else if (how === "choco") {
            await execa("choco", ["install", "claude"], { stdio: "inherit" });
        }
    }
    catch (e) {
        console.error("[WARN] Automated install failed. Please install the Claude CLI manually, then re-run `lc doctor`.");
    }
    return await has("claude");
}
export async function ensureClaudeRepoAccess() {
    const root = await repoRoot();
    const cfgDir = path.join(root, ".claude");
    const cfg = path.join(cfgDir, "settings.local.json");
    await fs.ensureDir(cfgDir);
    const hook = {
        hooks: {
            SessionStart: [
                {
                    hooks: [
                        { type: "command", command: "bash -lc 'cat .letscode/claude-context.json || true'" }
                    ]
                }
            ]
        }
    };
    let existing = {};
    try {
        existing = await fs.readJSON(cfg);
    }
    catch { }
    const merged = { ...existing, hooks: { ...(existing.hooks || {}), ...(hook.hooks) } };
    await fs.outputFile(cfg, JSON.stringify(merged, null, 2));
    return cfg;
}
