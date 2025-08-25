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
