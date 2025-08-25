import fs from "fs-extra";
import path from "path";
import { repoRoot, LOCAL_DIR } from "../lib/paths.js";
import { impactScan } from "./impact.js";
import { cmdContext } from "./context.js";
import { cmdBaseline } from "./baseline.js";

function injectBetweenMarkers(content: string, start: string, end: string, injection: string) {
  const s = content.indexOf(start);
  const e = content.indexOf(end);
  if (s !== -1 && e !== -1 && e > s) {
    return content.slice(0, s + start.length) + "\n\n" + injection + "\n\n" + content.slice(e);
  }
  return null;
}

export async function cmdRetake(opts: { updateReadme?: boolean } = {}) {
  const root = await repoRoot();

  // Refresh registries and context
  await impactScan();
  await cmdContext({ stdout: false });
  await cmdBaseline({ force: true });

  // Write a project summary from baseline
  const baseline = await fs.readJSON(path.join(root, LOCAL_DIR, "baseline.json")).catch(()=>({}));
  const sumFile = path.join(root, LOCAL_DIR, "project-summary.md");
  const md = [
    `# Project summary (auto)`,
    ``,
    `Name: ${baseline.name ?? path.basename(root)}`,
    ``,
    `## Summary`,
    `${baseline.summary ?? ""}`,
    ``,
    `## Tech stack`,
    ...(Array.isArray(baseline.techStack) ? baseline.techStack.map((t:string)=>`- ${t}`) : []),
    ``,
    `## Key files`,
    ...(Array.isArray(baseline.keyFiles) ? baseline.keyFiles.map((t:string)=>`- ${t}`) : []),
  ].join("\n");
  await fs.outputFile(sumFile, md);

  // Optional README injection between markers
  if (opts.updateReadme) {
    const readme = path.join(root, "README.md");
    if (await fs.pathExists(readme)) {
      const cur = await fs.readFile(readme, "utf8");
      const start = "<!-- lc:summary:start -->";
      const end = "<!-- lc:summary:end -->";
      const inject = injectBetweenMarkers(cur, start, end, md);
      if (inject) {
        await fs.outputFile(readme, inject);
      } else {
        console.log("[INFO] README markers not found; skipping inline summary. Add:", start, end);
      }
    }
  }

  console.log("[INFO] retake complete:", path.relative(root, sumFile));
}


