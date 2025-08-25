import { execa } from "execa";

export async function currentBranch(): Promise<string> {
  try {
    const { stdout } = await execa("git", ["branch", "--show-current"]);
    return stdout.trim() || "(detached)";
  } catch {
    return "(unknown)";
  }
}

export type TicketRef = { kind: "feature"|"bug"; index: number; slug: string; id: string; branch: string };

export async function currentTicket(): Promise<TicketRef | null> {
  const b = await currentBranch();
  const m = b.match(/^(feature|bug)\/(\d+)-(.+)$/);
  if (!m) return null;
  const kind = m[1] as "feature"|"bug";
  const index = parseInt(m[2], 10);
  const slug = m[3];
  return { kind, index, slug, id: `${kind}-${index}-${slug}`, branch: b };
}

export async function isGitRepo(): Promise<boolean> {
  try { await execa("git", ["rev-parse", "--is-inside-work-tree"]); return true; } catch { return false; }
}

export async function defaultBranchName(cwd?: string): Promise<string> {
  try {
    const { stdout } = await execa("git", ["symbolic-ref", "refs/remotes/origin/HEAD"], { cwd });
    const m = stdout.trim().match(/origin\/(.+)$/);
    if (m) return m[1];
  } catch {}
  for (const name of ["main", "master", "develop"]) {
    try { await execa("git", ["show-ref", "--verify", "--quiet", `refs/heads/${name}`], { cwd }); return name; } catch {}
  }
  return "main";
}
