// The Quiet Vale: Main Rulebook v7.0 (195 x 255 mm, 36 pages).
// Redesign of pages 2-12 incorporating blind-playtest feedback and the 1-5p balance update.
//   node design/rulebook-v7_0/build.mjs <out-dir>
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const require = createRequire(path.join(root, "package.json"));
const { chromium } = require("playwright");
const ts = require("typescript");
const outDir = path.resolve(process.argv[2] || path.join(root, "output/rulebook-v7_0"));
fs.mkdirSync(outDir, { recursive: true });

function load(file) {
  const m = { exports: {} };
  new Function("exports", "module", "require", ts.transpileModule(fs.readFileSync(path.join(root, file), "utf8"), { compilerOptions: { module: 1, target: 9 } }).outputText)(m.exports, m, require);
  return m.exports;
}
const { specialTiles, goldenTiles } = load("src/data/tiles.ts");
const { stewards } = load("src/data/stewards.ts");
const { specialTileBackNumbers } = load("src/data/specialTileNumbers.ts");
const figMeta = JSON.parse(fs.readFileSync(path.join(root, "design/rulebook-v6_9/assets/figures.json"), "utf8"));

const url = (p) => pathToFileURL(path.join(root, p)).href;
const A = (f) => url(`design/rulebook-v6_9/assets/${f}`);
const ICON = (f) => url(`design/artist-tile-templates/assets/${f}`);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/'/g, "&rsquo;");
const icon = (f, cls = "ic") => `<img class="${cls}" src="${ICON(`icon-${f}.png`)}" alt="">`;
const terrainName = { woodland: "Woodland", mountains: "Mountains", heaths: "Heaths", arable: "Arable Land", ruins: "Ruins" };

// ---------------------------------------------------------------- helpers
const box = (label, body, cls = "") => `<section class="box ${cls}">${label ? `<div class="boxlabel">${label}</div>` : ""}${body}</section>`;
const note = (label, body, cls = "") => `<aside class="note ${cls}"><b>${label}</b> ${body}</aside>`;
const steps = (items, start = 1, prefix = "") => `<ol class="steps">${items.map((it, i) => `<li><span class="n">${prefix}${start + i}</span><div>${it}</div></li>`).join("")}</ol>`;
const table = (head, rows, cls = "") => `<table class="${cls}"><thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
const story = (text) => `<blockquote class="story">${text}</blockquote>`;
const caption = (t) => `<figcaption>${t}</figcaption>`;

// A figure with drawing over it. Marks are placed by hex id (map figures) or
// by fraction of the picture. The overlay uses a 1000-wide viewBox.
function fig(name, marks = [], cap = "", cls = "") {
  const m = figMeta[name];
  const W = 1000, H = Math.round((1000 * m.h) / m.w);
  const at = (p) => {
    if (typeof p === "string") { const [fx, fy] = m.hexes[p]; return [fx * W, fy * H]; }
    return [p[0] * W, p[1] * H];
  };
  const hexR = m.hexW ? (m.hexW * W) / 2 : 40;
  const hexPts = (cx, cy, r) => Array.from({ length: 6 }, (_, k) => `${(cx + r * Math.cos((Math.PI / 3) * k)).toFixed(1)},${(cy + r * Math.sin((Math.PI / 3) * k)).toFixed(1)}`).join(" ");
  const svg = marks.map((mk) => {
    const [type, ...a] = mk;
    if (type === "ring") { const [x, y] = at(a[0]); const c = a[1] || "gold"; return `<polygon class="ring ${c}" points="${hexPts(x, y, hexR * 0.97)}"/>`; }
    if (type === "shade") { const [x, y] = at(a[0]); return `<polygon class="shade" points="${hexPts(x, y, hexR * 0.98)}"/>`; }
    if (type === "badge") { const [x, y] = at(a[0]); const dx = (a[2] || 0) * hexR, dy = (a[3] || 0) * hexR; const c = a[4] || ""; return `<g class="badge ${c}" transform="translate(${(x + dx).toFixed(1)} ${(y + dy).toFixed(1)})"><circle r="${(hexR * 0.2).toFixed(1)}"/><text dy="${(hexR * 0.075).toFixed(1)}" font-size="${(hexR * 0.22).toFixed(1)}">${a[1]}</text></g>`; }
    if (type === "arrow") {
      let [x1, y1] = at(a[0]); let [x2, y2] = at(a[1]);
      const sh = a[2] ?? 0.42; const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy);
      x1 += (dx / L) * hexR * sh; y1 += (dy / L) * hexR * sh; x2 -= (dx / L) * hexR * sh; y2 -= (dy / L) * hexR * sh;
      const c = a[3] || "";
      return `<line class="arrow ${c}" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" marker-end="url(#ah${c ? "-" + c : ""})"/>`;
    }
    if (type === "cross") { const [x, y] = at(a[0]); const s = hexR * 0.22; return `<g class="cross"><line x1="${x - s}" y1="${y - s}" x2="${x + s}" y2="${y + s}"/><line x1="${x + s}" y1="${y - s}" x2="${x - s}" y2="${y + s}"/></g>`; }
    if (type === "label") {
      const [x, y] = at(a[0]); const dx = (a[2] || 0) * (typeof a[0] === "string" ? hexR : W), dy = (a[3] || 0) * (typeof a[0] === "string" ? hexR : W);
      const lines = String(a[1]).split("\n");
      const fs = a[4] || 24, lh = fs * 1.2;
      const w = Math.max(...lines.map((l) => l.length)) * fs * 0.5 + fs * 1.1, h = lines.length * lh + fs * 0.55;
      return `<g class="label" transform="translate(${(x + dx).toFixed(1)} ${(y + dy).toFixed(1)})"><rect x="${(-w / 2).toFixed(1)}" y="${(-h / 2).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="${(fs * 0.35).toFixed(1)}"/>${lines.map((l, i) => `<text y="${(-h / 2 + fs * 0.3 + lh * (i + 0.78)).toFixed(1)}" font-size="${fs}">${esc(l)}</text>`).join("")}</g>`;
    }
    if (type === "num") { // a numbered callout at a fraction of the picture
      const [x, y] = at(a[0]); const r = a[2] || 20;
      return `<g class="badge" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><circle r="${r}"/><text dy="${(r * 0.36).toFixed(1)}" font-size="${(r * 1.1).toFixed(1)}">${a[1]}</text></g>`;
    }
    return "";
  }).join("");
  const defs = `<defs>${["", "red", "dark"].map((c) => `<marker id="ah${c ? "-" + c : ""}" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4.2" markerHeight="4.2" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="ahead ${c}"/></marker>`).join("")}</defs>`;
  return `<figure class="fig ${cls}"><div class="pic"><img src="${A(`${name}.jpg`)}" alt=""><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${defs}${svg}</svg></div>${cap ? caption(cap) : ""}</figure>`;
}
const cardImg = (f, cls = "card") => `<img class="${cls}" src="${A(f)}" alt="">`;
const tileImg = (f, cls = "tilepic") => `<img class="${cls}" src="${A(`tile-${f}.webp`)}" alt="">`;

const page = (section, title, body, cls = "") => ({ section, title, body, cls });

// ---------------------------------------------------------------- pages
const P = [];

// 2 Welcome & Aim of the Game
P.push(page("Welcome to the Vale", "The Quiet Vale", `
  ${story(`War&rsquo;s banners have long since fallen silent. Old military roads now carry traders, settlers and wandering folk looking for somewhere safe to begin again. Across three Seasons you will gather resources, grow one shared settlement, welcome Arrivals and meet the Burdens of a fractured world.`)}
  <h3>How you play &amp; how you win</h3>
  <p><b>The Quiet Vale</b> is a fully cooperative game for 1 to 5 players. There is no individual winner and no pass-or-fail target: your group shares one settlement, one Warehouse and one final score. Over <b>12 rounds</b> (3 Seasons of 4 rounds), you work together to grow your settlement&rsquo;s <b>Population</b> and <b>Renown</b>, complete your Stewards&rsquo; Objectives and this game&rsquo;s Quest Card, welcome Arrivals, resolve Burdens and keep Strain off the map. After Round 12, tally your shared score and record it in the Steward&rsquo;s Ledger to try to beat it next time.</p>
  <div class="scoregrid">
    <div class="plus"><b>Add to your shared score</b>Population and Renown on all working Tiles, +15 for each Steward Objective met, +20 if you complete the Quest Card, and +5 for each Golden Tile goal met.</div>
    <div class="minus"><b>Subtract from your shared score</b>&minus;10 for each active Burden left unresolved, &minus;10 for each Arrival that failed, and &minus;10 for every Strain token still on the map.</div>
  </div>
  ${fig("fig-finale", [], "A finished settlement after Round 12: 19 Tiles built across both riverbanks, with only a few Strain left to clear.")}
`, "welcome"));

// 3 Contents
P.push(page("Welcome to the Vale", "Contents", `
  <div class="contents">{{CONTENTS}}</div>
  ${note("Quick pointers", "Leave Golden Tiles and Golden Boons in the box for your first game (page {{p:goldenp}}). Whenever a specific card or Tile contradicts a general rule, follow the card or Tile for that situation.")}`, "contentsp"));

// 4 How a game flows
P.push(page("How a game flows", "How a game flows", `
  <p class="lead">One game lasts <b>12 rounds</b> across three Seasons. You all play on the same map, spend from the same Warehouse, and aim for the highest shared score after Round 12.</p>
  <h3>1 · Three Seasons</h3>
  <div class="seasons">${[["I", "Foundations", "Rounds 1 to 4", "Seed before Round 1"], ["II", "Growth", "Rounds 5 to 8", "Season transition &amp; seed"], ["III", "Maturity", "Rounds 9 to 12", "Final scoring"]].map(([n, t, r, e]) => `<div><span>${n}</span><b>${t}</b><i>${r}</i><em>${e}</em></div>`).join("")}</div>
  <p>Before each Season, every player secretly tucks 3 Encounter Cards from their hand into the Encounter deck (top, middle and bottom) to shape when challenges and opportunities arrive.</p>
  <h3>2 · Every round in three steps</h3>
  <div class="glance">
    <div><b><span>1</span>Reveal Encounters</b>Flip 1 Encounter Card per player and resolve what they say.</div>
    <div><b><span>2</span>Take turns</b>Starting with the <b>Player 1 marker</b>, go clockwise. Each player takes 4 Actions (1–2p), 3 (3–4p) or 2 (5p): Place, Upgrade, Activate or Interact.</div>
    <div><b><span>3</span>End of round</b>Arrivals lose 1 timer, X tokens come off, the Round marker moves on, and the Player 1 marker passes one seat clockwise.</div>
  </div>
  <h3>3 · Four things to keep in mind</h3>
  <div class="cols2">
    <div>
      <p><b>Shared Warehouse.</b> All resources are shared. Production fills the Warehouse (max 15 each); every cost comes out of it.</p>
      <p><b>Your Steward &amp; Network.</b> Your wooden meeple moves onto every Tile you Place, Upgrade or Activate. You can only act on Tiles connected to your meeple (rivers block connection until you build a Bridge).</p>
    </div>
    <div>
      <p><b>Encounters.</b> Boons help you, Arrivals unlock Special Tiles before their timers run out, and Burdens pressure the settlement until resolved.</p>
      <p><b>Strain &amp; Overstrained.</b> Burdens and failed Arrivals put black Strain tokens on Tiles. A Tile works fine at 1 or 2 Strain, but at <b>3 Strain it is Overstrained</b>: it stops working, stops scoring, and spreads 1 Strain to a neighbour (page {{p:strain}}).</p>
    </div>
  </div>`, "routep"));

