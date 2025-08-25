import { strict as assert } from "assert";
import fs from "fs-extra";
import path from "path";
import os from "os";
import { nextIndex } from "../src/commands/featureBug.js";
import { BASE_DIR } from "../src/lib/paths.js";

async function withTemp<T>(fn: (root: string) => Promise<T>) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "lc-test-"));
  try { return await fn(dir); } finally { await fs.remove(dir); }
}

await withTemp(async (root) => {
  const fdir = path.join(root, BASE_DIR, "features");
  const bdir = path.join(root, BASE_DIR, "bugs");
  await fs.ensureDir(fdir);
  await fs.ensureDir(bdir);
  assert.equal(await nextIndex(root), 1);
  await fs.ensureDir(path.join(fdir, "1-alpha"));
  await fs.ensureDir(path.join(bdir, "2-beta"));
  await fs.ensureDir(path.join(fdir, "10-zeta"));
  assert.equal(await nextIndex(root), 11);
  console.log("nextIndex tests passed");
});


