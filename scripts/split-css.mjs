import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const SRC = "site-dump/assets/_astro";
const OUT = "extracted/css";

// Split a stylesheet into top-level blocks, brace-balanced and string-aware.
function topLevelBlocks(css) {
  const blocks = [];
  let depth = 0;
  let start = 0;
  let str = null;
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (str) {
      if (c === "\\") i++;
      else if (c === str) str = null;
      continue;
    }
    if (c === '"' || c === "'") str = c;
    else if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        blocks.push(css.slice(start, i + 1).trim());
        start = i + 1;
      }
    }
  }
  const tail = css.slice(start).trim();
  if (tail) blocks.push(tail);
  return blocks.filter(Boolean);
}

function cidsOf(text) {
  return [...new Set([...text.matchAll(/data-astro-cid-([a-z0-9]+)/g)].map((m) => m[1]))];
}

await mkdir(OUT, { recursive: true });

const bundles = [
  "privacy.C33TjNsF.css",
  "index.CVD7CNaJ.css",
  "privacy.C0v0Orcj.css",
  "nearfield-vs-stereofuse.CD1qWgXb.css",
];

const byCid = new Map();
const global = [];
const tailwindLayers = [];

for (const file of bundles) {
  const css = await readFile(join(SRC, file), "utf8");
  for (const raw of topLevelBlocks(css)) {
    const block = raw.replace(/^(?:\s*\/\*[\s\S]*?\*\/)+\s*/, "");
    // Tailwind's own generated layers get regenerated from source, never copied.
    if (/^@layer\s+(theme|base|utilities|properties|components)\b/.test(block)) {
      tailwindLayers.push({ file, head: block.slice(0, block.indexOf("{")).trim() });
      continue;
    }
    if (/^@property\s+--tw-/.test(block)) {
      continue;
    }
    const cids = cidsOf(block);
    if (cids.length === 1) {
      const cid = cids[0];
      if (!byCid.has(cid)) byCid.set(cid, []);
      byCid.get(cid).push(block);
    } else {
      global.push(block);
    }
  }
}

for (const [cid, blocks] of byCid) {
  await writeFile(join(OUT, `cid-${cid}.css`), blocks.join("\n\n") + "\n");
}
await writeFile(join(OUT, "_global.css"), global.join("\n\n") + "\n");

console.log("Tailwind layers skipped (regenerated):");
for (const l of tailwindLayers) console.log(`  ${l.file}: ${l.head}`);
console.log(`\nScoped component sheets: ${byCid.size}`);
for (const [cid, blocks] of [...byCid].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  cid-${cid}  ${blocks.length} rules`);
}
console.log(`Global/unscoped rules: ${global.length}`);
