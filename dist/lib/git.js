import { execa } from "execa";
export async function currentBranch() {
    try {
        const { stdout } = await execa("git", ["branch", "--show-current"]);
        return stdout.trim() || "(detached)";
    }
    catch {
        return "(unknown)";
    }
}
export async function currentTicket() {
    const b = await currentBranch();
    const m = b.match(/^(feature|bug)\/(\d+)-(.+)$/);
    if (!m)
        return null;
    const kind = m[1];
    const index = parseInt(m[2], 10);
    const slug = m[3];
    return { kind, index, slug, id: `${kind}-${index}-${slug}`, branch: b };
}
