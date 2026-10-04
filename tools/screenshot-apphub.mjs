// Screenshots the live apphub.casa front page for the Apps card:
//   https://apphub.casa/ (light) -> site/assets/img/apphub.webp
//   https://apphub.casa/ (dark)  -> site/assets/img/apphub-dark.webp
// Usage: node tools/screenshot-apphub.mjs   (needs the playwright package and Chromium)
// The output must stay 1320x825: index.html has width/height for it. The page is
// rendered at 880x550 CSS px and 1.5x scale, which frames the app grid without
// wide empty margins and keeps the text readable on the card.
// WebP is encoded by Chromium itself (canvas.toDataURL), so no image tools are needed.
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const URL_TO_SHOOT = "https://apphub.casa/";
const WIDTH = 880;
const HEIGHT = 550;
const SCALE = 1.5;
const QUALITY = 0.82;

const repo = fileURLToPath(new URL("..", import.meta.url));
const out = (name) => join(repo, "site/assets/img", name);

const browser = await chromium.launch();

for (const [name, colorScheme] of [
  ["apphub.webp", "light"],
  ["apphub-dark.webp", "dark"],
]) {
  const page = await browser.newPage({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: SCALE,
    colorScheme,
    reducedMotion: "reduce",
  });
  await page.goto(URL_TO_SHOOT, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500); // let images and any entrance transitions settle
  const png = await page.screenshot({ type: "png" });

  // Re-encode the PNG as WebP in the browser.
  const webp = await page.evaluate(
    async ({ data, quality }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${data}`;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext("2d").drawImage(img, 0, 0);
      return canvas.toDataURL("image/webp", quality).split(",")[1];
    },
    { data: png.toString("base64"), quality: QUALITY },
  );
  await writeFile(out(name), Buffer.from(webp, "base64"));
  console.log(`wrote site/assets/img/${name}`);
  await page.close();
}

await browser.close();
