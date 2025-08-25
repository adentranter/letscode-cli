import { ensureLocalScaffold, ensureGlobalScaffold, repoRoot } from "../lib/paths.js";

export async function cmdInit() {
  const root = await repoRoot();
  await ensureLocalScaffold(root);
  await ensureGlobalScaffold();
  console.log("[INFO] Initialised .letscode/ and ~/.letscode/");
}
