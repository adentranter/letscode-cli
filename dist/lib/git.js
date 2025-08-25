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
export async function isGitRepo() {
    try {
        await execa("git", ["rev-parse", "--is-inside-work-tree"]);
        return true;
    }
    catch {
        return false;
    }
}
export async function defaultBranchName(cwd) {
    try {
        const { stdout } = await execa("git", ["symbolic-ref", "refs/remotes/origin/HEAD"], { cwd });
        const m = stdout.trim().match(/origin\/(.+)$/);
        if (m)
            return m[1];
    }
    catch { }
    for (const name of ["main", "master", "develop"]) {
        try {
            await execa("git", ["show-ref", "--verify", "--quiet", `refs/heads/${name}`], { cwd });
            return name;
        }
        catch { }
    }
    return "main";
}
