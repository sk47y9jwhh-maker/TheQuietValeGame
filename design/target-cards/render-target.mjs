// Renders the 30 Target Card fronts (poker 69 x 94 mm with bleed, 600 dpi),
// in the same family as the Chronicle Cards, with the silver frame.
// Usage: node render-target.mjs <background.png> <out-dir> [cardNumber...]
// The deck comes from target-cards.json (flat-top tie directions).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const here = path.dirname(fileURLToPath(import.meta.url));
const fonts = path.resolve(here, "../../src/assets/fonts");
const art = path.resolve(here, "../chronicle-cards");
const [bgArg, outArg, ...only] = process.argv.slice(2);
const uri = (file, type) => `data:${type};base64,` + fs.readFileSync(file).toString("base64");
const bg = uri(bgArg, "image/png");
const divider = uri(path.join(art, "divider-long.png"), "image/png");
const { cards } = JSON.parse(fs.readFileSync(path.join(here, "target-cards.json"), "utf8"));
if (cards.length !== 30) throw new Error(`Expected 30 Target Cards, found ${cards.length}`);
fs.mkdirSync(outArg, { recursive: true });
const font = (file) => uri(path.join(fonts, file), "font/woff2");

const ink = "#2b2f33";
const steel = "#3e5566";

// Flat-top hexes: corners at 0, 60, 120 ... degrees; neighbours at -90, -30, 30 ... degrees.
const hexPoints = (cx, cy, r) => [0, 1, 2, 3, 4, 5].map((i) => { const a = Math.PI / 3 * i; return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`; }).join(" ");
const hex = (cx, cy, r, attrs) => `<polygon points="${hexPoints(cx, cy, r)}" ${attrs}/>`;
const line = `fill="none" stroke="${ink}" stroke-width="7"`;
const glyphs = {
  core: `<svg viewBox="0 0 100 100">${hex(50, 50, 40, line)}</svg>`,
  specialOrGolden: `<svg viewBox="0 0 100 100">${hex(50, 50, 40, line)}<path d="M50 27 L56 43 L73 43 L59 53 L64 70 L50 60 L36 70 L41 53 L27 43 L44 43 Z" fill="${ink}"/></svg>`,
  basic: `<svg viewBox="0 0 100 100">${hex(50, 50, 40, line)}</svg>`,
  upgraded: `<svg viewBox="0 0 100 100">${hex(50, 50, 42, `fill="none" stroke="${ink}" stroke-width="6"`)}${hex(50, 50, 26, `fill="none" stroke="${ink}" stroke-width="6"`)}</svg>`,
  either: `<svg viewBox="0 0 100 100">${hex(50, 50, 42, `fill="none" stroke="${ink}" stroke-width="6"`)}${hex(50, 50, 26, `fill="none" stroke="${ink}" stroke-width="5" stroke-dasharray="8 7"`)}</svg>`,
  ring: (filled) => `<svg viewBox="0 0 120 120">${hex(60, 60, 16, `fill="none" stroke="${ink}" stroke-width="5"`)}${[0, 1, 2, 3, 4, 5].map((i) => { const a = -Math.PI / 2 + Math.PI / 3 * i; return hex(60 + 31 * Math.cos(a), 60 + 31 * Math.sin(a), 15, i < filled ? `fill="${ink}"` : `fill="none" stroke="${ink}" stroke-width="3" stroke-opacity="0.45"`); }).join("")}</svg>`,
  strained: `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="34" fill="#1d1d1f"/><ellipse cx="40" cy="38" rx="12" ry="7" fill="#fff" fill-opacity="0.28"/></svg>`,
  unstrained: `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="32" fill="none" stroke="${ink}" stroke-width="5" stroke-dasharray="9 8"/></svg>`
};
const values = {
  tileClass: { core: ["Core", glyphs.core], specialOrGolden: ["Special or Golden", glyphs.specialOrGolden], any: ["Any", ""] },
  side: { basic: ["Basic", glyphs.basic], upgraded: ["Upgraded", glyphs.upgraded], either: ["Either", glyphs.either], any: ["Any", ""] },
  adjacency: { threePlus: ["3+ neighbours", glyphs.ring(3)], zeroToTwo: ["0–2 neighbours", glyphs.ring(2)], any: ["Any", ""] },
  strain: { strained: ["Already strained", glyphs.strained], unstrained: ["Unstrained", glyphs.unstrained], any: ["Any", ""] }
};
const names = { N: "north", NE: "north-east", SE: "south-east", S: "south", SW: "south-west", NW: "north-west" };
const bearing = { N: -90, NE: -30, SE: 30, S: 90, SW: 150, NW: 210 };

// A flat-top hex with an arm out of each edge, the card's direction picked out.
function compass(direction) {
  const arm = (d) => {
    const on = d === direction;
    return `<g transform="rotate(${bearing[d]} 120 120)">
      <line x1="150" y1="120" x2="${on ? 196 : 206}" y2="120" stroke="${on ? steel : ink}" stroke-width="${on ? 14 : 5}" stroke-linecap="round" stroke-opacity="${on ? 1 : 0.4}"/>
      ${on ? `<path d="M232 120 L196 99 L196 141 Z" fill="${steel}"/>` : ""}
    </g>`;
  };
  return `<svg viewBox="0 0 240 240" class="compass">${hex(120, 120, 34, `fill="rgba(62,85,102,0.12)" stroke="${ink}" stroke-width="6"`)}${Object.keys(bearing).map(arm).join("")}</svg>`;
}

function row(label, [value, glyph]) {
  return `<section class="row"><div class="label">${label}</div><div class="value">${glyph ? `<span class="glyph">${glyph}</span>` : ""}<span>${value}</span></div></section>`;
}

function page(card) {
  const open = !card.direction;
  const outcome = open
    ? `<section class="outcome"><div class="label">Open target</div><div class="big">Choose any eligible tile</div><div class="small">Keep to any limits set by the effect.</div></section>`
    : `<section class="outcome"><div class="label">If still tied</div><div class="tie">${compass(card.direction)}<div class="tie-words"><div class="big">Furthest ${names[card.direction]}</div><div class="small">across the whole map</div></div></div></section>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @font-face { font-family: Almendra; font-weight: 400; src: url(${font("almendra-latin-regular.woff2")}); }
  @font-face { font-family: Almendra; font-weight: 700; src: url(${font("almendra-latin-bold.woff2")}); }
  @font-face { font-family: Alegreya; font-weight: 400 700; src: url(${font("alegreya-latin-variable.woff2")}); }
  @font-face { font-family: Alegreya; font-style: italic; src: url(${font("alegreya-latin-italic.woff2")}); }
  @font-face { font-family: "Alegreya Sans"; font-weight: 500; src: url(${font("alegreya-sans-latin-medium.woff2")}); }
  html, body { margin: 0; width: 1630px; height: 2220px; overflow: hidden; }
  body { position: relative; background: url(${bg}) no-repeat 0 0 / 1630px 2220px; color: ${ink}; font-family: Alegreya, serif; }
  .glow { position: absolute; left: 230px; right: 230px; border-radius: 50%; background: radial-gradient(ellipse at center, rgba(120, 136, 150, 0.32), rgba(120, 136, 150, 0) 70%); }
  .div { position: absolute; left: 191px; width: 1248px; height: 28px; background: url(${divider}) no-repeat center / 1248px 28px; }
  .type { position: absolute; top: 590px; left: 0; right: 0; text-align: center; font: 500 46px/1 "Alegreya Sans", sans-serif; letter-spacing: 0.16em; text-transform: uppercase; color: #333; }
  .title { position: absolute; top: 745px; left: 260px; right: 260px; height: 135px; display: flex; align-items: center; justify-content: center;
    font: 400 104px/1 Almendra, serif; color: #26292c; text-shadow: 0 2px 0 rgba(255, 252, 240, 0.8), 0 -1px 0 rgba(30, 35, 40, 0.3); }
  .rows { position: absolute; top: 948px; left: 250px; right: 250px; height: 690px; display: grid; grid-template-rows: repeat(4, 1fr); }
  .row { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; border-bottom: 2px solid rgba(43, 47, 51, 0.22); }
  .row:last-child { border-bottom: 0; }
  .label { font: 400 50px/1 Almendra, serif; color: #44494e; }
  .value { display: flex; align-items: center; gap: 26px; font: 700 76px/1 Alegreya, serif; color: #1f2226; }
  .glyph svg { width: 80px; height: 80px; display: block; }
  .outcome { position: absolute; top: 1696px; left: 230px; right: 230px; height: 310px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; }
  .tie { display: flex; align-items: center; gap: 30px; }
  .compass { width: 236px; height: 236px; }
  .big { font: 700 72px/1.05 Alegreya, serif; color: ${steel}; text-align: center; }
  .small { font: italic 400 46px/1.1 Alegreya, serif; color: #44494e; text-align: center; }
  .tie-words .big, .tie-words .small { text-align: left; }
  .foot { position: absolute; top: 2012px; left: 0; right: 0; text-align: center; font: italic 400 46px/1 Alegreya, serif; color: #44494e; }
  </style></head><body>
  <div class="glow" style="top:760px;height:110px"></div>
  <div class="div" style="top:663px"></div>
  <div class="div" style="top:905px"></div>
  <div class="div" style="top:1648px"></div>
  <div class="type">Target</div>
  <div class="title">Card ${String(card.id).padStart(2, "0")}</div>
  <div class="rows">
    ${row("Tile class", values.tileClass[card.tileClass])}
    ${row("Tile side", values.side[card.side])}
    ${row("Adjacency", values.adjacency[card.adjacency])}
    ${row("Current Strain", values.strain[card.strain])}
  </div>
  ${outcome}
  <div class="foot">Work down the rows. Skip any row no tile matches.</div>
  </body></html>`;
}

const browser = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox", "--font-render-hinting=none"] });
const tab = await browser.newPage();
await tab.setViewport({ width: 1630, height: 2220, deviceScaleFactor: 1 });
const report = [];
for (const card of cards) {
  if (only.length && !only.includes(String(card.id))) continue;
  await tab.setContent(page(card), { waitUntil: "load" });
  await tab.evaluate(() => document.fonts.ready);
  const overflow = await tab.evaluate(() => [...document.querySelectorAll(".row, .outcome")].some((el) => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1));
  await tab.screenshot({ path: path.join(outArg, `target-${String(card.id).padStart(2, "0")}.png`), type: "png" });
  report.push({ id: card.id, overflow });
}
await browser.close();
console.log(JSON.stringify(report));
