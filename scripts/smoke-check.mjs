import { chromium } from "playwright";

const ORIGIN = process.env.LOCAL_ORIGIN ?? "http://localhost:4321";

const ROUTES = [
  { path: "/", expect: ["[data-wave-host]", "[data-spatial]", "[data-driver]", "footer"] },
  { path: "/faqs", expect: ["main", "footer"] },
  { path: "/nearfield-vs-stereofuse", expect: ["main", "footer"] },
  { path: "/privacy", expect: ["main", "footer"] },
  { path: "/terms", expect: ["main", "footer"] },
  { path: "/refund-policy", expect: ["main", "footer"] },
];

const browser = await chromium.launch();
let failures = 0;

for (const route of ROUTES) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  const failed = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("requestfailed", (request) => failed.push(request.url()));

  try {
    await page.goto(ORIGIN + route.path, { waitUntil: "networkidle", timeout: 30000 });
  } catch (error) {
    console.log(`FAIL ${route.path}: ${error.message}`);
    failures++;
    await page.close();
    continue;
  }

  const missing = [];
  for (const selector of route.expect) {
    if ((await page.locator(selector).count()) === 0) missing.push(selector);
  }

  // Remote references would mean third-party code survived the port.
  const remote = await page.evaluate(() =>
    [...document.querySelectorAll("script[src], link[rel=stylesheet]")]
      .map((el) => el.getAttribute("src") || el.getAttribute("href"))
      .filter((url) => url && /^https?:\/\//.test(url)),
  );

  const problems = [];
  if (missing.length) problems.push(`missing ${missing.join(", ")}`);
  if (errors.length) problems.push(`console: ${errors.slice(0, 3).join(" | ")}`);
  if (failed.length) problems.push(`requests failed: ${failed.slice(0, 3).join(" | ")}`);
  if (remote.length) problems.push(`remote assets: ${remote.join(" | ")}`);

  if (problems.length) {
    failures++;
    console.log(`FAIL ${route.path}\n       ${problems.join("\n       ")}`);
  } else {
    console.log(`ok   ${route.path}`);
  }

  await page.close();
}

await browser.close();
console.log(failures ? `\n${failures} route(s) with problems` : "\nall routes clean");
process.exit(failures ? 1 : 0);
