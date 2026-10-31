// Renders the Chronicle Card fronts (poker 69 x 94 mm with bleed, 600 dpi).
// Usage: node render-chronicle.mjs <background.png> <out-dir> [cardNumber...]
// The background is the poker Golden Boon front (see README.md). Text is set
// in the game's own fonts; each half shrinks slightly if its text is long.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const here = path.dirname(fileURLToPath(import.meta.url));
const fonts = path.resolve(here, "../../src/assets/fonts");
const [bgArg, outArg, ...only] = process.argv.slice(2);
const bg = "data:image/png;base64," + fs.readFileSync(bgArg).toString("base64");
const data = JSON.parse(fs.readFileSync(path.resolve(here, "../../src/data/chronicleCards.json"), "utf8"));
fs.mkdirSync(outArg, { recursive: true });

const font = (file) => "data:font/woff2;base64," + fs.readFileSync(path.join(fonts, file)).toString("base64");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

function strips(half) {
  const rows = [...(half.strips ?? [])];
  if (half.keep) rows.push(half.keep);
  if (!rows.length) return "";
  const head = `<tr class="players"><th>Players</th>${[1, 2, 3, 4, 5].map((p) => `<td>${p}</td>`).join("")}</tr>`;
  const body = rows.map(([label, values]) => `<tr class="${label.startsWith("Keep it") ? "keep" : ""}"><th>${esc(label)}</th>${values.map((v) => `<td>${esc(v)}</td>`).join("")}</tr>`).join("");
  return `<table class="strip">${head}${body}</table>`;
}

function half(h, pips, cls) {
  return `<section class="half ${cls}">
    <div class="label"><span class="pips">${"&#9679;".repeat(pips)}</span>${esc(h.kind)}<span class="gem">&#9670;</span>${esc(h.check)}</div>
    <div class="fit">
      <h2>${esc(h.name)}</h2>
      <p>${esc(h.text)}</p>
      ${strips(h)}
    </div>
  </section>`;
}

function page(card) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @font-face { font-family: Almendra; font-weight: 400; src: url(${font("almendra-latin-regular.woff2")}); }
  @font-face { font-family: Almendra; font-weight: 700; src: url(${font("almendra-latin-bold.woff2")}); }
  @font-face { font-family: Alegreya; font-weight: 400 700; src: url(${font("alegreya-latin-variable.woff2")}); }
  @font-face { font-family: Alegreya; font-style: italic; src: url(${font("alegreya-latin-italic.woff2")}); }
  @font-face { font-family: "Alegreya Sans"; font-weight: 500; src: url(${font("alegreya-sans-latin-medium.woff2")}); }
  @font-face { font-family: "Alegreya Sans"; font-weight: 700; src: url(${font("alegreya-sans-latin-bold.woff2")}); }
  html, body { margin: 0; width: 1630px; height: 2220px; overflow: hidden; }
  body { position: relative; background: url(${bg}) no-repeat 0 0 / 1630px 2220px; color: #2f2a22; font-family: Alegreya, serif; }
  .type { position: absolute; top: 590px; left: 0; right: 0; text-align: center; font: 500 46px/1 "Alegreya Sans", sans-serif; letter-spacing: 0.16em; text-transform: uppercase; color: #3a332a; }
  .title { position: absolute; top: 745px; left: 260px; right: 260px; height: 135px; display: flex; align-items: center; justify-content: center; text-align: center;
    font: 400 104px/1 Almendra, serif; color: #2e2a24; text-shadow: 0 2px 0 rgba(255, 248, 226, 0.75), 0 -1px 0 rgba(60, 45, 20, 0.35); }
  .half { position: absolute; left: 255px; right: 255px; display: flex; flex-direction: column; align-items: center; }
  .top { top: 945px; height: 490px; }
  .bottom { top: 1462px; height: 540px; }
  .label { height: 78px; display: flex; align-items: center; gap: 18px; font: 400 52px/1 Almendra, serif; color: #3a2f1d; }
  .label .gem { font-size: 26px; color: #8a6a1e; }
  .label .pips { font-size: 22px; letter-spacing: 6px; color: #8a6a1e; margin-right: 8px; }
  .fit { flex: 1; width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: 14px; padding-top: 10px; transform-origin: top center; }
  h2 { margin: 0; font: 700 72px/1.05 Almendra, serif; text-align: center; color: #2b2620; }
  p { margin: 0; font: 400 60px/1.18 Alegreya, serif; text-align: center; text-wrap: balance; max-width: 1080px; }
  .strip { border-collapse: collapse; margin-top: 6px; font-family: "Alegreya Sans", sans-serif; }
  .strip th { font: 500 48px/1.1 "Alegreya Sans", sans-serif; text-align: right; padding: 4px 22px 4px 0; color: #4a3f2e; max-width: 470px; }
  .strip td { width: 100px; text-align: center; font: 700 56px/1.1 "Alegreya Sans", sans-serif; color: #2b2620; border-left: 2px solid rgba(138, 106, 30, 0.45); }
  .strip tr.players td, .strip tr.players th { font: 500 44px/1 "Alegreya Sans", sans-serif; color: #7a6a4c; padding-bottom: 6px; }
  .strip tr.keep th { font-style: normal; color: #6b3d2a; }
  .strip tr.keep td { color: #6b3d2a; }
  .foot { position: absolute; top: 2010px; left: 0; right: 0; text-align: center; font: italic 400 46px/1 Alegreya, serif; color: #4a3f2e; }
  </style></head><body>
  <div class="type">Chronicle</div>
  <div class="title">${esc(card.theme)}</div>
  ${half(card.top, 1, "top")}
  ${half(card.bottom, 2, "bottom")}
  <div class="foot">No. ${card.n}. Complete either half for +20 Renown.</div>
  </body></html>`;
}

const browser = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox", "--font-render-hinting=none"] });
const tab = await browser.newPage();
await tab.setViewport({ width: 1630, height: 2220, deviceScaleFactor: 1 });
const report = [];
for (const card of data.cards) {
  if (only.length && !only.includes(String(card.n))) continue;
  await tab.setContent(page(card), { waitUntil: "load" });
  await tab.evaluate(() => document.fonts.ready);
  const fit = await tab.evaluate(() => [...document.querySelectorAll(".half")].map((half) => {
    const box = half.querySelector(".fit");
    const room = half.clientHeight - half.querySelector(".label").offsetHeight;
    let scale = 1;
    while (box.scrollHeight * scale > room && scale > 0.7) { scale -= 0.02; box.style.transform = `scale(${scale})`; }
    return Math.round(scale * 100);
  }));
  const file = path.join(outArg, `chronicle-${String(card.n).padStart(2, "0")}.png`);
  await tab.screenshot({ path: file, type: "png" });
  report.push({ n: card.n, theme: card.theme, topScale: fit[0], bottomScale: fit[1] });
}
await browser.close();
console.log(JSON.stringify(report));
