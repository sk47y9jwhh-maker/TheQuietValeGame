// Draws the rulebook's Encounter Cards with the online game's own
// EncounterCard component (print mode), at 4x, as PNGs with bleed.
//   NODE_PATH=<node_modules> node design/rulebook-v6_9/cards/render-cards.mjs <out-dir>
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const require = createRequire(path.join(root, "package.json"));
const esbuild = require("esbuild");
const { chromium } = require("playwright");
const out = path.resolve(process.argv[2] || path.join(root, "output/rulebook-v6_9/cards"));
const dist = path.join(out, "_dist");
fs.mkdirSync(dist, { recursive: true });
await esbuild.build({ entryPoints: [path.join(here, "entry.tsx")], bundle: true, outdir: dist, format: "iife", jsx: "automatic",
  loader: { ".png": "file", ".webp": "file", ".woff2": "file", ".jpg": "file" }, publicPath: ".", define: { "process.env.NODE_ENV": '"production"' }, logLevel: "error", nodePaths: [path.join(root, "node_modules")] });
const want = [
  { name: "Quiet Quest", key: "arrival-quiet-quest", timers: 3 }, { name: "Blade to Herb", key: "arrival-blade-to-herb" },
  { name: "A Little Time", key: "boon-a-little-time", season: 1 }, { name: "Old Wounds Reopen", key: "burden-old-wounds", season: 1 },
  { name: "The Golden Scroll", key: "golden-scroll" }, { name: "Ancient Paths Reopen", key: "boon-ancient-paths" },
  { name: "Remnants of the Cavalry", key: "arrival-cavalry", timers: 2 }];
fs.writeFileSync(path.join(dist, "page.html"), `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="entry.css"><style>body{margin:0}.shot{display:inline-block;margin:20px;width:420px}</style></head><body><div id="root"></div><script>window.WANT=${JSON.stringify(want)}</script><script src="entry.js"></script></body></html>`);
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 4, viewport: { width: 1400, height: 1000 } });
await page.goto(pathToFileURL(path.join(dist, "page.html")).href);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(800);
for (const w of want) await (await page.$(`#${w.key} .physical-encounter-card`)).screenshot({ path: path.join(out, `${w.key}.png`), omitBackground: true });
await browser.close();
console.log("cards", want.length);