// 5 Components (visual key to Setup on facing page)
const at = (n) => `<span class="key">${n}</span>`;
P.push(page("1 · Components &amp; Setup", "What is in the box", `
  <p class="lead">Every numbered item below matches the circled callouts on the two-player setup picture on the facing page (page {{p:setupfig}}).</p>
  ${table(["Component", "In the box", "Key"], [
    ["Map board", "The Vale on a flat-top hex grid, with the round tracker along its foot (3 Seasons of 4 rounds).", at(1)],
    ["Encounter board", "Wells for the Encounter deck and discard pile, with the In play area between them.", at(4)],
    ["Logistics board", "The Target deck well, the shared six-resource Warehouse and the token tray.", at(5) + at(6) + at(7)],
    ["Tiles board", "The Quest Card space, unlocked Special Tiles and the Core Tile supply in five bays.", at(8) + at(9)],
    ["Core Tiles", "70 double-sided Tiles across 21 types (basic on one side, upgraded on the back), plus 14 Travel extension hexes for 2-hex Streets and 3-hex Tracks.", at(9)],
    ["Special Tiles", "28 hexes across 25 designs with numbered backs matching Arrival rewards (Stables uses two hexes).", ""],
    ["Golden Tiles", "5 Tiles with plain Golden backs, kept in the box until unlocked by the Steward&rsquo;s Ledger.", ""],
    ["Encounter Cards", "90 tarot cards: 30 Boons, 30 Burdens, 25 Arrivals and 5 Golden Boons (page {{p:enc}}).", at(4) + at(11)],
    ["Quest Cards", "21 poker cards with gold backs (page {{p:quest}}).", at(8)],
    ["Target Cards", "30 poker cards with silver backs (page {{p:target}}).", at(5)],
    ["Stewards", "6 Steward Guides and 6 matching wooden Steward meeples (page {{p:stewardsp}}).", at(2) + at(10)],
    ["Resources", "90 wooden pieces: 15 each of Wood, Stone, Metal, Food, Herbs and Goods.", at(6)],
    ["Tokens &amp; Markers", "Black Strain tokens; 20 bronze Supported shields; 20 bronze Arrival timers; 1 Round marker; 1 <b>Player 1 marker</b>; 20 wooden X tokens for once-per-round uses.", at(3) + at(7)],
  ], "comp")}
  ${note("First game", "Leave all 5 Golden Tiles and 5 Golden Boons in the box until the Steward&rsquo;s Ledger unlocks them (page {{p:quest}}).")}`, "comp1"));

// 6 Setup picture
const sp = figMeta["fig-setup"].points;
const setupCallouts = [["map", 1, 0.05, -0.07], ["meeple", 2, 0.025, -0.03], ["round", 3, 0.028, -0.035], ["encdeck", 4, 0.045, 0.06], ["target", 5, -0.045, 0], ["warehouse", 6, -0.032, 0], ["tokens", 7, -0.035, 0.05], ["quest", 8, 0.045, 0.02], ["tiles", 9, 0.05, 0.06], ["guide0", 10, -0.05, 0], ["hand0", 11, -0.045, 0.02]]
  .map(([k, n, dx, dy]) => ["num", [sp[k][0] + dx, sp[k][1] + dy], n, 17]);
P.push(page("1 · Components &amp; Setup", "Table layout (two-player example)", `
  ${fig("fig-setup", setupCallouts, "", "setup")}
  <ol class="legend">
    <li>Map board &amp; round tracker.</li>
    <li>Steward meeples on Starting Terrain.</li>
    <li>Round marker on Round 1.</li>
    <li>Encounter deck, face down.</li>
    <li>Target deck, shuffled once.</li>
    <li>Warehouse (10 each for 2 players).</li>
    <li>Strain, shields, timers, X &amp; Player 1 markers.</li>
    <li>This game&rsquo;s Quest Card.</li>
    <li>Core Tiles, basic side up.</li>
    <li>Each player&rsquo;s Steward Guide.</li>
    <li>Each player&rsquo;s hidden hand of 9 cards.</li>
  </ol>
  ${fig("fig-setup-alt", [], "<b>Alternative layout.</b> Lay the Encounter, Logistics and Tiles boards flat in a column to the right of the map.")}`, "setupfig"));

// 7 Setup steps
P.push(page("1 · Components &amp; Setup", "Setup step by step", `
  ${table(["Players", "1", "2", "3", "4", "5"], [
    ["Actions per turn", "4", "4", "3", "3", "2"],
    ["Starting Warehouse (each)", "15", "10", "8", "0", "0"],
    ["Encounter pool (Boons / Burdens / Arrivals)", "5 / 3 / 4", "8 / 8 / 8", "12 / 12 / 12", "16 / 16 / 16", "26 / 14 / 20"],
  ], "wh")}
  <div class="cols2">
    <div>
      <h3>1. Prepare the table</h3>
      ${steps([
        "Lay out the map, Encounter, Logistics and Tiles boards as shown on page {{p:setupfig}}. Put the Round marker on Round 1.",
        "Sort Core Tiles into the five bays, basic side up (the upgraded side is on the back). Keep Travel extensions with Travel Tiles and arrange Special Tiles by their numbered backs.",
        "Shuffle the 30 Target Cards face down in their well (never reshuffled).",
        "Draw the top Quest Card onto the Tiles board (shuffle the 21 Quest Cards before your very first game; keep the deck order after that).",
      ], 1, "")}
      <h3>2. Pick Stewards &amp; Player 1</h3>
      ${steps([
        "Each player picks a different Steward and takes its Guide and meeple. Read your Starting Terrain, Power and Objective aloud.",
        "Choose who starts Round 1 and give them the <b>Player 1 marker</b>. (It passes one seat clockwise each round.)",
      ], 5, "")}
    </div>
    <div>
      <h3>3. Fill the Warehouse &amp; build Encounters</h3>
      ${steps([
        "Fill each of the 6 Warehouse resources to the starting amount in the table above (max 15 each; resources never drop below 0).",
        "Sort standard Encounter Cards by type, shuffle each type, and pull the exact Boons / Burdens / Arrivals for your player count (always 12 cards per player). Return unused cards to the box.",
        "Shuffle the selected pool, deal <b>9 hidden cards</b> to each player, and place the remaining <b>3 cards per player</b> face down as the starting Encounter deck.",
      ], 7, "")}
      <h3>4. Place Steward meeples</h3>
      <p>Put each meeple on an empty hex matching its Starting Terrain (two meeples cannot share a hex). On your first turn, your first Action must place any legal Tile directly under your meeple.</p>
      ${note("Hidden hands", "Discuss strategy and timing freely, but never name hidden cards or quote their exact effects. Next: seed for Season I (page {{p:seeding}}).")}
    </div>
  </div>`, "setup2"));

// 8 Seasons and seeding
P.push(page("2 · Seasons &amp; Seeding", "Seeding the Encounter deck", `
  <p class="lead">Every Encounter Card has a <b>Season I</b>, <b>Season II</b> and <b>Season III</b> row. Cards get stronger as the Seasons progress. Before Rounds 1, 5 and 9, each player seeds 3 cards from their hand into the deck to control <i>when</i> they appear—and which Season row you face.</p>
  <h3>How to seed (before Rounds 1, 5 and 9)</h3>
  ${steps([
    "Secretly pick 3 cards from your hand. (In Seasons I and II, keep the rest for later Seasons.)",
    "Place one card face down on <b>top</b> of the Encounter deck.",
    "Tuck one card face down into the <b>middle</b> of the deck without counting.",
    "Place the last card face down on the <b>bottom</b> of the deck.",
  ], 1, "")}
  <div class="seedrow">
    <figure>${cardImg("card-boon-ancient-paths.webp")}<figcaption><b>Top</b>Likely revealed soon.</figcaption></figure>
    <figure>${cardImg("card-arrival-cavalry.webp")}<figcaption><b>Middle</b>Revealed mid-Season.</figcaption></figure>
    <figure>${cardImg("card-burden-old-wounds.webp")}<figcaption><b>Bottom</b>Likely carries into next Season.</figcaption></figure>
    <figure class="deck">${cardImg("card-encounter-back.webp")}<figcaption><b>Encounter deck</b>All seeded cards go in face down; never count or peek at the deck.</figcaption></figure>
  </div>
  <p>Cards already in the deck stay where they are. Because the deck starts with 3 cards per player and gains 3 more per player each Season, a few cards near the bottom naturally carry over into the next Season (and use that next Season&rsquo;s row). Every remaining card is revealed by the end of Round 12.</p>
  <h3>Why position matters</h3>
  ${table(["Card type", "Seed earlier (Top)", "Seed later (Bottom or hold in hand)"], [
    ["<b>Boon</b>", "Get an immediate boost early, or give a lasting Boon more rounds to work before the Season ends.", "Save it for a stronger Season II or III row, or wait until you have built the Tiles it helps."],
    ["<b>Burden</b>", "Face its weaker Season I/II row now while it is cheaper to resolve and before it reapplies.", "Buy time to build up resources—at the risk of facing a harsher, pricier row next Season."],
    ["<b>Arrival</b>", "Unlock its Special Tile early so you get more rounds of value from it (always starts with 3 timers).", "Delay it until you can easily afford its cost, leaving fewer rounds to enjoy its Special Tile."],
  ], "seed")}`, "seeding"));

