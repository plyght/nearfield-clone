import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const PAGES = "site-dump/pages";

// For each scope id, report the shallowest element carrying it per page.
for (const file of (await readdir(PAGES)).filter(
  (f) => f.endsWith(".html") && !f.includes(".min."),
)) {
  const html = await readFile(join(PAGES, file), "utf8");
  const lines = html.split("\n");
  const best = new Map();
  for (const [i, line] of lines.entries()) {
    const m = line.match(/^(\s*)<([a-z][a-z0-9-]*)([^>]*data-astro-cid-([a-z0-9]+)[^>]*)>/);
    if (!m) continue;
    const [, indent, tag, attrs, cid] = m;
    const prev = best.get(cid);
    if (prev && prev.indent <= indent.length) continue;
    const cls =
      attrs
        .match(/class="([^"]*)"/)?.[1]
        .replace(/data-astro-cid-\S+/g, "")
        .trim() || "";
    const id = attrs.match(/\sid="([^"]*)"/)?.[1] || "";
    best.set(cid, { indent: indent.length, tag, cls: cls.slice(0, 70), id, line: i + 1 });
  }
  console.log(`\n=== ${file} ===`);
  for (const [cid, b] of [...best].sort((a, b) => a[1].line - b[1].line)) {
    console.log(
      `  ${cid.padEnd(10)} L${String(b.line).padEnd(5)} <${b.tag}${b.id ? ` id=${b.id}` : ""} class="${b.cls}">`,
    );
  }
}
