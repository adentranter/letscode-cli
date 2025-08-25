import fs from "fs-extra";
import path from "path";
import { repoRoot, BASE_DIR } from "../lib/paths.js";
import { currentTicket } from "../lib/git.js";
import { execa } from "execa";
export async function cmdPromptStart(opts = {}) {
    const root = await repoRoot();
    const t = await currentTicket();
    if (!t)
        throw new Error("Not on a ticket branch");
    const dir = path.join(root, BASE_DIR, t.kind === 'feature' ? 'features' : 'bugs', `${t.index}-${t.slug}`);
    await fs.ensureDir(dir);
    const file = path.join(dir, "PROMPT.md");
    if (!(await fs.pathExists(file))) {
        const body = `# Prompt: ${t.slug}\n\nYou are helping with ${t.kind} ${t.index}. Goal: (fill from ticket).\n\nPlease draft a short PRD in this folder.\n`;
        await fs.outputFile(file, body);
    }
    if (opts.open) {
        try {
            await execa("open", [file], { stdio: "inherit" });
        }
        catch { /* noop */ }
    }
    console.log("[INFO] prompt ready:", path.relative(root, file));
}