// 9 The round
P.push(page("3 · The round", "How a round works", `
  <p class="lead">Every one of the 12 rounds follows the same three steps. Always finish one step completely before moving to the next.</p>
  ${table(["Step", "What happens"], [
    ["<b>1. Reveal Encounters</b>", "Flip cards from the Encounter deck until you have revealed <b>1 standard card per player</b>. Resolve each card&rsquo;s current-Season row in order before any player takes a turn. Place Arrivals, active Burdens and lasting Boons in the In play area."],
    ["<b>2. Take turns</b>", "Starting with the player holding the <b>Player 1 marker</b>, go clockwise around the table. Each player takes one turn with:<br><b>1–2 players:</b> up to 4 Actions &middot; <b>3–4 players:</b> up to 3 Actions &middot; <b>5 players:</b> up to 2 Actions.<br>You may end your turn early; unused Actions do not carry over."],
    ["<b>3. End of round</b>", "Remove 1 timer disc from every active Arrival (resolve any that hit 0). Discard effects that end this round, clear all X tokens from Tiles, advance the Round marker by 1, and <b>pass the Player 1 marker one seat clockwise</b>."],
  ], "phase")}
  ${fig("fig-inplay", [["num", [0.075, 0.12], 1, 15], ["num", [0.31, 0.06], 2, 15], ["num", [0.56, 0.06], 3, 15], ["num", [0.81, 0.06], 4, 15]], "The Encounter board during Round 2 of a two-player game.")}
  <ol class="legend inline"><li>The Encounter deck.</li><li>An Arrival with its 3 bronze timer discs.</li><li>An active Burden.</li><li>A lasting Boon kept face up.</li></ol>
  ${note("Finish one effect before moving on", "Whenever a card, Tile or Burden asks you to pay resources, place Strain, spread an Overstrain chain or make a choice, finish all of its steps before revealing the next card or taking your next Action.")}`, "round"));

// 10 Your first round
P.push(page("Your first round", "Your first round", `
  <p class="lead">Follow two players through Round 1 using the setup on page {{p:setupfig}}: the Knight on Arable Land and the Sentinel on Mountains, with 10 of each resource in the Warehouse and 4 Actions per turn.</p>
  <div>
    <div class="r1text">
      <h3>Before Round 1: Seed</h3>
      <p>Each player picks 3 cards from their hand and tucks one on top, one in the middle and one at the bottom of the Encounter deck. Their other 6 cards stay in hand for Seasons II and III.</p>
      <h3>1. Reveal Encounters</h3>
      <p>With two players, reveal 2 cards: <i>Quiet Quest</i> (an Arrival) and <i>Old Wounds Reopen</i> (a Burden).</p>
      <p><b>Quiet Quest</b> enters play with 3 bronze timer discs. Spending 1 Action plus 4 Goods and 2 Herbs will unlock Special Tile 1.</p>
      <p><b>Old Wounds Reopen</b> triggers its Season I row (affecting a Social or Wellbeing Tile). None are built yet, so nothing happens now—but the Burden stays active and will trigger again in Season II unless resolved.</p>
      <h3>2. Take turns</h3>
      <p>The Knight holds the <b>Player 1 marker</b> and goes first, followed by the Sentinel. Their turns are on the next page; below is the map after both have played.</p>
    </div>
  </div>
  <div class="cols2 figs">
    ${fig("fig-round1-knight", [["badge", "B6", "1", -0.62, -0.5], ["badge", "C6", "2", -0.62, -0.5], ["badge", "B6", "3", -0.62, 0.3], ["arrow", "B6", "C6"]], "The Knight on Arable Land: Actions 1 to 3.")}
    ${fig("fig-round1-sentinel", [["badge", "B1", "5", -0.62, 0.2], ["badge", "B1", "6", 0.62, 0.45], ["badge", "B2", "7", -0.62, 0.3], ["arrow", "B1", "B2"]], "The Sentinel on Mountains: Actions 5 to 7.")}
  </div>`, "round1"));

// 11 Your first round, continued (simplified without dense Warehouse table)
P.push(page("Your first round", "Your first round, continued", `
  <div class="cols2">
    <div>
      <h3>The Knight&rsquo;s turn (4 Actions)</h3>
      ${steps([
        "<b>Place</b> a Farmstead directly under the Knight&rsquo;s meeple (required for your first Action; costs 0 resources).",
        "<b>Place</b> a Cabin beside it (pay 2 Wood, 5 Food). The Knight&rsquo;s meeple moves onto the Cabin.",
        "<b>Activate</b> the Farmstead to gain 2 Food. The meeple moves back onto the Farmstead.",
        "<b>Interact</b> to resolve <i>Old Wounds Reopen</i>: pay 2 Herbs and discard it. Interact does not move the meeple.",
      ])}
      <p class="small">The Knight&rsquo;s once-per-Season Power is still ready for a later round.</p>
    </div>
    <div>
      <h3>The Sentinel&rsquo;s turn (4 Actions)</h3>
      ${steps([
        "<b>Place</b> a Mine Tunnel directly under the Sentinel&rsquo;s meeple (first Action; costs 0 resources).",
        "<b>Activate</b> the Mine Tunnel to gain 2 Stone.",
        "<b>Place</b> a Path beside it (costs 0 resources). The Sentinel&rsquo;s meeple moves onto the Path to reach further next round.",
        "<b>Interact</b> to complete <i>Quiet Quest</i>: pay 4 Goods and 2 Herbs, discard it, and place Special Tile 1 (Adventurers&rsquo; Guild) on the Tiles board ready to build later.",
      ], 5)}
    </div>
  </div>
  <h3>3. End of Round 1</h3>
  <p>Both Encounters were already handled, so no Arrival timers come off. Remove any X tokens, advance the Round marker to <b>Round 2</b>, and pass the <b>Player 1 marker</b> to the Sentinel so they go first next round.</p>
  ${note("Where the settlement stands", "After Round 1, both Stewards have started producing resources, the Burden is cleared, Special Tile 1 is unlocked, and the Warehouse still holds plenty of stock (8 Wood, 12 Stone, 10 Metal, 7 Food, 6 Herbs, 6 Goods). Next round: try upgrading a Tile, linking two matching producers (page {{p:prod}}), or working toward the Quest Card.")}`, "round1b"));

// 12 Your turn & The four Actions (plain English, Strain context included)
P.push(page("4 · Your turn", "The four Actions", `
  <p class="lead">On your turn, spend up to <b>4 Actions</b> (1–2p), <b>3 Actions</b> (3–4p) or <b>2 Actions</b> (5p). Mix and match the four Actions in any order—you can take the same Action more than once on your turn (for example, Place twice and Activate twice).</p>
  <div class="actions">
    <div><b>Place</b>Put a new Tile on a legal, reachable empty hex and pay its cost.</div>
    <div><b>Upgrade</b>Flip a reachable basic Core Tile to its stronger back side and pay its upgrade cost.</div>
    <div><b>Activate</b>Use a reachable working Tile&rsquo;s Activated Effect (like Production or clearing Strain).</div>
    <div><b>Interact</b>Complete an active Arrival or resolve an active Burden.</div>
  </div>
  <div class="cols2">
    <div>
      <h3>Place a Tile</h3>
      <p>Pick an available Tile and an empty hex you can reach. Check its terrain and placement rules, pay its cost from the Warehouse (unlocked Special Tiles cost 0 resources), place it, and move your meeple onto it. Only Bridges (or Tiles that say so) may go on River/Water.</p>
      <h3>Upgrade a Tile</h3>
      <p>Pick any basic Core Tile you can reach—as long as it is not <b>Overstrained</b> (3 Strain). Pay the cost shown for its upgraded side, flip the Tile over in place, and move your meeple onto it. Special and Golden Tiles do not upgrade.</p>
    </div>
    <div>
      <h3>Activate a Tile</h3>
      <p>Pick a working (non-Overstrained) Tile you can reach, pay any cost on its effect, resolve its Activated Effect, and move your meeple onto it. You can Activate the same Tile more than once if legal. Passive effects happen automatically without an Action.</p>
      <h3>Interact with an Encounter</h3>
      <p><b>Arrival:</b> Pay the Arrival&rsquo;s cost to discard it and unlock its matching Special Tile on the Tiles board (page {{p:special}}).</p>
      <p><b>Burden:</b> Pay the Burden&rsquo;s current-Season resolution cost to discard it. Any Strain it already placed stays on the map.</p>
      <p class="small">Interact never moves your meeple. (If a Special Tile or Boon lets you resolve a Burden, just follow that card or Tile&rsquo;s text.)</p>
    </div>
  </div>
  <h3>Moving your Steward &amp; Reach</h3>
  <p>Whenever you <b>Place</b>, <b>Upgrade</b> or <b>Activate</b> a Tile, move your Steward meeple onto it. You can only Place, Upgrade or Activate Tiles connected to your meeple through an unbroken chain of working Tiles—rivers block connection until you build a Bridge (page {{p:rivers}}). <b>Interact</b> never moves your meeple.</p>
  ${note("Free effects &amp; Overstrained reminder", "<b>Free effects:</b> Steward Powers and face-up Boons cost 0 Actions unless stated (a 0-Action benefit still pays normal resources). <b>Overstrained:</b> A Tile with 3 Strain shuts down until Strain is removed, and spreads 1 Strain to a neighbour when it hits 3 (page {{p:strain}}).")}`, "turn"));

// 11 Activate, Interact, meeple movement


// 12 Production
P.push(page("5 · Production and the Warehouse", "Production", `
  <p class="lead">Production is an Activated Effect on Resource Tiles. Spend an Activate Action, then add the Tile&rsquo;s printed resources to the Warehouse, up to its limit.</p>
  <h3>Linked Production</h3>
  <p>The first time each round you activate a Resource Tile, check it and every <b>immediately adjacent</b> copy from the same Tile stack. If none of them has produced this round, the chosen Tile and all its immediately adjacent, non-Overstrained copies produce for that one Activate Action, each using its current side.</p>
  <p>Linked Production never continues outward through a chain: only copies touching the chosen Tile join in. Put an X token on the chosen Tile and on every copy that produced with it. If the chosen Tile or an adjacent copy already has an X token, only the chosen Tile produces; put an X on it too. A separate group of copies elsewhere may still use Linked Production. Every X token comes off at the end of the round.</p>
  ${fig("fig-linked", [["ring", "A1"], ["ring", "B1"], ["ring", "C1"], ["badge", "B1", "1", -0.05, 0.62]], "Three upgraded Mine Shafts on the Mountains, each producing 3 Stone and 2 Metal. The Sentinel activates the middle one (1): it and both copies touching it produce, 9 Stone and 6 Metal for one Action. Activating any of them again this round produces only from the Tile chosen: 3 Stone and 2 Metal.")}
  ${note("Example", "Had the Sentinel activated the left Mine Shaft instead, only it and the middle one would touch, giving 6 Stone and 4 Metal. The right one does not touch the left one and has not taken part, but its neighbour the middle one has, so it could later produce only alone that round.")}
  <h3>The Warehouse</h3>
  <p>All resources are shared and kept on the Logistics board: pieces above the stitch are in the Warehouse, spares sit below. Each resource holds at most 15 unless an effect changes the limit. Any gain beyond the limit is lost. Resources never go below zero.</p>`, "prod"));

