import fs from "fs-extra";
import path from "path";
import { ensureLocalScaffold, repoRoot, LOCAL_DIR } from "../lib/paths.js";
import { currentTicket } from "../lib/git.js";
function uniqueSorted(arr) {
    return Array.from(new Set(arr)).sort();
}
export async function impactScan() {
    const root = await repoRoot();
    await ensureLocalScaffold(root);
    const regDir = path.join(root, LOCAL_DIR, "registry");
    await fs.ensureDir(regDir);
    // naive detectors
    const prismaFile = path.join(root, "prisma", "schema.prisma");
    let prismaModels = [];
    try {
        const s = await fs.readFile(prismaFile, "utf8");
        prismaModels = uniqueSorted(Array.from(s.matchAll(/model\s+(\w+)/g)).map(m => m[1]));
    }
    catch { }
    const sqlFile = path.join(root, "db", "schema.sql");
    let sqlTables = [];
    try {
        const s = await fs.readFile(sqlFile, "utf8");
        sqlTables = uniqueSorted(Array.from(s.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?([\w\.\"]+)/ig)).map(m => m[1].replace(/\"/g, "")));
    }
    catch { }
    const openapiFile = path.join(root, "openapi.yaml");
    let openapiPaths = [];
    try {
        const s = await fs.readFile(openapiFile, "utf8");
        openapiPaths = uniqueSorted(Array.from(s.matchAll(/\n\s*(\/[\w\-\/{\}:]+):\s*\n/g)).map(m => m[1]));
    }
    catch { }
    // hot files from git log
    let hotFiles = [];
    try {
        const { execa } = await import("execa");
        const { stdout } = await execa("git", ["log", "--name-only", "--pretty=format:", "-n", "200"], { cwd: root });
        hotFiles = uniqueSorted(stdout.split(/\r?\n/).filter(Boolean).filter(f => !f.startsWith(LOCAL_DIR + "/") && !f.startsWith("node_modules/") && !f.startsWith(".git/")));
    }
    catch { }
    const res = { prismaModels, sqlTables, openapiPaths, hotFiles };
    await fs.outputFile(path.join(regDir, "impact-scan.json"), JSON.stringify(res, null, 2));
    console.log("[INFO] impact scan written:", path.relative(root, path.join(regDir, "impact-scan.json")));
}
export async function impactSet(opts) {
    const root = await repoRoot();
    await ensureLocalScaffold(root);
    const ticket = await currentTicket();
    if (!ticket)
        throw new Error("Not on a ticket branch");
    const tdir = path.join(root, LOCAL_DIR, "tickets", ticket.id);
    await fs.ensureDir(tdir);
    const file = path.join(tdir, "scope.json");
    const tables = (opts.tables || "").split(",").map(s => s.trim()).filter(Boolean);
    const apis = (opts.apis || "").split(",").map(s => s.trim()).filter(Boolean);
    const files = (opts.files || "").split(",").map(s => s.trim()).filter(Boolean);
    const scope = { ts: new Date().toISOString(), tables, apis, files };
    await fs.outputFile(file, JSON.stringify(scope, null, 2));
    console.log("[INFO] ticket scope set:", path.relative(root, file));
}
