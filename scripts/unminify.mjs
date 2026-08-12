import { readdir, readFile, writeFile, stat } from "node:fs/promises";
import { join, extname } from "node:path";
import prettier from "prettier";

const PARSERS = { ".html": "html", ".css": "css", ".js": "babel" };

async function* walk(dir) {
  for (const entry of await readdir(dir)) {
    const path = join(dir, entry);
    if ((await stat(path)).isDirectory()) yield* walk(path);
    else yield path;
  }
}

let formatted = 0;
for await (const path of walk("site-dump")) {
  const ext = extname(path);
  const parser = PARSERS[ext];
  if (!parser || path.includes(".min.")) continue;
  const src = await readFile(path, "utf8");
  const min = path.replace(new RegExp(`\\${ext}$`), `.min${ext}`);
  await writeFile(min, src);
  await writeFile(path, await prettier.format(src, { parser, printWidth: 100 }));
  formatted++;
}
console.log(`formatted ${formatted} files (originals kept as *.min.*)`);
