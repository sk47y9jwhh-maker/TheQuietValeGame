#!/usr/bin/env node
/**
 * Renders all Tabletop Simulator (TTS) assets for The Quiet Vale v7.0 into public/tts/:
 *   1. Four trimmed charcoal-leather & brass boards (boards/*.jpg)
 *   2. 15 v7.0 Target Cards (2-row + enlarged compass / Open) -> decks/target-deck.jpg + target-back.jpg
 *   3. 90 v7.0 Encounter Cards (30 Boons, 30 Burdens, 25 Arrivals, 5 Golden Boons) -> decks/*-deck.jpg + encounter-back.jpg
 *   4. 21 Quest Cards -> decks/quest-deck.jpg + quest-back.jpg
 *   5. All v7.0 Hex Tiles (Core Basic/Upgraded, Special 1-26, Golden 1-5, Extensions, Backs) -> tiles/*.png (512x512)
 *   6. 6 Steward Reference Mats + shared back -> stewards/*.jpg
 *   7. Circular game tokens -> tokens/*.png
 *
 * Usage:
 *   node tools/tts/render-assets.mjs [--only boards,target,encounters,tiles,stewards,tokens,sheets]
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const require = createRequire(path.join(root, "package.json"));
const ts = require("typescript");
const esbuild = require("esbuild");

const PLAYWRIGHT_PATH =
  process.env.QV_PLAYWRIGHT ||
  "/Users/robertlittle/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright";
const PYTHON_BIN =
  process.env.QV_PYTHON ||
  "/Users/robertlittle/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3";
const CHROME_BIN =
  process.env.QV_CHROME ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const { chromium } = require(PLAYWRIGHT_PATH);

const rawDir = path.join(root, "output/tts/raw");
const outDir = path.join(root, "public/tts");
fs.mkdirSync(rawDir, { recursive: true });
fs.mkdirSync(outDir, { recursive: true });

const onlyArg = process.argv.find((a) => a.startsWith("--only="));
const onlySet = onlyArg ? new Set(onlyArg.slice("--only=".length).split(",")) : null;
const wantStep = (name) => !onlySet || onlySet.has(name);

function loadTs(relPath) {
  const full = path.join(root, relPath);
  const src = fs.readFileSync(full, "utf8");
  const mod = { exports: {} };
  const localRequire = (spec) => {
    if (spec.startsWith(".")) {
      const base = path.resolve(path.dirname(full), spec);
      if (fs.existsSync(base + ".ts")) return loadTs(path.relative(root, base + ".ts"));
      if (fs.existsSync(base + ".json")) return JSON.parse(fs.readFileSync(base + ".json", "utf8"));
    }
    return require(spec);
  };
  const out = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  new Function("exports", "module", "require", out)(mod.exports, mod, localRequire);
  return mod.exports;
}

const dataUri = (absPath, mime) =>
  `data:${mime};base64,${fs.readFileSync(absPath).toString("base64")}`;

const esc = (s) =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

// ---------------------------------------------------------------------------
// 1. Target Cards (v7.0 — 15 cards, 2 rows: Tile + Current Strain + Compass)
// ---------------------------------------------------------------------------
async function renderTargetCards(browser) {
  const { targetCards } = loadTs("src/data/targetCards.ts");
  const fontsDir = path.join(root, "src/assets/fonts");
  const bg = dataUri(path.join(root, "design/target-cards/target-front-background-clean-600dpi.png"), "image/png");
  const divider = dataUri(path.join(root, "design/quest-cards/divider-long.png"), "image/png");
  const font = (f) => dataUri(path.join(fontsDir, f), "font/woff2");

  const ink = "#2b2f33";
  const steel = "#3e5566";
  const hexPts = (cx, cy, r) =>
    [0, 1, 2, 3, 4, 5]
      .map((i) => {
        const a = (Math.PI / 3) * i;
        return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
      })
      .join(" ");
  const hex = (cx, cy, r, attrs) => `<polygon points="${hexPts(cx, cy, r)}" ${attrs}/>`;
  const line = `fill="none" stroke="${ink}" stroke-width="7"`;
  const glyphs = {
    basic: `<svg viewBox="0 0 100 100">${hex(50, 50, 40, line)}</svg>`,
    upgraded: `<svg viewBox="0 0 100 100">${hex(50, 50, 42, `fill="none" stroke="${ink}" stroke-width="6"`)}${hex(50, 50, 26, `fill="none" stroke="${ink}" stroke-width="6"`)}</svg>`,
    specialOrGolden: `<svg viewBox="0 0 100 100">${hex(50, 50, 40, line)}<path d="M50 27 L56 43 L73 43 L59 53 L64 70 L50 60 L36 70 L41 53 L27 43 L44 43 Z" fill="${ink}"/></svg>`,
    strained: `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="34" fill="#1d1d1f"/><ellipse cx="40" cy="38" rx="12" ry="7" fill="#fff" fill-opacity="0.28"/></svg>`,
    unstrained: `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="32" fill="none" stroke="${ink}" stroke-width="5" stroke-dasharray="9 8"/></svg>`
  };
  const tileVals = {
    basic: ["Basic", glyphs.basic],
    upgraded: ["Upgraded", glyphs.upgraded],
    specialOrGolden: ["Special / Golden", glyphs.specialOrGolden],
    any: ["Any", ""]
  };
  const strainVals = {
    strained: ["Already Strained", glyphs.strained],
    unstrained: ["Unstrained", glyphs.unstrained],
    any: ["Any", ""]
  };
  const vectors = {
    N: [0, -1],
    NE: [Math.sqrt(3) / 2, -0.5],
    SE: [Math.sqrt(3) / 2, 0.5],
    S: [0, 1],
    SW: [-Math.sqrt(3) / 2, 0.5],
    NW: [-Math.sqrt(3) / 2, -0.5]
  };
  const dirNames = {
    N: "North (N)",
    NE: "North-East (NE)",
    SE: "South-East (SE)",
    S: "South (S)",
    SW: "South-West (SW)",
    NW: "North-West (NW)"
  };

  function tieDiagram(direction) {
    const [dx, dy] = vectors[direction];
    const [px, py] = [-dy, dx];
    const W = 380, H = 250, cx = W / 2, cy = H / 2 + 10, hw = 162, hh = 98, r = 24;
    const reach = Math.min(dx ? hw / Math.abs(dx) : 1e9, dy ? hh / Math.abs(dy) : 1e9) - r - 12;
    const win = [cx + dx * reach, cy + dy * reach];
    const others = [
      [cx - dx * reach * 0.25 + px * 68, cy - dy * reach * 0.25 + py * 68],
      [cx + dx * reach * 0.2 - px * 70, cy + dy * reach * 0.2 - py * 70]
    ].map(([x, y]) => [
      Math.max(cx - hw + r + 8, Math.min(cx + hw - r - 8, x)),
      Math.max(cy - hh + r + 8, Math.min(cy + hh - r - 8, y))
    ]);
    const tail = [cx - dx * reach * 0.92, cy - dy * reach * 0.92];
    const tip = [win[0] - dx * (r + 14), win[1] - dy * (r + 14)];
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    return `<svg viewBox="0 0 ${W} ${H + 12}" class="diagram">
      <text x="${cx}" y="20" text-anchor="middle" font-family="Alegreya Sans" font-weight="700" font-size="26" fill="${ink}" fill-opacity="0.65">N</text>
      <rect x="${cx - hw}" y="${cy - hh}" width="${hw * 2}" height="${hh * 2}" rx="16" fill="rgba(62,85,102,0.08)" stroke="${ink}" stroke-width="3.5" stroke-opacity="0.45" stroke-dasharray="10 7"/>
      ${others.map(([x, y]) => hex(x, y, r, `fill="#f6f0df" stroke="${ink}" stroke-width="4.5"`)).join("")}
      ${hex(win[0], win[1], r, `fill="${steel}" stroke="${ink}" stroke-width="4.5"`)}
      <line x1="${tail[0]}" y1="${tail[1]}" x2="${tip[0] - dx * 22}" y2="${tip[1] - dy * 22}" stroke="${steel}" stroke-width="13" stroke-linecap="round"/>
      <g transform="translate(${tip[0]} ${tip[1]}) rotate(${angle})"><path d="M10 0 L-34 -25 L-34 25 Z" fill="${steel}"/></g>
    </svg>`;
  }

  const targetOut = path.join(rawDir, "target");
  fs.mkdirSync(targetOut, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1630, height: 2220 }, deviceScaleFactor: 1 });

  for (const card of targetCards) {
    const open = !card.direction;
    const [tileLabel, tileGlyph] = tileVals[card.tile];
    const [strainLabel, strainGlyph] = strainVals[card.strain];
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
      @font-face { font-family: Almendra; font-weight: 400; src: url(${font("almendra-latin-regular.woff2")}); }
      @font-face { font-family: Almendra; font-weight: 700; src: url(${font("almendra-latin-bold.woff2")}); }
      @font-face { font-family: Alegreya; font-weight: 400 700; src: url(${font("alegreya-latin-variable.woff2")}); }
      @font-face { font-family: Alegreya; font-style: italic; src: url(${font("alegreya-latin-italic.woff2")}); }
      @font-face { font-family: "Alegreya Sans"; font-weight: 500; src: url(${font("alegreya-sans-latin-medium.woff2")}); }
      @font-face { font-family: "Alegreya Sans"; font-weight: 700; src: url(${font("alegreya-sans-latin-bold.woff2")}); }
      html, body { margin: 0; width: 1630px; height: 2220px; overflow: hidden; }
      body { position: relative; background: url(${bg}) no-repeat 0 0 / 1630px 2220px; color: ${ink}; font-family: Alegreya, serif; }
      .glow { position: absolute; left: 270px; right: 270px; border-radius: 50%; background: radial-gradient(ellipse at center, rgba(120,136,150,0.32), rgba(120,136,150,0) 70%); }
      .div { position: absolute; height: 28px; background: url(${divider}) no-repeat center / 100% 28px; }
      .type { position: absolute; top: 248px; left: 0; right: 0; text-align: center; font: 700 46px/1 "Alegreya Sans", sans-serif; letter-spacing: 0.16em; text-transform: uppercase; color: #333; }
      .title { position: absolute; top: 366px; left: 260px; right: 260px; height: 135px; display: flex; align-items: center; justify-content: center;
        font: 400 108px/1 Almendra, serif; color: #26292c; text-shadow: 0 2px 0 rgba(255,252,240,0.8); }
      .rows { position: absolute; top: 560px; left: 250px; right: 250px; height: 620px; display: grid; grid-template-rows: 1fr 1fr; }
      .row { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; border-bottom: 2px solid rgba(43,47,51,0.22); }
      .row:last-child { border-bottom: 0; }
      .label { font: 400 62px/1 Almendra, serif; color: #44494e; }
      .value { display: flex; align-items: center; gap: 30px; font: 700 96px/1 Alegreya, serif; color: #1f2226; }
      .glyph svg { width: 108px; height: 108px; display: block; }
      .outcome { position: absolute; top: 1230px; left: 220px; right: 220px; height: 740px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px; text-align: center; }
      .diagram { width: 640px; height: 420px; display: block; }
      .big { font: 700 84px/1.08 Alegreya, serif; color: ${steel}; }
      .dir { font: 700 64px/1 "Alegreya Sans", sans-serif; color: ${ink}; letter-spacing: 0.04em; }
      .small { font: italic 400 54px/1.15 Alegreya, serif; color: #44494e; max-width: 1040px; }
      .foot { position: absolute; top: 2012px; left: 0; right: 0; text-align: center; font: italic 400 46px/1 Alegreya, serif; color: #44494e; }
    </style></head><body>
      <div class="glow" style="top:372px;height:130px"></div>
      <div class="div" style="top:320px;left:440px;width:750px"></div>
      <div class="div" style="top:518px;left:245px;width:1140px"></div>
      <div class="div" style="top:1196px;left:245px;width:1140px"></div>
      <div class="type">Target</div>
      <div class="title">${open ? `Open ${String(card.id).padStart(2, "0")}` : `Card ${String(card.id).padStart(2, "0")}`}</div>
      <div class="rows">
        <section class="row">
          <div class="label">1. Tile</div>
          <div class="value">${tileGlyph ? `<span class="glyph">${tileGlyph}</span>` : ""}<span>${tileLabel}</span></div>
        </section>
        <section class="row">
          <div class="label">2. Current Strain</div>
          <div class="value">${strainGlyph ? `<span class="glyph">${strainGlyph}</span>` : ""}<span>${strainLabel}</span></div>
        </section>
      </div>
      ${
        open
          ? `<section class="outcome">
               <div class="label">Open Target</div>
               <div class="big">Choose any eligible tile</div>
               <div class="small">Keep to any limits set by the triggering effect.</div>
             </section>`
          : `<section class="outcome">
               <div class="label">If still tied</div>
               ${tieDiagram(card.direction)}
               <div class="dir">${dirNames[card.direction]}</div>
               <div class="small">Take the tied tile closest to the arrow. If still tied, players choose.</div>
             </section>`
      }
      <div class="foot">Stop as soon as 1 tile remains. Skip a row if no tile matches.</div>
    </body></html>`;
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(targetOut, `target-${String(card.id).padStart(2, "0")}.png`), type: "png" });
  }
  await page.close();
  console.log(`rendered ${targetCards.length} v7.0 target cards`);
}

// ---------------------------------------------------------------------------
// 2. Encounter Cards (v7.0 — 90 cards via live React EncounterCard component)
// ---------------------------------------------------------------------------
async function renderEncounterCards(browser) {
  const { boons, burdens, arrivals, goldenBoons } = loadTs("src/data/encounters.ts");
  const groups = [
    ["boons", boons],
    ["burdens", burdens],
    ["arrivals", arrivals],
    ["golden-boons", goldenBoons]
  ];
  const dist = path.join(rawDir, "encounters/_dist");
  fs.mkdirSync(dist, { recursive: true });

  await esbuild.build({
    entryPoints: [path.join(here, "encounter-entry.tsx")],
    bundle: true,
    outdir: dist,
    format: "iife",
    jsx: "automatic",
    loader: { ".png": "file", ".webp": "file", ".woff2": "file", ".jpg": "file" },
    publicPath: ".",
    define: {
      "process.env.NODE_ENV": '"production"',
      "import.meta.env.BASE_URL": JSON.stringify(pathToFileURL(path.join(root, "public")).href + "/")
    },
    logLevel: "error",
    nodePaths: [path.join(root, "node_modules")]
  });

  const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 1200, height: 1200 } });
  let total = 0;
  for (const [groupName, cards] of groups) {
    const groupOut = path.join(rawDir, "encounters", groupName);
    fs.mkdirSync(groupOut, { recursive: true });
    const want = cards.map((c, i) => ({ id: c.id, key: `c-${String(i + 1).padStart(2, "0")}` }));
    const htmlPath = path.join(dist, `${groupName}.html`);
    fs.writeFileSync(
      htmlPath,
      `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="encounter-entry.css"><style>body{margin:0;background:transparent}.shot{display:inline-block;margin:16px;width:240px}</style></head><body><div id="root"></div><script>window.WANT=${JSON.stringify(want)}</script><script src="encounter-entry.js"></script></body></html>`
    );
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);
    for (const w of want) {
      const el = await page.$(`#${w.key} .physical-encounter-card`);
      if (!el) throw new Error(`Missing rendered card ${w.id}`);
      await el.screenshot({ path: path.join(groupOut, `${w.key}-${w.id}.png`), omitBackground: true });
      total++;
    }
    console.log(`rendered ${cards.length} ${groupName} cards`);
  }
  await page.close();
  console.log(`rendered ${total} total v7.0 encounter cards`);
}

// ---------------------------------------------------------------------------
// 3. Hex Tiles (v7.0 — via design/artist-tile-templates/renderer.html)
// ---------------------------------------------------------------------------
async function renderHexTiles(browser) {
  const data = loadTs("src/data/tiles.ts");
  const { compactRulesText } = loadTs("src/data/compactText.ts");
  for (const t of [...data.coreTiles, ...data.specialTiles, ...data.goldenTiles]) {
    for (const d of [t, t.basic, t.upgraded]) {
      if (d?.effectText) d.effectText = compactRulesText(d.effectText);
    }
  }

  const samples = [];
  for (const t of data.coreTiles) {
    for (const face of ["basic", "upgraded"]) {
      samples.push({ id: `${t.id}-${face}`, kind: "core", face, t, name: t[face].name });
    }
  }
  for (const t of data.specialTiles) {
    samples.push({ id: t.id, kind: "special", t, name: t.name });
  }
  for (const t of data.goldenTiles) {
    samples.push({ id: t.id, kind: "golden", t, name: t.name });
  }
  for (const face of ["basic", "upgraded"]) {
    samples.push({ id: `travel-extension-${face}`, kind: "extension", face, name: `Travel Extension - ${face}` });
  }
  samples.push({ id: "golden-back", kind: "golden-back", name: "Golden back" });
  let num = 0;
  for (const t of data.specialTiles) {
    for (let copy = 1; copy <= t.count; copy++) {
      num++;
      samples.push({ id: `special-back-${num}`, kind: "back", number: num, name: `Special back ${num}` });
    }
  }

  const templateDir = path.join(root, "design/artist-tile-templates");
  const rawTilesDir = path.join(rawDir, "tiles");
  fs.mkdirSync(rawTilesDir, { recursive: true });

  const server = http.createServer((req, res) => {
    try {
      const reqPath = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "");
      const filePath = path.join(templateDir, reqPath);
      const ct = filePath.endsWith(".html")
        ? "text/html"
        : filePath.endsWith(".png")
          ? "image/png"
          : filePath.endsWith(".woff2")
            ? "font/woff2"
            : "application/octet-stream";
      res.setHeader("Content-Type", ct);
      res.end(fs.readFileSync(filePath));
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));

  const page = await browser.newPage({ viewport: { width: 1560, height: 1370 }, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:${server.address().port}/renderer.html`, { waitUntil: "load" });
  await page.evaluate(() => window.ready);

  for (const s of samples) {
    await page.evaluate((sample) => window.renderTile(sample), s);
    const dataUrl = await page.evaluate(() => document.querySelector("canvas").toDataURL("image/png"));
    fs.writeFileSync(path.join(rawTilesDir, `${s.id}.png`), Buffer.from(dataUrl.split(",")[1], "base64"));
  }
  await page.close();
  server.close();
  console.log(`rendered ${samples.length} v7.0 hex tile faces/backs`);

  execFileSync(PYTHON_BIN, [path.join(here, "export-boards.py"), "--mode", "tiles", "--raw", rawTilesDir, "--out", path.join(outDir, "tiles")], {
    stdio: "inherit"
  });
}

// ---------------------------------------------------------------------------
// 4. Steward Reference Mats (6 Stewards + shared back)
// ---------------------------------------------------------------------------
async function renderStewardMats(browser) {
  const { stewards } = loadTs("src/data/stewards.ts");
  const fontsDir = path.join(root, "src/assets/fonts");
  const font = (f) => dataUri(path.join(fontsDir, f), "font/woff2");
  const treeLogo = dataUri(path.join(root, "src/assets/quiet_vale_tree_brass_transparent.png"), "image/png");

  const accentById = {
    vanguard: { color: "#4e7a52", terrain: "Woodland", role: "Scout & Roadbuilder" },
    knight: { color: "#a45e3d", terrain: "Arable Land", role: "Protector of Hearths" },
    sentinel: { color: "#5e6f7e", terrain: "Mountains", role: "Master Mason" },
    ranger: { color: "#76548a", terrain: "Heaths", role: "Wilderness Pathfinder" },
    warden: { color: "#8c3d48", terrain: "Ruins", role: "Keeper of the Old Stones" },
    quartermaster: { color: "#9c7c32", terrain: "Any Non-Grassland/Water", role: "Steward of Stores" }
  };

  const stewardsOut = path.join(outDir, "stewards");
  fs.mkdirSync(stewardsOut, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 1 });

  for (const s of stewards) {
    const meta = accentById[s.id];
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
      @font-face { font-family: Almendra; font-weight: 400; src: url(${font("almendra-latin-regular.woff2")}); }
      @font-face { font-family: Almendra; font-weight: 700; src: url(${font("almendra-latin-bold.woff2")}); }
      @font-face { font-family: Alegreya; font-weight: 400 700; src: url(${font("alegreya-latin-variable.woff2")}); }
      @font-face { font-family: Alegreya; font-style: italic; src: url(${font("alegreya-latin-italic.woff2")}); }
      @font-face { font-family: "Alegreya Sans"; font-weight: 500; src: url(${font("alegreya-sans-latin-medium.woff2")}); }
      @font-face { font-family: "Alegreya Sans"; font-weight: 700; src: url(${font("alegreya-sans-latin-bold.woff2")}); }
      * { box-sizing: border-box; }
      html, body { margin: 0; width: 960px; height: 640px; overflow: hidden; }
      body {
        background: radial-gradient(ellipse at 50% 35%, #f7f0df 0%, #eadec2 72%, #d8c6a0 100%);
        color: #26221c; font-family: Alegreya, serif; padding: 26px;
        border: 10px solid #2b2620; position: relative;
      }
      .frame {
        width: 100%; height: 100%; border: 3px solid ${meta.color}; border-radius: 10px;
        padding: 20px 28px 18px; display: flex; flex-direction: column; justify-content: space-between;
        background: rgba(255,252,244,0.42);
      }
      header { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 2px solid rgba(43,38,32,0.25); padding-bottom: 10px; }
      .title-wrap { display: flex; align-items: baseline; gap: 14px; }
      h1 { margin: 0; font: 700 48px/1 Almendra, serif; color: #241f18; }
      .role { font: italic 400 22px/1 Alegreya, serif; color: #5b5244; }
      .badge { font: 700 18px/1 "Alegreya Sans", sans-serif; letter-spacing: 0.08em; text-transform: uppercase;
        background: ${meta.color}; color: #faf6eb; padding: 8px 14px; border-radius: 6px; }
      .grid { display: grid; grid-template-columns: 1.25fr 1fr; gap: 22px; margin: 14px 0; flex: 1; }
      .panel { background: rgba(255,250,238,0.65); border: 1.5px solid rgba(43,38,32,0.2); border-radius: 8px; padding: 14px 18px; display: flex; flex-direction: column; gap: 8px; }
      .kicker { font: 700 16px/1 "Alegreya Sans", sans-serif; letter-spacing: 0.12em; text-transform: uppercase; color: ${meta.color}; }
      .copy { font: 400 23px/1.32 Alegreya, serif; color: #26221c; margin: 0; }
      .vp { font: 700 26px/1 Almendra, serif; color: #8c651c; margin-top: auto; }
      footer {
        display: flex; justify-content: space-between; align-items: center;
        border-top: 2px solid rgba(43,38,32,0.22); padding-top: 10px;
        font: 500 16px/1.2 "Alegreya Sans", sans-serif; color: #463e32;
      }
      .ref b { color: #241f18; }
    </style></head><body>
      <div class="frame">
        <header>
          <div class="title-wrap"><h1>${esc(s.name)}</h1><span class="role">${esc(meta.role)}</span></div>
          <div class="badge">Start: ${esc(meta.terrain)}</div>
        </header>
        <div class="grid">
          <section class="panel">
            <div class="kicker">Once Per Season Power</div>
            <p class="copy">${esc(s.powerText)}</p>
          </section>
          <section class="panel">
            <div class="kicker">Steward Objective</div>
            <p class="copy">${esc(s.objectiveText)}</p>
            <div class="vp">+${s.objectiveRenown} Renown at Final Scoring</div>
          </section>
        </div>
        <footer>
          <div class="ref"><b>Actions / Turn:</b> 1P: 4 &middot; 2P: 4 &middot; 3P: 3 &middot; 4P: 3 &middot; 5P: 2</div>
          <div class="ref"><b>Unlocked Special Tiles:</b> 0 Actions to place &middot; <b>Warehouse Cap:</b> 15</div>
        </footer>
      </div>
    </body></html>`;
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(stewardsOut, `steward-${s.id}.jpg`), type: "jpeg", quality: 86 });
  }

  // Shared Steward mat back
  const backHtml = `<!doctype html><html><head><meta charset="utf-8"><style>
    @font-face { font-family: Almendra; font-weight: 700; src: url(${font("almendra-latin-bold.woff2")}); }
    @font-face { font-family: "Alegreya Sans"; font-weight: 500; src: url(${font("alegreya-sans-latin-medium.woff2")}); }
    html, body { margin: 0; width: 960px; height: 640px; overflow: hidden; }
    body { background: radial-gradient(circle at center, #2d2925 0%, #181614 100%); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px; border: 10px solid #a98643; box-sizing: border-box; }
    img { width: 220px; height: auto; opacity: 0.92; }
    h1 { margin: 0; font: 700 48px/1 Almendra, serif; color: #d8b56a; letter-spacing: 0.06em; }
    p { margin: 0; font: 500 20px/1 "Alegreya Sans", sans-serif; color: #b8a786; letter-spacing: 0.2em; text-transform: uppercase; }
  </style></head><body>
    <img src="${treeLogo}" alt="">
    <h1>The Quiet Vale</h1>
    <p>Steward of the Settlement</p>
  </body></html>`;
  await page.setContent(backHtml, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(stewardsOut, "steward-back.jpg"), type: "jpeg", quality: 86 });
  await page.close();
  console.log(`rendered ${stewards.length} steward mats + back`);
}

// ---------------------------------------------------------------------------
// Main orchestration
// ---------------------------------------------------------------------------
async function main() {
  if (wantStep("boards")) {
    execFileSync(PYTHON_BIN, [path.join(here, "export-boards.py"), "--mode", "boards", "--out", path.join(outDir, "boards")], {
      stdio: "inherit"
    });
  }
  if (wantStep("tokens")) {
    execFileSync(PYTHON_BIN, [path.join(here, "export-boards.py"), "--mode", "tokens", "--out", path.join(outDir, "tokens")], {
      stdio: "inherit"
    });
  }

  const needsBrowser = wantStep("target") || wantStep("encounters") || wantStep("tiles") || wantStep("stewards");
  if (needsBrowser) {
    const browser = await chromium.launch({ headless: true, executablePath: CHROME_BIN, args: ["--disable-gpu"] });
    try {
      if (wantStep("target")) await renderTargetCards(browser);
      if (wantStep("encounters")) await renderEncounterCards(browser);
      if (wantStep("tiles")) await renderHexTiles(browser);
      if (wantStep("stewards")) await renderStewardMats(browser);
    } finally {
      await browser.close();
    }
  }

  if (wantStep("sheets")) {
    execFileSync(PYTHON_BIN, [path.join(here, "export-boards.py"), "--mode", "pack-sheets", "--work", rawDir, "--out", outDir], {
      stdio: "inherit"
    });
  }

  console.log("TTS asset rendering complete -> public/tts/");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
