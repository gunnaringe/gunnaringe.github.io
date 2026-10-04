// Renders the social preview image and the PNG icons from their sources:
//   tools/og.html            -> site/assets/img/og.png
//   site/assets/img/icon.svg -> apple-touch-icon.png, icon-192.png, icon-512.png
// Usage: node tools/render-images.mjs   (needs the playwright package and Chromium)
// favicon.ico is built from icon-192.png afterwards, see README.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const repo = fileURLToPath(new URL("..", import.meta.url));
const types = { ".html": "text/html", ".svg": "image/svg+xml", ".woff2": "font/woff2" };

// CSS masks and fonts don't load from file:// URLs, so serve the repo over HTTP.
const server = createServer(async (req, res) => {
  try {
    const path = join(repo, decodeURIComponent(new URL(req.url, "http://x").pathname));
    res.writeHead(200, { "content-type": types[extname(path)] ?? "application/octet-stream" });
    res.end(await readFile(path));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const out = (name) => join(repo, "site/assets/img", name);

const browser = await chromium.launch();

const og = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await og.goto(`${base}/tools/og.html`);
await og.evaluate(() => document.fonts.ready);
await og.screenshot({ path: out("og.png") });

// iOS fills transparent corners with black, so its icon gets a solid background.
const icons = [
  ["apple-touch-icon.png", 180, "#f6f3ec"],
  ["icon-192.png", 192, "transparent"],
  ["icon-512.png", 512, "transparent"],
];
for (const [name, size, background] of icons) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.goto(`${base}/tools/og.html`); // any same-origin page will do
  await page.setContent(
    `<style>html,body{margin:0;background:${background}}img{display:block;width:100vw;height:100vh}</style>` +
      `<img src="${base}/site/assets/img/icon.svg" alt="">`,
    { waitUntil: "load" },
  );
  await page.screenshot({ path: out(name), omitBackground: background === "transparent" });
}

await browser.close();
server.close();
