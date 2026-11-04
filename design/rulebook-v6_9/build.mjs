// The Quiet Vale: Main Rulebook v6.9 (195 x 255 mm, 32 pages).
// The rules follow the v6.8 review rulebook, brought up to date with the
// Quest Cards, the flat-top Target Card directions, the v4 boards and the
// Steward Guides. Every picture is made from the real components
// (figures.py, scene.py and the online EncounterCard), not photographs.
//   node design/rulebook-v6_9/build.mjs <out-dir>
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const require = createRequire(path.join(root, "package.json"));
const { chromium } = require("playwright");
const ts = require("typescript");
const outDir = path.resolve(process.argv[2] || path.join(root, "output/rulebook-v6_9"));
fs.mkdirSync(outDir, { recursive: true });

function load(file) {
  const m = { exports: {} };
  new Function("exports", "module", "require", ts.transpileModule(fs.readFileSync(path.join(root, file), "utf8"), { compilerOptions: { module: 1, target: 9 } }).outputText)(m.exports, m, require);
  return m.exports;
}
const { specialTiles, goldenTiles } = load("src/data/tiles.ts");
const { stewards } = load("src/data/stewards.ts");
const { specialTileBackNumbers } = load("src/data/specialTileNumbers.ts");
const figMeta = JSON.parse(fs.readFileSync(path.join(here, "assets/figures.json"), "utf8"));

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

// 2 Welcome
P.push(page("Welcome to the Vale", "The Quiet Vale", `
  ${story(`War&rsquo;s banners have long since fallen silent. Old military roads now carry traders, settlers and wandering folk looking for somewhere safe to begin again. Across three Seasons you will gather resources, grow one shared settlement, welcome Arrivals and meet the Burdens of a fractured world.<br><br>The Quiet Vale is a game of stewardship: build carefully, support your neighbours and leave the Vale stronger than you found it.`)}
  <h3>The aim of the game</h3>
  <p>Build Population and earn Renown together over 12 rounds. Complete Steward Objectives, Arrivals and the Quest Card, resolve Burdens and protect the settlement from Strain. After Round 12, work out one shared final score. There is no separate winning threshold and no individual winner. Record the score, and file the Quest Card in the Steward&rsquo;s Ledger if you completed it.</p>
  ${note("Your shared score", "Population and Renown, plus Steward Objective, Quest Card and Golden bonuses, minus 10 for each active Burden, each failed Arrival and each Strain on the map.")}
  <h3>The game at a glance</h3>
  <div class="glance">
    <div><span>1</span><b>Season start</b>Each player secretly seeds three Encounter Cards into the deck: one on top, one in the middle and one at the bottom.</div>
    <div><span>2</span><b>Each round</b>Reveal and resolve Encounters, choose the player order, then each player takes one turn of up to 4 Actions. Finish with the end of the round.</div>
    <div><span>3</span><b>Season end</b>After Rounds 4 and 8, work through the Season transition. After Round 12, work out the final score.</div>
  </div>
  <h3>Three Seasons, twelve rounds</h3>
  <div class="seasons">${[["I", "Foundations", "Rounds 1 to 4", "Season transition"], ["II", "Growth", "Rounds 5 to 8", "Season transition"], ["III", "Maturity", "Rounds 9 to 12", "Final scoring"]].map(([n, t, r, e]) => `<div><span>${n}</span><b>${t}</b><i>${r}</i><em>Then: ${e}</em></div>`).join("")}</div>`, "welcome"));

// 3 Contents
const contents = [["Components", 4], ["Setup", 6], ["Seasons and Encounter seeding", 8], ["The round", 9], ["Your turn and the four Actions", 10], ["Production and the Warehouse", 12], ["Reading a Tile", 13], ["Placing Tiles", 14], ["Reach, rivers and Bridges", 15], ["Special Tiles", 16], ["Encounter Cards", 17], ["Strain and Supported", 20], ["Overstrain chains", 21], ["The Target Deck", 22], ["Stewards", 24], ["End of a Season", 25], ["Final scoring", 26], ["Quest Cards and the Steward&rsquo;s Ledger", 27], ["Golden content", 28], ["Quick reference", 29], ["Glossary", 30]];
P.push(page("Welcome to the Vale", "Using this rulebook", `
  <p class="lead">For your first game, follow Setup and Encounter seeding (pages 6 to 8), then keep the round and the four Actions (pages 9 to 11) open beside you. During play, use your Steward Guide and the Quick reference on page 29. Leave Golden content in the box for your first game.</p>
  <p>The pictures in this book show the real components on the table: the map board, the tiles, the cards and the wooden tokens. Pale rings, numbers and arrows drawn over a picture are there to explain it; they are not on the board.</p>
  <div class="contents">${contents.map(([t, n], i) => `<div><span class="cn">${i + 1}</span><span class="ct">${t}</span><span class="dots"></span><span class="cp">${n}</span></div>`).join("")}</div>
  <figure class="frontis"><img src="${A("board-map-board-v4.jpg")}" alt="">${caption("The Vale before the first Tile is laid.")}</figure>
  ${note("When rules conflict", "Text on a specific card or Tile overrides a general rule, but only for the situation it names. Otherwise follow this rulebook, and finish every mandatory effect before play continues.")}`, "contentsp"));

