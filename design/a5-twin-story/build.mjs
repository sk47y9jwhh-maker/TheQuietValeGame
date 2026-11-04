// The Quiet Vale: A5 two-sided sheet. Side 1, the Twin Settlements game mode
// (from the v6.4 Twin Settlements appendix, brought up to the current rules).
// Side 2, "What the Ledger Remembers", a short story built from the original,
// longer Arrival texts.
//   node design/a5-twin-story/build.mjs <out-dir>
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const require = createRequire(path.join(root, "package.json"));
const { chromium } = require("playwright");
const outDir = path.resolve(process.argv[2] || path.join(root, "output/a5-twin-story"));
fs.mkdirSync(outDir, { recursive: true });
const url = (p) => pathToFileURL(path.join(root, p)).href;
const F = (f) => url(`src/assets/fonts/${f}`);
const A = (f) => url(`design/a5-twin-story/assets/${f}`);
const lab = JSON.parse(fs.readFileSync(path.join(here, "assets/twin-map.json"), "utf8"));

const css = `
@font-face { font-family: Almendra; font-weight: 700; src: url(${F("almendra-latin-bold.woff2")}); }
@font-face { font-family: Alegreya; font-weight: 400 800; src: url(${F("alegreya-latin-variable.woff2")}); }
@font-face { font-family: Alegreya; font-style: italic; src: url(${F("alegreya-latin-italic.woff2")}); }
@font-face { font-family: Sans; font-weight: 700; src: url(${F("alegreya-sans-latin-bold.woff2")}); }
@font-face { font-family: Sans; font-weight: 500; src: url(${F("alegreya-sans-latin-medium.woff2")}); }
@page { size: 154.35mm 216.35mm; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; }
body { font-family: Alegreya, serif; color: #2b2620; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-variant-numeric: lining-nums; }
.page { width: 154.35mm; height: 216.35mm; position: relative; overflow: hidden; page-break-after: always; background: url(${url("design/rulebook-v6_9/assets/parchment.jpg")}) center / cover; }
.inner { position: absolute; left: 12.2mm; right: 12.2mm; top: 11.6mm; bottom: 11.6mm; display: flex; flex-direction: column; gap: 2.2mm; }
.eyebrow { font: 700 6.6pt/1 Sans, sans-serif; letter-spacing: 0.14em; text-transform: uppercase; color: #8a6a1e; }
h1 { margin: 0.8mm 0 0; font: 700 19pt/1.05 Almendra, serif; }
header { border-bottom: 0.3mm solid rgba(138,106,30,0.6); padding-bottom: 1.8mm; }
.lead { font-size: 8.9pt; line-height: 1.3; margin: 1.2mm 0 0; }
h3 { margin: 0; font: 700 10.2pt/1.1 Almendra, serif; color: #6f5418; }
p { margin: 0; }
.cols { display: grid; grid-template-columns: 1fr 1fr; gap: 4.4mm; }
.cols > div { display: flex; flex-direction: column; gap: 1.6mm; }
ul { margin: 0; padding-left: 3.6mm; font-size: 7.7pt; line-height: 1.25; }
li { margin-bottom: 0.5mm; }
.small { font-size: 7.4pt; line-height: 1.25; color: #4a4033; }
.mapgrid { display: grid; grid-template-columns: 70mm 1fr; gap: 4mm; align-items: center; flex: none; }
.maptext { display: flex; flex-direction: column; gap: 1.6mm; font-size: 8.2pt; line-height: 1.3; }
.map { position: relative; border-radius: 1.2mm; overflow: hidden; box-shadow: 0 0.3mm 1mm rgba(40,30,15,0.35); }
.map img { display: block; width: 100%; }
.tag { position: absolute; transform: translate(-50%, -50%); font: 700 7.6pt/1 Almendra, serif; color: #f8eed2; background: rgba(43,38,32,0.82); border: 0.3mm solid #c9a457; padding: 1.1mm 2.2mm; border-radius: 1mm; white-space: nowrap; }
.note { border-radius: 1.4mm; padding: 1.8mm 2.4mm; background: rgba(138,106,30,0.09); font-size: 7.8pt; line-height: 1.27; }
.note b.k { font: 700 6.4pt/1 Sans, sans-serif; letter-spacing: 0.12em; text-transform: uppercase; color: #8a6a1e; margin-right: 1mm; }
.split { display: grid; grid-template-columns: 1fr 1fr; gap: 1.6mm; }
.split div { border-radius: 1.2mm; padding: 1.6mm 2mm; font-size: 7.6pt; line-height: 1.24; }
.split div:first-child { background: rgba(64,120,160,0.12); }
.split div:last-child { background: rgba(176,120,50,0.13); }
.split b { display: block; font: 700 8.8pt/1.1 Almendra, serif; margin-bottom: 0.4mm; }

/* Story */
.story .inner { left: 14mm; right: 14mm; top: 13mm; bottom: 12mm; gap: 0; }
.story header { text-align: center; border: 0; padding: 0; }
.story h1 { font-size: 22pt; }
.story .sub { font-style: italic; font-size: 9pt; color: #5a4c38; margin-top: 1.2mm; }
.rule { height: 3mm; margin: 2mm auto 2.6mm; width: 40mm; background: radial-gradient(circle, #a78343 0.55mm, transparent 0.7mm) center / 3mm 3mm no-repeat, linear-gradient(#a78343, #a78343) center / 100% 0.25mm no-repeat; }
.text { columns: 2; column-gap: 7mm; column-fill: balance; font-size: 8.7pt; line-height: 1.38; text-align: left; hyphens: manual; }
.text p { margin: 0 0 1.5mm; text-indent: 3.2mm; }
.text p.first { text-indent: 0; }
.text h3 { font-size: 9.2pt; letter-spacing: 0.02em; margin: 2.2mm 0 1.2mm; break-after: avoid; text-align: left; }
.text h3 span { font: 700 6.4pt/1 Sans, sans-serif; letter-spacing: 0.14em; text-transform: uppercase; color: #8a6a1e; display: block; margin-bottom: 0.6mm; }
.intro { font-style: italic; font-size: 8.8pt; line-height: 1.36; text-align: center; color: #3d3427; margin: 0 5mm 2mm; }
.tree { position: absolute; left: 50%; bottom: 13mm; width: 26mm; transform: translateX(-50%); opacity: 0.14; }
.end { text-align: center; margin-top: auto; font: 700 9pt/1 Almendra, serif; color: #8a6a1e; }
`;

