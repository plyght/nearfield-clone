import { readFile, writeFile, mkdir } from "node:fs/promises";

// Page-level <style> blocks never make it into the /_astro bundles, so they
// have to be pulled straight out of the served HTML.
const PAGES = ["privacy", "faqs", "terms", "refund-policy", "nearfield-vs-stereofuse", "index"];

await mkdir("extracted/css", { recursive: true });

const seen = new Set();
const collected = [];

for (const page of PAGES) {
  const html = await readFile(`site-dump/pages/${page}.html`, "utf8");
  for (const match of html.matchAll(/<style>([\s\S]*?)<\/style>/g)) {
    const css = match[1].trim();
    // Skip the tiny first-paint fallback, which the layout already inlines.
    if (!css || css.includes("background-color: #0a0a0a") || seen.has(css)) continue;
    seen.add(css);
    collected.push(`/* from pages/${page}.html */\n${css}`);
  }
}

const out = collected.join("\n\n").replace(/\[data-astro-cid-[a-z0-9]+\]/g, "");
await writeFile("src/styles/components/page-styles.css", out + "\n");

const selectors = [...out.matchAll(/^\s*\.([a-z][a-z0-9-]*)/gm)].map((m) => m[1]);
console.log(`wrote src/styles/components/page-styles.css (${out.split("\n").length} lines)`);
console.log(`selectors: ${[...new Set(selectors)].join(", ")}`);