// 4 Components I
P.push(page("1 · Components", "What is in the box", `
  <div class="boards">
    <figure class="b-map"><img src="${A("board-map-board-v4.jpg")}" alt="">${caption("<b>Map board.</b> The Vale on a flat-top hex grid, with the round tracker along the foot: three Season trays of four rounds.")}</figure>
    <div class="b-side">
      <figure><img src="${A("board-encounter-board-v4.jpg")}" alt="">${caption("<b>Encounter board.</b> The Encounter deck, the cards in play and the discard pile.")}</figure>
      <figure><img src="${A("board-logistics-board-v4.jpg")}" alt="">${caption("<b>Logistics board.</b> The Target deck, the six-resource Warehouse and the token tray.")}</figure>
      <figure class="b-tiles"><img src="${A("board-tiles-board-v4.jpg")}" alt="">${caption("<b>Tiles board.</b> The Quest Card, unlocked Special Tiles and the Core Tile supply in five bays.")}</figure>
    </div>
  </div>
  ${table(["Component", "In the box"], [
    ["Boards", "Map board, Encounter board, Logistics board and Tiles board."],
    ["Core Tiles", "70 double-sided Core Tiles across 21 types, plus 14 Travel extension hexes. Each Core Tile has a basic side and an upgraded side."],
    ["Special Tiles", "28 hexes across 25 designs, each with a numbered back. Stables uses two separate hexes."],
    ["Golden Tiles", "5 Golden Tiles with a plain Golden back, unlocked through the Steward&rsquo;s Ledger."],
    ["Encounter Cards", "90 tarot-size cards: 30 Boons, 30 Burdens, 25 Arrivals and 5 Golden Boons."],
    ["Quest Cards", "21 poker-size cards with gold backs."],
    ["Target Cards", "30 poker-size cards with silver backs."],
    ["Stewards", "6 Steward Guides and 6 matching wooden Steward meeples."],
    ["Warehouse", "90 wooden resource pieces: 15 each of Wood, Stone, Metal, Food, Herbs and Goods."],
    ["Tokens", "Black wooden Strain tokens and bronze tokens for Supported, Arrival timers and the Round marker."],
  ], "comp")}`, "comp1"));

// 5 Components II
const tileCaps = figMeta.tiles;
P.push(page("1 · Components", "Tiles, cards and tokens", `
  <h3>Tiles</h3>
  <div class="tilerow">${tileCaps.map((t) => `<figure><img src="${A(t.file)}" alt="">${caption(t.caption)}</figure>`).join("")}</div>
  <p class="small">A Street covers 2 hexes in a line and a Track 3: the Travel extension hexes complete them. Golden Tiles share the Special Tile back with no number.</p>
  <h3>Cards</h3>
  <div class="cardrow">
    <figure>${cardImg("card-encounter-back.webp")}${caption("Encounter back")}</figure>
    <figure>${cardImg("card-boon-a-little-time.webp")}${caption("Boon")}</figure>
    <figure>${cardImg("card-burden-old-wounds.webp")}${caption("Burden")}</figure>
    <figure>${cardImg("card-arrival-quiet-quest.webp")}${caption("Arrival")}</figure>
    <figure>${cardImg("card-golden-scroll.webp")}${caption("Golden Boon")}</figure>
  </div>
  <div class="cardrow poker">
    <figure>${cardImg("card-quest-back.webp")}${caption("Quest back")}</figure>
    <figure>${cardImg("card-quest-07.webp")}${caption("Quest Card")}</figure>
    <figure>${cardImg("card-target-back.webp")}${caption("Target back")}</figure>
    <figure>${cardImg("card-target-05.webp")}${caption("Target Card")}</figure>
    <figure>${cardImg("card-target-25.webp")}${caption("Open Target Card")}</figure>
  </div>
  <h3>Wooden pieces</h3>
  ${fig("fig-tokens", [], "Black Strain tokens, bronze tokens, the six Steward meeples and one resource piece of each type.", "tokens")}
  ${note("Before your first game", "Leave the Golden Tiles and Golden Boons in the box. They enter play only once the Steward&rsquo;s Ledger unlocks them (page 27).")}`, "comp2"));

// 6 Setup picture
const sp = figMeta["fig-setup"].points;
const setupCallouts = [["map", 1, 0.06, -0.06], ["meeple", 2, 0.03, -0.025], ["round", 3, 0.035, -0.03], ["encdeck", 4, 0.06, 0.045], ["target", 5, -0.065, 0], ["warehouse", 6, -0.045, 0], ["tokens", 7, -0.05, 0.03], ["quest", 8, 0.03, -0.05], ["tiles", 9, 0.045, 0.03], ["guide0", 10, 0, -0.105], ["hand0", 11, 0, -0.095]]
  .map(([k, n, dx, dy]) => ["num", [sp[k][0] + dx, sp[k][1] + dy], n, 17]);
P.push(page("2 · Setup", "Setting up a two-player game", `
  ${fig("fig-setup", setupCallouts, "", "setup")}
  <ol class="legend">
    <li>The map board, with the round tracker along its foot.</li>
    <li>Each Steward meeple on its Starting Terrain: here the Knight on Arable Land and the Sentinel on Mountains.</li>
    <li>The Round marker in the Round 1 socket.</li>
    <li>The Encounter deck, face down.</li>
    <li>The Target deck, shuffled once and face down.</li>
    <li>The Warehouse: 10 of every resource for two players, spare pieces below the stitch.</li>
    <li>Strain and bronze tokens.</li>
    <li>This game&rsquo;s Quest Card.</li>
    <li>The Core Tile supply, basic side up, by category.</li>
    <li>Each player&rsquo;s Steward Guide.</li>
    <li>Each player&rsquo;s hidden hand of 9 Encounter Cards.</li>
  </ol>`, "setupfig"));

