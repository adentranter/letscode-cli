import fs from "fs-extra";
import path from "path";
export function slugify(s) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
export async function appendNdjson(file, obj) {
    await fs.ensureDir(path.dirname(file));
    await fs.appendFile(file, JSON.stringify(obj) + "\n", "utf8");
}
export async function readJson(file, fallback) {
    try {
        return await fs.readJSON(file);
    }
    catch {
        return fallback;
    }
}
export async function writeJsonAtomic(file, data) {
    const tmp = file + ".tmp";
    await fs.outputFile(tmp, JSON.stringify(data, null, 2));
    await fs.move(tmp, file, { overwrite: true });
}
export const sleep = (ms) => new Promise(r => setTimeout(r, ms));
