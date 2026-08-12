import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const ORIGIN = "https://trynearfield.com";
const OUT = "site-dump";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const ROUTES = ["/", "/faqs", "/nearfield-vs-stereofuse", "/privacy", "/refund-policy", "/terms"];

const manifest = {
  target: ORIGIN,
  scope: "same-origin + fonts",
  rendered: false,
  routes: [],
  assets: [],
  missing: [],
  notes: [],
};

const seen = new Set();

async function save(path, buf) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, buf);
}

async function get(url) {
  const res = await fetch(url, { headers: { "user-agent": UA } });
  const buf = Buffer.from(await res.arrayBuffer());
  return { res, buf };
}

function routePath(route) {
  return route === "/" ? "index.html" : `${route.replace(/^\//, "")}.html`;
}

async function fetchRoute(route) {
  const url = ORIGIN + route;
  const { res, buf } = await get(url);
  const path = join(OUT, "pages", routePath(route));
  if (!res.ok) {
    manifest.missing.push({ url, status: res.status });
    return "";
  }
  await save(path, buf);
  manifest.routes.push({ url, path, status: res.status, bytes: buf.length });
  return buf.toString("utf8");
}

function discover(html, base = ORIGIN) {
  const urls = new Set();
  const patterns = [
    /(?:href|src|poster)="([^"]+)"/g,
    /content="(\/[^"\s]+|https?:\/\/[^"\s]+)"/g,
    /srcset="([^"]+)"/g,
    /url\((['"]?)([^)'"]+)\1\)/g,
    /(?:from|import)\s*"(\.[^"]+)"/g,
  ];
  for (const re of patterns) {
    for (const m of html.matchAll(re)) {
      const raw = m[2] ?? m[1];
      for (const cand of raw.split(",")) {
        const u = cand.trim().split(/\s+/)[0];
        if (!u || u.startsWith("data:") || u.startsWith("mailto:")) continue;
        if (u.startsWith("#")) continue;
        try {
          const abs = new URL(u, base);
          if (abs.origin !== ORIGIN) continue;
          if (/\.(html?)$/.test(abs.pathname)) continue;
          if (abs.pathname === "/" || ROUTES.includes(abs.pathname)) continue;
          urls.add(abs.origin + abs.pathname);
        } catch {}
      }
    }
  }
  return urls;
}

async function fetchAsset(url) {
  if (seen.has(url)) return "";
  seen.add(url);
  const { res, buf } = await get(url);
  const rel = new URL(url).pathname.replace(/^\//, "");
  const path = join(OUT, "assets", rel);
  if (!res.ok) {
    manifest.missing.push({ url, status: res.status });
    return "";
  }
  await save(path, buf);
  const ct = res.headers.get("content-type") || "";
  manifest.assets.push({
    url,
    path,
    status: res.status,
    bytes: buf.length,
    content_type: ct,
  });
  return /text|javascript|json|css|xml|svg/.test(ct) ? buf.toString("utf8") : "";
}

const pending = new Set();
for (const route of ROUTES) {
  const html = await fetchRoute(route);
  for (const u of discover(html)) pending.add(u);
}

for (let depth = 0; depth < 3 && pending.size; depth++) {
  const batch = [...pending];
  pending.clear();
  const texts = [];
  for (let i = 0; i < batch.length; i += 8) {
    texts.push(...(await Promise.all(batch.slice(i, i + 8).map(fetchAsset))));
  }
  for (const [i, text] of texts.entries()) {
    if (!text) continue;
    const base = batch[i];
    for (const u of discover(text, base)) if (!seen.has(u)) pending.add(u);
    const sm = text.match(/\/\/# sourceMappingURL=(\S+)/);
    if (sm && !sm[1].startsWith("data:")) {
      const abs = new URL(sm[1], base).href;
      if (!seen.has(abs)) pending.add(abs);
    }
  }
}

for (const extra of ["/favicon.svg", "/og/nearfield-og.png"]) {
  await fetchAsset(ORIGIN + extra);
}

manifest.fetched_at = process.env.FETCHED_AT || "";
await save(join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));

console.log(
  `routes=${manifest.routes.length} assets=${manifest.assets.length} missing=${manifest.missing.length} bytes=${
    manifest.assets.reduce((a, b) => a + b.bytes, 0) +
    manifest.routes.reduce((a, b) => a + b.bytes, 0)
  }`,
);
for (const m of manifest.missing) console.log(`  MISSING ${m.status} ${m.url}`);
