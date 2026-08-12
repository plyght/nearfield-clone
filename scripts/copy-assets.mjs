import { readdir, mkdir, copyFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const SRC = "site-dump/assets";
const map = {};

await mkdir("public/fonts", { recursive: true });
await mkdir("public/og", { recursive: true });

for (const file of await readdir(join(SRC, "_astro"))) {
  if (!file.endsWith(".woff2")) continue;
  // inter-latin-wght-normal.Dx4kXJAl.woff2 -> inter-latin.woff2
  const clean = file.replace(/-wght-normal\.[A-Za-z0-9_-]+\.woff2$/, ".woff2");
  await copyFile(join(SRC, "_astro", file), join("public/fonts", clean));
  map[`/_astro/${file}`] = `/fonts/${clean}`;
}

for (const [from, to] of Object.entries({
  "favicon.svg": "public/favicon.svg",
  "icon-appletv.png": "public/icon-appletv.png",
  "icon-safari.png": "public/icon-safari.png",
  "spatial-wallpaper.jpg": "public/spatial-wallpaper.jpg",
  "og/nearfield-og.png": "public/og/nearfield-og.png",
})) {
  await copyFile(join(SRC, from), to);
  map[`/${from}`] = `/${from}`;
}

await writeFile("extracted/path-map.json", JSON.stringify(map, null, 2));
console.log(`copied ${Object.keys(map).length} assets`);
for (const [k, v] of Object.entries(map)) console.log(`  ${k} -> ${v}`);
