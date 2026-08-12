import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

// Every @keyframes / transition / scroll-variable in the source CSS, checked
// against what the clone actually ships. A keyframe defined but never
// referenced in shipped CSS means an animation surface was dropped.
const SRC_DIR = "extracted/css";
const OUT_DIRS = ["src/styles", "src/styles/components"];

async function readAll(dir, recurse = false) {
  let text = "";
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (recurse) text += await readAll(join(dir, entry.name), recurse);
      continue;
    }
    if (entry.name.endsWith(".css")) text += "\n" + (await readFile(join(dir, entry.name), "utf8"));
  }
  return text;
}

const source = await readAll(SRC_DIR);
const shipped = await readAll("src/styles", true);

const names = (css) => [...css.matchAll(/@keyframes\s+([A-Za-z0-9_-]+)/g)].map((m) => m[1]);

const sourceKeyframes = [...new Set(names(source))];
const shippedKeyframes = new Set(names(shipped));

console.log("keyframes in source:", sourceKeyframes.length);

// Keyframes belonging to features deliberately left out of the clone.
const INTENTIONALLY_DROPPED = new Set(["checkout-spin"]);

const missing = sourceKeyframes.filter(
  (k) => !shippedKeyframes.has(k) && !INTENTIONALLY_DROPPED.has(k),
);
console.log(missing.length ? `MISSING keyframes: ${missing.join(", ")}` : "all keyframes shipped");

// A shipped keyframe nobody animates is a dropped hook.
const unreferenced = [...shippedKeyframes].filter((k) => {
  const uses = shipped.match(new RegExp(`(animation[^;]*|animation-name:\\s*)\\b${k}\\b`, "g"));
  return !uses || uses.length === 0;
});
console.log(
  unreferenced.length ? `defined but never animated: ${unreferenced.join(", ")}` : "all animated",
);

// Custom properties the JS is expected to drive.
for (const variable of ["--scroll-progress", "--char-d", "--window-x", "--base", "--pos"]) {
  const inSource = source.includes(variable);
  const inShipped = shipped.includes(variable);
  if (inSource && !inShipped) console.log(`MISSING driven variable: ${variable}`);
}
console.log("driven-variable check done");
