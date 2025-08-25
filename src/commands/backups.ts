import fs from "fs-extra";
import path from "path";
import { backupDir } from "../lib/backup.js";
import { globalDir, repoRoot } from "../lib/paths.js";
import { execa } from "execa";

export async function cmdBackupsList() {
  const gd = globalDir();
  const base = path.join(gd, "backups");
  if (!(await fs.pathExists(base))) { console.log("[INFO] no backups yet"); return; }
  const entries = await fs.readdir(base);
  for (const name of entries.sort()) {
    const dir = path.join(base, name);
    const meta = await fs.readJSON(path.join(dir, ".backup.json")).catch(()=>({}));
    console.log(`${name}  ${meta.repo || ''}`);
  }
}

export async function cmdBackupsOpen() {
  const dir = await backupDir();
  try {
    await execa("open", [dir], { stdio: "inherit" });
  } catch {
    console.log(dir);
  }
}


