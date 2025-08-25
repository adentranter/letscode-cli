import path from "path";
import fs from "fs-extra";
import prompts from "prompts";
import { repoRoot, LOCAL_DIR } from "../lib/paths.js";
import { currentTicket } from "../lib/git.js";
import { appendNdjson } from "../lib/util.js";
import { cmdCmerge } from "./cmerge.js";
export async function cmdFinish(message) {
    const root = await repoRoot();
    const ticket = await currentTicket();
    if (!ticket)
        throw new Error("Not on a ticket branch");
    let msg = message ?? "";
    let pct = undefined;
    if (!msg) {
        const ans = await prompts([
            { type: "text", name: "message", message: "Final note (what changed)?" },
            { type: "number", name: "progress", message: "Ticket progress % now (0-100)?", min: 0, max: 100, initial: 100 },
        ]);
        msg = String(ans.message || "").trim();
        if (typeof ans.progress === "number")
            pct = ans.progress;
    }
    // Always record a final ticket update (per-ticket only)
    const ts = new Date().toISOString();
    const tdir = path.join(root, LOCAL_DIR, "tickets", ticket.id);
    await fs.ensureDir(tdir);
    await appendNdjson(path.join(tdir, "updates.ndjson"), {
        type: "ticket.update",
        ts,
        ticket: ticket.id,
        branch: ticket.branch,
        message: msg || "finish",
    });
    // Per-ticket progress snapshot (does NOT change global progress.ndjson)
    if (typeof pct === "number" && pct >= 0 && pct <= 100) {
        await appendNdjson(path.join(tdir, "progress.ndjson"), { ts, percent: Math.floor(pct), gist: (msg || "").slice(0, 120) });
    }
    // Continue to interactive merge (handles acceptance + close)
    await cmdCmerge({});
}
