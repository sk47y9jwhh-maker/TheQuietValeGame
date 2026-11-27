#!/usr/bin/env node
/**
 * Generates Tabletop Simulator (TTS) Save/Mod JSON files for The Quiet Vale v7.0:
 *   - public/tts/The_Quiet_Vale_v7_0.json         (GitHub Pages HTTPS URLs)
 *   - output/tts/The_Quiet_Vale_v7_0_local.json   (Local file:// URLs for instant testing)
 *
 * Usage:
 *   node tools/tts/build-tts-mod.mjs [--base-url <url>]
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const require = createRequire(path.join(root, "package.json"));
const ts = require("typescript");

function loadTs(relPath) {
  const full = path.join(root, relPath);
  const src = fs.readFileSync(full, "utf8");
  const mod = { exports: {} };
  const localRequire = (spec) => {
    if (spec.endsWith(".webp") || spec.endsWith(".png") || spec.endsWith(".jpg")) return spec;
    if (spec.startsWith(".")) {
      const base = path.resolve(path.dirname(full), spec);
      if (spec.endsWith(".json") && fs.existsSync(base)) {
        const parsed = JSON.parse(fs.readFileSync(base, "utf8"));
        return { default: parsed, ...parsed };
      }
      if (fs.existsSync(base + ".ts")) return loadTs(path.relative(root, base + ".ts"));
      if (fs.existsSync(base + ".json")) {
        const parsed = JSON.parse(fs.readFileSync(base + ".json", "utf8"));
        return { default: parsed, ...parsed };
      }
    }
    return require(spec);
  };
  const out = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  new Function("exports", "module", "require", out)(mod.exports, mod, localRequire);
  return mod.exports;
}

const { mapCells, mapLayout, mapArtworkLayers } = loadTs("src/data/map.ts");
const { targetCards, describeTargetCard } = loadTs("src/data/targetCards.ts");
const { boons, burdens, arrivals, goldenBoons } = loadTs("src/data/encounters.ts");
const { questCards } = loadTs("src/data/questCards.ts");
const { stewards } = loadTs("src/data/stewards.ts");
const { coreTiles, specialTiles, goldenTiles } = loadTs("src/data/tiles.ts");
const { specialTileBackNumbers } = loadTs("src/data/specialTileNumbers.ts");

const warehouseCounterLua = fs.readFileSync(path.join(here, "lua/warehouse_counter.lua"), "utf8");
const globalLuaTemplate = fs.readFileSync(path.join(here, "lua/global.lua"), "utf8");

// ---------------------------------------------------------------------------
// Exact physical-to-TTS scale: 1 mm = 0.04 TTS units
// ---------------------------------------------------------------------------
const MM = 0.04;
const BOARD_Y = 1.04;

// Board dimensions in mm (from design/boards-v4/build_leather_boards.py)
const MAP_BOARD_MM = { w: 698.5, h: 568.5 };
const LONG_BOARD_MM = { w: 568.5, h: 146.0 };
const TILES_BOARD_MM = { w: 284.25, h: 232.83 };

// World centers for the 4 boards — matches Rulebook v7.0 fig-setup-alt.jpg:
// Map Board on the left; Encounter, Logistics, and Tiles Boards stacked flush on the right.
// Map spans x in [-25.97, +1.97], z in [-11.37, +11.37]
// Right column starts at x = 2.97 (1.0 unit gap), width 22.74 -> center x = 14.34
const POS = {
  mapBoard: [-12.0, BOARD_Y, 0.0],
  encounterBoard: [14.34, BOARD_Y, 8.45],
  logisticsBoard: [14.34, BOARD_Y, 1.65],
  tilesBoard: [8.655, BOARD_Y, -6.715]
};

// Convert board-local mm (origin = top-left of trimmed board, +x right, +y down)
// to TTS world (x, z) when board is centered at [bx, y, bz] with rotY = 180.
function boardMmToWorld(boardPos, boardMm, xMm, yMm) {
  const wx = boardPos[0] + (xMm - boardMm.w / 2) * MM;
  const wz = boardPos[2] + (boardMm.h / 2 - yMm) * MM;
  return [Number(wx.toFixed(4)), Number(wz.toFixed(4))];
}

// Compute all 126 exact flat-top hex snap points on the Map Board
// Matches design/a1-board-unified/generate_unified_a1_board.py + src/data/map.ts
function computeMapHexSnapPoints() {
  const frame = mapArtworkLayers[0].frame; // x: -19.6663, y: -7.7617, w: 714.1339, h: 545.4286
  const srcW = 3200, srcH = 2444;
  const crop = [124, 88, 3072, 2360];
  const mapWidthMm = ((crop[2] - crop[0]) / srcW) * frame.width;
  const cropLeftSvg = frame.x + (crop[0] / srcW) * frame.width;
  const cropTopSvg = frame.y + (crop[1] / srcH) * frame.height;
  const mapLeftMm = (MAP_BOARD_MM.w - mapWidthMm) / 2.0;
  const mapTopMm = 18.0;

  const r = mapLayout.hexRadius; // 30
  const hh = mapLayout.hexHeight; // sqrt(3)*30

  return mapCells.map((cell) => {
    const colIdx = cell.col.charCodeAt(0) - 65;
    const svgX = r + colIdx * r * 1.5 + mapLayout.originX;
    const svgY = hh / 2 + (cell.row - 1) * hh + (colIdx % 2 ? hh / 2 : 0) + mapLayout.originY;
    const xMm = mapLeftMm + (svgX - cropLeftSvg);
    const yMm = mapTopMm + (svgY - cropTopSvg);
    const [wx, wz] = boardMmToWorld(POS.mapBoard, MAP_BOARD_MM, xMm, yMm);
    return {
      id: cell.id,
      terrain: cell.terrain,
      Position: { x: wx, y: 1.06, z: wz },
      Rotation: { x: 0, y: 180, z: 0 },
      RotationSnap: true
    };
  });
}

// Compute the 12 Round Tracker sockets along the bottom of 01-map-board-v4
function computeRoundSockets() {
  const frame = mapArtworkLayers[0].frame;
  const mapHeightMm = ((2360 - 88) / 2444) * frame.height;
  const mapBottomMm = 18.0 + mapHeightMm;
  const tTop = mapBottomMm + 5.0 + 4.0;
  const tBot = MAP_BOARD_MM.h - 5.0;
  const cy = (tTop + tBot) / 2;
  const sockets = [];
  const centres = [MAP_BOARD_MM.w / 6, MAP_BOARD_MM.w / 2, (MAP_BOARD_MM.w * 5) / 6];
  for (let s = 0; s < 3; s++) {
    const left = centres[s] - 100;
    for (let k = 0; k < 4; k++) {
      const sx = left + 64 + k * 34.5;
      const [wx, wz] = boardMmToWorld(POS.mapBoard, MAP_BOARD_MM, sx, cy);
      sockets.push([wx, 1.06, wz]);
    }
  }
  return sockets;
}

// Deterministic 6-hex GUID generator
let guidCounter = 0x100000;
function nextGuid() {
  guidCounter += 1;
  return guidCounter.toString(16).padStart(6, "0");
}

function makeTransform(pos, rot = [0, 180, 0], scale = [1, 1, 1]) {
  return {
    posX: Number(pos[0].toFixed(4)),
    posY: Number(pos[1].toFixed(4)),
    posZ: Number(pos[2].toFixed(4)),
    rotX: rot[0],
    rotY: rot[1],
    rotZ: rot[2],
    scaleX: Number(scale[0].toFixed(4)),
    scaleY: Number(scale[1].toFixed(4)),
    scaleZ: Number(scale[2].toFixed(4))
  };
}

function makeCustomTile({
  guid = nextGuid(),
  name,
  description = "",
  pos,
  rot = [0, 180, 0],
  scale = [1, 1, 1],
  imageUrl,
  secondaryUrl = "",
  type = 0, // 0=Box, 1=Hex, 2=Circle
  thickness = 0.1,
  stackable = false,
  stretch = false,
  locked = false,
  luaScript = "",
  colorDiffuse = { r: 1, g: 1, b: 1 }
}) {
  return {
    GUID: guid,
    Name: "Custom_Tile",
    Transform: makeTransform(pos, rot, scale),
    Nickname: name,
    Description: description,
    GMNotes: "",
    ColorDiffuse: colorDiffuse,
    LayoutGroupSortIndex: 0,
    Value: 0,
    Locked: locked,
    Grid: false,
    Snap: true,
    IgnoreFoW: false,
    MeasureMovement: false,
    DragSelectable: true,
    Autoraise: true,
    Sticky: true,
    Tooltip: true,
    GridProjection: false,
    HideWhenFaceDown: false,
    Hands: false,
    CustomImage: {
      ImageURL: imageUrl,
      ImageSecondaryURL: secondaryUrl || imageUrl,
      ImageScalar: 1.0,
      WidthScale: 0.0,
      CustomTile: {
        Type: type,
        Thickness: thickness,
        Stackable: stackable,
        Stretch: stretch
      }
    },
    LuaScript: luaScript,
    LuaScriptState: "",
    XmlUI: ""
  };
}

function makeDeck({
  guid = nextGuid(),
  name,
  deckIdNum,
  faceUrl,
  backUrl,
  numWidth,
  numHeight,
  cards, // array of { nickname, description }
  pos,
  rot = [0, 180, 180], // face down by default
  scale = [1.15, 1.0, 1.15]
}) {
  const deckKey = String(deckIdNum);
  const customDeck = {
    [deckKey]: {
      FaceURL: faceUrl,
      BackURL: backUrl,
      NumWidth: numWidth,
      NumHeight: numHeight,
      BackIsHidden: true,
      UniqueBack: false,
      Type: 0
    }
  };

  const deckIds = [];
  const contained = cards.map((c, idx) => {
    const cardId = deckIdNum * 100 + idx;
    deckIds.push(cardId);
    return {
      GUID: nextGuid(),
      Name: "Card",
      Transform: makeTransform(pos, rot, scale),
      Nickname: c.nickname,
      Description: c.description || "",
      GMNotes: "",
      ColorDiffuse: { r: 0.7132, g: 0.7132, b: 0.7132 },
      Locked: false,
      Grid: false,
      Snap: true,
      Autoraise: true,
      Sticky: true,
      Tooltip: true,
      HideWhenFaceDown: true,
      Hands: true,
      CardID: cardId,
      SidewaysCard: false,
      CustomDeck: customDeck,
      LuaScript: "",
      LuaScriptState: "",
      XmlUI: ""
    };
  });

  return {
    GUID: guid,
    Name: "Deck",
    Transform: makeTransform(pos, rot, scale),
    Nickname: name,
    Description: "",
    GMNotes: "",
    ColorDiffuse: { r: 0.7132, g: 0.7132, b: 0.7132 },
    Locked: false,
    Grid: false,
    Snap: true,
    Autoraise: true,
    Sticky: true,
    Tooltip: true,
    HideWhenFaceDown: true,
    Hands: false,
    SidewaysCard: false,
    DeckIDs: deckIds,
    CustomDeck: customDeck,
    ContainedObjects: contained,
    LuaScript: "",
    LuaScriptState: "",
    XmlUI: ""
  };
}

function makeBag({ guid = nextGuid(), name, description = "", pos, color, infinite = false, contained = [] }) {
  return {
    GUID: guid,
    Name: infinite ? "Infinite_Bag" : "Bag",
    Transform: makeTransform(pos, [0, 180, 0], [0.75, 0.75, 0.75]),
    Nickname: name,
    Description: description,
    GMNotes: "",
    ColorDiffuse: color,
    Locked: true,
    Grid: false,
    Snap: true,
    Autoraise: true,
    Sticky: true,
    Tooltip: true,
    HideWhenFaceDown: false,
    Hands: false,
    MaterialIndex: -1,
    MeshIndex: -1,
    Bag: { Order: 0 },
    ContainedObjects: contained,
    LuaScript: "",
    LuaScriptState: "",
    XmlUI: ""
  };
}

function makePlaque({ guid = nextGuid(), name, pos, scale = [3.6, 0.25, 2.2], color = { r: 0.14, g: 0.12, b: 0.10 } }) {
  return {
    GUID: guid,
    Name: "BlockSquare",
    Transform: makeTransform(pos, [0, 180, 0], scale),
    Nickname: name,
    Description: "",
    GMNotes: "",
    ColorDiffuse: color,
    Locked: true,
    Grid: false,
    Snap: false,
    Autoraise: false,
    Sticky: false,
    Tooltip: true,
    Hands: false,
    LuaScript: "",
    LuaScriptState: "",
    XmlUI: ""
  };
}

function makePawn({ guid = nextGuid(), name, description, pos, color }) {
  return {
    GUID: guid,
    Name: "PlayerPawn",
    Transform: makeTransform(pos, [0, 180, 0], [1.05, 1.05, 1.05]),
    Nickname: name,
    Description: description,
    GMNotes: "",
    ColorDiffuse: color,
    Locked: false,
    Grid: false,
    Snap: true,
    Autoraise: true,
    Sticky: true,
    Tooltip: true,
    Hands: false,
    LuaScript: "",
    LuaScriptState: "",
    XmlUI: ""
  };
}

function makePdf({ guid = nextGuid(), name, pdfUrl, pos }) {
  return {
    GUID: guid,
    Name: "Custom_PDF",
    Transform: makeTransform(pos, [0, 180, 0], [2.4, 1.0, 2.4]),
    Nickname: name,
    Description: "Official 36-page Rulebook v7.0 (1–5 Players).",
    GMNotes: "",
    ColorDiffuse: { r: 1, g: 1, b: 1 },
    Locked: false,
    Grid: false,
    Snap: true,
    Autoraise: true,
    Sticky: true,
    Tooltip: true,
    Hands: false,
    CustomPDF: {
      PDFUrl: pdfUrl,
      PDFPassword: "",
      PDFPage: 0,
      PDFPageOffset: 0
    },
    LuaScript: "",
    LuaScriptState: "",
    XmlUI: ""
  };
}

function makeHandZone(color, pos, rotY = 0) {
  return {
    GUID: nextGuid(),
    Name: "HandTrigger",
    Transform: makeTransform(pos, [0, rotY, 0], [9.5, 4.0, 4.2]),
    Nickname: "",
    Description: "",
    GMNotes: "",
    ColorDiffuse: { r: 1, g: 1, b: 1, a: 0 },
    Locked: true,
    Grid: false,
    Snap: false,
    Autoraise: false,
    Sticky: false,
    Tooltip: false,
    Hands: false,
    FogColor: color,
    LuaScript: "",
    LuaScriptState: "",
    XmlUI: ""
  };
}

// Convert JS object to Lua table literal for embedding CONFIG in global.lua
function toLua(val, indent = "") {
  if (val === null || val === undefined) return "nil";
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (typeof val === "string") return JSON.stringify(val);
  if (Array.isArray(val)) {
    const items = val.map((v) => toLua(v, indent + "  "));
    return `{ ${items.join(", ")} }`;
  }
  const entries = Object.entries(val).map(
    ([k, v]) => `${indent}  ${/^[A-Za-z_][A-Za-z0-9_]*$/.test(k) ? k : `[${JSON.stringify(k)}]`} = ${toLua(v, indent + "  ")}`
  );
  return `{\n${entries.join(",\n")}\n${indent}}`;
}

// ---------------------------------------------------------------------------
// Build full TTS Save JSON for a given base URL
// ---------------------------------------------------------------------------
export function buildTtsSave({ assetBaseUrl, pdfUrl }) {
  guidCounter = 0x100000;
  const asset = (rel) => `${assetBaseUrl.replace(/\/$/, "")}/${rel}`;

  const hexSnaps = computeMapHexSnapPoints();
  const roundSockets = computeRoundSockets();
  const objects = [];

  // 1. Four Leather-and-Brass Boards (locked, exact physical aspect ratios via stretch: true)
  objects.push(
    makeCustomTile({
      name: "The Quiet Vale — Map Board",
      description: "14x9 flat-top hex map with 3-Season / 12-Round tracker.",
      pos: POS.mapBoard,
      scale: [(MAP_BOARD_MM.w * MM) / 2, 1.0, (MAP_BOARD_MM.h * MM) / 2],
      imageUrl: asset("boards/map-board.jpg"),
      type: 0,
      thickness: 0.14,
      stretch: true,
      locked: true
    }),
    makeCustomTile({
      name: "Encounter Board",
      description: "Encounter draw well, In Play tray, and Discard well.",
      pos: POS.encounterBoard,
      scale: [(LONG_BOARD_MM.w * MM) / 2, 1.0, (LONG_BOARD_MM.h * MM) / 2],
      imageUrl: asset("boards/encounter-board.jpg"),
      type: 0,
      thickness: 0.14,
      stretch: true,
      locked: true
    }),
    makeCustomTile({
      name: "Logistics & Warehouse Board",
      description: "15-card Target Deck well, 6-resource Warehouse (cap 15), and Token tray.",
      pos: POS.logisticsBoard,
      scale: [(LONG_BOARD_MM.w * MM) / 2, 1.0, (LONG_BOARD_MM.h * MM) / 2],
      imageUrl: asset("boards/logistics-board.jpg"),
      type: 0,
      thickness: 0.14,
      stretch: true,
      locked: true
    }),
    makeCustomTile({
      name: "Tiles & Quest Board",
      description: "Quest Card well, Unlocked Special Tiles tray, and 5 Core Tile bays.",
      pos: POS.tilesBoard,
      scale: [(TILES_BOARD_MM.w * MM) / 2, 1.0, (TILES_BOARD_MM.h * MM) / 2],
      imageUrl: asset("boards/tiles-board.jpg"),
      type: 0,
      thickness: 0.14,
      stretch: true,
      locked: true
    })
  );

  // 2. Encounter Board wells & Reserve Encounter Decks (90 cards total) — neatly above Encounter Board
  const [encDrawX, encDrawZ] = boardMmToWorld(POS.encounterBoard, LONG_BOARD_MM, 6 + 40, 73);
  const [encDiscX, encDiscZ] = boardMmToWorld(POS.encounterBoard, LONG_BOARD_MM, LONG_BOARD_MM.w - 6 - 40, 73);

  const boonsGuid = nextGuid();
  const burdensGuid = nextGuid();
  const arrivalsGuid = nextGuid();
  const goldenBoonsGuid = nextGuid();

  const tarotScale = [1.26, 1.0, 1.52];
  objects.push(
    makeDeck({
      guid: boonsGuid,
      name: "Boons Reserve (30)",
      deckIdNum: 1,
      faceUrl: asset("decks/boons-deck.jpg"),
      backUrl: asset("decks/encounter-back.jpg"),
      numWidth: 6,
      numHeight: 5,
      cards: boons.map((c) => ({ nickname: c.name, description: `Boon — ${c.effects?.season1 || ""}` })),
      pos: [6.8, 1.35, 14.6],
      rot: [0, 180, 180],
      scale: tarotScale
    }),
    makeDeck({
      guid: burdensGuid,
      name: "Burdens Reserve (30)",
      deckIdNum: 2,
      faceUrl: asset("decks/burdens-deck.jpg"),
      backUrl: asset("decks/encounter-back.jpg"),
      numWidth: 6,
      numHeight: 5,
      cards: burdens.map((c) => ({ nickname: c.name, description: `Burden — ${c.effects?.season1 || ""}` })),
      pos: [11.8, 1.35, 14.6],
      rot: [0, 180, 180],
      scale: tarotScale
    }),
    makeDeck({
      guid: arrivalsGuid,
      name: "Arrivals Reserve (25)",
      deckIdNum: 3,
      faceUrl: asset("decks/arrivals-deck.jpg"),
      backUrl: asset("decks/encounter-back.jpg"),
      numWidth: 5,
      numHeight: 5,
      cards: arrivals.map((c) => ({
        nickname: c.name,
        description: `Arrival — Req: ${c.requirementText || ""} | Reward: ${c.rewardText || ""}`
      })),
      pos: [16.8, 1.35, 14.6],
      rot: [0, 180, 180],
      scale: tarotScale
    }),
    makeDeck({
      guid: goldenBoonsGuid,
      name: "Golden Boons (5)",
      deckIdNum: 4,
      faceUrl: asset("decks/golden-boons-deck.jpg"),
      backUrl: asset("decks/encounter-back.jpg"),
      numWidth: 5,
      numHeight: 2,
      cards: goldenBoons.map((c) => ({ nickname: c.name, description: c.effectText || "Golden Boon" })),
      pos: [21.8, 1.35, 14.6],
      rot: [0, 180, 180],
      scale: tarotScale
    })
  );

  // 3. Logistics Board: 15-card Target Deck + 6 Clickable Warehouse Counters + Token Bags
  const [targetX, targetZ] = boardMmToWorld(POS.logisticsBoard, LONG_BOARD_MM, 6 + 40, 73);
  const targetDeckGuid = nextGuid();
  objects.push(
    makeDeck({
      guid: targetDeckGuid,
      name: "Target Deck (15)",
      deckIdNum: 5,
      faceUrl: asset("decks/target-deck.jpg"),
      backUrl: asset("decks/target-back.jpg"),
      numWidth: 5,
      numHeight: 3,
      cards: targetCards.map((c) => {
        const d = describeTargetCard(c);
        return {
          nickname: c.direction ? `Target Card ${String(c.id).padStart(2, "0")} (${c.direction})` : `Target Card ${c.id} (Open)`,
          description: `1. Tile: ${d.tile} | 2. Strain: ${d.strain}${c.direction ? ` | Tie: ${c.direction}` : " | Players choose any eligible tile"}`
        };
      }),
      pos: [targetX, 1.25, targetZ],
      rot: [0, 180, 180],
      scale: [1.14, 1.0, 1.14]
    })
  );

  // 6 Warehouse Counters matching build_leather_boards.py column order:
  // STONE, METAL, GOODS, WOOD, FOOD, HERBS
  const whOrder = [
    ["Stone", "tokens/res-stone.png"],
    ["Metal", "tokens/res-metal.png"],
    ["Goods", "tokens/res-goods.png"],
    ["Wood", "tokens/res-wood.png"],
    ["Food", "tokens/res-food.png"],
    ["Herbs", "tokens/res-herbs.png"]
  ];
  const cl = 6 + 80 + 7;
  const cr = LONG_BOARD_MM.w - cl;
  const innerL = cl + 4;
  const innerR = cr - 4;
  const colW = (innerR - innerL) / 6;
  const warehouseCounterGuids = [];
  whOrder.forEach(([label, iconRel], i) => {
    const cxMm = innerL + colW * (i + 0.5);
    const [wx, wz] = boardMmToWorld(POS.logisticsBoard, LONG_BOARD_MM, cxMm, LONG_BOARD_MM.h / 2);
    const guid = nextGuid();
    warehouseCounterGuids.push(guid);
    objects.push(
      makeCustomTile({
        guid,
        name: label,
        description: `Warehouse ${label} tracker (cap 15). Left-click +1, right-click -1.`,
        pos: [wx, 1.12, wz],
        scale: [0.92, 1.0, 0.92],
        imageUrl: asset(iconRel),
        type: 2,
        thickness: 0.12,
        locked: true,
        luaScript: warehouseCounterLua
      })
    );
  });

  // Infinite Token Bags on the right side of the Logistics Board (TOKENS well)
  const tokWellX = LONG_BOARD_MM.w - 6 - 40;
  const tokenBagSpecs = [
    ["Strain Tokens", "Place on tiles for Strain. 2 Strain = Overstrained.", "tokens/strain.png", { r: 0.16, g: 0.15, b: 0.15 }, -20, -24, 0.42],
    ["Supported Shields", "Single-use bronze shield: prevents the next 1 Strain on this tile.", "tokens/supported.png", { r: 0.72, g: 0.54, b: 0.24 }, 20, -24, 0.44],
    ["Cooldown X", "Marks a tile activated this round. Cleared by End Round button.", "tokens/cooldown-x.png", { r: 0.48, g: 0.24, b: 0.22 }, -20, 24, 0.40],
    ["Arrival Timers", "Place 3 timers on a revealed Arrival; remove 1 each round.", "tokens/arrival-timer.png", { r: 0.24, g: 0.36, b: 0.44 }, 20, 24, 0.38]
  ];
  for (const [bagName, desc, imgRel, col, dxMm, dyMm, tokScale] of tokenBagSpecs) {
    const [bx, bz] = boardMmToWorld(POS.logisticsBoard, LONG_BOARD_MM, tokWellX + dxMm, 73 + dyMm);
    const tokenItem = makeCustomTile({
      name: bagName === "Cooldown X" ? "Cooldown X" : bagName.replace(/s$/, ""),
      description: desc,
      pos: [bx, 1.2, bz],
      scale: [tokScale, 1.0, tokScale],
      imageUrl: asset(imgRel),
      type: 2,
      thickness: 0.12,
      stackable: true
    });
    objects.push(
      makeBag({
        name: bagName,
        description: desc,
        pos: [bx, 1.08, bz],
        color: col,
        infinite: true,
        contained: [tokenItem]
      })
    );
  }

  // 4. Tiles Board: Quest Deck (21) + Core Tile Stacks (21 types + Travel Extensions)
  const [questDeckX, questDeckZ] = boardMmToWorld(POS.tilesBoard, TILES_BOARD_MM, 46, 52);
  const [activeQuestX, activeQuestZ] = boardMmToWorld(POS.tilesBoard, TILES_BOARD_MM, 118, 52);
  const [unlockedSpecX, unlockedSpecZ] = boardMmToWorld(POS.tilesBoard, TILES_BOARD_MM, TILES_BOARD_MM.w - 52, 52);

  const questDeckGuid = nextGuid();
  objects.push(
    makeDeck({
      guid: questDeckGuid,
      name: "Quest Deck (21)",
      deckIdNum: 6,
      faceUrl: asset("decks/quest-deck.jpg"),
      backUrl: asset("decks/quest-back.jpg"),
      numWidth: 7,
      numHeight: 3,
      cards: questCards.map((q) => ({
        nickname: `Quest #${q.n}: ${q.theme}`,
        description: `Top (${q.top.kind}): ${q.top.name} — ${q.top.text}\nBottom (${q.bottom.kind}): ${q.bottom.name} — ${q.bottom.text}`
      })),
      pos: [questDeckX, 1.25, questDeckZ],
      rot: [0, 180, 180],
      scale: [1.14, 1.0, 1.14]
    })
  );

  // Hex tile scale: 60mm * 0.04 = 2.40 point-to-point -> scaleX = scaleZ = 1.20
  const HEX_SCALE = [(60 * MM) / 2, 1.0, (60 * MM) / 2];

  // Organize Core Tiles into the 5 bays along the lower portion of Tiles Board
  // Bays: 0=resource, 1=merchant+crafting, 2=social+wellbeing, 3=housing, 4=travel
  const bayForCategory = {
    resource: 0,
    merchant: 1,
    crafting: 1,
    social: 2,
    wellbeing: 2,
    housing: 3,
    travel: 4
  };
  const bayBuckets = [[], [], [], [], []];
  for (const t of coreTiles) {
    bayBuckets[bayForCategory[t.category] ?? 0].push(t);
  }
  const tileInnerL = 10;
  const tileInnerR = TILES_BOARD_MM.w - 10;
  const bayW = (tileInnerR - tileInnerL) / 5;

  bayBuckets.forEach((bucket, bayIdx) => {
    const bxMm = tileInnerL + bayW * (bayIdx + 0.5);
    bucket.forEach((tile, slotIdx) => {
      // Arrange neatly in 1-2 sub-rows inside the bay (and overflow cleanly just right of board if needed)
      const yMm = 118 + slotIdx * 24;
      const [wx, wz] = boardMmToWorld(POS.tilesBoard, TILES_BOARD_MM, bxMm, Math.min(yMm, 212));
      for (let c = 0; c < tile.count; c++) {
        objects.push(
          makeCustomTile({
            name: `${tile.basic.name} / ${tile.upgraded.name}`,
            description: `Basic: ${tile.basic.effectText}\nUpgraded: ${tile.upgraded.effectText}`,
            pos: [wx, 1.12 + c * 0.13, wz],
            scale: HEX_SCALE,
            imageUrl: asset(`tiles/${tile.id}-basic.jpg`),
            secondaryUrl: asset(`tiles/${tile.id}-upgraded.jpg`),
            type: 1,
            thickness: 0.12,
            stackable: true
          })
        );
      }
    });
  });

  // Travel Extension hex tiles bag (for size-2/size-3 travel tiles)
  const extCount = coreTiles.reduce((sum, t) => sum + t.count * ((t.size || 1) - 1), 0);
  const extItems = Array.from({ length: extCount }, () =>
    makeCustomTile({
      name: "Travel Extension",
      description: "Multi-hex extension for Path, Street, Track, Road, or Bridge (Basic / Upgraded).",
      pos: [16.4, 1.3, -9.8],
      scale: HEX_SCALE,
      imageUrl: asset("tiles/travel-extension-basic.jpg"),
      secondaryUrl: asset("tiles/travel-extension-upgraded.jpg"),
      type: 1,
      thickness: 0.12,
      stackable: true
    })
  );
  objects.push(
    makeBag({
      name: `Travel Extensions (${extCount})`,
      description: "Double-sided Travel Extension hexes (Basic / Upgraded).",
      pos: [16.4, 1.15, -9.8],
      color: { r: 0.45, g: 0.42, b: 0.34 },
      contained: extItems
    })
  );

  // 5. Special Tiles Reserve Bag (26 numbered tiles #1-#26) & Golden Tiles Bag (5)
  const specialBagGuid = nextGuid();
  const specialContained = [];
  for (const t of specialTiles) {
    const nums = specialTileBackNumbers[t.id] || [];
    for (const num of nums) {
      const copies = t.footprint === "detached" ? (t.size || 1) : 1;
      for (let c = 0; c < copies; c++) {
        specialContained.push(
          makeCustomTile({
            name: `#${num} ${t.name}`,
            description: `Special Tile #${num} (0 Actions to place once unlocked). ${t.effectText || ""}`,
            pos: [19.4, 1.3, -9.8],
            scale: HEX_SCALE,
            imageUrl: asset(`tiles/${t.id}.jpg`),
            secondaryUrl: asset(`tiles/special-back-${num}.jpg`),
            type: 1,
            thickness: 0.12,
            stackable: false
          })
        );
      }
    }
  }
  objects.push(
    makeBag({
      guid: specialBagGuid,
      name: "Special Tiles Reserve (#1–#26)",
      description: "All 26 numbered Special Tiles. Use the Unlock Special Tile plaque to pull #N onto the Tiles Board.",
      pos: [19.4, 1.15, -9.8],
      color: { r: 0.20, g: 0.24, b: 0.32 },
      contained: specialContained
    })
  );

  const goldenContained = goldenTiles.map((t, i) =>
    makeCustomTile({
      name: t.name,
      description: `Golden Legacy Tile #${i + 1}. ${t.effectText || ""}\nScoring: ${t.scoringText || ""}`,
      pos: [22.4, 1.3, -9.8],
      scale: HEX_SCALE,
      imageUrl: asset(`tiles/${t.id}.jpg`),
      secondaryUrl: asset("tiles/golden-back.jpg"),
      type: 1,
      thickness: 0.12,
      stackable: false
    })
  );
  objects.push(
    makeBag({
      name: "Golden Tiles Reserve (5)",
      description: "5 Golden Legacy hex tiles.",
      pos: [22.4, 1.15, -9.8],
      color: { r: 0.76, g: 0.60, b: 0.22 },
      contained: goldenContained
    })
  );

  // 6. Round Marker & Player 1 Marker
  const roundMarkerGuid = nextGuid();
  const player1MarkerGuid = nextGuid();
  const seatMarkerPositions = [
    [-20.0, 1.25, -18.6], // Seat 1 (White)
    [-8.0, 1.25, -18.6],  // Seat 2 (Red)
    [4.0, 1.25, -18.6],   // Seat 3 (Blue)
    [16.0, 1.25, -18.6],  // Seat 4 (Green)
    [-12.0, 1.25, 14.6]   // Seat 5 (Yellow)
  ];
  objects.push(
    makeCustomTile({
      guid: roundMarkerGuid,
      name: "Round Marker",
      description: "Tracks Rounds 1–12 across Seasons I, II, and III.",
      pos: [roundSockets[0][0], 1.25, roundSockets[0][2]],
      scale: [0.34, 1.0, 0.34],
      imageUrl: asset("tokens/round-marker.png"),
      type: 2,
      thickness: 0.16
    }),
    makeCustomTile({
      guid: player1MarkerGuid,
      name: "Player 1 Marker",
      description: "Rotates clockwise each round to the next player.",
      pos: seatMarkerPositions[0],
      scale: [0.58, 1.0, 0.58],
      imageUrl: asset("tokens/player-1.png"),
      type: 2,
      thickness: 0.18
    })
  );

  // 7. 6 Steward Reference Mats (3:2 landscape via stretch: true) + 6 Matching Meeples/Pawns
  const stewardColors = {
    vanguard: { r: 0.31, g: 0.48, b: 0.32 },
    knight: { r: 0.64, g: 0.37, b: 0.24 },
    sentinel: { r: 0.37, g: 0.44, b: 0.49 },
    ranger: { r: 0.46, g: 0.33, b: 0.54 },
    warden: { r: 0.55, g: 0.24, b: 0.28 },
    quartermaster: { r: 0.61, g: 0.49, b: 0.20 }
  };
  stewards.forEach((s, idx) => {
    const sx = -22.5 + idx * 7.8;
    const sz = -15.2;
    objects.push(
      makeCustomTile({
        name: `Steward: ${s.name}`,
        description: `Start: ${s.startingTerrains.join(", ")}\nPower: ${s.powerText}\nObjective (+${s.objectiveRenown}): ${s.objectiveText}`,
        pos: [sx, 1.18, sz],
        scale: [3.4, 1.0, 2.27],
        imageUrl: asset(`stewards/steward-${s.id}.jpg`),
        secondaryUrl: asset("stewards/steward-back.jpg"),
        type: 0,
        thickness: 0.1,
        stretch: true
      }),
      makePawn({
        name: `${s.name} Meeple`,
        description: `Place on starting terrain (${s.startingTerrains.join(", ")}).`,
        pos: [sx, 1.5, sz + 1.5],
        color: stewardColors[s.id]
      })
    );
  });

  // 8. Control Plaques + Rulebook v7.0 PDF (neatly filling bottom-right quadrant beside Tiles Board)
  const controlPlaqueGuid = nextGuid();
  const unlockPlaqueGuid = nextGuid();
  objects.push(
    makePlaque({
      guid: controlPlaqueGuid,
      name: "Game Setup & Round Control",
      pos: [17.6, 1.12, -4.4],
      scale: [5.4, 0.24, 3.6]
    }),
    makePlaque({
      guid: unlockPlaqueGuid,
      name: "Special Tile Unlock Helper",
      pos: [17.6, 1.12, -7.5],
      scale: [5.0, 0.24, 2.2]
    }),
    makePdf({
      name: "The Quiet Vale — Rulebook v7.0 (36 pages)",
      pdfUrl,
      pos: [23.6, 1.25, -5.6]
    })
  );

  // 9. Five Player Hand Zones (White, Red, Blue, Green, Yellow)
  objects.push(
    makeHandZone("White", [-20.0, 3.0, -21.8], 0),
    makeHandZone("Red", [-8.0, 3.0, -21.8], 0),
    makeHandZone("Blue", [4.0, 3.0, -21.8], 0),
    makeHandZone("Green", [16.0, 3.0, -21.8], 0),
    makeHandZone("Yellow", [-12.0, 3.0, 18.2], 180)
  );

  // 10. World Snap Points (126 Map Hexes + 12 Round Sockets + Card Wells)
  const snapPoints = [
    ...hexSnaps.map(({ Position, Rotation, RotationSnap }) => ({ Position, Rotation, RotationSnap })),
    ...roundSockets.map(([x, y, z]) => ({ Position: { x, y, z } })),
    { Position: { x: encDrawX, y: 1.08, z: encDrawZ }, Rotation: { x: 0, y: 180, z: 0 }, RotationSnap: true },
    { Position: { x: encDiscX, y: 1.08, z: encDiscZ }, Rotation: { x: 0, y: 180, z: 0 }, RotationSnap: true },
    { Position: { x: targetX, y: 1.08, z: targetZ }, Rotation: { x: 0, y: 180, z: 0 }, RotationSnap: true },
    { Position: { x: questDeckX, y: 1.08, z: questDeckZ }, Rotation: { x: 0, y: 180, z: 0 }, RotationSnap: true },
    { Position: { x: activeQuestX, y: 1.08, z: activeQuestZ }, Rotation: { x: 0, y: 180, z: 0 }, RotationSnap: true }
  ];

  // 11. Inject exact GUIDs & coordinates into global.lua
  const luaConfig = {
    guids: {
      controlPlaque: controlPlaqueGuid,
      unlockPlaque: unlockPlaqueGuid,
      warehouseCounters: warehouseCounterGuids,
      targetDeck: targetDeckGuid,
      questDeck: questDeckGuid,
      boonsDeck: boonsGuid,
      burdensDeck: burdensGuid,
      arrivalsDeck: arrivalsGuid,
      goldenBoonsDeck: goldenBoonsGuid,
      specialBag: specialBagGuid,
      roundMarker: roundMarkerGuid,
      player1Marker: player1MarkerGuid
    },
    positions: {
      encounterDraw: [encDrawX, 1.25, encDrawZ],
      activeQuest: [activeQuestX, 1.35, activeQuestZ],
      unlockedSpecial: [unlockedSpecX, 1.25, unlockedSpecZ],
      roundSockets,
      seatMarkers: seatMarkerPositions
    },
    mapBounds: {
      minX: Number((POS.mapBoard[0] - MAP_BOARD_MM.w * MM * 0.5).toFixed(3)),
      maxX: Number((POS.mapBoard[0] + MAP_BOARD_MM.w * MM * 0.5).toFixed(3)),
      minZ: Number((POS.mapBoard[2] - MAP_BOARD_MM.h * MM * 0.5).toFixed(3)),
      maxZ: Number((POS.mapBoard[2] + MAP_BOARD_MM.h * MM * 0.5).toFixed(3))
    }
  };

  const globalLua = globalLuaTemplate.replace("__QV_TTS_CONFIG__", toLua(luaConfig));

  return {
    SaveName: "The Quiet Vale: Seasons of Settlement (v7.0)",
    GameMode: "The Quiet Vale v7.0",
    Date: new Date().toISOString().slice(0, 10),
    VersionNumber: "v13.2.2",
    GameType: "Game",
    GameComplexity: "Medium Complexity",
    PlayingTime: [45, 90],
    PlayerCounts: [1, 5],
    Tags: ["Board Games", "Cooperative", "Hex Grid", "Resource Management"],
    Gravity: 0.5,
    PlayArea: 0.5,
    Table: "Table_RPG",
    Sky: "Sky_Museum",
    Note: "The Quiet Vale: Seasons of Settlement (v7.0). Click 1P–5P on the left Control Plaque to auto-setup Warehouse, Encounters, Target Deck, and Quest Card.",
    Rules: "",
    LuaScript: globalLua,
    LuaScriptState: "",
    XmlUI: "",
    TabStates: {},
    Grid: {
      Type: 0,
      Lines: false,
      Color: { r: 0, g: 0, b: 0 },
      Opacity: 0.0,
      ThickLines: false,
      Snapping: false,
      Offset: false,
      BothSnapping: false,
      xSize: 2.4,
      ySize: 2.4,
      PosOffset: { x: 0, y: 1, z: 0 }
    },
    Hands: {
      Enable: true,
      DisableUnused: false,
      Hiding: 0
    },
    SnapPoints: snapPoints,
    ObjectStates: objects
  };
}

// CLI execution
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const pagesBase = "https://thequietvalegame.com";
  const customBaseIdx = process.argv.indexOf("--base-url");
  const hostedAssetBase =
    customBaseIdx !== -1 && process.argv[customBaseIdx + 1]
      ? process.argv[customBaseIdx + 1]
      : `${pagesBase}/tts`;
  const hostedPdfUrl = `${pagesBase}/rulebook/The-Quiet-Vale-Rulebook.pdf`;

  // 1. Hosted GitHub Pages save JSON -> public/tts/The_Quiet_Vale_v7_0.json
  const hostedSave = buildTtsSave({ assetBaseUrl: hostedAssetBase, pdfUrl: hostedPdfUrl });
  const hostedPath = path.join(root, "public/tts/The_Quiet_Vale_v7_0.json");
  fs.mkdirSync(path.dirname(hostedPath), { recursive: true });
  fs.writeFileSync(hostedPath, JSON.stringify(hostedSave, null, 2));

  // 2. Local file:// test save JSON -> output/tts/The_Quiet_Vale_v7_0_local.json
  const localAssetBase = pathToFileURL(path.join(root, "public/tts")).href;
  const localPdfUrl = pathToFileURL(path.join(root, "public/rulebook/The-Quiet-Vale-Rulebook.pdf")).href;
  const localSave = buildTtsSave({ assetBaseUrl: localAssetBase, pdfUrl: localPdfUrl });
  const localPath = path.join(root, "output/tts/The_Quiet_Vale_v7_0_local.json");
  fs.mkdirSync(path.dirname(localPath), { recursive: true });
  fs.writeFileSync(localPath, JSON.stringify(localSave, null, 2));

  console.log(`Wrote hosted TTS save: ${hostedPath} (${hostedSave.ObjectStates.length} root objects, ${hostedSave.SnapPoints.length} snap points)`);
  console.log(`Wrote local TTS save:  ${localPath}`);
}