// 13 Reading a Tile
const tileCall = (n, x, y) => `<span class="tc" style="left:${x}%;top:${y}%">${n}</span>`;
P.push(page("6 · Reading a Tile", "Reading a Tile", `
  <div class="anat">
    <figure><div class="tw">${tileImg("c06_cottage-basic", "big")}${tileCall(1, 23, 14)}${tileCall(2, 50, 5)}${tileCall(3, 80, 14)}${tileCall(4, 9.5, 42)}${tileCall(5, 12, 51)}${tileCall(6, 12, 58)}${tileCall(7, 31, 64)}</div>${caption("Cottage: the basic side")}</figure>
    <figure><div class="tw">${tileImg("c06_cottage-upgraded", "big")}${tileCall(8, 24, 52.5)}</div>${caption("Fine Cottage: the upgraded side")}</figure>
  </div>
  <ol class="legend two">
    <li><b>Category.</b> The symbol beside the name: Resource, Housing, Travel, Merchant, Crafting, Social or Wellbeing.</li>
    <li><b>Name.</b></li>
    <li><b>Placement symbol.</b> A terrain symbol means place on that terrain; a symbol in a hexagon means place beside that terrain or Tile category. Here: beside a Housing Tile.</li>
    <li><b>Printed scores.</b> Population on the left, Renown on the right.</li>
    <li><b>Place.</b> The cost to place the basic side.</li>
    <li><b>Upgrade.</b> The cost to flip it to the upgraded side.</li>
    <li><b>Effect.</b> Activate needs an Activate Action. Passive works by itself, at the printed timing.</li>
    <li><b>Upgraded side.</b> A silver frame and the name of the basic side it came from.</li>
  </ol>
  <div class="symbols">${[["Resource Wood", "Wood"], ["Resource Stone", "Stone"], ["Resource Metal", "Metal"], ["Resource Food", "Food"], ["Resource Herbs", "Herbs"], ["Resource Goods", "Goods"], ["Population", "Population"], ["Renown", "Renown"]].map(([f, n]) => `<div>${icon(f)}<span>${n}</span></div>`).join("")}</div>
  <p>Read a number beside a symbol as that amount. Two costs separated by &ldquo;or&rdquo; mean pay either one. When a Tile uses an ability marked once per round, put an X token on it: it cannot use that ability again until the X comes off at the end of the round. Once per Season refreshes when the next Season starts. Special Tiles have a coloured margin and a numbered back. Golden Tiles have a gold frame and print their placement rule in the effect box.</p>`, "anatomy"));

// 14 Placing Tiles
P.push(page("7 · Placing Tiles", "Terrain, placement and adjacency", `
  <p>The Vale has seven terrains: Grasslands, Woodland, Arable Land, Mountains, Heaths, Ruins and River/Water. Read each placement rule exactly: the Mine Tunnel goes on Mountains, the Farmstead on Arable Land, the Salvage Camp on Ruins and the Bridge on River/Water. A Tile with no placement symbol may go on any land hex.</p>
  <div class="terrains">${[["Placement Woodland", "Woodland"], ["Placement Mountains", "Mountains"], ["Placement Heath", "Heaths"], ["Placement Arable Land", "Arable Land"], ["Placement Ruins", "Ruins"], ["Placement Water", "River/Water"]].map(([f, n]) => `<div>${icon(f)}<span>${n}</span></div>`).join("")}<div><span class="grass"></span><span>Grasslands</span></div></div>
  <h3>Adjacency</h3>
  <p>Tiles are adjacent when their hexes share a side. Requirements such as beside Housing, beside Travel and beside River/Water all use this rule.</p>
  ${fig("fig-adjacency", [["ring", "I2"], ["ring", "I4"], ["ring", "H2"], ["ring", "H3"], ["ring", "J2"], ["ring", "J3"], ["cross", "K3"]], "The six hexes ringed in gold are adjacent to the Cabin. The Path and the Cottage are adjacent to it; the Eatery is not, though it touches the Cottage.", "side")}
  ${note("Shelter in the Ruins", "When you place or upgrade a Tile whose whole footprint lies on Ruins, ignore all Stone in that cost. If any part of it lies outside the Ruins, pay the full cost.")}
  <h3>Workshops and Market Stalls</h3>
  <div class="cols2 tilepair">
    <div>${tileImg("c13_workshops-basic", "mini")}<p>Workshops and The Makers Conclave are Passive. Once per round, <b>Workshops</b> takes 1 resource off the cost to upgrade an adjacent Core Tile. <b>The Makers Conclave</b> instead takes up to 2 off the cost to upgrade any reachable Core Tile.</p></div>
    <div>${tileImg("c14_market_stalls-basic", "mini")}<p>Market Stalls and The Seldes are Passive. Once per round while paying a cost, <b>Market Stalls</b> lets you spend 1 Goods as 1 resource of any type. <b>The Seldes</b> lets you spend 1 Goods as up to 2 resources of one type. Neither replaces Goods printed in the cost.</p></div>
  </div>`, "place"));

// 15 Reach and rivers
P.push(page("7 · Placing Tiles", "Reach, rivers and Bridges", `
  <h3>Reachability</h3>
  <p>A Tile or empty hex is reachable when you can reach it from your meeple through the shared settlement network, or when a card, Tile or Steward rule says it is reachable. The network is every placed, non-Overstrained Tile joined side to side; the Docks and Stables extend it, but never to an Overstrained Tile. Every Steward uses the same network, and an empty hex is reachable when it is next to a Tile you can reach.</p>
  <h3>Rivers and Bridges</h3>
  <p>River/Water is a barrier. Tiles on opposite banks do not connect, and you cannot reach across, unless a Bridge or another rule allows the crossing.</p>
  <div class="cols2 figs">
    ${fig("fig-river-a", [["cross", "E5"], ["label", "D5", "Not connected", 0.95, -0.8, 26]], "Without a Bridge the Cabin and the Salvage Camp are on opposite banks and do not connect.")}
    ${fig("fig-river-b", [["ring", "E5"], ["arrow", "D5", "E5", 0.5], ["arrow", "E5", "F5", 0.5]], "A Bridge on the river joins the two banks into one network.")}
  </div>
  ${story("One roof became three. A path reached the workshop, another reached the river, and neighbours carried tools between them. Nobody planned the whole shape alone; the settlement grew wherever one piece of work made the next possible.")}
  ${note("Steward meeples and reach", "After your first placement, your meeple moves whenever you Place, Upgrade or Activate. Your next reach starts from the Tile it is on. Overstrained Tiles do not join the network, so a settlement split by one may leave some Tiles out of reach.")}`, "rivers"));

// 16 Special Tiles
const specials = specialTiles.map((t) => [(specialTileBackNumbers[t.id] || []).join(" and "), t.name]).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
P.push(page("8 · Special Tiles", "Unlocking and placing Special Tiles", `
  <p class="lead">Completing an Arrival unlocks the Special Tile whose back number matches its reward. Unlocking does not place it. Later, any player may place it with a normal Place Action for no resources, following its printed placement rule.</p>
  <div class="match">
    <figure>${cardImg("card-arrival-blade-to-herb.webp")}${caption("Blade to Herb unlocks Special Tile 23")}</figure>
    <figure class="hexes">${tileImg("special-back-23", "mid")}${tileImg("special_the_root_weavers_respite", "mid")}${caption("The back numbered 23, and its front: The Root Weavers Respite")}</figure>
    ${fig("fig-special", [["ring", "M4"]], "Placed later on a reachable Heaths hex.", "small")}
  </div>
  <h3>Special Tiles on their terrain</h3>
  <p>These Special Tiles go on the listed terrain. They need no adjacent Resource Tile. Their effects still apply exactly as written, and any other printed requirement still uses side-sharing adjacency. The five Shrines have no once-per-round limit: a Shrine adds its gain every time an adjacent matching producer produces, and never takes an X token.</p>
  ${table(["Place on", "Special Tiles"], [
    ["Heaths", "13 Shrine of Ancients, 23 The Root Weavers Respite"],
    ["Mountains", "15 Shrine of Depths, 19 The Iron Roots Respite"],
    ["Woodland", "16 Shrine of Renewal, 21 The Reavers&rsquo; Respite"],
    ["Arable Land", "14 Shrine of Bounty, 24 The Tamers&rsquo; Respite"],
    ["Ruins", "12 Shrine of Ancestors, 20 The Lorekeepers&rsquo; Respite"],
  ], "spec")}
  <h3>Special Tile numbers</h3>
  <div class="specials">${specials.map(([n, name]) => `<div><span>${n}</span>${esc(name)}</div>`).join("")}</div>
  <p class="small">Remnants of the Cavalry unlocks Stables (17 and 18): two separate hexes, placed by its printed rule.</p>`, "special"));

// 17 Encounter overview
P.push(page("9 · Encounter Cards", "Encounter Cards at a glance", `
  <p class="lead">Read every Encounter from top to bottom. The title and the italic story text set the scene; the rules are in the sections below them. A specific card rule overrides a general rule only for the situation it names.</p>
  <div class="enc4 grid2">
    <figure>${cardImg("card-boon-a-little-time.webp")}<figcaption><b>Boon</b>Use the row for the current Season. The italic line under it says whether the card is used at once, stays face up, has limited uses or ends with the Season.</figcaption></figure>
    <figure>${cardImg("card-burden-old-wounds.webp")}<figcaption><b>Burden</b>Apply the current row when it is revealed and leave the card active. Its italic line gives the Action and payment that resolve and discard it.</figcaption></figure>
    <figure>${cardImg("card-arrival-quiet-quest.webp")}<figcaption><b>Arrival</b>Put a bronze timer disc in each of the three circles. Meet its Requirements with an Interact Action to unlock the Special Tile named in its Reward.</figcaption></figure>
    <figure>${cardImg("card-golden-scroll.webp")}<figcaption><b>Golden Boon</b>No Season rows and no timers. Resolve it free when revealed; it does not count towards the cards revealed each round.</figcaption></figure>
  </div>
  ${note("Current Season", "Use row I in Foundations (Rounds 1 to 4), II in Growth (Rounds 5 to 8) and III in Maturity (Rounds 9 to 12).")}
  <p class="small">The story text is narrative only. The italic line inside a Boon or Burden row is a rule, and so is the italic line at the foot of a Golden Boon.</p>`, "enc"));

