import { readFile, writeFile, mkdir } from "node:fs/promises";

// The settings-window mock is a deep, mostly-static block of chrome. Extract it
// straight out of the dump instead of retyping it, so the class names the
// stylesheet expects (.app-window, .app-header, ...) survive exactly.
const html = await readFile("site-dump/pages/index.html", "utf8");
const lines = html.split("\n");

const start = lines.findIndex((l) => l.includes('class="app-stage"'));
if (start === -1) throw new Error("app-stage not found");

// Brace-free: walk forward counting <div> depth from the opening tag.
let depth = 0;
let end = -1;
for (let i = start; i < lines.length; i++) {
  for (const _ of lines[i].matchAll(/<div\b/g)) depth++;
  for (const _ of lines[i].matchAll(/<\/div>/g)) depth--;
  if (depth === 0) {
    end = i;
    break;
  }
}
if (end === -1) throw new Error("unbalanced app-stage block");

let block = lines.slice(start, end + 1).join("\n");

block = block
  .replace(/\s*data-astro-cid-[a-z0-9]+(="[^"]*")?/g, "")
  .replace(/<img([^>]*?)\s*\/?>/g, (_, attrs) => `<img${attrs.trimEnd()} />`)
  .replace(/\s+\n/g, "\n");

await mkdir("extracted", { recursive: true });
await writeFile("extracted/app-window.html", block + "\n");

const classes = [...new Set([...block.matchAll(/class="([^"]+)"/g)].map((m) => m[1]))];
console.log(`extracted ${block.split("\n").length} lines -> extracted/app-window.html`);
console.log(`classes: ${classes.join(", ")}`);
