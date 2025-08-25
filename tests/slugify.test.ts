import { strict as assert } from "assert";
import { slugify } from "../src/lib/util.js";

assert.equal(slugify("Hello, World!"), "hello-world");
assert.equal(slugify("  Multi   Space  "), "multi-space");
assert.equal(slugify("UPPER_case-Mix"), "upper-case-mix");
console.log("slugify tests passed");


