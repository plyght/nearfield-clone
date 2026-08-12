import { chromium } from "playwright";

const LOCAL = process.env.LOCAL_ORIGIN ?? "http://localhost:4321";
const REMOTE = "https://trynearfield.com";

// Selectors present on both sites, measured box-for-box.
const SELECTORS = [
  "header",
  ".header-brand",
  "header nav",
  "header nav > a:first-child",
  "main",
  "main > div:first-child",
  "[data-wave-host]",
  "[data-hero-headline]",
  ".buy-btn",
  ".buy-label",
  ".buy-apple",
  ".buy-arrow",
  "main section:nth-of-type(1)",
  ".companion-card",
  ".companion-copy h2",
  ".companion-features",
  ".app-stage",
  ".app-window",
  ".feature-card",
  ".bottom-cta",
  "footer",
  "footer > div",
];

const PROPS = [
  "fontSize",
  "fontWeight",
  "lineHeight",
  "letterSpacing",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "marginTop",
  "gap",
  "borderRadius",
];

async function measure(url) {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
    colorScheme: "dark",
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(900);
  const data = await page.evaluate(
    ({ selectors, props }) => {
      const out = {};
      for (const selector of selectors) {
        const el = document.querySelector(selector);
        if (!el) {
          out[selector] = null;
          continue;
        }
        const rect = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        const style = {};
        for (const prop of props) style[prop] = cs[prop];
        out[selector] = {
          x: Math.round(rect.x * 10) / 10,
          y: Math.round(rect.y * 10) / 10,
          w: Math.round(rect.width * 10) / 10,
          h: Math.round(rect.height * 10) / 10,
          text: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40),
          style,
        };
      }
      return out;
    },
    { selectors: SELECTORS, props: PROPS },
  );
  await page.close();
  return data;
}

const browser = await chromium.launch();
const [local, orig] = await Promise.all([measure(LOCAL), measure(REMOTE)]);
await browser.close();

const TOL = 1.5;
let issues = 0;

for (const selector of SELECTORS) {
  const a = local[selector];
  const b = orig[selector];
  if (!b) continue;
  if (!a) {
    console.log(`MISSING locally: ${selector}`);
    issues++;
    continue;
  }

  const deltas = [];
  for (const key of ["x", "y", "w", "h"]) {
    const diff = a[key] - b[key];
    if (Math.abs(diff) > TOL)
      deltas.push(`${key} ${diff > 0 ? "+" : ""}${Math.round(diff * 10) / 10}`);
  }
  const styleDiffs = [];
  for (const prop of PROPS) {
    if (a.style[prop] !== b.style[prop]) {
      styleDiffs.push(`${prop}: ${a.style[prop]} vs ${b.style[prop]}`);
    }
  }

  if (deltas.length || styleDiffs.length) {
    issues++;
    console.log(`\n${selector}`);
    if (deltas.length) console.log(`   box:   ${deltas.join(", ")}`);
    for (const d of styleDiffs) console.log(`   style: ${d}`);
    if (a.text !== b.text) console.log(`   text:  "${a.text}" vs "${b.text}"`);
  }
}

console.log(issues ? `\n${issues} element(s) differ` : "\nall measured elements match");