// 18 Boons and Burdens
P.push(page("9 · Encounter Cards", "Boons and Burdens", `
  <div class="side-card">
    ${cardImg("card-boon-a-little-time.webp")}
    <div>
      <h3>Boons: help for the settlement</h3>
      <p>Read the current Season row and resolve it at once, unless its italic line says to keep the card face up. A kept Boon stays in play until it is used or its time runs out; then discard it. Using a face-up Boon costs no Action unless its text says so. Only one Boon may change a single Action unless a rule says otherwise.</p>
      <p>For example, <i>A Little Time</i> adds 1 timer to an active Arrival in Season I, up to 3. Its later rows add up to 2 or 3 timers. It is kept until used or until the Season ends.</p>
    </div>
  </div>
  <div class="side-card">
    ${cardImg("card-burden-old-wounds.webp")}
    <div>
      <h3>Burdens: pressure that stays</h3>
      <p>When a Burden is revealed, apply its current row and leave it face up as an active Burden. At the start of Seasons II and III, apply every unresolved Burden again using its new row.</p>
      <p>Resolve a Burden by carrying out its printed resolution, usually with an Interact Action, or with an effect that resolves it. <i>Old Wounds Reopen</i> in Season I asks you to choose 1 Social or Wellbeing Tile, then pay 2 Herbs or take 1 Strain there. To discard it, spend 1 Action and pay 2 Herbs.</p>
      <p>When a Burden offers payment or Strain, choose before drawing a Target Card, and draw only for the Strain. Resolving a Burden stops it from applying again; Strain it has already placed stays.</p>
    </div>
  </div>
  ${note("Active Burdens score against you", "Each Burden still active at the end of the game costs 10 points.")}`, "boons"));

// 19 Arrivals
P.push(page("9 · Encounter Cards", "Arrivals", `
  <div class="side-card">
    ${cardImg("card-arrival-quiet-quest.webp")}
    <div>
      <p class="lead">Arrivals are timed goals that unlock Special Tiles. When one is revealed, put it in play with a bronze timer disc in each of its 3 circles.</p>
      <p><i>Quiet Quest</i> asks for 4 Goods and 2 Herbs and unlocks Special Tile 1, the Adventurers&rsquo; Guild.</p>
      <p>To complete an Arrival, meet its Requirements and spend 1 Interact Action before its last timer is removed. Remove the timers, discard the card and set the unlocked Special Tile on the Tiles board.</p>
    </div>
  </div>
  <div class="tilepair cols2">
    <div>${tileImg("c08_inn-basic", "mini")}<p><b>More time.</b> An activated Inn adds 1 timer to an active Arrival.</p></div>
    <div>${tileImg("c08_inn-upgraded", "mini")}<p>The Dawn Break Inn adds up to 2. An Arrival never holds more than 3 timers.</p></div>
  </div>
  <h3>Arrival timing</h3>
  ${table(["When", "What happens"], [
    ["End of each round", "Remove 1 timer from every active Arrival."],
    ["Its last timer is removed", "The Arrival fails. Discard it and record one failed Arrival. Then make every placed Tile with fewer than 3 Strain eligible and draw a Target Card to choose one of them for 1 Strain. If there is no such Tile, place no Strain."],
    ["Still active after Round 12", "It stays active. It does not fail, place Strain or cost points."],
  ], "arr")}
  ${note("Several Arrivals fail together", "Resolve each failure on its own. For each one, work out the eligible Tiles again and draw a fresh Target Card, returning it to the bottom of the deck before the next.")}
  <p class="small">An easy way to count failures at the end: keep failed Arrivals face down in the discard well, apart from the other cards.</p>`, "arrivals"));

// 20 Strain and Supported
P.push(page("10 · Strain and Supported", "Strain and Supported", `
  <div class="cols2">
    <div>
      <h3>Strain</h3>
      <p>Strain is shown with black wooden tokens on the Tile. A Tile holds at most 3 Strain. At 1 or 2 Strain it works normally unless a rule says otherwise. If an effect would add Strain to a Tile already at 3, add nothing.</p>
      ${note("Partial resolution", "If the full amount or number of targets is not available, place as much Strain as possible on as many eligible Tiles as possible. &ldquo;If none&rdquo; means no legal target exists; it never lets you choose zero while a legal target remains.")}
    </div>
    <div>
      <h3>Supported</h3>
      <p>A bronze shield on a Tile shows Supported. Supported stops 1 Strain before you check whether the Tile becomes Overstrained. A Tile either has Supported or does not: it never stacks.</p>
      <p><b>Passive Supported</b> lasts while its source&rsquo;s condition holds and stops the first Strain on that Tile each round. Common Land gives it to 1 adjacent Housing Tile; The Pleasance to up to 3. Choose them when the effect starts and keep them until the eligible Tiles change or the source becomes Overstrained. You cannot move it in answer to incoming Strain.</p>
      <p><b>Single-use Supported</b>, from placement, activation or another effect, stops 1 Strain and is then removed.</p>
    </div>
  </div>
  ${fig("fig-strain", [["badge", "G5", "0", 0.55, -0.45], ["badge", "I6", "1", 0.55, -0.45], ["badge", "H6", "2", 0.55, -0.45], ["badge", "G6", "3", 0.55, -0.45, "red"], ["arrow", "H7", "H6", 0.62]], "The Eatery has no Strain, the Cottage 1 and the Cabin 2. The Common Land gives the Cabin passive Supported (the bronze shield), so the next Strain that reaches it this round is stopped. The Path holds 3 Strain and is Overstrained.", "side")}
  <p class="small">The Golden Garden and every other prevention apply at the same step as Supported. Prevented Strain is not placed, moved elsewhere or able to start a spread.</p>`, "strain"));

// 21 Overstrained and chains
P.push(page("11 · Overstrain chains", "Overstrained Tiles and chains", `
  <p class="lead">A Tile becomes Overstrained when it goes from fewer than 3 Strain to 3. Leave it on the map. It cannot be activated or upgraded, gives no passive effects, does not join the network, scores no Population or Renown and meets no positive requirement. As soon as it drops below 3 it works again.</p>
  <div class="spreadrule">
    <h3>The spread rule</h3>
    <p class="big">When a Tile becomes Overstrained, it spreads <b>1 Strain</b> to <b>one</b> adjacent Tile, never more, after the effect that caused it has finished.</p>
    <ul>
      <li><b>Which Tile:</b> draw a fresh Target Card. It chooses from the placed Tiles that share a side with the Overstrained Tile and have fewer than 3 Strain.</li>
      <li><b>No eligible neighbour:</b> nothing spreads.</li>
      <li><b>Stopped:</b> if Supported or another prevention stops that Strain, the spread ends there.</li>
      <li><b>Once each time:</b> a Tile spreads when it reaches 3, not while it stays at 3. If it drops below 3 and reaches 3 again later, it spreads again.</li>
      <li><b>Chains:</b> if the spread brings the chosen Tile to 3, that Tile spreads in turn.</li>
    </ul>
  </div>
  <h3>Resolving a chain</h3>
  <p>Finish the whole original effect first, including every printed Strain and Strain Cascade. Then list every Tile that reached 3 and choose the order they spread in. Resolve one spread at a time, each with its own Target Card. A Tile that reaches 3 from a spread joins the end of the list. The chain ends when every Tile on the list has spread.</p>
  <div class="cols2 figs">
    ${fig("fig-chain-a", [["ring", "I3", "red"], ["badge", "I3", "+1", -0.6, -0.6, "red"]], "Before: the Cottage and the Path beside it both hold 2 Strain. An effect adds 1 Strain to the Cottage.")}
    ${fig("fig-chain-b", [["arrow", "I3", "J3", 0.45, "red"], ["arrow", "J3", "J4", 0.45, "red"], ["badge", "I3", "1", 0.4, -0.75, "red"], ["badge", "J3", "2", 0.4, -0.75, "red"]], "After: the Cottage reaches 3 and spreads 1 Strain. Its Target Card picks the Path (1). The Path reaches 3 and spreads 1 Strain in turn; its card picks the Apothecary (2), which goes to 1 Strain, so the chain stops.")}
  </div>
  <p class="small">A Tile already at 3 does not spread again when another effect targets it; the extra Strain is simply not added. A printed Strain Cascade is part of the effect that caused it, not a spread. Nothing spreads at the end of a Season.</p>`, "chain"));

// 22 Target deck
P.push(page("12 · The Target Deck", "Choosing where Strain lands", `
  <div class="side-card poker">
    ${cardImg("card-target-05.webp")}
    <div>
      <p class="lead">When an effect adds Strain, it says which Tiles are <b>eligible</b>. A Target Card then chooses among them, so nobody has to. It never adds a Tile the effect did not make eligible.</p>
      ${steps([
        "Start with only the Tiles the effect made eligible. Apply any printed fallback first.",
        "Draw the top card for each separate target, even if only 1 Tile is eligible. Several Strain on the same Tile use one card.",
        "Work down the four rows: Tile class, Tile side, Adjacency, then Current Strain.",
        "At each row, keep the Tiles that match. <b>If none match, skip that row</b> and keep them all. Any changes nothing. Never bring back a Tile already ruled out.",
        "If more than one Tile is left, take the one the arrow points to: the tied Tile furthest in that direction on the map.",
        "Return the card face down to the bottom of the deck. Then apply Supported and other prevention. Prevented Strain is not moved elsewhere.",
      ])}
    </div>
  </div>
  <div class="trows">
    <div><b>Tile class</b>Core, Special or Golden, or Any</div>
    <div><b>Tile side</b>Basic, Upgraded, Either or Any</div>
    <div><b>Adjacency</b>3 or more neighbours, 0 to 2 neighbours, or Any</div>
    <div><b>Current Strain</b>Already strained, Unstrained or Any</div>
  </div>
  <div class="side-card poker">
    ${cardImg("card-target-25.webp")}
    <div>
      <h3>Open cards</h3>
      <p>Cards 25 to 30 say Any on every row. Keep the eligible Tiles, then the players choose any one of them. No arrow is used.</p>
      <h3>Tie directions</h3>
      <p>The arrows follow the map&rsquo;s flat-top hexes: N, NE, SE, S, SW and NW, with north at the top of the map board. Each direction is on 4 cards. Hold the card the same way up as the board. If two Tiles are exactly level in that direction, take the one nearer the top of the map, then the one further left.</p>
    </div>
  </div>`, "target"));