const twin = `
<div class="page"><div class="inner">
  <header>
    <div class="eyebrow">Alternative game mode</div>
    <h1>Twin Settlements</h1>
    <p class="lead">Two Vales grow on opposite banks of the river. Each team builds its own settlement with its own Warehouse, Tiles and Encounters, and the whole table shares one result. For 2 to 4 players; one player can also run both Vales.</p>
  </header>
  <div class="mapgrid">
    <div class="map"><img src="${A("twin-map.jpg")}" alt=""><span class="tag" style="left:${lab.B5[0] * 100}%;top:${lab.B5[1] * 100}%">West</span><span class="tag" style="left:${lab.J3[0] * 100}%;top:${lab.J3[1] * 100}%">East</span></div>
    <div class="maptext">
      <p><b>The West Vale</b> is the land west of the river&rsquo;s western channel, shaded blue.</p>
      <p><b>The East Vale</b> is all the other land, shaded gold, including both Ruins.</p>
      <p class="small">A team may cross the river to build, but its Tiles always belong to its own Vale.</p>
    </div>
  </div>
  <div class="cols">
    <div>
      <h3>Setup</h3>
      <ul>
        <li><b>Teams.</b> Split into two teams: 1 and 1, 2 and 2, or 1 and 2. In 1 and 2, the solo player chooses a Vale.</li>
        <li><b>Stewards.</b> Choose different Stewards as normal, but leave out the Warden. A Quartermaster may not start on Ruins.</li>
        <li><b>Meeples.</b> Each player puts their meeple on an empty hex of their Starting Terrain in their own Vale. Their first Action places a Tile there, as normal.</li>
        <li><b>Tiles.</b> Split every stack of Core Tiles in half, one half for each Vale.</li>
        <li><b>Warehouses.</b> Each Vale has its own: 15 of each resource for a one-player team, 10 of each for a two-player team.</li>
        <li><b>Encounters.</b> Build one Encounter deck and hand set for each team, using the normal setup for that team&rsquo;s size.</li>
        <li><b>Leave out</b> the Docks, the Stables, the two Arrivals that unlock them, Golden content and the Quest Card. Replace each of those Arrivals with another unused Arrival.</li>
      </ul>
    </div>
    <div>
      <h3>Play</h3>
      <ul>
        <li>Play 12 rounds as normal. Each round, both Vales reveal their own Encounters, then every player takes one turn of up to 4 Actions, in an order the whole table chooses.</li>
        <li>Teammates share everything in their Vale: the Warehouse, the Tile supply, the network, unlocked Special Tiles, Encounters, Strain and Supported.</li>
        <li>Turns, Actions, meeples, Steward Powers and Objectives stay individual.</li>
        <li>A team may only use, upgrade, activate or count its own Tiles, resources and Encounters.</li>
        <li>A team&rsquo;s first Tiles need not touch; once joined, they are one network.</li>
        <li>Read &ldquo;each player&rdquo; on a card as &ldquo;each team&rdquo;, resolved once.</li>
        <li>Both teams draw from the one Target deck. Only the drawing team&rsquo;s Tiles are ever eligible.</li>
      </ul>
      <div class="note"><b class="k">Never join the Vales</b> No Tile may be placed where it would connect the West Vale network to the East Vale network.</div>
    </div>
  </div>
  <h3>Scoring</h3>
  <div class="split">
    <div><b>Score each Vale</b>Use the normal final scoring with only that team&rsquo;s Tiles, Steward Objectives, active Burdens, failed Arrivals and Strain.</div>
    <div><b>One result</b>Record both scores together as the table&rsquo;s result. Nobody wins alone; the aim is two strong Vales.</div>
  </div>
</div></div>`;

