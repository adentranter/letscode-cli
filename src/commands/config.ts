import path from "path";
import fs from "fs-extra";
import { execa } from "execa";
import { ensureGlobalScaffold, globalDir } from "../lib/paths.js";
import { platform, has } from "../lib/system.js";

async function pickEditor(): Promise<{ bin: string; args: string[] }> {
  const v = process.env.VISUAL || process.env.EDITOR;
  if (v) return { bin: v, args: [] };
  const plat = platform();
  if (plat === "mac") return { bin: "open", args: ["-t"] };
  if (plat === "win") return { bin: "notepad", args: [] };
  // linux default
  if (await has("nano")) return { bin: "nano", args: [] };
  return { bin: "vi", args: [] };
}

export async function cmdConfigEdit() {
  const { gd } = await ensureGlobalScaffold();
  const cfg = path.join(gd, "config.json");
  if (!(await fs.pathExists(cfg))) await fs.outputJSON(cfg, { createdAt: new Date().toISOString() }, { spaces: 2 });
  const ed = await pickEditor();
  await execa(ed.bin, [...ed.args, cfg], { stdio: "inherit" });
  console.log("[INFO] Edited:", cfg);
}