// 23 Target in action
P.push(page("12 · The Target Deck", "A Target Card at work", `
  <p class="lead">A Burden places 1 Strain on a Housing Tile. The four Housing Tiles are eligible. The players draw Target Card 05.</p>
  <div class="worked">
    ${fig("fig-target", [["ring", "J6", "dim"], ["ring", "I6", "dim"], ["ring", "I7"], ["ring", "J7", "red"], ["label", "J6", "Basic: out at row 2", 0, -0.55, 21], ["label", "I6", "No Strain: out at row 4", 0, -0.55, 21], ["label", "J7", "Takes the Strain", 0, 0.6, 21]], "")}
    <div class="poker">${cardImg("card-target-05.webp")}</div>
  </div>
  ${table(["Row", "Card 05 says", "Tiles left"], [
    ["Tile class", "Core", "All four are Core Tiles: all four stay."],
    ["Tile side", "Upgraded", "The Cabin is basic, so it goes. The Fine Cabin and both Fine Cottages stay."],
    ["Adjacency", "3 or more neighbours", "All three have at least 3 neighbouring Tiles: all stay."],
    ["Current Strain", "Already strained", "The Fine Cabin has no Strain, so it goes. Both Fine Cottages stay."],
    ["If still tied", "Arrow to SE", "The Fine Cottage further to the south-east, ringed in red, takes the Strain."],
  ], "wtab")}
  <p class="small">The card goes face down to the bottom of the deck. Had that Fine Cottage been Supported, the Strain would have been stopped there and not moved to another Tile.</p>`, "target2"));

// When effects meet
P.push(page("When effects meet", "When effects meet", `
  <p class="lead">When several rules seem to happen at once, use this order. Always finish every mandatory effect before moving to the next step.</p>
  <h3>In a round</h3>
  <div class="timeline">
    <div><b><span>1</span>Reveal</b>Reveal until the standard cards revealed equal the player count. Golden Boons do not count, so keep revealing.</div>
    <div><b><span>2</span>Resolve</b>Apply each revealed card&rsquo;s current Season row and finish every payment, choice and Strain it creates.</div>
    <div><b><span>3</span>Play</b>Clockwise from this round&rsquo;s first player, each player takes one turn of up to 4 Actions (1–2p), 3 (3–4p) or 2 (5p). Free effects can be used during your turn.</div>
    <div><b><span>4</span>End</b>Arrivals lose a timer and failures are resolved one by one. Short effects end, X tokens come off, the Round marker moves on.</div>
  </div>
  <h3>When an effect would add Strain</h3>
  <div class="pipe">
    <div><b>Eligible</b>The effect says which Tiles can take it</div><i></i>
    <div><b>Target Card</b>Draw one to choose among them</div><i></i>
    <div><b>Prevent</b>Supported or another prevention may stop it</div><i></i>
    <div><b>Apply</b>Put the Strain on the Tile</div><i></i>
    <div><b>Chain</b>Only once the whole effect is done: Tiles that reached 3 spread</div>
  </div>
  <div class="cols2">
    <div>
      <h3>Inside one effect</h3>
      <p>Finish everything the card or Tile prints first, including every Strain placement and Strain Cascade. Only then start Overstrain chains, one spread at a time, in the order the players choose.</p>
      <p>When an effect gives a choice between paying and taking Strain, choose first. Draw a Target Card only if you take the Strain.</p>
    </div>
    <div>
      <h3>Between Seasons</h3>
      <p>After Rounds 4 and 8: Arrival failures, then Boons that end with the Season, Neighbourly Support, Burdens applied again with the new row, Steward Powers refreshed, and seeding last (page {{p:seasonend}}).</p>
      <p>After Round 12, finish every pending effect, then score (page {{p:scoring}}).</p>
    </div>
  </div>
  ${note("When rules conflict", "Text on a specific card or Tile overrides a general rule, but only for the situation it names.")}`, "timing"));

// 24 Stewards
P.push(page("13 · Stewards", "The six Stewards", `
  <p class="lead">Each Steward has a Starting Terrain, a Power used once per Season and an Objective worth +15 Renown at final scoring. A Power costs no Action unless it says so, needs no Tile, and refreshes at the start of each Season. Your Steward Guide has the full wording.</p>
  <div class="stewards">${stewards.map((s, i) => `<div class="st"><img src="${A(`meeple-${s.id}.webp`)}" alt=""><div><h4>${esc(s.name)} <span>${["I", "II", "III", "IV", "V", "VI"][i]}</span></h4><p class="terr">${s.startingTerrains.length > 1 ? "Any terrain but Grasslands and River/Water" : terrainName[s.startingTerrains[0]]}</p><p><b>Power.</b> ${esc(s.powerText)}</p><p><b>Objective.</b> ${esc(s.objectiveText)}</p></div></div>`).join("")}</div>
  <p class="small">Only non-Overstrained Tiles count towards Objectives unless a rule says otherwise.</p>`, "stewardsp"));

// 25 End of a Season
P.push(page("14 · End of a Season", "End of a Season", `
  <p class="lead">After Rounds 4 and 8, work through these steps in order before the next Season begins.</p>
  ${table(["Step", "After Rounds 4 and 8"], [
    ["1", "Finish every Arrival that ran out of timers."],
    ["2", "Discard unused face-up Boons whose time ends with the Season."],
    ["3", "Neighbourly Support (below)."],
    ["4", "Apply every unresolved Burden again, using the new Season row."],
    ["5", "Refresh every Steward Power."],
    ["6", "Seed the Encounter deck for the next Season (page {{p:seeding}})."],
  ], "season")}
  <h3>Neighbourly Support</h3>
  <p>Each Housing cluster gains 1 single-use Supported for every complete group of 3 non-Overstrained Housing Tiles in it. Put each one on a different eligible Housing Tile in that cluster. Ignore Overstrained Tiles when tracing a cluster and counting its size.</p>
  ${fig("fig-neighbourly", [["ring", "H2"], ["ring", "I2"], ["ring", "J2"], ["ring", "H3"], ["ring", "I3"], ["ring", "J3"]], "A cluster of six Housing Tiles: two complete groups of 3, so it gains 2 Supported, placed on two different Tiles.")}
  ${note("No automatic spread", "Nothing spreads at the end of a Season. A chain starts only when a Tile newly reaches 3 Strain.")}`, "seasonend"));

// 26 Final scoring
P.push(page("15 · Final scoring", "Final scoring", `
  <p class="lead">After Round 12 and every pending effect, work out one shared final score. There is no pass mark and no individual winner.</p>
  ${table(["Step", "Score"], [
    ["1. Population", "Population printed on, and given to, non-Overstrained Tiles."],
    ["2. Renown", "Renown printed on, and given to, non-Overstrained Tiles, and from effects."],
    ["3. Steward Objectives", "+15 for each Steward Objective met."],
    ["4. Quest Card", "+20 if either half of the Quest Card is complete. Completing both gives no more."],
    ["5. Golden Tiles", "+5 for each placed, non-Overstrained Golden Tile whose condition is met."],
    ["6. Active Burdens", "&minus;10 for each."],
    ["7. Failed Arrivals", "&minus;10 for each Arrival that ran out during play."],
    ["8. Strain", "&minus;10 for every Strain token on the map."],
  ], "score")}
  ${note("Final score", "Add Population and every Renown bonus, then take away every penalty. Record the score, then file the Quest Card (page {{p:quest}}).")}
  <h3>Scoring example</h3>
  <div class="tally">
    <table class="tallyt"><tbody>
      <tr><td>Population from Tiles</td><td>80</td></tr>
      <tr><td>Renown from Tiles and effects</td><td>25</td></tr>
      <tr><td>Two Steward Objectives met</td><td>+30</td></tr>
      <tr><td>Quest Card complete</td><td>+20</td></tr>
      <tr><td>One Golden Tile condition met</td><td>+5</td></tr>
      <tr class="sub"><td>Before penalties</td><td>160</td></tr>
      <tr class="neg"><td>One active Burden</td><td>&minus;10</td></tr>
      <tr class="neg"><td>Two failed Arrivals</td><td>&minus;20</td></tr>
      <tr class="neg"><td>Three Strain on the map</td><td>&minus;30</td></tr>
    </tbody></table>
    <div class="total"><span>Shared final score</span><b>100</b></div>
  </div>
  <p class="small">Unlocked Special Tiles that were never placed do not score. Overstrained Tiles neither score nor meet positive Objectives unless a rule says so.</p>
`, "scoring"));

// 27 Quest Cards
P.push(page("16 · Quest Cards and the Steward&rsquo;s Ledger", "Quest Cards", `
  <div class="side-card quest">
    ${cardImg("card-quest-07.webp")}
    <div>
      <p class="lead">One Quest Card is in play each game, whatever the player count. Draw the top card of the Quest deck at setup.</p>
      <p><b>Both halves are live.</b> The top half (one pip) is easier; the bottom half (two pips) is harder. Complete either half and the card scores <b>+20 Renown</b>, once. Completing both gives no more.</p>
      <p>Each half shows a target for every player count: read the column for yours.</p>
    </div>
  </div>
  <div class="kinds">
    <div><b>Goal, Moment</b>Complete the moment it happens, even if the board changes later.</div>
    <div><b>Goal, Final</b>Checked at final scoring.</div>
    <div><b>Vow, All game</b>A rule that must hold all game. If it is ever broken, that half fails. Its &ldquo;End with&rdquo; target is checked at final scoring.</div>
  </div>
  <p class="small">Quest Cards look only at the map: tile shapes and placements, never the score. The card on page {{p:setupfig}}, item 8, is Quest Card 7, The Workings.</p>
  <h3>The Steward&rsquo;s Ledger</h3>
  <p>The Steward&rsquo;s Ledger is the pile of completed Quest Cards your group keeps in the box. After final scoring:</p>
  ${steps([
    "If the Quest Card is complete, add it to the Ledger.",
    "If not, put it at the bottom of the Quest deck, so it does not come straight back.",
    "Once every card is in the Ledger, the completed cards come round again, in the order they were completed.",
  ])}
  ${table(["Cards in the Ledger", "3", "6", "9", "12", "15"], [["Golden Tile", "The Golden Charter", "The Golden Hearth", "The Golden River Gate", "The Golden Cairn", "The Golden Garden"], ["Golden Boon", "The Golden Bell", "The Golden Scroll", "The Golden Vial", "The Golden-Eyed Traveller", "The Golden Signet Ring"]], "ledger")}
  <p class="small">Each milestone unlocks one Golden pair for good. Unlocked pairs stay available in every later game.</p>`, "quest"));

