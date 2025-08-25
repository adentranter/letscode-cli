import path from "path";
import fs from "fs-extra";
import { execa } from "execa";
import prompts from "prompts";
import { ensureLocalScaffold, repoRoot, BASE_DIR, LOCAL_DIR } from "../lib/paths.js";
import { slugify } from "../lib/util.js";
export async function nextIndex(root) {
    const feat = path.join(root, BASE_DIR, "features");
    const bugs = path.join(root, BASE_DIR, "bugs");
    const all = [];
    for (const dir of [feat, bugs]) {
        if (!(await fs.pathExists(dir)))
            continue;
        for (const name of await fs.readdir(dir)) {
            const m = /^(\d+)-/.exec(name);
            if (m)
                all.push(Number(m[1]));
        }
    }
    return (all.length ? Math.max(...all) : 0) + 1;
}
export async function createTicket(kind, rawName, withReadme = false, interactive = false) {
    const root = await repoRoot();
    const { events } = await ensureLocalScaffold(root);
    const idx = await nextIndex(root);
    const slug = slugify(rawName);
    const folder = `${idx}-${slug}`;
    const branch = `${kind}/${folder}`;
    const dir = path.join(root, BASE_DIR, kind === "feature" ? "features" : "bugs", folder);
    await fs.ensureDir(dir);
    try {
        await execa("git", ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`]);
        await execa("git", ["checkout", branch]);
    }
    catch {
        await execa("git", ["checkout", "-b", branch]);
    }
    const rd = path.join(dir, "README.md");
    if (withReadme && !(await fs.pathExists(rd))) {
        await fs.outputFile(rd, `# ${rawName}\n\n**Type:** ${kind}\n**Index:** ${idx}\n**Branch:** ${branch}\n**Created:** ${new Date().toISOString()}\n`);
        try {
            await execa("git", ["add", rd]);
            await execa("git", ["commit", "-m", `chore(${kind}): scaffold ${branch} (README)`]);
        }
        catch { }
    }
    // Optional interactive metadata
    if (interactive) {
        const ans = await prompts([
            { type: "text", name: "goal", message: "Goal (what outcome do you want?)" },
            { type: "list", name: "acceptance", message: "Acceptance criteria (comma-separated)", separator: "," },
            { type: "text", name: "estimate", message: "Estimate (e.g., 2d, 8h)" },
            { type: "list", name: "stakeholders", message: "Stakeholders (comma-separated)", separator: "," },
            { type: "list", name: "risks", message: "Risks (comma-separated)", separator: "," },
        ]);
        const tdir = path.join(root, LOCAL_DIR, "tickets", `${kind}-${idx}-${slug}`);
        await fs.ensureDir(tdir);
        const meta = {
            type: kind,
            index: idx,
            name: rawName,
            branch,
            createdAt: new Date().toISOString(),
            goal: ans.goal || "",
            acceptance: Array.isArray(ans.acceptance) ? ans.acceptance.map((s) => s.trim()).filter(Boolean) : [],
            estimate: ans.estimate || "",
            stakeholders: Array.isArray(ans.stakeholders) ? ans.stakeholders.map((s) => s.trim()).filter(Boolean) : [],
            risks: Array.isArray(ans.risks) ? ans.risks.map((s) => s.trim()).filter(Boolean) : [],
        };
        await fs.outputFile(path.join(tdir, "ticket.json"), JSON.stringify(meta, null, 2));
        // Enrich README
        let cur = (await fs.pathExists(rd)) ? await fs.readFile(rd, "utf8") : `# ${rawName}\n\n`;
        const extra = [
            "\n## Goal\n",
            (meta.goal || ""),
            "\n\n## Acceptance criteria\n",
            ...(meta.acceptance.length ? meta.acceptance.map((a) => `- ${a}\n`) : ["- \n"]),
            "\n## Estimate\n",
            (meta.estimate || ""),
            "\n\n## Stakeholders\n",
            ...(meta.stakeholders.length ? meta.stakeholders.map((p) => `- ${p}\n`) : ["- \n"]),
            "\n## Risks\n",
            ...(meta.risks.length ? meta.risks.map((r) => `- ${r}\n`) : ["- \n"]),
        ].join("");
        await fs.outputFile(rd, cur + extra);
        try {
            await execa("git", ["add", rd, path.join(tdir, "ticket.json")]);
            await execa("git", ["commit", "-m", `docs(${kind}): seed ${branch} (metadata)`]);
        }
        catch { }
    }
    await fs.appendFile(events, JSON.stringify({
        type: `${kind}.create`,
        ts: new Date().toISOString(),
        index: idx, name: rawName, slug, branch, folder
    }) + "\n");
    console.log(`[INFO] ${kind} ready → ${folder} on ${branch}`);
}
