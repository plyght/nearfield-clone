import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const LOCAL = process.env.LOCAL_ORIGIN ?? "http://localhost:4321";
const REMOTE = "https://trynearfield.com";

const ROUTES = ["/", "/faqs", "/nearfield-vs-stereofuse", "/privacy", "/terms", "/refund-policy"];

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
];

const only = process.argv.slice(2);
const routes = only.length ? only : ROUTES;

await mkdir("shots", { recursive: true });

const browser = await chromium.launch();

for (const viewport of VIEWPORTS) {
  for (const route of routes) {
    const slug = route === "/" ? "index" : route.replace(/^\//, "").replace(/\//g, "-");

    for (const [label, origin] of [
      ["local", LOCAL],
      ["orig", REMOTE],
    ]) {
      const page = await browser.newPage({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: 2,
        colorScheme: "dark",
      });
      // Freeze motion so the two captures are comparable.
      await page.emulateMedia({ reducedMotion: "reduce" });
      try {
        await page.goto(origin + route, { waitUntil: "networkidle", timeout: 30000 });
        await page.waitForTimeout(600);
        await page.screenshot({
          path: `shots/${slug}-${viewport.name}-${label}.png`,
          fullPage: true,
        });
        console.log(`  ok   ${label.padEnd(5)} ${viewport.name.padEnd(7)} ${route}`);
      } catch (error) {
        console.log(
          `  FAIL ${label.padEnd(5)} ${viewport.name.padEnd(7)} ${route}: ${error.message}`,
        );
      }
      await page.close();
    }
  }
}

await browser.close();
console.log("\nshots written to shots/");