// 28 Golden content
const goldenScore = {
  golden_tile_the_golden_charter: "Adjacent to at least 4 different Tile categories.",
  golden_tile_the_golden_hearth: "Surrounded by 6 placed, non-Overstrained Tiles.",
  golden_tile_the_golden_river_gate: "Non-Overstrained Tiles on both sides of the river, connected by a Bridge or Stone Bridge.",
  golden_tile_the_golden_cairn: "Non-Overstrained Tiles on at least 4 terrains other than River/Water.",
  golden_tile_the_golden_garden: "The game ends with no Overstrained Tiles.",
};
P.push(page("17 · Golden content", "Golden content", `
  <p class="lead">Golden content is optional advanced material unlocked through the Steward&rsquo;s Ledger. It is not for a first game.</p>
  <h3>Golden setup</h3>
  ${steps([
    "After the standard hands are dealt, choose up to 1 unlocked Golden Tile and up to 1 unlocked Golden Boon.",
    "Place the Golden Tile on an eligible empty hex, following its printed rule. This costs no Actions and no resources.",
    "Shuffle the Golden Boon into the Encounter deck. It never enters a hand and is never seeded.",
    "When it is revealed, resolve it free. It does not count towards the standard reveal, so keep revealing.",
  ], 1, "18.")}
  <h3>Golden Tile scoring</h3>
  <p>At final scoring, each placed, non-Overstrained Golden Tile scores +5 Renown if its condition is met.</p>
  <div class="golden">${goldenTiles.map((g) => `<div>${tileImg(g.id, "gt")}<div><b>${esc(g.name)}</b><p class="small">${esc(g.placement?.text || "")}</p><p><b>+5 Renown:</b> ${goldenScore[g.id] || ""}</p></div></div>`).join("")}</div>
  <h3>Golden Boons</h3>
  <p>Golden Boons never enter hands or seeding. When one is revealed, resolve it free, do not count it towards the standard reveal, and keep revealing. <i>The Golden Scroll</i>, for example, lets each player discard any standard Encounter Cards from their hand and draw the same number at random from the box; Golden Boons cannot be drawn, and if the box runs short, draw as many as you can. Then discard it.</p>`, "goldenp"));

// Twin Settlements, an optional mode
const twinLab = {"B5": [0.12336988892059868, 0.5259574501156132], "J3": [0.6713150944000508, 0.31880187180172764], "D5": [0.2603561902904617, 0.5259574501156132], "F5": [0.3973424916603247, 0.5259574501156132]};
P.push(page("18 · Twin Settlements", "Twin Settlements", `
  <p class="lead">An optional mode: two Vales grow on opposite banks of the river. Each team builds its own settlement with its own Warehouse, Tiles and Encounters, and the whole table shares one result. For 2 to 4 players; one player can also run both Vales.</p>
  <div class="twinmap">
    <div class="map"><img src="${A("twin-map.jpg")}" alt=""><span class="tag" style="left:${twinLab.B5[0] * 100}%;top:${twinLab.B5[1] * 100}%">West Vale</span><span class="tag" style="left:${twinLab.J3[0] * 100}%;top:${twinLab.J3[1] * 100}%">East Vale</span></div>
    <div class="maptext">
      <p><b>The West Vale</b> is the land west of the river&rsquo;s western channel, shaded blue.</p>
      <p><b>The East Vale</b> is all the other land, shaded gold, including both Ruins.</p>
      <p class="small">A team may cross the river to build, but its Tiles always belong to its own Vale.</p>
    </div>
  </div>
  <div class="cols2">
    <div>
      <h3>Setup</h3>
      <ul class="twin">
        <li><b>Teams.</b> Split into two teams: 1 and 1, 2 and 2, or 1 and 2. In 1 and 2, the solo player chooses a Vale.</li>
        <li><b>Stewards.</b> Choose different Stewards as normal, but leave out the Warden. A Quartermaster may not start on Ruins.</li>
        <li><b>Meeples.</b> Each player puts their meeple on an empty hex of their Starting Terrain in their own Vale. Their first Action places a Tile there, as normal.</li>
        <li><b>Tiles.</b> Split every stack of Core Tiles in half, one half for each Vale.</li>
        <li><b>Warehouses.</b> Each Vale has its own: 15 of each resource for a one-player team, 10 of each for a two-player team.</li>
        <li><b>Encounters.</b> Build one Encounter deck and set of hands for each team, using the normal setup for that team&rsquo;s size.</li>
        <li><b>Leave out</b> the Docks, the Stables, the two Arrivals that unlock them, Golden content and the Quest Card. Replace each of those Arrivals with another unused Arrival.</li>
      </ul>
    </div>
    <div>
      <h3>Play</h3>
      <ul class="twin">
        <li>Each round, both Vales reveal their Encounters, then every player takes one turn of up to 4 Actions (3 with four players), clockwise from the first player, who moves one seat left each round.</li>
        <li>Teammates share everything in their Vale: the Warehouse, the Tile supply, the network, unlocked Special Tiles, Encounters, Strain and Supported.</li>
        <li>Turns, Actions, meeples, Steward Powers and Objectives stay individual.</li>
        <li>A team may only use, upgrade, activate or count its own Tiles, resources and Encounters.</li>
        <li>A team&rsquo;s first Tiles need not touch; once joined, they are one network.</li>
        <li>Read &ldquo;each player&rdquo; on a card as &ldquo;each team&rdquo;, resolved once.</li>
        <li>Both teams draw from the one Target deck. Only the drawing team&rsquo;s Tiles are ever eligible.</li>
      </ul>
      ${note("Never join the Vales", "No Tile may be placed where it would connect the West Vale network to the East Vale network.")}
    </div>
  </div>
  <div class="scoregrid">
    <div class="plus"><b>Score each Vale</b>Use the normal final scoring with only that team&rsquo;s Tiles, Steward Objectives, active Burdens, failed Arrivals and Strain.</div>
    <div class="minus" style="background: rgba(214,168,62,0.13)"><b>One result</b>Record both scores together as the table&rsquo;s result. Nobody wins alone; the aim is two strong Vales.</div>
  </div>`, "twinp"));

// 29 Quick reference
P.push(page("19 · Quick reference", "Quick reference", `
  <h3>The round</h3>
  <div class="qr3"><div><span>1</span>Reveal and resolve Encounters</div><div><span>2</span>Starting with the Player 1 marker, go clockwise: 4 Actions (1–2p), 3 (3–4p) or 2 (5p)</div><div><span>3</span>Remove Arrival timers, resolve failures, clear X tokens, advance Round &amp; pass Player 1 marker</div></div>

  <h3>Placing Strain</h3>
  <div class="qr4"><div><b>Select</b>Find the eligible Tiles, then draw a Target Card</div><div><b>Prevent</b>Supported and other prevention first</div><div><b>Check</b>At 3 Strain the Tile is Overstrained</div><div><b>Chain</b>After the effect, each newly Overstrained Tile spreads 1 Strain to one adjacent Tile (Target Card)</div></div>
  <h3>Season transition, after Rounds 4 and 8</h3>
  <ol class="mini"><li>Finish Arrival failures.</li><li>Discard Boons that end with the Season.</li><li>Neighbourly Support: 1 Supported per 3 Housing Tiles in a cluster.</li><li>Apply every Burden again with the new row.</li><li>Refresh every Steward Power.</li><li>Seed the Encounter deck.</li></ol>
  <div class="status"><b>Watch a Tile&rsquo;s Strain</b><span><em>1 or 2</em> It still works normally.</span><span><em>3</em> Overstrained: no effects, no connection, no score, and it spread 1 Strain when it got there.</span><span><em>Bronze shield</em> Supported: the next Strain is stopped.</span></div>
  <h3>Costs and limits</h3>
  ${table(["Rule", "Remember"], [
    ["Warehouse", "At most 15 of each. Start with 15, 10, 8, 0 or 0 of each for 1 to 5 players. Never below zero."],
    ["Special Tile", "Once unlocked: 1 Place Action, its placement rule, no resources."],
    ["0 Actions", "Only the Action is free. Pay the resource cost unless the effect changes it."],
    ["Steward meeple", "Place, Upgrade and Activate move it. Interact does not."],
    ["Arrival", "Starts with 3 timers, never more. Remove 1 from each at the end of every round."],
    ["Target Card", "Start from the eligible Tiles, work down the rows, then return the card face down to the bottom."],
    ["Quest Card", "Either half complete: +20 Renown, once."],
  ], "qrt")}
  <div class="scoregrid"><div class="plus"><b>Add</b>Population and Renown on non-Overstrained Tiles, +15 each Steward Objective met, +20 Quest Card, +5 each Golden condition met</div><div class="minus"><b>Take away 10</b>for each active Burden, each failed Arrival and each Strain on the map</div></div>`, "qr"));