// 7 Setup steps
P.push(page("2 · Setup", "Setup step by step", `
  <div class="cols2">
    <div>
      <h3>Prepare the shared area</h3>
      ${steps([
        "Lay out the map board. Stand the Encounter board on end along its left side and the Logistics board on end along its right side, both with their lettering facing the map. Put the Tiles board below the map.",
        "Sort the Core Tiles into the Tiles board&rsquo;s five bays with every basic side face up. The upgraded side is the back of the same Tile, so there is no separate upgraded supply. Keep the Travel extension hexes with the Travel Tiles.",
        "Arrange the Special Tiles by their numbered backs, ready to match to Arrival rewards.",
        "Put the Round marker in the Round 1 socket.",
        "Shuffle the 30 Target Cards once and put the deck face down in its well. There is no discard pile and you never reshuffle it.",
        "Shuffle the 21 Quest Cards and draw the top one onto the Tiles board. Keep the rest as the Quest deck (page 27).",
      ], 1, "2.")}
      <h3>Choose Stewards</h3>
      <p>Each player chooses a different Steward and takes its Steward Guide and meeple. Read each Steward&rsquo;s Starting Terrain, Power and Objective aloud. For 1 player, choose 1 Steward and use the 1-player values wherever they are shown. For 5 players, return the sixth Steward to the box.</p>
      <h3>Fill the Warehouse</h3>
      ${table(["Players", "1", "2", "3", "4", "5"], [["Each resource", "15", "10", "5", "0", "0"]], "wh")}
      <p class="small">The Warehouse holds at most 15 of each resource unless an effect changes the limit. All resources are shared. Resources never go below zero: losing a resource you do not have has no effect.</p>
    </div>
    <div>
      <h3>Build the Encounter material</h3>
      ${steps([
        "Sort the standard Encounter Cards by type and shuffle each type. For each player, take 4 Boons, 4 Burdens and 4 Arrivals: a pool of 12 cards per player. For 5 players, take 20 of each type, 60 cards in all.",
        "Shuffle the pool and deal 9 hidden cards to each player.",
        "Put the remaining 3 cards per player face down in the Encounter well as the starting deck. For 5 players that is the last 15 cards.",
        "Return every unselected standard card to the box as the reserve. Keep it apart and do not look through it unless an effect tells you to.",
      ], 7, "2.")}
      ${note("Hidden hands", "Talk freely about strategy, timing and broad plans, but do not name hidden cards or quote their exact effects.")}
      <h3>Place the Steward meeples</h3>
      <p>Each player puts their meeple on an empty hex of their Steward&rsquo;s Starting Terrain. This places no Tile and costs nothing. Two meeples cannot share a hex.</p>
      ${note("First placement", "On your first turn, your first Action must place any legal Tile on the hex under your meeple. It need not be a Resource Tile and need not connect to another Tile.")}
      <p class="small">Then seed the Encounter deck for Season I (page 8) and begin Round 1.</p>
    </div>
  </div>`, "setup2"));

// 8 Seasons and seeding
P.push(page("3 · Seasons and Encounter seeding", "Seeding the Encounter deck", `
  <p class="lead">A game lasts 12 rounds across three Seasons of four rounds: Foundations (Rounds 1 to 4), Growth (Rounds 5 to 8) and Maturity (Rounds 9 to 12). Before each Season, every player commits 3 cards from their hand and chooses where each enters the Encounter deck.</p>
  <h3>Choose the cards, then the positions</h3>
  ${steps([
    "Choose 3 cards from your hidden hand. In Seasons I and II, keep the others in your hand for a later Season.",
    "Seed one chosen card on top of the Encounter deck.",
    "Push one into the middle, without counting the deck.",
    "Seed the last one at the bottom.",
  ], 1, "3.")}
  <div class="seedrow">
    <figure>${cardImg("card-boon-ancient-paths.webp")}<figcaption><b>Top</b>Comes up soonest.</figcaption></figure>
    <figure>${cardImg("card-arrival-cavalry.webp")}<figcaption><b>Middle</b>Somewhere in the Season.</figcaption></figure>
    <figure>${cardImg("card-burden-old-wounds.webp")}<figcaption><b>Bottom</b>Most likely to cross into the next Season.</figcaption></figure>
    <figure class="deck">${cardImg("card-encounter-back.webp")}<figcaption><b>The Encounter deck</b>Seeded cards go in face down; nobody sees where the others went.</figcaption></figure>
  </div>
  <p>Seed before Rounds 1, 5 and 9. Cards already in the deck stay where they are. In a normal game, 2 standard cards per player remain in the deck after Season I and 1 per player after Season II, and every remaining standard card is revealed in Season III. A low card can therefore cross into the next Season and use that Season&rsquo;s row. Nobody may count, inspect, reorder or reveal the deck unless an effect allows it.</p>
  ${note("Two timing decisions", "First choose which 3 cards enter the deck this Season; this is your clearest control over the Season row. Then choose top, middle and bottom. Top usually comes up sooner, while bottom is the most likely to cross into the next Season. Position guides timing; it never fixes an exact round.")}
  ${table(["Card", "Bring it forward", "Hold it back or seed it lower"], [
    ["Boon", "Speed up a plan, or give a kept effect more time before the Season ends.", "Use a stronger later-Season row, or wait until its targets exist."],
    ["Burden", "Reveal its weaker current-Season row while resolving it is cheaper and more time remains before it reapplies.", "Gain time to prepare, at the risk of a stronger row, a higher cost and less time to respond."],
    ["Arrival", "Unlock its Special Tile with more of the game left to use it. It still starts with 3 timers.", "Wait until its Requirements are easier to meet, but leave less time to use the Tile."],
  ], "seed")}`, "seeding"));

