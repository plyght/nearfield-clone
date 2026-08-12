import { readFile, writeFile, mkdir } from "node:fs/promises";

const pathMap = JSON.parse(await readFile("extracted/path-map.json", "utf8"));

let authored = await readFile("extracted/css/_global.css", "utf8");

// Point @font-face at the vendored /fonts/ copies.
for (const [from, to] of Object.entries(pathMap)) {
  authored = authored.split(from).join(to);
}

// The checkout dialog was dropped from this clone, so its spinner keyframes
// have nothing left to animate.
authored = authored.replace(/@keyframes checkout-spin \{[\s\S]*?\n\}\n*/, "");

// Component-scoped sheets are emitted with their components; drop the checkout
// sheet entirely and keep the rest out of the global bundle.
const theme = `@import "tailwindcss";

@theme {
  --font-sans:
    -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Inter Variable", Inter,
    system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji",
    "Segoe UI Emoji";
  --font-mono:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New",
    monospace;

  --color-ink: #0a0a0a;
  --color-ink-2: #0f0f0f;
  --color-surface: #ffffff0d;
  --color-surface-strong: #ffffff14;
  --color-hairline: #ffffff14;
  --color-fg: #fff;
  --color-muted: #ffffff80;
  --color-faint: #ffffff59;
  --color-white: #fff;
  --color-black: #000;

  --radius-card: 24px;
}

`;

await mkdir("src/styles", { recursive: true });
await writeFile("src/styles/global.css", theme + authored);
console.log(`wrote src/styles/global.css (${(theme + authored).split("\n").length} lines)`);
