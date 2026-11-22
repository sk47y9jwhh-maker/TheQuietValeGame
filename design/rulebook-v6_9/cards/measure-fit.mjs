// Checks that every Encounter Card's text fits its printed box: all 90 cards,
// each Season shown as current (bold), at one or more text scales.
//   node design/rulebook-v6_9/cards/measure-fit.mjs 1 1.1 1.2
// QV_CHROME may point at a Chromium binary. Prints each overflowing box and,
// per scale, how many boxes overflow and the tightest fit.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const require = createRequire(path.join(root, "package.json"));
const esbuild = require("esbuild");
const { chromium } = require("playwright");
const dist = path.join(root, "output/card-fit/_dist");
fs.mkdirSync(dist, { recursive: true });
await esbuild.build({ entryPoints: [path.join(here, "fit-entry.tsx")], bundle: true, outdir: dist, format: "iife", jsx: "automatic",
  loader: { ".png": "file", ".webp": "file", ".woff2": "file", ".jpg": "file" }, publicPath: ".",
  define: { "process.env.NODE_ENV": '"production"', "import.meta.env.BASE_URL": JSON.stringify(pathToFileURL(path.join(root, "public")).href + "/") },
  logLevel: "error", nodePaths: [path.join(root, "node_modules")] });
fs.writeFileSync(path.join(dist, "page.html"), `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="fit-entry.css"><style>body{margin:0}.shot{display:inline-block;margin:6px;width:420px}</style></head><body><div id="root"></div><script src="fit-entry.js"></script></body></html>`);
const browser = await chromium.launch(process.env.QV_CHROME ? { executablePath: process.env.QV_CHROME } : {});
const page = await browser.newPage({ viewport: { width: 1800, height: 1000 } });
await page.goto(pathToFileURL(path.join(dist, "page.html")).href);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(500);
const scales = process.argv.slice(2).map(Number).filter(Boolean);
for (const scale of scales.length ? scales : [1]) {
  const result = await page.evaluate((scale) => {
    document.documentElement.style.setProperty("--face-text-scale", String(scale)); // overrides the 1.25 default
    const boxes = document.querySelectorAll(".physical-card-effect, .physical-card-lifecycle, .physical-card-arrival-requirement, .physical-card-arrival-reward, .physical-card-golden-effect");
    const over = [];
    let tightest = Infinity;
    for (const box of boxes) {
      // The visible text (a face with icons also carries a hidden copy in words for screen readers).
      const content = box.querySelector(".face-text > [aria-hidden]") ?? box.firstElementChild;
      if (!content) continue;
      const b = box.getBoundingClientRect();
      // Measure the text's own line boxes, not the inline wrapper's padding.
      const range = document.createRange();
      range.selectNodeContents(content);
      const rects = [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
      if (!rects.length) continue;
      const top = Math.min(...rects.map((r) => r.top)), bottom = Math.max(...rects.map((r) => r.bottom));
      const left = Math.min(...rects.map((r) => r.left)), right = Math.max(...rects.map((r) => r.right));
      const spare = Math.min(top - b.top, b.bottom - bottom, left - b.left + 1, b.right - right + 1) / b.height;
      tightest = Math.min(tightest, spare);
      if (top < b.top - 0.5 || bottom > b.bottom + 0.5 || right > b.right + 1) {
        const shot = box.closest(".shot");
        over.push(`${shot.id} ${box.className.split(" ")[0].replace("physical-card-", "")} ${box.className.match(/copy-\w+/)?.[0] ?? ""} (${Math.round(bottom - top)}/${Math.round(b.height)} px)`);
      }
    }
    return { count: boxes.length, over, tightest };
  }, scale);
  console.log(`scale ${scale}: ${result.over.length} of ${result.count} boxes overflow; tightest spare ${(result.tightest * 100).toFixed(1)}% of box height`);
  for (const line of result.over.slice(0, 40)) console.log("  " + line);
}
await browser.close();
