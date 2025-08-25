import path from "path";
import fs from "fs-extra";
import { execa } from "execa";
import { ensureLocalScaffold, repoRoot, BASE_DIR } from "../lib/paths.js";
import { slugify } from "../lib/util.js";

async function nextIndex(root: string) {
  const feat = path.join(root, BASE_DIR, "features");
  const bugs = path.join(root, BASE_DIR, "bugs");
  const all: number[] = [];
  for (const dir of [feat, bugs]) {
    if (!(await fs.pathExists(dir))) continue;
    for (const name of await fs.readdir(dir)) {
      const m = /^(\d+)-/.exec(name);
      if (m) all.push(Number(m[1]));
    }
  }
  return (all.length ? Math.max(...all) : 0) + 1;
}

export async function createTicket(kind: "feature"|"bug", rawName: string, withReadme = false) {
  const root = await repoRoot();
  const { events } = await ensureLocalScaffold(root);

  const idx   = await nextIndex(root);
  const slug  = slugify(rawName);
  const folder= `${idx}-${slug}`;
  const branch= `${kind}/${folder}`;
  const dir   = path.join(root, BASE_DIR, kind === "feature" ? "features" : "bugs", folder);

  await fs.ensureDir(dir);
  try {
    await execa("git", ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`]);
    await execa("git", ["checkout", branch]);
  } catch {
    await execa("git", ["checkout", "-b", branch]);
  }

  if (withReadme) {
    const rd = path.join(dir, "README.md");
    if (!(await fs.pathExists(rd))) {
      await fs.outputFile(rd,
        `# ${rawName}\n\n**Type:** ${kind}\n**Index:** ${idx}\n**Branch:** ${branch}\n**Created:** ${new Date().toISOString()}\n`
      );
      try { await execa("git", ["add", rd]); await execa("git", ["commit", "-m", `chore(${kind}): scaffold ${branch} (README)`]); } catch {}
    }
  }

  await fs.appendFile(events, JSON.stringify({
    type: `${kind}.create`,
    ts: new Date().toISOString(),
    index: idx, name: rawName, slug, branch, folder
  }) + "\n");

  console.log(`[INFO] ${kind} ready → ${folder} on ${branch}`);
}
