import fs from "fs-extra";
import path from "path";

export function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export async function appendNdjson(file: string, obj: Record<string, any>) {
  await fs.ensureDir(path.dirname(file));
  await fs.appendFile(file, JSON.stringify(obj) + "\n", "utf8");
}

export async function readJson<T>(file: string, fallback: T): Promise<T> {
  try { return await fs.readJSON(file); } catch { return fallback; }
}

export async function writeJsonAtomic(file: string, data: any) {
  const tmp = file + ".tmp";
  await fs.outputFile(tmp, JSON.stringify(data, null, 2));
  await fs.move(tmp, file, { overwrite: true });
}

export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