// 9 The round
P.push(page("4 · The round", "How a round works", `
  ${table(["Phase", "What happens"], [
    ["<b>1. Reveal Encounters</b>", "Reveal cards until the number of standard Encounter Cards revealed equals the player count. Resolve every mandatory effect before turns begin. Put Arrivals and kept Boons and Burdens in the In play area."],
    ["<b>2. Player turns</b>", "The group chooses the order. Each player then takes exactly one turn of up to 4 Actions."],
    ["<b>3. End of the round</b>", "Remove 1 timer from every active Arrival and resolve any that run out. Discard effects whose time is up, refresh effects used this round, then move the Round marker on."],
  ], "phase")}
  ${fig("fig-inplay", [["num", [0.075, 0.12], 1, 15], ["num", [0.31, 0.06], 2, 15], ["num", [0.56, 0.06], 3, 15], ["num", [0.81, 0.06], 4, 15]], "The Encounter board during Round 2 of a two-player game.")}
  <ol class="legend inline"><li>The Encounter deck.</li><li>An Arrival with its 3 bronze timers.</li><li>An active Burden.</li><li>A Boon kept face up until it is used.</li></ol>
  ${note("Pending effects", "A pending effect is any mandatory choice, payment, placement, Strain, chain or other instruction already started but not finished. Finish it before turns begin or before moving to the next step.")}
  ${note("Golden content", "Golden Tiles and Golden Boons stay in the box until the Steward&rsquo;s Ledger unlocks them. If your group uses them, see page 28.", "gold")}`, "round"));

// 10 Your turn
P.push(page("5 · Your turn", "The four Actions", `
  <p class="lead">On your turn, take up to 4 Actions. You may repeat an Action as often as each use is legal. Unused Actions are lost when your turn ends.</p>
  <div class="actions">
    <div><b>Place</b>Put an available Tile on a legal, reachable empty hex and pay its cost.</div>
    <div><b>Upgrade</b>Pay the upgraded cost and flip a reachable basic Core Tile.</div>
    <div><b>Activate</b>Use a reachable, non-Overstrained Tile&rsquo;s Activated Effect, such as Production.</div>
    <div><b>Interact</b>Complete an active Arrival, or resolve an active Burden.</div>
  </div>
  <div class="cols2">
    <div>
      <h3>Place a Tile</h3>
      ${steps([
        "Choose an available Tile.",
        "Choose an empty, reachable hex.",
        "Check terrain, adjacency and the Tile&rsquo;s printed placement rule.",
        "Pay its cost from the Warehouse. An unlocked Special Tile costs nothing to place.",
        "Place the Tile, resolve any placement effect and move your meeple onto it.",
      ], 1, "5.")}
      <p class="small">Do not place a Tile on River/Water unless its own rule allows or requires it, as the Bridge&rsquo;s does.</p>
    </div>
    <div>
      <h3>Upgrade a Tile</h3>
      <p>Choose a reachable, placed basic Core Tile that is not Overstrained. Pay the cost printed for its upgraded side and flip the same Tile in place. Its upgraded name, effect and scores now apply. Upgraded, Special, Golden and Overstrained Tiles cannot be upgraded.</p>
      ${steps([
        "Choose a reachable basic Core Tile that is not Overstrained.",
        "Spend 1 Action and pay the upgrade cost.",
        "Flip the Tile, resolve any effect the upgrade creates and move your meeple onto it.",
      ], 6, "5.")}
    </div>
  </div>
  ${fig("fig-first", [["ring", "N6"]], "<b>First placement.</b> The Sentinel starts on Mountains, so its first Action places a Mine Tunnel on the hex under the meeple. From then on, the meeple moves with every Place, Upgrade and Activate.", "side narrow")}
  ${note("Free effects", "Face-up Boons and Steward Powers cost no Action unless their text says otherwise. A benefit that costs 0 Actions saves only the Action: still pay the resource cost unless the effect also changes it.")}`, "turn"));

