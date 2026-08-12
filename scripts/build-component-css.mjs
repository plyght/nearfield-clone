import { readFile, writeFile, mkdir } from "node:fs/promises";

// Component sheets whose selectors span more than one .astro file (or match
// elements created at runtime) are emitted as plain imported stylesheets so
// Astro's per-component scoping can't hide them. Checkout (bp7iawlb) is
// deliberately not built — that flow was dropped from the clone.
// mh3n6o72 is the drum machine's floating dev tuning panel. It is not rendered
// in this clone, and its `.panel` rule collides with the display `.panel`, so
// it is deliberately left out.
const SHEETS = {
  xlt3x6ey: "scene.css",
  lwnimdpj: "cards.css",
  i5mwzbw6: "hero.css",
  ud663b2a: "buy-button.css",
  vnivfuh2: "companion.css",
  rnfb76xl: "bottom-cta.css",
  wbpnv3t7: "compare.css",
  dmqpwcec: "logo.css",
};

await mkdir("src/styles/components", { recursive: true });

const owners = new Map();

for (const [cid, name] of Object.entries(SHEETS)) {
  const css = await readFile(`extracted/css/cid-${cid}.css`, "utf8");
  const descoped = css.replace(/\[data-astro-cid-[a-z0-9]+\]/g, "");
  await writeFile(`src/styles/components/${name}`, descoped);

  // These sheets are global once de-scoped, so a class defined in two of them
  // silently overrides across components. Surface that instead.
  for (const match of descoped.matchAll(/^\.([a-z][a-z0-9-]*)[\s,{]/gm)) {
    const selector = match[1];
    if (!owners.has(selector)) owners.set(selector, new Set());
    owners.get(selector).add(name);
  }

  console.log(
    `  cid-${cid} -> src/styles/components/${name} (${descoped.split("\n").length} lines)`,
  );
}

const collisions = [...owners].filter(([, sheets]) => sheets.size > 1);
if (collisions.length) {
  console.log("\nWARNING: class defined in more than one sheet:");
  for (const [selector, sheets] of collisions) {
    console.log(`  .${selector} -> ${[...sheets].join(", ")}`);
  }
}

console.log(`\nwrote ${Object.keys(SHEETS).length} component stylesheets`);