// Questions at the table
P.push(page("Questions at the table", "Questions at the table", `
  <div class="faq"><div><span>01</span><div><b>Does &ldquo;0 Actions&rdquo; also waive the resources?</b><p>No. Only the Action is free. Pay the normal cost unless the effect also changes it. <em>Page {{p:turn}}.</em></p></div></div><div><span>02</span><div><b>Is an unlocked Special Tile free to place?</b><p>It costs no resources, but it still takes a Place Action, a reachable hex and its printed placement rule. <em>Page {{p:special}}.</em></p></div></div><div><span>03</span><div><b>Does Linked Production run down a line of copies?</b><p>No. Only copies touching the chosen Tile join in, and only the first time that group produces each round. <em>Page {{p:prod}}.</em></p></div></div><div><span>04</span><div><b>Does a Tile already at 3 Strain spread again when it is targeted?</b><p>No. It spreads only when it goes from fewer than 3 to 3. If it is relieved and later reaches 3 again, it spreads again. <em>Page {{p:chain}}.</em></p></div></div><div><span>05</span><div><b>A Burden says pay or take Strain. When do we draw the Target Card?</b><p>Choose first. Draw a Target Card only if you take the Strain. <em>Page {{p:boons}}.</em></p></div></div><div><span>06</span><div><b>Can an Arrival still be active after Round 12?</b><p>Yes. It does not fail, place Strain or cost points. <em>Page {{p:arrivals}}.</em></p></div></div><div><span>07</span><div><b>Two Tiles are exactly level in the arrow&rsquo;s direction. Which one?</b><p>The one nearer the top of the map; if still level, the one further left. <em>Page {{p:target}}.</em></p></div></div><div><span>08</span><div><b>Does Interact move my meeple?</b><p>No. Only Place, Upgrade and Activate move it. <em>Page {{p:turn}}.</em></p></div></div><div><span>09</span><div><b>The Warehouse is full and a Tile produces more. What happens?</b><p>The extra is lost. The Warehouse holds at most 15 of each resource, and never goes below zero. <em>Page {{p:prod}}.</em></p></div></div><div><span>10</span><div><b>Can we complete both halves of the Quest Card for 40 Renown?</b><p>No. Either half completes the card, for +20 Renown once. <em>Page {{p:quest}}.</em></p></div></div><div><span>11</span><div><b>Do Golden Boons count towards the cards revealed each round?</b><p>No. Resolve one free and keep revealing until enough standard cards are out. <em>Page {{p:goldenp}}.</em></p></div></div><div><span>12</span><div><b>What happens to a failed Quest Card?</b><p>It goes to the bottom of the Quest deck. A completed card goes into the Steward&rsquo;s Ledger. <em>Page {{p:quest}}.</em></p></div></div></div>`, "faqp"));

// 30 Glossary
const gloss = [
  ["Action", "One of up to 4 things you do on your turn: Place, Upgrade, Activate or Interact."],
  ["Activated Effect", "A Tile effect used by spending an Activate Action."],
  ["Active Burden", "A revealed Burden that has not been resolved."],
  ["Adjacent", "Sharing a hex side."],
  ["Arrival", "A timed Encounter completed with an Interact Action to unlock its Special Tile."],
  ["Available Tile", "A Core Tile still in the supply, or an unlocked Special Tile ready to place."],
  ["Boon", "A helpful Encounter, used at once or kept face up for its printed time."],
  ["Burden", "An Encounter that applies its current row and stays active until resolved."],
  ["Core Tile", "A double-sided Tile with a basic side and an upgraded side."],
  ["Eligible", "A Tile an effect says Strain may land on. A Target Card chooses only among eligible Tiles."],
  ["Failed Arrival", "An Arrival whose last timer was removed during play."],
  ["Golden Tile", "Optional advanced content unlocked through the Steward&rsquo;s Ledger and placed at setup."],
  ["Housing cluster", "A group of non-Overstrained Housing Tiles joined side to side."],
  ["Linked Production", "The first activation of a Resource Tile each round, with every adjacent copy from the same stack producing too. It does not chain outward."],
  ["Network", "Every placed, non-Overstrained Tile joined side to side."],
  ["Overstrain chain", "After an effect, each newly Overstrained Tile spreads 1 Strain to one adjacent Tile chosen by a Target Card; any Tile that reaches 3 that way spreads in turn."],
  ["Overstrained", "A Tile at 3 Strain. It does nothing positive until it drops below 3. Reaching 3 spreads 1 Strain to one adjacent Tile."],
  ["Passive Effect", "A Tile effect that works without an Action while its condition holds."],
  ["Pending effect", "A mandatory choice, payment, placement, Strain, chain or other instruction already started but not finished."],
  ["Quest Card", "This game&rsquo;s shared challenge. Complete either half for +20 Renown."],
  ["Reachable", "A Tile or empty hex your meeple can reach through the network or by a specific rule."],
  ["Round", "Reveal Encounters, one turn per player, then the end of the round."],
  ["Season", "Four rounds: Foundations (1 to 4), Growth (5 to 8) or Maturity (9 to 12)."],
  ["Special Tile", "A Tile unlocked by an Arrival and placed later with a Place Action for no resources."],
  ["Steward meeple", "Your wooden piece on the map. Your reach starts from the Tile it stands on."],
  ["Steward&rsquo;s Ledger", "Your group&rsquo;s pile of completed Quest Cards. It unlocks the Golden pairs."],
  ["Strain Cascade", "Card-specific Strain placements resolved inside the original effect."],
  ["Supported", "A bronze shield that stops 1 Strain. Passive or single-use; never stacks."],
  ["X token", "A small natural wooden X on a Tile whose once-per-round ability or Linked Production was used this round. All come off at the end of the round."],
  ["Vow", "A Quest Card half whose rule must hold all game."],
  ["Warehouse", "The shared supply of resources, normally at most 15 of each."],
  ["River/Water", "The map&rsquo;s water. It blocks connection unless a Bridge or another rule allows the crossing."],
];
gloss.sort((a, b) => a[0].replace("&rsquo;", "'").localeCompare(b[0].replace("&rsquo;", "'")));
const glossDl = (rows) => `<dl class="gloss">${rows.map(([t, d]) => `<dt>${t}</dt><dd>${d}</dd>`).join("")}</dl>`;
const GSPLIT = 22;
P.push(page("20 · Glossary", "Glossary", glossDl(gloss.slice(0, GSPLIT)), "glossary"));

// 31 Index
const where = [["Arrivals", "arrivals"], ["Boons and Burdens", "boons"], ["Components", "comp1"], ["End of a Season", "seasonend"], ["Final scoring", "scoring"], ["First round, guided", "round1"], ["Four Actions", "turn"], ["Golden content", "goldenp"], ["Linked Production", "prod"], ["Neighbourly Support", "seasonend"], ["Overstrain chains", "chain"], ["Quest Cards", "quest"], ["Questions at the table", "faqp"], ["Reachability", "rivers"], ["Reading a Tile", "anatomy"], ["Rivers and Bridges", "rivers"], ["Round sequence", "round"], ["Seeding", "seeding"], ["Setup", "setupfig"], ["Shelter in the Ruins", "place"], ["Special Tile numbers", "special"], ["Steward meeple movement", "turn"], ["Stewards", "stewardsp"], ["Strain and Supported", "strain"], ["Target Cards", "target"], ["Timing", "timing"], ["Twin Settlements", "twinp"], ["Warehouse", "prod"], ["X tokens", "prod"]].map(([t, id]) => [t, `{{p:${id}}}`]);
P.push(page("20 · Glossary", "Glossary, continued", `
  ${glossDl(gloss.slice(GSPLIT))}
  <h3>Where to look</h3>
  <div class="index">${where.map(([t, n]) => `<div><span>${t}</span><span class="dots"></span><span>${n}</span></div>`).join("")}</div>
`, "indexp"));

// ---------------------------------------------------------------- render
function pageHtml(p, n) {
  const side = n % 2 === 0 ? "even" : "odd";
  return `<div class="page ${p.cls} ${side}"><div class="inner">
    <header><div class="eyebrow">${p.section}</div><h2>${p.title}</h2></header>
    <div class="body">${p.body}</div>
    <footer><span>${n}</span></footer>
  </div></div>`;
}

const font = (f) => url(`src/assets/fonts/${f}`);
const css = fs.readFileSync(path.join(here, "rulebook.css"), "utf8")
  .replaceAll("{{FONT}}", url("src/assets/fonts/").replace(/\/$/, ""))
  .replaceAll("{{PARCHMENT}}", A("parchment.jpg"));
void font;

// Contents: the first page of each numbered section, taken from the pages.
const seen = new Set();
const contentsHtml = P.map((pg, i) => [pg.section, i + 2]).filter(([sec]) => sec !== "Welcome to the Vale" && !seen.has(sec) && seen.add(sec))
  .map(([sec, n]) => { const [num, name] = / · /.test(sec) ? sec.split(" · ") : ["", sec]; return `<div><span class="cn">${num}</span><span class="ct">${name}</span><span class="dots"></span><span class="cp">${n}</span></div>`; }).join("");
for (const pg of P) pg.body = pg.body.replace("{{CONTENTS}}", contentsHtml);
const pageOf = Object.fromEntries(P.map((pg, i) => [pg.cls.split(" ")[0], i + 2]));
for (const pg of P) pg.body = pg.body.replace(/\{\{p:([a-z0-9]+)\}\}/g, (m, id) => { if (!pageOf[id]) throw new Error("No page " + id); return String(pageOf[id]); });

const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>
  <div class="page cover" style="background-image:url(${A("cover.jpg")})"></div>
  ${P.map((p, i) => pageHtml(p, i + 2)).join("")}
  <div class="page cover" style="background-image:url(${A("back.jpg")})"></div>
</body></html>`;

const htmlPath = path.join(outDir, "_rulebook.html");
fs.writeFileSync(htmlPath, html);
const browser = await chromium.launch();
const tab = await browser.newPage();
await tab.goto(pathToFileURL(htmlPath).href, { waitUntil: "load" });
await tab.evaluate(() => document.fonts.ready);
const report = await tab.evaluate(() => [...document.querySelectorAll(".page")].map((pg, i) => {
  const body = pg.querySelector(".body");
  if (!body) return null;
  const bb = body.getBoundingClientRect();
  const over = [...body.querySelectorAll("*")].filter((c) => c.getBoundingClientRect().bottom > bb.bottom + 1 && c.getBoundingClientRect().height > 0).length;
  const wide = [...body.querySelectorAll("*")].filter((c) => c.getBoundingClientRect().right > bb.right + 1).length;
  return over || wide ? { page: i + 1, over, wide, slack: Math.round(bb.bottom - Math.max(...[...body.children].map((c) => c.getBoundingClientRect().bottom))) } : null;
}).filter(Boolean));
const slack = await tab.evaluate(() => [...document.querySelectorAll(".page")].map((pg, i) => {
  const body = pg.querySelector(".body"); if (!body) return null;
  const bb = body.getBoundingClientRect();
  return [i + 1, Math.round((bb.bottom - Math.max(...[...body.children].map((c) => c.getBoundingClientRect().bottom))) / 3.78)];
}).filter(Boolean));
const pdf = path.join(outDir, "The_Quiet_Vale_Main_Rulebook_v7_0.pdf");
await tab.pdf({ path: pdf, width: "201.35mm", height: "261.35mm", printBackground: true, preferCSSPageSize: true });
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
p.docinfo["/Title"] = "The Quiet Vale - Rulebook"
p.save(sys.argv[1])
print(len(p.pages), "pages")
`, pdf], { stdio: "inherit" });
console.log(JSON.stringify({ overflow: report, slackMm: slack }));