const story = `
<div class="page story"><div class="inner">
  <header>
    <div class="eyebrow">A story of the Vale</div>
    <h1>What the Ledger Remembers</h1>
    <div class="sub">from the margins of the first Steward&rsquo;s ledger</div>
  </header>
  <div class="rule"></div>
  <p class="intro">Most of the ledger is figures: timber counted, grain measured, debts owed and paid. In the margins, though, are the people who came.</p>
  <div class="text">
    <h3><span>Season I</span>Foundations</h3>
    <p class="first">The riders came first, slowly, their cloaks heavy with rain. Their banners were long gone and their rations thin, but the horses were immaculate: brushed, well fed and spoken to with a tenderness the old age seldom showed anyone. They did not ask for barracks, or for glory. They asked for pasture, fresh water and somewhere both rider and horse could finally rest. I wrote: <i>find them a field.</i></p>
    <p>A week later a river boat came to the bank, patched with timber salvaged from old jetties and ruined warships. The crew said little about where they had been, only that safe harbours had become rare. Before their cargo was even unloaded, they were walking the riverbank and talking about trade.</p>
    <p>Then came a wagonload of labourers: strong backs, calloused hands and a need to be useful. They asked for plain meals, a dry roof and work that would build rather than break. Within days, foundations were being cleared twice as fast as before.</p>
    <h3><span>Season II</span>Growth</h3>
    <p class="first">That summer, old armour came in by the cartload. Helmets became lantern casings and swords became ploughs. The veterans who oversaw the work said little. The dents in the metal said enough.</p>
    <p>The woodcutter arrived carrying an axe big enough to split a shield and the soldier behind it. These days it fells only deadwood. She has one arm and a laugh you can hear across the river, and the children follow her everywhere. Forests grow back, she says. Kingdoms rarely do.</p>
    <p>The Beastmaster&rsquo;s name reached us long before he did. The feared commander who finally arrived now spends his evenings tending lame oxen and brushing tired draught horses, and he speaks to them more gently than his reputation ever suggested.</p>
    <p>A brewer came with great casks strapped to his wagons. A settlement, he told me, needs roofs and bread, but it also needs evenings when people sing together and, for a while, forget the war. That evening, the whole yard broke into song.</p>
    <h3><span>Season III</span>Maturity</h3>
    <p class="first">Some arrivals asked for nothing that could be counted. Actors in painted wagons wanted only a square where they could speak the names of the fallen without glorifying the wars that took them. The dryads asked for nothing at all, yet wherever they walked the wildlands grew calmer. Children planted acorns beside elders who still remembered the groves that burned. The elders knew they would never sit in that shade. They planted anyway, so that the children would.</p>
    <p>When I read the ledger back now, it is the margins I return to. Nobody planned the Vale as a whole. It was built by people who arrived carrying what was left of the old world, and chose to put it to gentler work.</p>
  </div>
  <div class="end">&#10022;</div>
</div></div>`;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${twin}${story}</body></html>`;
const htmlPath = path.join(outDir, "_a5.html");
fs.writeFileSync(htmlPath, html);
const browser = await chromium.launch();
const tab = await browser.newPage();
await tab.goto(pathToFileURL(htmlPath).href, { waitUntil: "load" });
await tab.evaluate(() => document.fonts.ready);
const report = await tab.evaluate(() => [...document.querySelectorAll(".page")].map((pg, i) => {
  const inner = pg.querySelector(".inner").getBoundingClientRect();
  const kids = [...pg.querySelectorAll(".inner *")].filter((e) => e.getBoundingClientRect().height > 0);
  const bottom = Math.max(...kids.map((e) => e.getBoundingClientRect().bottom));
  const text = pg.querySelector(".text");
  const colOverflow = text ? text.scrollWidth > text.clientWidth + 1 : false;
  return { page: i + 1, slackMm: Math.round((inner.bottom - bottom) / 3.78), colOverflow };
}));
const pdf = path.join(outDir, "The_Quiet_Vale_A5_Twin_Settlements_and_Story.pdf");
await tab.pdf({ path: pdf, width: "154.35mm", height: "216.35mm", printBackground: true, preferCSSPageSize: true });
await browser.close();
if (!process.env.KEEP_HTML) fs.unlinkSync(htmlPath);
const { execFileSync } = await import("node:child_process");
execFileSync("python3", ["-c", `
import sys, pikepdf
b = 3.175 * 72 / 25.4
p = pikepdf.open(sys.argv[1], allow_overwriting_input=True)
for pg in p.pages:
    x0, y0, x1, y1 = [float(v) for v in pg.MediaBox]
    pg.BleedBox = [x0, y0, x1, y1]
    pg.TrimBox = [x0 + b, y0 + b, x1 - b, y1 - b]
p.docinfo["/Title"] = "The Quiet Vale - Twin Settlements and What the Ledger Remembers"
p.save(sys.argv[1])
`, pdf]);
console.log(JSON.stringify(report));