// 11 Activate, Interact, meeple movement
P.push(page("5 · Your turn", "Activate, Interact and your meeple", `
  <div class="cols2">
    <div>
      <h3>Activate a Tile</h3>
      <p>Spend 1 Action to use a reachable, non-Overstrained Tile&rsquo;s Activated Effect, and pay any cost printed with it. A Tile may be activated more than once when each use is legal. Passive effects never need the Activate Action. If it is Production, apply Linked Production when it is allowed (page 12). Then move your meeple onto the Tile.</p>
    </div>
    <div>
      <h3>Interact with an Encounter</h3>
      <p><b>Arrival.</b> Choose an active Arrival, meet and pay its Requirements and spend 1 Action. Remove its timers, discard it, and set the matching Special Tile beside the board (page 16).</p>
      <p><b>Burden.</b> Choose an active Burden, spend 1 Action and carry out its current-Season resolution, including any payment. Discard it. Strain it has already placed stays.</p>
      <p class="small">If another effect resolves a Burden, follow that effect&rsquo;s own cost and timing instead. Interact does not move your meeple.</p>
    </div>
  </div>
  <h3>Your meeple marks where you reach from</h3>
  <p>Place, Upgrade and Activate move your meeple onto the Tile you chose, and your next reach is measured from there. Interact does not move it.</p>
  ${fig("fig-movement", [["badge", "B6", "1", -0.55, -0.55], ["badge", "C6", "2", -0.55, -0.55], ["badge", "D6", "3", -0.55, -0.55], ["badge", "B6", "4", 0.15, 0.55], ["arrow", "B6", "C6"], ["arrow", "C6", "D6"]], "The Knight&rsquo;s first turn. <b>1</b> Place a Farmstead under the meeple on Arable Land (the first placement). <b>2</b> Place a Cabin beside it; the meeple moves to the Cabin. <b>3</b> Place a Cottage beside the Cabin, which it needs. <b>4</b> Activate the Farmstead for Food; the meeple moves back to it.")}`, "turn2"));

// 12 Production
P.push(page("6 · Production and the Warehouse", "Production", `
  <p class="lead">Production is an Activated Effect on Resource Tiles. Spend an Activate Action, then add the Tile&rsquo;s printed resources to the Warehouse, up to its limit.</p>
  <h3>Linked Production</h3>
  <p>The first time each round you activate a Resource Tile, check it and every <b>immediately adjacent</b> copy from the same Tile stack. If none of them has produced this round, the chosen Tile and all its immediately adjacent, non-Overstrained copies produce for that one Activate Action, each using its current side.</p>
  <p>Linked Production never continues outward through a chain: only copies touching the chosen Tile join in. Mark every Tile that produced as having taken part this round. If the chosen Tile or an adjacent copy has already taken part, only the chosen Tile produces. A separate group of copies elsewhere may still use Linked Production. Everything refreshes at the start of the next round.</p>
  ${fig("fig-linked", [["ring", "A1"], ["ring", "B1"], ["ring", "C1"], ["badge", "B1", "5", -0.05, 0.62], ["badge", "A1", "5", -0.05, 0.62], ["badge", "C1", "5", -0.05, 0.62]], "Three upgraded Mine Shafts on the Mountains. The Sentinel activates the middle one: it and both copies touching it produce 5 each, 15 in all, for one Action. Activating any of them again this round produces only 5, from the Tile chosen.")}
  ${note("Example", "Had the Sentinel activated the left Mine Shaft, only it and the middle one would touch, so 10 would be produced. The right one, which does not touch the left one, could still produce later that round, alone.")}
  <h3>The Warehouse</h3>
  <p>All resources are shared and kept on the Logistics board: pieces above the stitch are in the Warehouse, spares sit below. Each resource holds at most 15 unless an effect changes the limit. Any gain beyond the limit is lost. Resources never go below zero.</p>`, "prod"));

// 13 Reading a Tile
const tileCall = (n, x, y) => `<span class="tc" style="left:${x}%;top:${y}%">${n}</span>`;
P.push(page("7 · Reading a Tile", "Reading a Tile", `
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
  <p>Read a number beside a symbol as that amount. Two costs separated by &ldquo;or&rdquo; mean pay either one. Once per round and once per Season refresh when the next round or Season starts. Special Tiles have a coloured margin and a numbered back. Golden Tiles have a gold frame and print their placement rule in the effect box.</p>`, "anatomy"));

