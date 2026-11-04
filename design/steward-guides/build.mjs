// The Quiet Vale: Steward Guides (A6, 20 pages, one per Steward).
// Content comes from the game data (src/data) and the current rules; art from
// design/steward-guides/assets (make_assets.py), the artist tiles
// (public/tiles) and the card print files.
//   node design/steward-guides/build.mjs <out-dir> [stewardId...]
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const require = createRequire(path.join(root, "package.json"));
const { chromium } = require("playwright");
const ts = require("typescript");
const outDir = path.resolve(process.argv[2] || path.join(root, "output/steward-guides"));
const only = process.argv.slice(3);
fs.mkdirSync(outDir, { recursive: true });

function load(file) {
  const m = { exports: {} };
  new Function("exports", "module", "require", ts.transpileModule(fs.readFileSync(path.join(root, file), "utf8"), { compilerOptions: { module: 1, target: 9 } }).outputText)(m.exports, m, require);
  return m.exports;
}
const { coreTiles, specialTiles, goldenTiles } = load("src/data/tiles.ts");
const { stewards } = load("src/data/stewards.ts");
const { specialTileBackNumbers } = load("src/data/specialTileNumbers.ts");

const url = (p) => pathToFileURL(path.join(root, p)).href;
const A = (f) => url(`design/steward-guides/assets/${f}`);
const ICON = (f) => url(`design/artist-tile-templates/assets/${f}`);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/’/g, "&rsquo;");
const numerals = ["I", "II", "III", "IV", "V", "VI"];
// Sampled from the parchment border of each category's tile artwork.
const catColour = { resource: "#989368", housing: "#b48f65", travel: "#a8966d", merchant: "#ae9660", crafting: "#989575", social: "#a88b71", wellbeing: "#929a72" };
const catName = { resource: "Resource", housing: "Housing", travel: "Travel", merchant: "Merchant", crafting: "Crafting", social: "Social", wellbeing: "Wellbeing" };
const terrainName = { woodland: "Woodland", mountains: "Mountains", heaths: "Heaths", arable: "Arable Land", ruins: "Ruins", grasslands: "Grasslands", water: "River/Water" };
const terrainIcon = { woodland: "Woodland", mountains: "Mountains", heaths: "Heath", arable: "Arable Land", ruins: "Ruins" };
const resName = { wood: "Wood", stone: "Stone", metal: "Metal", food: "Food", herbs: "Herbs", goods: "Goods" };

function costText(side) {
  if (side.alternateCostText) return side.alternateCostText;
  const parts = Object.entries(side.cost || {}).filter(([, v]) => v > 0).map(([k, v]) => `${v} ${resName[k]}`);
  return parts.length ? parts.join(" + ") : "Free";
}
function effectText(t) {
  return t.replace(/ ?Passive: Linked Production — .*$/, " <span class=\"lp\">Linked Production.</span>");
}
function scoreText(side) {
  const s = [];
  if (side.population) s.push(`<img src="${ICON("icon-Population.png")}"> ${side.population} Population`);
  if (side.renown) s.push(`<img src="${ICON("icon-Renown.png")}"> ${side.renown} Renown`);
  return s.length ? `<div class="score">${s.join("<i>·</i>")}</div>` : "";
}
function tileBlock(t) {
  const size = t.size ?? 1;
  const foot = size === 1 ? "1 hex" : `${size} hexes in a line`;
  const place = t.placement?.text || "No placement requirement.";
  const side = (k) => `<div class="side">
      <img class="tileimg" src="${url(`public/tiles/${t.id}-${k}.webp`)}">
      <div class="sidelabel">${k === "basic" ? "Basic" : "Upgraded"}</div>
      <h4>${esc(t[k].name)}</h4>
      <div class="cost"><span>Cost</span> ${esc(costText(t[k]))}</div>
      <p>${effectText(esc(t[k].effectText))}</p>
      ${scoreText(t[k])}
    </div>`;
  return `<section class="tile" style="--cat:${catColour[t.category]}">
    <div class="th"><span class="chip">${catName[t.category]}</span><span class="meta">${foot} · ${t.count} in the box</span><span class="place">${esc(place)}</span></div>
    <div class="sides">${side("basic")}${side("upgraded")}</div>
  </section>`;
}

