import { readFile } from "node:fs/promises";

// Astro re-scopes component <style> blocks itself, so the source's
// [data-astro-cid-*] attribute selectors must come off first.
const cid = process.argv[2];
if (!cid) {
  console.error("usage: bun scripts/descope-css.mjs <cid>");
  process.exit(1);
}

const css = await readFile(`extracted/css/cid-${cid}.css`, "utf8");
process.stdout.write(css.replace(/\[data-astro-cid-[a-z0-9]+\]/g, ""));