// 14 Placing Tiles
P.push(page("8 · Placing Tiles", "Terrain, placement and adjacency", `
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
P.push(page("8 · Placing Tiles", "Reach, rivers and Bridges", `
  <h3>Reachability</h3>
  <p>A Tile or empty hex is reachable when you can reach it from your meeple through the shared settlement network, or when a card, Tile or Steward rule says it is reachable. The network is every placed, non-Overstrained Tile joined side to side. Every Steward uses the same network, and an empty hex is reachable when it is next to a Tile you can reach.</p>
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
P.push(page("9 · Special Tiles", "Unlocking and placing Special Tiles", `
  <p class="lead">Completing an Arrival unlocks the Special Tile whose back number matches its reward. Unlocking does not place it. Later, any player may place it with a normal Place Action for no resources, following its printed placement rule.</p>
  <div class="match">
    <figure>${cardImg("card-arrival-blade-to-herb.webp")}${caption("Blade to Herb unlocks Special Tile 23")}</figure>
    <figure class="hexes">${tileImg("special-back-23", "mid")}${tileImg("special_the_root_weavers_respite", "mid")}${caption("The back numbered 23, and its front: The Root Weavers Respite")}</figure>
    ${fig("fig-special", [["ring", "M4"]], "Placed later on a reachable Heaths hex.", "small")}
  </div>
  <h3>Special Tiles on their terrain</h3>
  <p>These Special Tiles go on the listed terrain. They need no adjacent Resource Tile. Their effects still apply exactly as written, and any other printed requirement still uses side-sharing adjacency.</p>
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
P.push(page("10 · Encounter Cards", "Encounter Cards at a glance", `
  <p class="lead">Read every Encounter from top to bottom. The title and the italic story text set the scene; the rules are in the sections below them. A specific card rule overrides a general rule only for the situation it names.</p>
  <div class="enc4 grid2">
    <figure>${cardImg("card-boon-a-little-time.webp")}<figcaption><b>Boon</b>Use the row for the current Season. The italic line under it says whether the card is used at once, stays face up, has limited uses or ends with the Season.</figcaption></figure>
    <figure>${cardImg("card-burden-old-wounds.webp")}<figcaption><b>Burden</b>Apply the current row when it is revealed and leave the card active. Its italic line gives the Action and payment that resolve and discard it.</figcaption></figure>
    <figure>${cardImg("card-arrival-quiet-quest.webp")}<figcaption><b>Arrival</b>Put a bronze timer in each of the three circles. Meet its Requirements with an Interact Action to unlock the Special Tile named in its Reward.</figcaption></figure>
    <figure>${cardImg("card-golden-scroll.webp")}<figcaption><b>Golden Boon</b>No Season rows and no timers. Resolve it free when revealed; it does not count towards the cards revealed each round.</figcaption></figure>
  </div>
  ${note("Current Season", "Use row I in Foundations (Rounds 1 to 4), II in Growth (Rounds 5 to 8) and III in Maturity (Rounds 9 to 12).")}
  <p class="small">The story text is narrative only. The italic line inside a Boon or Burden row is a rule, and so is the italic line at the foot of a Golden Boon.</p>`, "enc"));

// 18 Boons and Burdens
P.push(page("10 · Encounter Cards", "Boons and Burdens", `
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
P.push(page("10 · Encounter Cards", "Arrivals", `
  <div class="side-card">
    ${cardImg("card-arrival-quiet-quest.webp")}
    <div>
      <p class="lead">Arrivals are timed goals that unlock Special Tiles. When one is revealed, put it in play with a bronze timer in each of its 3 circles.</p>
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
P.push(page("11 · Strain and Supported", "Strain and Supported", `
  <div class="cols2">
    <div>
      <h3>Strain</h3>
      <p>Strain is shown with black wooden tokens on the Tile. A Tile holds at most 3 Strain. At 1 or 2 Strain it works normally unless a rule says otherwise. If an effect would add Strain to a Tile already at 3, add nothing.</p>
      ${note("Partial resolution", "If the full amount or number of targets is not available, place as much Strain as possible on as many eligible Tiles as possible. &ldquo;If none&rdquo; means no legal target exists; it never lets you choose zero while a legal target remains.")}
    </div>
    <div>
      <h3>Supported</h3>
      <p>A bronze token on a Tile shows Supported. Supported stops 1 Strain before you check whether the Tile becomes Overstrained. A Tile either has Supported or does not: it never stacks.</p>
      <p><b>Passive Supported</b> lasts while its source&rsquo;s condition holds and stops the first Strain on that Tile each round. Common Land gives it to 1 adjacent Housing Tile; The Pleasance to up to 3. Choose them when the effect starts and keep them until the eligible Tiles change or the source becomes Overstrained. You cannot move it in answer to incoming Strain.</p>
      <p><b>Single-use Supported</b>, from placement, activation or another effect, stops 1 Strain and is then removed.</p>
    </div>
  </div>
  ${fig("fig-strain", [["badge", "G5", "0", 0.55, -0.45], ["badge", "I6", "1", 0.55, -0.45], ["badge", "H6", "2", 0.55, -0.45], ["badge", "G6", "3", 0.55, -0.45, "red"], ["arrow", "H7", "H6", 0.62]], "The Eatery has no Strain, the Cottage 1 and the Cabin 2. The Common Land gives the Cabin passive Supported (the bronze token), so the next Strain that reaches it this round is stopped. The Path holds 3 Strain and is Overstrained.", "side")}
  <p class="small">The Golden Garden and every other prevention apply at the same step as Supported. Prevented Strain is not placed, moved elsewhere or able to start a spread.</p>`, "strain"));

// 21 Overstrained and chains
P.push(page("12 · Overstrain chains", "Overstrained Tiles and chains", `
  <p class="lead">A Tile becomes Overstrained when it goes from fewer than 3 Strain to 3. Leave it on the map. It cannot be activated or upgraded, gives no passive effects, does not join the network, scores no Population or Renown and meets no positive requirement. As soon as it drops below 3 it works again. Reaching 3 again later is a new Overstrain.</p>
  <h3>Resolving a chain</h3>
  ${steps([
    "Finish the original effect, including every printed Strain and Strain Cascade.",
    "Find every Tile that went from fewer than 3 Strain to 3.",
    "If there are several, choose the order in which they spread.",
    "For each spread, draw a fresh Target Card. The eligible Tiles are the placed Tiles adjacent to the spreading Tile with fewer than 3 Strain.",
    "Put 1 Strain on the chosen Tile, after Supported and any other prevention.",
    "If that Tile becomes Overstrained, it spreads too. Carry on until no new spread remains.",
  ], 1, "12.")}
  <div class="cols2 figs">
    ${fig("fig-chain-a", [["ring", "I3", "red"], ["badge", "I3", "+1", -0.6, -0.6, "red"]], "Before: the Cottage and the Path beside it both hold 2 Strain. An effect adds 1 Strain to the Cottage.")}
    ${fig("fig-chain-b", [["arrow", "I3", "J3", 0.45, "red"], ["arrow", "J3", "J4", 0.45, "red"], ["badge", "I3", "1", 0.4, -0.75, "red"], ["badge", "J3", "2", 0.4, -0.75, "red"]], "After: the Cottage reaches 3. Its spread draws a Target Card, which picks the Path (1). The Path reaches 3 and spreads in the same chain; its card picks the Apothecary (2).")}
  </div>
  <p class="small">A Tile already at 3 does not spread just because another effect targets it. A printed Strain Cascade belongs to the effect that caused it: resolve every printed placement and Cascade before starting any chain they create. There is no automatic spread at the end of a Season.</p>`, "chain"));

// 22 Target deck
P.push(page("13 · The Target Deck", "Choosing where Strain lands", `
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
P.push(page("13 · The Target Deck", "A Target Card at work", `
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

// 24 Stewards
P.push(page("14 · Stewards", "The six Stewards", `
  <p class="lead">Each Steward has a Starting Terrain, a Power used once per Season and an Objective worth +15 Renown at final scoring. A Power costs no Action unless it says so, needs no Tile, and refreshes at the start of each Season. Your Steward Guide has the full wording.</p>
  <div class="stewards">${stewards.map((s, i) => `<div class="st"><img src="${A(`meeple-${s.id}.webp`)}" alt=""><div><h4>${esc(s.name)} <span>${["I", "II", "III", "IV", "V", "VI"][i]}</span></h4><p class="terr">${s.startingTerrains.length > 1 ? "Any terrain but Grasslands and River/Water" : terrainName[s.startingTerrains[0]]}</p><p><b>Power.</b> ${esc(s.powerText)}</p><p><b>Objective.</b> ${esc(s.objectiveText)}</p></div></div>`).join("")}</div>
  <p class="small">Only non-Overstrained Tiles count towards Objectives unless a rule says otherwise.</p>`, "stewardsp"));

// 25 End of a Season
P.push(page("15 · End of a Season", "End of a Season", `
  <p class="lead">After Rounds 4 and 8, work through these steps in order before the next Season begins.</p>
  ${table(["Step", "After Rounds 4 and 8"], [
    ["1", "Finish every Arrival that ran out of timers."],
    ["2", "Discard unused face-up Boons whose time ends with the Season."],
    ["3", "Neighbourly Support (below)."],
    ["4", "Apply every unresolved Burden again, using the new Season row."],
    ["5", "Refresh every Steward Power."],
    ["6", "Seed the Encounter deck for the next Season (page 8)."],
  ], "season")}
  <h3>Neighbourly Support</h3>
  <p>Each Housing cluster gains 1 single-use Supported for every complete group of 3 non-Overstrained Housing Tiles in it. Put each one on a different eligible Housing Tile in that cluster. Ignore Overstrained Tiles when tracing a cluster and counting its size.</p>
  ${fig("fig-neighbourly", [["ring", "H2"], ["ring", "I2"], ["ring", "J2"], ["ring", "H3"], ["ring", "I3"], ["ring", "J3"]], "A cluster of six Housing Tiles: two complete groups of 3, so it gains 2 Supported, placed on two different Tiles.")}
  ${note("No automatic spread", "Nothing spreads at the end of a Season. A chain starts only when a Tile newly reaches 3 Strain.")}`, "seasonend"));

// 26 Final scoring
P.push(page("16 · Final scoring", "Final scoring", `
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
  ${note("Final score", "Add Population and every Renown bonus, then take away every penalty. Record the score, then file the Quest Card (page 27).")}
  <h3>Scoring example</h3>
  <div class="example">
    <p>Your group has 80 Population and 25 Renown from Tiles and effects. Two Steward Objectives are met (+30), the Quest Card is complete (+20) and one Golden Tile&rsquo;s condition is met (+5). That is 160 before penalties.</p>
    <p>One active Burden (&minus;10), two failed Arrivals (&minus;20) and three Strain on the map (&minus;30) bring the shared final score to <b>100</b>.</p>
  </div>
  <p class="small">Unlocked Special Tiles that were never placed do not score. Overstrained Tiles neither score nor meet positive Objectives unless a rule says so.</p>
  ${fig("fig-finale", [], "By the end of play the settlement is not just a score. It is a record of the group&rsquo;s choices: here 19 Tiles, four Strain still on the map and one Supported Cottage.", "side")}`, "scoring"));

// 27 Quest Cards
P.push(page("17 · Quest Cards and the Steward&rsquo;s Ledger", "Quest Cards", `
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
  <p class="small">Quest Cards look only at the map: tile shapes and placements, never the score. The card on page 5 is Quest Card 7, The Workings.</p>
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
P.push(page("18 · Golden content", "Golden content", `
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

// 29 Quick reference
P.push(page("19 · Quick reference", "Quick reference", `
  <h3>The round</h3>
  <div class="qr3"><div><span>1</span>Reveal and resolve Encounters</div><div><span>2</span>Choose the order; each player takes one turn of up to 4 Actions</div><div><span>3</span>Remove Arrival timers, resolve failures, tidy up, move the Round marker</div></div>
  <h3>Four Actions</h3>
  <div class="actions small4"><div><b>Place</b>A legal Tile</div><div><b>Upgrade</b>Flip a reachable basic Core Tile</div><div><b>Activate</b>A reachable Activated Effect</div><div><b>Interact</b>Complete an Arrival or resolve a Burden</div></div>
  <h3>Placing Strain</h3>
  <div class="qr4"><div><b>Select</b>Find the eligible Tiles, then draw a Target Card</div><div><b>Prevent</b>Supported and other prevention first</div><div><b>Check</b>At 3 Strain the Tile is Overstrained</div><div><b>Chain</b>After the effect, each newly Overstrained Tile spreads 1 Strain</div></div>
  <h3>Season transition, after Rounds 4 and 8</h3>
  <ol class="mini"><li>Finish Arrival failures.</li><li>Discard Boons that end with the Season.</li><li>Neighbourly Support: 1 Supported per 3 Housing Tiles in a cluster.</li><li>Apply every Burden again with the new row.</li><li>Refresh every Steward Power.</li><li>Seed the Encounter deck.</li></ol>
  <h3>Costs and limits</h3>
  ${table(["Rule", "Remember"], [
    ["Warehouse", "At most 15 of each. Start with 15, 10, 5, 0 or 0 of each for 1 to 5 players. Never below zero."],
    ["Special Tile", "Once unlocked: 1 Place Action, its placement rule, no resources."],
    ["0 Actions", "Only the Action is free. Pay the resource cost unless the effect changes it."],
    ["Steward meeple", "Place, Upgrade and Activate move it. Interact does not."],
    ["Arrival", "Starts with 3 timers, never more. Remove 1 from each at the end of every round."],
    ["Target Card", "Start from the eligible Tiles, work down the rows, then return the card face down to the bottom."],
    ["Quest Card", "Either half complete: +20 Renown, once."],
  ], "qrt")}
  <div class="scoregrid"><div class="plus"><b>Add</b>Population and Renown on non-Overstrained Tiles, +15 each Steward Objective met, +20 Quest Card, +5 each Golden condition met</div><div class="minus"><b>Take away 10</b>for each active Burden, each failed Arrival and each Strain on the map</div></div>`, "qr"));

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
  ["Overstrain chain", "The spreads caused by newly Overstrained Tiles after the original effect."],
  ["Overstrained", "A Tile at 3 Strain. It does nothing positive until it drops below 3."],
  ["Passive Effect", "A Tile effect that works without an Action while its condition holds."],
  ["Pending effect", "A mandatory choice, payment, placement, Strain, chain or other instruction already started but not finished."],
  ["Quest Card", "This game&rsquo;s shared challenge. Complete either half for +20 Renown."],
  ["Reachable", "A Tile or empty hex your meeple can reach through the network or by a specific rule."],
  ["Round", "Reveal Encounters, one turn per player, then the end of the round."],
  ["Season", "Four rounds: Foundations (1 to 4), Growth (5 to 8) or Maturity (9 to 12)."],
  ["Special Tile", "A Tile unlocked by an Arrival and placed later with a Place Action for no resources."],
  ["Steward&rsquo;s Ledger", "Your group&rsquo;s pile of completed Quest Cards. It unlocks the Golden pairs."],
  ["Strain Cascade", "Card-specific Strain placements resolved inside the original effect."],
  ["Supported", "A bronze token that stops 1 Strain. Passive or single-use; never stacks."],
  ["Vow", "A Quest Card half whose rule must hold all game."],
  ["Warehouse", "The shared supply of resources, normally at most 15 of each."],
  ["River/Water", "The map&rsquo;s water. It blocks connection unless a Bridge or another rule allows the crossing."],
];
gloss.sort((a, b) => a[0].replace("&rsquo;", "'").localeCompare(b[0].replace("&rsquo;", "'")));
const glossDl = (rows) => `<dl class="gloss">${rows.map(([t, d]) => `<dt>${t}</dt><dd>${d}</dd>`).join("")}</dl>`;
const GSPLIT = 22;
P.push(page("20 · Glossary", "Glossary", glossDl(gloss.slice(0, GSPLIT)), "glossary"));

// 31 Index
const where = [["Arrivals", 19], ["Boons and Burdens", 18], ["Components", 4], ["End of a Season", 25], ["Final scoring", 26], ["First placement", 7], ["Four Actions", 10], ["Golden content", 28], ["Linked Production", 12], ["Neighbourly Support", 25], ["Overstrain chains", 21], ["Quest Cards", 27], ["Reachability", 15], ["Reading a Tile", 13], ["Rivers and Bridges", 15], ["Round sequence", 9], ["Seeding", 8], ["Setup", 6], ["Shelter in the Ruins", 14], ["Special Tile numbers", 16], ["Steward meeple movement", 11], ["Stewards", 24], ["Strain and Supported", 20], ["Target Cards", 22], ["Warehouse", 12]];
P.push(page("20 · Glossary", "Glossary, continued", `
  ${glossDl(gloss.slice(GSPLIT))}
  <h3>Where to look</h3>
  <div class="index">${where.map(([t, n]) => `<div><span>${t}</span><span class="dots"></span><span>${n}</span></div>`).join("")}</div>
  ${story("After the rain, one wall bowed and a path washed thin. Before either failed, neighbours arrived with braces, stone and dry timber. Nothing grand was done that day. The settlement held because ordinary repairs were made in time.")}
  ${note("Credits and edition", "The Quiet Vale: Seasons of Settlement. Rulebook v6.9, review edition, November 2026. It pairs with the v6.9 Steward Guides and replaces the v6.8 review rulebook. The v6.6 locked rules remain the approved record until this edition is approved.")}`, "indexp"));

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
const pdf = path.join(outDir, "The_Quiet_Vale_Main_Rulebook_v6_9.pdf");
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
p.docinfo["/Title"] = "The Quiet Vale - Main Rulebook (v6.9 review edition)"
p.save(sys.argv[1])
print(len(p.pages), "pages")
`, pdf], { stdio: "inherit" });
console.log(JSON.stringify({ overflow: report, slackMm: slack }));