const page = (eyebrow, title, body, cls = "") => ({ eyebrow, title, body, cls });
const box = (label, body, cls = "") => `<section class="box ${cls}"><div class="boxlabel">${label}</div>${body}</section>`;
const list = (items, cls = "") => `<ul class="${cls}">${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;
const steps = (items) => `<ol class="steps">${items.map(([h, b], i) => `<li><span class="n">${i + 1}</span><div><b>${h}</b> ${b}</div></li>`).join("")}</ol>`;

function stewardPage(s, idx) {
  const terr = s.startingTerrains.length > 1
    ? `Any of ${s.startingTerrains.map((k) => terrainName[k]).join(", ").replace(/, ([^,]*)$/, " or $1")}. Never Grasslands or River/Water.`
    : terrainName[s.startingTerrains[0]];
  const icons = s.startingTerrains.map((k) => `<img src="${ICON(`icon-Placement ${terrainIcon[k]}.png`)}">`).join("");
  return page(`Steward ${numerals[idx]}`, s.name, `
    ${box("Power · once per Season", `<p class="lead">${esc(s.powerText)}</p>`, "gold")}
    ${box(`Objective · +${s.objectiveRenown} Renown`, `<p class="lead">${esc(s.objectiveText)}</p>`, "gold")}
    ${box("Starting terrain", `<div class="terrain${s.startingTerrains.length > 1 ? " multi" : ""}">${icons}<p>${terr}</p></div><p class="small">At setup, put your Steward meeple on an empty hex of this terrain. Two meeples cannot share a hex.</p>`)}
    <h3 class="sub">For every Steward</h3>
    <p><b>First placement.</b> On your first turn, your first Action must place any legal Tile on the hex under your meeple. It need not be a Resource Tile and need not connect to another Tile.</p>
    <p><b>Shelter in the Ruins.</b> When a Tile&rsquo;s whole footprint lies on Ruins, ignore all Stone in its placement or upgrade cost. Otherwise pay the full cost.</p>
    <p><b>Your Power</b> costs no Action and refreshes at the start of each Season.</p>`, "steward");
}

const turnPage = page("How a round works", "Your turn", `
  <div class="seasons">${[["I", "Foundations", "Rounds 1–4"], ["II", "Growth", "Rounds 5–8"], ["III", "Maturity", "Rounds 9–12"]].map(([n, t, r]) => `<div><span>${n}</span><b>${t}</b><i>${r}</i></div>`).join("")}</div>
  <h3 class="sub">Each round</h3>
  ${steps([["Reveal.", "Reveal Encounter Cards until the number of standard cards revealed equals the player count. Finish every mandatory effect."], ["Turns.", "The group chooses the order. Each player takes one turn of up to 4 Actions and may stop early."], ["End of round.", "Remove 1 timer from every active Arrival and resolve any that run out. End durations, refresh round effects and move the Round marker."]])}
  <h3 class="sub">Four Actions (repeat any)</h3>
  <div class="actions">
    <div><b>Place</b>Put an available Tile on a legal, reachable empty hex and pay its cost.</div>
    <div><b>Upgrade</b>Pay the upgraded cost and flip a reachable basic Core Tile.</div>
    <div><b>Activate</b>Use a reachable, non-Overstrained Tile&rsquo;s Activated Effect.</div>
    <div><b>Interact</b>Complete an Arrival, or resolve an active Burden.</div>
  </div>
  ${box("Your meeple", `<p>Place, Upgrade and Activate move your meeple onto the Tile you chose; reach is measured from there. Interact does not move it.</p>`)}`, "turn");

const byId = Object.fromEntries(coreTiles.map((t) => [t.id, t]));
const T = (id) => tileBlock(byId[id]);
const sym = [["Resource Wood", "Wood"], ["Resource Stone", "Stone"], ["Resource Metal", "Metal"], ["Resource Food", "Food"], ["Resource Herbs", "Herbs"], ["Resource Goods", "Goods"], ["Population", "Population"], ["Renown", "Renown"]];
const lpBox = `<div class="lpwrap">${box("Linked Production", `<p>The first time each round you activate a Resource Tile, it and every <b>immediately adjacent</b>, non-Overstrained copy from the same stack all produce, for one Action. It never continues outward through a chain. Activating any of those Tiles again that round produces only from the Tile you choose.</p>`)}
  ${box("Symbols and timing", `<div class="symbols">${sym.map(([f, n]) => `<div><img src="${ICON(`icon-${f}.png`)}"><span>${n}</span></div>`).join("")}</div>
  <p><b>Activate:</b> spend an Activate Action. <b>Passive:</b> works by itself, at the printed timing. <b>Once per round / Season:</b> refreshes when the next one starts. Two costs mean pay either one.</p>`)}</div>`;
const tilePages = [
  ["Core Tiles · Resource", "Woodland & Mountains", [T("c01_lumber_yard"), T("c02_mine_tunnel")]],
  ["Core Tiles · Resource", "Heaths & Arable Land", [T("c03_gathering_outpost"), T("c04_farmstead")]],
  ["Core Tiles · Resource", "Ruins & production", [T("c20_dig_site"), lpBox]],
  ["Core Tiles · Housing", "Cabin & Cottage", [T("c05_cabin"), T("c06_cottage")]],
  ["Core Tiles · Housing", "Stedding & Inn", [T("c07_stedding"), T("c08_inn")]],
  ["Core Tiles · Social", "Tavern & Eatery", [T("c09_tavern"), T("c10_eatery")]],
  ["Core Tiles · Wellbeing", "Washhouse & Apothecary", [T("c11_washhouse"), T("c12_apothecary")]],
  ["Core Tiles · Wellbeing & Crafting", "The Vaults & Workshops", [T("c21_the_vaults"), T("c13_workshops")]],
  ["Core Tiles · Merchant & Travel", "Market Stalls & Path", [T("c14_market_stalls"), T("c15_path")]],
  ["Core Tiles · Travel", "Common Land & Bridge", [T("c18_common_land"), T("c19_bridge")]],
  ["Core Tiles · Travel", "Street & Track", [T("c16_street"), T("c17_track")]]
].map(([e, t, blocks]) => page(e, t, blocks.join(""), "tiles"));

const targetPage = page("Choosing where Strain lands", "Target Cards", `
  <div class="tcards">
    <figure><img src="${A("card-target.jpg")}"><figcaption>Structured card</figcaption></figure>
    <div>
      <p>When an effect places Strain, it says which Tiles are <b>eligible</b>. The Target Card picks among them, so nobody has to choose.</p>
      <p class="small">Shuffle the 30-card deck once at setup. After each use, return the card face down to the bottom.</p>
    </div>
  </div>
  <h3 class="sub">Work down the rows</h3>
  <div class="trows">
    <div><b>Tile class</b>Core · Special or Golden · Any</div>
    <div><b>Tile side</b>Basic · Upgraded · Either · Any</div>
    <div><b>Adjacency</b>3+ neighbours · 0&ndash;2 neighbours · Any</div>
    <div><b>Current Strain</b>Already strained · Unstrained · Any</div>
  </div>
  <p>At each row, keep the eligible Tiles that match. <b>If none match, skip the row</b> and keep them all. <b>Any</b> changes nothing. Never bring back a Tile already ruled out.</p>
  <div class="tcards">
    <figure><img src="${A("card-target-open.jpg")}"><figcaption>Open card</figcaption></figure>
    <div>
      <p><b>If still tied</b> after the four rows, take the tied Tile the arrow points to on the map.</p>
      <p><b>Open card:</b> the players choose any eligible Tile.</p>
      <p>Draw a separate card for each Tile that needs a target.</p>
    </div>
  </div>`, "target");

const encPage = page("The Encounter deck", "Encounter Cards", `
  <div class="cards4">
    ${[["boon", "Boon", "Use the row for the current Season. The italic line says how long it stays."], ["burden", "Burden", "Apply the current row. It stays active, and reapplies with the new row each Season, until resolved."], ["arrival", "Arrival", "Enters with 3 timers. Meet its Requirements with an Interact Action to unlock its Special Tile."], ["goldenBoon", "Golden Boon", "Resolve free, then discard. It does not count toward the cards revealed each round."]].map(([k, n, d]) => `<figure><img src="${A(`enc-${k}.jpg`)}"><figcaption><b>${n}</b>${d}</figcaption></figure>`).join("")}
  </div>
  <p class="small">An Arrival whose last timer is removed fails: discard it, record a failure and place 1 Strain using a Target Card. An Arrival still active after Round 12 does not fail.</p>`, "enc");

const questPage = page("One card each game", "Quest Cards & the Ledger", `
  <div class="quest">
    <img src="${A("card-quest.jpg")}">
    <div>
      <p>At setup, draw the top Quest Card. One card is in play, whatever the player count.</p>
      <p><b>Both halves are live.</b> The top is easier, the bottom harder. Complete either half and the card scores <b>+20 Renown</b>, once.</p>
      <p>Read your target from the table for the number of players.</p>
    </div>
  </div>
  <div class="kinds"><div><b>Moment</b>Done as soon as it happens.</div><div><b>Final</b>Checked at final scoring.</div><div><b>Vow</b>A rule kept all game; its &ldquo;End with&rdquo; target is checked at the end.</div></div>
  ${box("The Steward&rsquo;s Ledger", `<p>After scoring, a completed card goes into the Ledger; a failed card goes to the bottom of the Quest deck.</p><p>Golden pairs unlock at <b>3, 6, 9, 12 and 15</b> cards in the Ledger. Each unlocks one Golden Tile and one Golden Boon for good.</p>`)}`, "questp");

const numberOf = (id) => (specialTileBackNumbers[id] || []).join(" & ");
const specialRows = specialTiles.map((t) => [numberOf(t.id), t.name]).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
const specialPage = page("Unlocking and placing", "Special & Golden Tiles", `
  <p><b>Special Tiles.</b> Completing an Arrival unlocks the Special Tile whose <b>back number</b> matches its reward. Place it later with a normal Place Action, for <b>0 resources</b>, following its printed placement rule. Stables (17 &amp; 18) places two separate hexes.</p>
  <div class="specials">${specialRows.map(([n, name]) => `<div><span>${n}</span>${esc(name)}</div>`).join("")}</div>
  <p class="small">Shrines and Respites placed on their terrain need no adjacent Resource Tile.</p>
  <h3 class="sub">Golden content (optional)</h3>
  <p>At setup, after hands are dealt, choose up to 1 unlocked Golden Tile and up to 1 unlocked Golden Boon. Place the Tile on an eligible empty hex for 0 Actions and 0 resources; shuffle the Boon into the Encounter deck. Each placed, non-Overstrained Golden Tile scores <b>+5 Renown</b> if its condition is met.</p>`, "special");

const refPage = page("Keep this page open", "At-table reference", `
  <h3 class="sub">Placing Strain</h3>
  ${steps([["Select.", "The effect sets which Tiles are eligible. Draw a Target Card to choose among them (page 15)."], ["Prevent.", "Supported stops 1 Strain. It does not stack."], ["Check.", "At 3 Strain a Tile is Overstrained: it does nothing, connects nothing and scores nothing until it drops below 3."], ["Chain.", "After the whole effect, each newly Overstrained Tile spreads 1 Strain to a neighbour, chosen with a fresh Target Card."]])}
  <h3 class="sub">End of Seasons I and II (after Rounds 4 and 8)</h3>
  <ol class="mini"><li>Finish Arrival expiry.</li><li>Discard Boons that end with the Season.</li><li>Neighbourly Support: each Housing cluster gains 1 Supported per 3 Housing Tiles.</li><li>Reapply every Burden with the new row.</li><li>Refresh every Steward Power.</li><li>Each Steward seeds 3 cards from their hand.</li></ol>
  <h3 class="sub">Final score (shared)</h3>
  <div class="scoregrid">
    <div class="plus"><b>Add</b>Population and Renown on non-Overstrained Tiles · +15 each Steward Objective met · +5 each Golden Tile condition met · +20 Quest Card</div>
    <div class="minus"><b>Subtract 10</b>for each active Burden · each failed Arrival · each Strain on the map</div>
  </div>`, "ref");

function pageHtml(p, n) {
  return `<div class="page ${p.cls}"><div class="inner">
    <header><div class="eyebrow">${p.eyebrow}</div><h2>${esc(p.title)}</h2></header>
    <div class="body">${p.body}</div>
    <footer><span>${n}</span></footer>
  </div></div>`;
}

const font = (f) => url(`src/assets/fonts/${f}`);
const css = `
@font-face { font-family: Almendra; font-weight: 700; src: url(${font("almendra-latin-bold.woff2")}); }
@font-face { font-family: Almendra; font-weight: 400; src: url(${font("almendra-latin-regular.woff2")}); }
@font-face { font-family: Alegreya; font-weight: 400 800; src: url(${font("alegreya-latin-variable.woff2")}); }
@font-face { font-family: Alegreya; font-style: italic; src: url(${font("alegreya-latin-italic.woff2")}); }
@font-face { font-family: Sans; font-weight: 500; src: url(${font("alegreya-sans-latin-medium.woff2")}); }
@font-face { font-family: Sans; font-weight: 700; src: url(${font("alegreya-sans-latin-bold.woff2")}); }
@page { size: 111.35mm 154.35mm; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { font-family: Alegreya, serif; color: #2b2620; font-size: 8.9pt; line-height: 1.27; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.page { width: 111.35mm; height: 154.35mm; position: relative; overflow: hidden; page-break-after: always; background: url(${A("parchment.jpg")}) center / cover; }
.page.cover { background-size: cover; background-position: center; }
.inner { position: absolute; left: 10.4mm; right: 10.4mm; top: 10.2mm; bottom: 11.8mm; display: flex; flex-direction: column; }

header { border-bottom: 0.25mm solid rgba(138,106,30,0.6); padding-bottom: 1.4mm; margin-bottom: 2.2mm; }
.eyebrow { font: 700 6.2pt/1 Sans, sans-serif; letter-spacing: 0.14em; text-transform: uppercase; color: #8a6a1e; margin-bottom: 1.2mm; }
h2 { margin: 0; font: 700 15.5pt/1.05 Almendra, serif; color: #2b2620; }
.body { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 2mm; }
footer { position: absolute; bottom: -2.2mm; left: 0; right: 0; text-align: center; font: 400 7.5pt/1 Almendra, serif; color: #6b5d45; }
p { margin: 0; }
b { font-weight: 700; }
.small { font-size: 7.9pt; color: #4a4033; }
h3.sub { margin: 1mm 0 0; font: 700 6.6pt/1 Sans, sans-serif; letter-spacing: 0.12em; text-transform: uppercase; color: #6b5d45; }
.box { border-radius: 1.6mm; padding: 2mm 2.6mm 2.2mm; background: rgba(138,106,30,0.07); }
.box.gold { background: rgba(214,168,62,0.15); }
.boxlabel { font: 700 6.4pt/1 Sans, sans-serif; letter-spacing: 0.12em; text-transform: uppercase; color: #8a6a1e; margin-bottom: 1.2mm; }
.box p + p { margin-top: 1mm; }
.lead { font-size: 9.6pt; line-height: 1.27; }
.steward h2 { font-size: 22pt; }
.steward .body { gap: 2mm; }
.steward .body > p { font-size: 8.4pt; }
.steward .box .small { margin-top: 1mm; }
.terrain { display: flex; align-items: center; gap: 1.5mm; }
.terrain img { height: 7mm; }
.terrain p { font-size: 9pt; font-weight: 700; margin-left: 1mm; }
.terrain.multi { flex-wrap: wrap; }
.terrain.multi p { flex-basis: 100%; margin: 0.8mm 0 0; font-size: 8.2pt; }
.seasons { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5mm; }
.seasons div { padding: 0.4mm 0; text-align: center; display: flex; flex-direction: column; }
.seasons span { font: 700 11pt/1 Almendra, serif; color: #8a6a1e; }
.seasons b { font-family: Almendra, serif; font-size: 8.2pt; }
.seasons i { font-size: 6.8pt; color: #6b5d45; }
ol.steps { list-style: none; margin: 0; padding: 0; display: grid; gap: 1.2mm; }
ol.steps li { display: grid; grid-template-columns: 4.6mm 1fr; gap: 1.6mm; align-items: start; }
ol.steps .n { width: 4.4mm; height: 4.4mm; border-radius: 50%; background: #2b2620; color: #f1e3b8; font: 700 6.5pt/4.4mm Sans, sans-serif; text-align: center; }
.actions { display: grid; grid-template-columns: 1fr 1fr; gap: 1.4mm; }
.actions div { border-radius: 1.4mm; padding: 1.3mm 1.8mm; background: rgba(138,106,30,0.07); font-size: 8.2pt; line-height: 1.22; }
.actions b { display: block; font: 700 9.6pt/1.1 Almendra, serif; color: #8a6a1e; margin-bottom: 0.3mm; }
.tiles .body { gap: 1.4mm; }
.turn .body { gap: 1.3mm; }
.turn h3.sub { margin-top: 0.6mm; }
.tile { flex: 1 0 auto; display: flex; flex-direction: column; }
.th { background: var(--cat); color: #231d14; border-radius: 1.2mm; display: flex; align-items: center; gap: 1.6mm; padding: 1.1mm 2.4mm; font: 500 6.8pt/1.1 Sans, sans-serif; }
.chip { font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
.meta { opacity: 0.9; }
.place { margin-left: auto; font-family: Alegreya, serif; font-style: italic; font-size: 7.3pt; text-align: right; }
.sides { flex: 1; display: grid; grid-template-columns: 1fr 1fr; }
.side { padding: 1.2mm 2mm 1mm; min-width: 0; display: flex; flex-direction: column; align-items: center; text-align: center; }
.side p { max-width: 38mm; }
.side + .side { border-left: 0.15mm solid rgba(107,93,69,0.22); }
.tileimg { width: 28mm; filter: drop-shadow(0 0.3mm 0.4mm rgba(40,30,15,0.35)); }
.sidelabel { margin-top: 0.8mm; font: 700 6pt/1 Sans, sans-serif; letter-spacing: 0.12em; text-transform: uppercase; color: #6b5d45; }
.side h4 { margin: 0.5mm 0 0.6mm; font: 700 10pt/1.05 Almendra, serif; }
.cost { font-size: 8.2pt; margin-bottom: 0.6mm; }
.cost span { font: 700 6.2pt/1 Sans, sans-serif; letter-spacing: 0.1em; text-transform: uppercase; color: #6b5d45; margin-right: 0.6mm; }
.side p { font-size: 8pt; line-height: 1.2; }
.lp { font-style: italic; }
.score { margin-top: auto; padding-top: 0.8mm; white-space: nowrap; font: 500 7pt/1.2 Sans, sans-serif; color: #4a4033; display: flex; align-items: center; justify-content: center; gap: 0.6mm; }
.score img { height: 3mm; }
.score i { font-style: normal; margin: 0 0.6mm; opacity: 0.6; }
.lpwrap { flex: 1; display: flex; flex-direction: column; gap: 2.2mm; }
.lpwrap p { font-size: 8.6pt; }
.lpwrap .symbols { margin: 0.6mm 0 1.6mm; }
.tcards { display: grid; grid-template-columns: 21mm 1fr; gap: 3mm; align-items: center; }
.tcards figure { margin: 0; text-align: center; }
.tcards img { width: 21mm; border-radius: 1.2mm;  }
.tcards figcaption { font: 500 5.8pt/1.2 Sans, sans-serif; color: #6b5d45; margin-top: 0.6mm; }
.tcards p + p { margin-top: 1mm; }
.trows { display: grid; grid-template-columns: 1fr 1fr; gap: 1.2mm; }
.trows div { border-radius: 1.4mm; padding: 1.1mm 1.6mm; font-size: 7.8pt; line-height: 1.2; background: rgba(120,136,150,0.12); }
.trows b { display: block; font: 700 9pt/1.1 Almendra, serif; color: #3e5566; }
.anatomy { position: relative; width: 62mm; margin: 0 auto; }
.anatomy img { width: 100%; display: block; filter: drop-shadow(0 0.4mm 0.6mm rgba(40,30,15,0.35)); }
.pin { position: absolute; transform: translate(-50%, -50%); width: 4.4mm; height: 4.4mm; border-radius: 50%; background: #2b2620; color: #f1e3b8; border: 0.3mm solid #e2c47a; font: 700 6.5pt/3.8mm Sans, sans-serif; text-align: center; }
ol.legend { margin: 0; padding-left: 4.4mm; columns: 2; column-gap: 4mm; font-size: 7.2pt; }
ol.legend li { margin-bottom: 0.6mm; break-inside: avoid; }
.symbols { display: grid; grid-template-columns: repeat(8, 1fr); gap: 0.6mm; text-align: center; }
.symbols img { height: 6.6mm; display: block; margin: 0 auto 0.5mm; }
.symbols span { font: 500 6.2pt/1 Sans, sans-serif; }
.cards4 { display: grid; grid-template-columns: 1fr 1fr; gap: 2mm 3mm; }
.cards4 figure { margin: 0; display: grid; grid-template-columns: 17mm 1fr; gap: 1.8mm; align-items: start; }
.cards4 img { width: 17mm; border-radius: 1mm;  }
.cards4 figcaption { font-size: 7pt; line-height: 1.22; }
.cards4 figcaption b { display: block; font: 700 8.6pt/1.1 Almendra, serif; margin-bottom: 0.4mm; }
.enc .cards4 { grid-template-columns: 1fr 1fr; gap: 2.6mm 4mm; }
.enc .cards4 figure { grid-template-columns: 1fr; gap: 1.2mm; justify-items: center; text-align: center; }
.enc .cards4 img { width: 20mm; }
.enc .cards4 figcaption { font-size: 7.9pt; }
.quest { display: grid; grid-template-columns: 33mm 1fr; gap: 3mm; align-items: center; }
.quest img { width: 33mm; border-radius: 1.4mm;  }
.quest p + p { margin-top: 1.2mm; }
.kinds { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.4mm; }
.kinds div { border-radius: 1.4mm; padding: 1.2mm 1.4mm; background: rgba(138,106,30,0.07); font-size: 7.6pt; line-height: 1.2; }
.kinds b { display: block; font: 700 8.4pt/1.1 Almendra, serif; color: #8a6a1e; }
.specials { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: repeat(13, auto); grid-auto-flow: column; gap: 0.3mm 3mm; font-size: 7.8pt; line-height: 1.22; }
.specials span { display: inline-block; min-width: 8.4mm; font: 700 6.6pt/1 Sans, sans-serif; color: #8a6a1e; }
.special .body { gap: 1.6mm; }
.ref .body { gap: 1.4mm; }
.ref ol.steps li { font-size: 9.3pt; }
.ref ol.mini { font-size: 8.9pt; }
.ref .scoregrid { font-size: 8.9pt; }
.ref .body { gap: 2.4mm; }
ol.mini { margin: 0; padding-left: 4.2mm; font-size: 7.2pt; columns: 2; column-gap: 4mm; }
ol.mini li { break-inside: avoid; margin-bottom: 0.3mm; }
.scoregrid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.6mm; font-size: 7.1pt; line-height: 1.22; }
.scoregrid div { border-radius: 1.4mm; padding: 1.4mm 1.8mm; }
.scoregrid b { display: block; font: 700 8.4pt/1.1 Almendra, serif; margin-bottom: 0.3mm; }
.plus { background: rgba(78,103,72,0.13); }
.minus { background: rgba(130,80,59,0.12); }
`;

function guideHtml(s, idx) {
  const pages = [stewardPage(s, idx), turnPage, ...tilePages, targetPage, encPage, questPage, specialPage, refPage];
  const inner = pages.map((p, i) => pageHtml(p, i + 2)).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>
    <div class="page cover" style="background-image:url(${A(`cover-${s.id}.jpg`)})"></div>
    ${inner}
    <div class="page cover" style="background-image:url(${A("back.jpg")})"></div>
  </body></html>`;
}

const browser = await chromium.launch();
const tab = await browser.newPage();
const report = [];
const pdfs = [];
for (const [idx, s] of stewards.entries()) {
  if (only.length && !only.includes(s.id)) continue;
  const html = path.join(outDir, `_${s.id}.html`);
  fs.writeFileSync(html, guideHtml(s, idx));
  await tab.goto(pathToFileURL(html).href, { waitUntil: "load" });
  await tab.evaluate(() => document.fonts.ready);
  const overflow = await tab.evaluate(() => [...document.querySelectorAll(".page")].map((pg, i) => {
    const body = pg.querySelector(".body");
    if (!body) return null;
    const over = [...body.children].some((c) => c.getBoundingClientRect().bottom > body.getBoundingClientRect().bottom + 1) || body.scrollHeight > body.clientHeight + 1;
    const clipped = [...pg.querySelectorAll('.side')].some((sd) => { const last = sd.lastElementChild; return last && last.getBoundingClientRect().bottom > sd.closest('.tile').getBoundingClientRect().bottom - 1; });
    if (clipped) return i + 1;
    return over ? i + 1 : null;
  }).filter(Boolean));
  const pdf = path.join(outDir, `The_Quiet_Vale_A6_${s.name}_Steward_Guide_v6_9.pdf`);
  await tab.pdf({ path: pdf, width: "111.35mm", height: "154.35mm", printBackground: true, preferCSSPageSize: true });
  if (!process.env.KEEP_HTML) fs.unlinkSync(html);
  pdfs.push(pdf);
  report.push({ steward: s.id, overflowPages: overflow });
}
await browser.close();
// Set the A6 TrimBox and BleedBox on every page (3.175 mm bleed).
const { execFileSync } = await import("node:child_process");
execFileSync("python3", ["-c", `
import sys, pikepdf
b = 3.175 * 72 / 25.4
for f in sys.argv[1:]:
    p = pikepdf.open(f, allow_overwriting_input=True)
    for pg in p.pages:
        x0, y0, x1, y1 = [float(v) for v in pg.MediaBox]
        pg.BleedBox = [x0, y0, x1, y1]
        pg.TrimBox = [x0 + b, y0 + b, x1 - b, y1 - b]
    p.docinfo["/Title"] = "The Quiet Vale - " + f.split("A6_")[1].split("_Steward")[0] + " Steward Guide"
    p.save(f)
`, ...pdfs]);
console.log(JSON.stringify(report));
