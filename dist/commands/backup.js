import { backupSync, backupWatch, backupRestore } from "../lib/backup.js";
export async function cmdBackupSync() {
    const { local, dest } = await backupSync();
    console.log("[INFO] backup synced:", local, "→", dest);
}
export async function cmdBackupWatch() {
    await backupWatch();
}
export async function cmdBackupRestore(opts) {
    const res = await backupRestore(!!opts.force);
    console.log("[INFO] restored:", res.from, "→", res.to);
}
