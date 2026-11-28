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
const { arrivalRequirementRules, burdenResolutionResources } = loadTs("src/data/contentRules.ts");

const warehouseCounterLua = fs.readFileSync(path.join(here, "lua/warehouse_counter.lua"), "utf8");
const globalLuaTemplate = fs.readFileSync(path.join(here, "lua/global.lua"), "utf8");
const hudXml = fs.readFileSync(path.join(here, "lua/hud.xml"), "utf8");

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
  gmNotes = "",
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
    GMNotes: gmNotes,
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
      GMNotes: c.gmNotes || "",
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

function makeTileBox({ guid = nextGuid(), name, description = "", pos, color = { r: 1, g: 1, b: 1 }, meshUrl, diffuseUrl = "", scale = [1.0, 1.0, 1.0], contained = [] }) {
  return {
    GUID: guid,
    Name: "Custom_Model_Bag",
    Transform: makeTransform(pos, [0, 180, 0], scale),
    Nickname: name,
    Description: description,
    GMNotes: "",
    ColorDiffuse: diffuseUrl ? { r: 1, g: 1, b: 1 } : color,
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
    CustomMesh: {
      MeshURL: meshUrl,
      DiffuseURL: diffuseUrl,
      NormalURL: "",
      ColliderURL: "",
      Convex: true,
      MaterialIndex: 1, // Wood
      TypeIndex: 6,     // Bag container
      CastShadows: true
    },
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

function makePawn({ guid = nextGuid(), name, description, pos, color, meshUrl }) {
  return {
    GUID: guid,
    Name: "Custom_Model",
    Transform: makeTransform(pos, [0, 180, 0], [1.0, 1.0, 1.0]),
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
    CustomMesh: {
      MeshURL: meshUrl,
      DiffuseURL: "",
      NormalURL: "",
      ColliderURL: "",
      Convex: true,
      MaterialIndex: 1, // Wood
      TypeIndex: 1,     // Figurine (stays upright!)
      CastShadows: true
    },
    LuaScript: "",
    LuaScriptState: "",
    XmlUI: ""
  };
}

function make3dToken({ guid = nextGuid(), name, description = "", pos, scale = [0.4, 1.0, 0.4], color, meshUrl, materialIndex = 1 }) {
  return {
    GUID: guid,
    Name: "Custom_Model",
    Transform: makeTransform(pos, [0, 180, 0], scale),
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
    CustomMesh: {
      MeshURL: meshUrl,
      DiffuseURL: "",
      NormalURL: "",
      ColliderURL: "",
      Convex: true,
      MaterialIndex: materialIndex, // 1 = Wood, 2 = Metal
      TypeIndex: 0,                 // Generic token
      CastShadows: true
    },
    LuaScript: "",
    LuaScriptState: "",
    XmlUI: ""
  };
}

function makePdf({
  guid = nextGuid(),
  name,
  description = "Official 36-page Rulebook v7.0 (1–5 Players).",
  pdfUrl,
  pos,
  rot = [0, 180, 0],
  scale = [2.25, 1.0, 2.25]
}) {
  return {
    GUID: guid,
    Name: "Custom_PDF",
    Transform: makeTransform(pos, rot, scale),
    Nickname: name,
    Description: description,
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
    Transform: makeTransform(pos, [0, rotY, 0], [13.5, 4.2, 5.0]),
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

  // 1. Four Leather-and-Brass Boards (locked)
  // In TTS Custom_Tile Type 0 with Stretch: true, world height = 2*scaleZ and
  // world width = 2*scaleX*(imgW/imgH), so scaleX = scaleZ = H_world/2 gives exact 1:1 physical proportions!
  objects.push(
    makeCustomTile({
      name: "The Quiet Vale — Map Board",
      description: "14x9 flat-top hex map with 3-Season / 12-Round tracker.",
      pos: POS.mapBoard,
      scale: [(MAP_BOARD_MM.h * MM) / 2, 1.0, (MAP_BOARD_MM.h * MM) / 2],
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
      scale: [(LONG_BOARD_MM.h * MM) / 2, 1.0, (LONG_BOARD_MM.h * MM) / 2],
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
      scale: [(LONG_BOARD_MM.h * MM) / 2, 1.0, (LONG_BOARD_MM.h * MM) / 2],
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
      scale: [(TILES_BOARD_MM.h * MM) / 2, 1.0, (TILES_BOARD_MM.h * MM) / 2],
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

  const tarotScale = [1.46, 1.0, 1.50];
  // Unused Encounter Reserve Decks neatly parked on the far right of the large Custom Table
  objects.push(
    makeDeck({
      guid: boonsGuid,
      name: "Boons Reserve (30)",
      deckIdNum: 1,
      faceUrl: asset("decks/boons-deck.jpg"),
      backUrl: asset("decks/encounter-back.jpg"),
      numWidth: 6,
      numHeight: 5,
      cards: boons.map((c) => ({ nickname: c.name, description: `Boon — ${c.effects?.season1 || ""}`, gmNotes: c.id })),
      pos: [33.0, 1.35, 8.8],
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
      cards: burdens.map((c) => ({ nickname: c.name, description: `Burden — ${c.effects?.season1 || ""}`, gmNotes: c.id })),
      pos: [38.5, 1.35, 8.8],
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
        description: `Arrival — Req: ${c.requirementText || ""} | Reward: ${c.rewardText || ""}`,
        gmNotes: c.id
      })),
      pos: [33.0, 1.35, 2.2],
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
      cards: goldenBoons.map((c) => ({ nickname: c.name, description: c.effectText || "Golden Boon", gmNotes: c.id })),
      pos: [38.5, 1.35, 2.2],
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
    // Seated below the colored stitch line (73mm) and above the debossed icon (125mm),
    // leaving the entire upper tray (26mm..68mm) open for the 5x3 grid of 15 wooden discs!
    const [wx, wz] = boardMmToWorld(POS.logisticsBoard, LONG_BOARD_MM, cxMm, 94);
    const guid = nextGuid();
    warehouseCounterGuids.push(guid);
    objects.push(
      makeCustomTile({
        guid,
        name: label,
        description: `Warehouse ${label} tracker (cap 15). Left-click +1, right-click -1.`,
        pos: [wx, 1.12, wz],
        scale: [0.68, 1.0, 0.68],
        imageUrl: asset(iconRel),
        type: 2,
        thickness: 0.12,
        locked: true,
        luaScript: warehouseCounterLua
      })
    );
  });

  // Infinite Token Bags on the right side of the Logistics Board (TOKENS well)
  // Real game components: Black wooden Strain discs, Bronze metal Supported shields, Natural wooden X tokens, Round bronze metal Arrival discs
  const tokWellX = LONG_BOARD_MM.w - 6 - 40;
  let strainBagGuid = "";
  let supportedBagGuid = "";
  let cooldownXBagGuid = "";
  let arrivalTimerBagGuid = "";
  const tokenBagSpecs = [
    ["Strain Tokens", "Black wooden disc: place on tiles for Strain (3 Strain = Overstrained).", "models/token-disc.obj", { r: 0.12, g: 0.11, b: 0.11 }, 1, -20, -24, 0.42],
    ["Supported Shields", "Bronze metal shield: prevents the next 1 Strain on this tile, then removed.", "models/token-shield.obj", { r: 0.80, g: 0.58, b: 0.26 }, 2, 20, -24, 0.46],
    ["Cooldown X", "Natural wooden X: marks a once-per-round tile or Linked Production used this round.", "models/token-x.obj", { r: 0.76, g: 0.62, b: 0.42 }, 1, -20, 24, 0.44],
    ["Arrival Timers", "Round bronze metal disc: place 3 on a revealed Arrival; remove 1 each round.", "models/token-disc.obj", { r: 0.76, g: 0.52, b: 0.24 }, 2, 20, 24, 0.30]
  ];
  for (const [bagName, desc, meshRel, col, matIdx, dxMm, dyMm, tokScale] of tokenBagSpecs) {
    const [bx, bz] = boardMmToWorld(POS.logisticsBoard, LONG_BOARD_MM, tokWellX + dxMm, 73 + dyMm);
    const bagGuid = nextGuid();
    if (bagName === "Strain Tokens") strainBagGuid = bagGuid;
    if (bagName === "Supported Shields") supportedBagGuid = bagGuid;
    if (bagName === "Cooldown X") cooldownXBagGuid = bagGuid;
    if (bagName === "Arrival Timers") arrivalTimerBagGuid = bagGuid;
    const tokenItem = make3dToken({
      name: bagName === "Cooldown X" ? "Cooldown X" : bagName.replace(/s$/, ""),
      description: desc,
      pos: [bx, 1.2, bz],
      scale: [tokScale, 1.0, tokScale],
      color: col,
      meshUrl: asset(meshRel),
      materialIndex: matIdx
    });
    objects.push(
      makeBag({
        guid: bagGuid,
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
      rot: [0, 90, 180],
      scale: [1.14, 1.0, 1.14]
    })
  );

  // Hex tile scale: 60mm * 0.04 = 2.40 point-to-point -> scaleX = scaleZ = 1.20
  const HEX_SCALE = [(60 * MM) / 2, 1.0, (60 * MM) / 2];

  // Organize Core Tiles into 5 clean category bags along the 5 bays of the Tiles Board
  // (avoids 21 overlapping stacks colliding on spawn while keeping every category one click away,
  // and keeps the top Quest + Unlocked Special Tiles areas completely clear!)
  const bayNames = [
    ["Resource Core Tiles", { r: 0.31, g: 0.41, b: 0.28 }, "models/tray-resource.jpg"],
    ["Merchant & Crafting Tiles", { r: 0.54, g: 0.43, b: 0.17 }, "models/tray-merchant.jpg"],
    ["Social & Wellbeing Tiles", { r: 0.48, g: 0.31, b: 0.42 }, "models/tray-social.jpg"],
    ["Housing Core Tiles", { r: 0.60, g: 0.36, b: 0.24 }, "models/tray-housing.jpg"],
    ["Travel Core Tiles", { r: 0.48, g: 0.44, b: 0.35 }, "models/tray-travel.jpg"]
  ];
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

  const coreCatalog = [];
  bayBuckets.forEach((bucket, bayIdx) => {
    const bxMm = tileInnerL + bayW * (bayIdx + 0.5);
    const [wx, wz] = boardMmToWorld(POS.tilesBoard, TILES_BOARD_MM, bxMm, 162);
    const [bagTitle, bagColor, bagDiffuse] = bayNames[bayIdx];
    const bagGuid = nextGuid();
    const contained = [];
    for (const tile of bucket) {
      coreCatalog.push({ name: tile.basic.name, bagGuid });
      for (let c = 0; c < tile.count; c++) {
        contained.push(
          makeCustomTile({
            name: `${tile.basic.name} / ${tile.upgraded.name}`,
            description: `Basic: ${tile.basic.effectText}\nUpgraded: ${tile.upgraded.effectText}`,
            gmNotes: tile.id,
            pos: [wx, 1.3 + c * 0.13, wz],
            scale: HEX_SCALE,
            imageUrl: asset(`tiles/${tile.id}-basic.jpg`),
            secondaryUrl: asset(`tiles/${tile.id}-upgraded.jpg`),
            type: 1,
            thickness: 0.12,
            stackable: true
          })
        );
      }
    }
    objects.push(
      makeTileBox({
        guid: bagGuid,
        name: `${bagTitle} (${contained.length})`,
        description: bucket.map((t) => `${t.basic.name} (×${t.count})`).join(", "),
        pos: [wx, 1.08, wz],
        color: bagColor,
        meshUrl: asset("models/tile-rack-long-v2.obj"),
        diffuseUrl: asset(bagDiffuse),
        scale: [1.0, 0.95, 1.0],
        contained
      })
    );
  });

  // Travel Extension hex tiles bag — neatly archived along the top-left rim above the Map Board
  const extCount = coreTiles.reduce((sum, t) => sum + t.count * ((t.size || 1) - 1), 0);
  const extItems = Array.from({ length: extCount }, () =>
    makeCustomTile({
      name: "Travel Extension",
      description: "Multi-hex extension for Path, Street, Track, Road, or Bridge (Basic / Upgraded).",
      pos: [-23.0, 1.3, 14.6],
      scale: HEX_SCALE,
      imageUrl: asset("tiles/travel-extension-basic.jpg"),
      secondaryUrl: asset("tiles/travel-extension-upgraded.jpg"),
      type: 1,
      thickness: 0.12,
      stackable: true
    })
  );
  const travelExtBagGuid = nextGuid();
  objects.push(
    makeTileBox({
      guid: travelExtBagGuid,
      name: `Travel Extensions (${extCount})`,
      description: "Double-sided Travel Extension hexes (Basic / Upgraded). Use +TRAVEL EXT. in HUD to pull quickly.",
      pos: [16.4, 1.08, -3.6],
      color: { r: 0.45, g: 0.42, b: 0.34 },
      meshUrl: asset("models/tile-box-v2.obj"),
      diffuseUrl: asset("models/tray-ext.jpg"),
      scale: [1.10, 0.95, 1.10],
      contained: extItems
    })
  );

  // 5. Special Tiles Reserve Box (26 numbered tiles #1-#26) & Golden Tiles Box (5) — neatly between Tiles Board & Rulebook
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
            gmNotes: t.id,
            pos: [16.4, 1.3, -6.7],
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
    makeTileBox({
      guid: specialBagGuid,
      name: "Special Tiles Reserve (#1–#26)",
      description: "All 26 numbered Special Tiles. Unlocked automatically when Welcoming Arrivals or via HUD.",
      pos: [16.4, 1.08, -6.7],
      color: { r: 0.20, g: 0.24, b: 0.32 },
      meshUrl: asset("models/tile-box-v2.obj"),
      diffuseUrl: asset("models/tray-special.jpg"),
      scale: [1.10, 0.95, 1.10],
      contained: specialContained
    })
  );

  const goldenContained = goldenTiles.map((t, i) =>
    makeCustomTile({
      name: t.name,
      description: `Golden Legacy Tile #${i + 1}. ${t.effectText || ""}\nScoring: ${t.scoringText || ""}`,
      gmNotes: t.id,
      pos: [16.4, 1.3, -9.8],
      scale: HEX_SCALE,
      imageUrl: asset(`tiles/${t.id}.jpg`),
      secondaryUrl: asset("tiles/golden-back.jpg"),
      type: 1,
      thickness: 0.12,
      stackable: false
    })
  );
  const goldenBagGuid = nextGuid();
  objects.push(
    makeTileBox({
      guid: goldenBagGuid,
      name: "Golden Tiles Reserve (5)",
      description: "5 Golden Legacy hex tiles.",
      pos: [16.4, 1.08, -9.8],
      color: { r: 0.76, g: 0.60, b: 0.22 },
      meshUrl: asset("models/tile-box-v2.obj"),
      diffuseUrl: asset("models/tray-golden.jpg"),
      scale: [1.10, 0.95, 1.10],
      contained: goldenContained
    })
  );

  // 6. Round Marker & Player 1 Marker (aligned with the 5 Player Stations)
  const roundMarkerGuid = nextGuid();
  const player1MarkerGuid = nextGuid();
  const seatMarkerPositions = [
    [-15.0, 1.25, -18.2], // Seat 1 (White — Front Left)
    [15.0, 1.25, -18.2],  // Seat 2 (Red — Front Right)
    [15.0, 1.25, 18.2],   // Seat 3 (Blue — Back Right)
    [-15.0, 1.25, 18.2],  // Seat 4 (Green — Back Left)
    [-34.5, 1.25, 0.0]    // Seat 5 (Yellow — Left / Map End)
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
  // Exact canonical Steward meeple colours from design/rulebook-v6_9/scene.py (STEWARD_COLOURS)
  const stewardColors = {
    vanguard:      { r: 0.333, g: 0.463, b: 0.310 }, // (85, 118, 79)
    knight:        { r: 0.659, g: 0.557, b: 0.196 }, // (168, 142, 50)
    sentinel:      { r: 0.369, g: 0.510, b: 0.576 }, // (94, 130, 147)
    ranger:        { r: 0.467, g: 0.380, b: 0.518 }, // (119, 97, 132)
    warden:        { r: 0.678, g: 0.404, b: 0.239 }, // (173, 103, 61)
    quartermaster: { r: 0.651, g: 0.557, b: 0.416 }  // (166, 142, 106)
  };
  // Default Starting Terrain hex IDs matching src/engine/setup.ts
  const defaultStewardStartHex = {
    vanguard: "G1",
    knight: "A6",
    sentinel: "A1",
    ranger: "A3",
    warden: "F4",
    quartermaster: "B8"
  };
  const hexById = Object.fromEntries(hexSnaps.map((h) => [h.id, h.Position]));
  const stewardConfigs = [];
  stewards.forEach((s, idx) => {
    const sx = -13.5 + idx * 5.4;
    const sz = -14.6;
    const pawnGuid = nextGuid();
    const startHexId = defaultStewardStartHex[s.id] || "G1";
    const startHexPos = hexById[startHexId];
    stewardConfigs.push({
      id: s.id,
      name: s.name,
      powerText: s.powerText,
      pawnGuid,
      startHexId,
      startHexPos: [startHexPos.x, startHexPos.y, startHexPos.z],
      homePawnPos: [sx, 1.5, sz + 1.0]
    });
    objects.push(
      makeCustomTile({
        name: `Steward: ${s.name}`,
        description: `Start: ${s.startingTerrains.join(", ")}\nPower: ${s.powerText}\nObjective (+${s.objectiveRenown}): ${s.objectiveText}`,
        pos: [sx, 1.18, sz],
        scale: [1.50, 1.0, 1.50],
        imageUrl: asset(`stewards/steward-${s.id}.jpg`),
        secondaryUrl: asset("stewards/steward-back.jpg"),
        type: 0,
        thickness: 0.1,
        stretch: true
      }),
      makePawn({
        guid: pawnGuid,
        name: `${s.name} Meeple`,
        description: `Place on starting terrain (${s.startingTerrains.join(", ")}).`,
        pos: [sx, 1.5, sz + 1.0],
        color: stewardColors[s.id],
        meshUrl: asset("models/meeple.obj")
      })
    );
  });

  // 8. Rulebook v7.0 PDF (centered cleanly beside the Tiles Board) + 5 A6 Steward Guides (one at each player seat!)
  const stewardGuideUrl = asset("The-Quiet-Vale-A6-Steward-Guide.pdf");
  const stewardGuideDesc = "Official 20-page A6 Steward Guide (all 6 Stewards, turn reference, all 21 Core Tiles, Target/Encounter/Quest guides). Click to flip pages!";
  objects.push(
    makePdf({
      name: "The Quiet Vale — Rulebook v7.0 (36 pages)",
      pdfUrl,
      pos: [21.6, 1.25, -6.7]
    }),
    makePdf({
      name: "A6 Steward Guide (Seat 1 — White)",
      description: stewardGuideDesc,
      pdfUrl: stewardGuideUrl,
      pos: [-6.0, 1.25, -21.8],
      rot: [0, 180, 0],
      scale: [1.48, 1.0, 1.48]
    }),
    makePdf({
      name: "A6 Steward Guide (Seat 2 — Red)",
      description: stewardGuideDesc,
      pdfUrl: stewardGuideUrl,
      pos: [24.0, 1.25, -21.8],
      rot: [0, 180, 0],
      scale: [1.48, 1.0, 1.48]
    }),
    makePdf({
      name: "A6 Steward Guide (Seat 3 — Blue)",
      description: stewardGuideDesc,
      pdfUrl: stewardGuideUrl,
      pos: [6.0, 1.25, 21.8],
      rot: [0, 0, 0],
      scale: [1.48, 1.0, 1.48]
    }),
    makePdf({
      name: "A6 Steward Guide (Seat 4 — Green)",
      description: stewardGuideDesc,
      pdfUrl: stewardGuideUrl,
      pos: [-24.0, 1.25, 21.8],
      rot: [0, 0, 0],
      scale: [1.48, 1.0, 1.48]
    }),
    makePdf({
      name: "A6 Steward Guide (Seat 5 — Yellow)",
      description: stewardGuideDesc,
      pdfUrl: stewardGuideUrl,
      pos: [-38.5, 1.25, -9.2],
      rot: [0, 270, 0],
      scale: [1.48, 1.0, 1.48]
    })
  );

  // 9. Five Player Hand Zones: 2 along front (-Z, rotY=0), 2 along back (+Z, rotY=180), 1 on left/map end (-X, rotY=90)
  objects.push(
    makeHandZone("White", [-15.0, 3.2, -21.8], 0),
    makeHandZone("Red", [15.0, 3.2, -21.8], 0),
    makeHandZone("Blue", [15.0, 3.2, 21.8], 180),
    makeHandZone("Green", [-15.0, 3.2, 21.8], 180),
    makeHandZone("Yellow", [-38.5, 3.2, 0.0], 90)
  );

  // 10. World Snap Points (126 Map Hexes + 12 Round Sockets + Card Wells)
  const snapPoints = [
    ...hexSnaps.map(({ Position, Rotation, RotationSnap }) => ({ Position, Rotation, RotationSnap })),
    ...roundSockets.map(([x, y, z]) => ({ Position: { x, y, z } })),
    { Position: { x: encDrawX, y: 1.08, z: encDrawZ }, Rotation: { x: 0, y: 180, z: 0 }, RotationSnap: true },
    { Position: { x: encDiscX, y: 1.08, z: encDiscZ }, Rotation: { x: 0, y: 180, z: 0 }, RotationSnap: true },
    { Position: { x: targetX, y: 1.08, z: targetZ }, Rotation: { x: 0, y: 180, z: 0 }, RotationSnap: true },
    { Position: { x: questDeckX, y: 1.08, z: questDeckZ }, Rotation: { x: 0, y: 90, z: 0 }, RotationSnap: true },
    { Position: { x: activeQuestX, y: 1.08, z: activeQuestZ }, Rotation: { x: 0, y: 90, z: 0 }, RotationSnap: true }
  ];

  // 5 evenly spaced IN PLAY slots across the Encounter Board center recess
  const inPlaySlots = [];
  for (let i = 0; i < 5; i++) {
    const xMm = 124 + i * 80;
    const [sx, sz] = boardMmToWorld(POS.encounterBoard, LONG_BOARD_MM, xMm, 73);
    inPlaySlots.push([sx, 1.22, sz]);
  }
  const [activeTargetX, activeTargetZ] = boardMmToWorld(POS.logisticsBoard, LONG_BOARD_MM, 6 + 40, -18);

  // Compact non-zero resource map helper for Lua config
  const compactRes = (m) => {
    const out = {};
    if (!m) return out;
    for (const [k, v] of Object.entries(m)) {
      if (v && v > 0) out[k] = v;
    }
    return out;
  };

  // Export canonical v7.0 tile rules for right-click Activate / Pay / Upgrade / Score & Placement Validation Lua
  const tileRules = {};
  for (const t of coreTiles) {
    tileRules[t.id] = {
      kind: "core",
      category: t.category,
      name: t.basic.name,
      linked: Boolean(t.basic.effectText && t.basic.effectText.includes("Linked Production")),
      placement: {
        terrain: t.placement?.terrain || [],
        adjacentTerrain: t.placement?.adjacentToTerrain || [],
        adjacentCategory: t.placement?.adjacentToCategory || [],
        text: t.placement?.text || ""
      },
      basic: {
        name: t.basic.name,
        cost: compactRes(t.basic.cost),
        prod: compactRes(t.basic.production),
        pop: t.basic.population || 0,
        renown: t.basic.renown || 0
      },
      upgraded: {
        name: t.upgraded.name,
        cost: compactRes(t.upgraded.cost),
        prod: compactRes(t.upgraded.production),
        pop: t.upgraded.population || 0,
        renown: t.upgraded.renown || 0
      }
    };
  }
  for (const t of specialTiles) {
    tileRules[t.id] = {
      kind: "special",
      category: t.category,
      name: t.name,
      pop: t.population || 0,
      renown: t.renown || 0,
      placement: {
        terrain: t.placement?.terrain || [],
        adjacentTerrain: t.placement?.adjacentToTerrain || [],
        adjacentCategory: t.placement?.adjacentToCategory || [],
        text: t.placement?.text || ""
      },
      basic: { name: t.name, prod: compactRes(t.production), pop: t.population || 0, renown: t.renown || 0 }
    };
  }
  for (const t of goldenTiles) {
    tileRules[t.id] = {
      kind: "golden",
      category: "golden",
      name: t.name,
      pop: t.population || 0,
      renown: t.renown || 0,
      placement: {
        terrain: t.placement?.terrain || [],
        adjacentTerrain: t.placement?.adjacentToTerrain || [],
        adjacentCategory: t.placement?.adjacentToCategory || [],
        text: t.placement?.text || ""
      },
      basic: { name: t.name, prod: {}, pop: t.population || 0, renown: t.renown || 0 }
    };
  }

  // Export canonical v7.0 encounter rules + concise summaries for Seeding Modal & right-click Resolution
  const shortText = (s, max = 64) => {
    const clean = String(s || "").replace(/\s+/g, " ").trim();
    return clean.length > max ? clean.slice(0, max - 1) + "…" : clean;
  };
  const encounterRules = {};
  for (const c of boons) {
    encounterRules[c.id] = {
      type: "boon",
      name: c.name,
      summary: shortText(c.effects?.season1 || "Boon")
    };
  }
  for (const c of goldenBoons) {
    encounterRules[c.id] = {
      type: "goldenBoon",
      name: c.name,
      summary: shortText(c.effectText || "Golden Boon")
    };
  }
  for (const c of burdens) {
    encounterRules[c.id] = {
      type: "burden",
      name: c.name,
      res: burdenResolutionResources[c.id] || "goods",
      summary: shortText(c.effects?.season1 || "Burden")
    };
  }
  for (const c of arrivals) {
    const req = arrivalRequirementRules[c.id];
    const unlockNums = c.unlocksTileId ? [...(specialTileBackNumbers[c.unlocksTileId] || [])] : [];
    encounterRules[c.id] = {
      type: "arrival",
      name: c.name,
      cost: compactRes(req?.cost),
      unlockNums,
      summary: shortText(`Req: ${c.requirementText || ""} -> ${c.rewardText || ""}`, 72)
    };
  }

  const ruinsHexes = hexSnaps
    .filter((h) => h.terrain === "ruins")
    .map((h) => [h.Position.x, h.Position.y, h.Position.z]);

  const mapHexes = hexSnaps.map((h) => ({
    id: h.id,
    t: h.terrain,
    x: h.Position.x,
    z: h.Position.z
  }));

  // 11. Inject exact GUIDs & coordinates into global.lua
  const luaConfig = {
    guids: {
      warehouseCounters: warehouseCounterGuids,
      targetDeck: targetDeckGuid,
      questDeck: questDeckGuid,
      boonsDeck: boonsGuid,
      burdensDeck: burdensGuid,
      arrivalsDeck: arrivalsGuid,
      goldenBoonsDeck: goldenBoonsGuid,
      specialBag: specialBagGuid,
      goldenBag: goldenBagGuid,
      travelExtBag: travelExtBagGuid,
      strainBag: strainBagGuid,
      supportedBag: supportedBagGuid,
      cooldownXBag: cooldownXBagGuid,
      arrivalTimerBag: arrivalTimerBagGuid,
      roundMarker: roundMarkerGuid,
      player1Marker: player1MarkerGuid
    },
    stewards: stewardConfigs,
    coreCatalog,
    tileRules,
    encounterRules,
    mapHexes,
    positions: {
      encounterDraw: [encDrawX, 1.25, encDrawZ],
      encounterDiscard: [encDiscX, 1.25, encDiscZ],
      boonsReserve: [33.0, 1.35, 8.8],
      burdensReserve: [38.5, 1.35, 8.8],
      arrivalsReserve: [33.0, 1.35, 2.2],
      goldenBoonsReserve: [38.5, 1.35, 2.2],
      questDeckWell: [questDeckX, 1.25, questDeckZ],
      seedS1: [-7.0, 1.35, 14.6],
      seedS2: [-3.2, 1.35, 14.6],
      seedS3: [0.6, 1.35, 14.6],
      inPlaySlots,
      targetWell: [targetX, 1.25, targetZ],
      activeTarget: [activeTargetX, 1.3, activeTargetZ],
      activeQuest: [activeQuestX, 1.35, activeQuestZ],
      unlockedSpecial: [unlockedSpecX, 1.25, unlockedSpecZ],
      coreStaging: [-11.5, 1.25, 14.6],
      ruinsHexes,
      roundSockets,
      seatMarkers: seatMarkerPositions,
      handZones: [
        { color: "White",  pos: [-15.0, 3.2, -21.8], rotY: 0,   axis: "x" },
        { color: "Red",    pos: [15.0,  3.2, -21.8], rotY: 0,   axis: "x" },
        { color: "Blue",   pos: [15.0,  3.2,  21.8], rotY: 180, axis: "x" },
        { color: "Green",  pos: [-15.0, 3.2,  21.8], rotY: 180, axis: "x" },
        { color: "Yellow", pos: [-38.5, 3.2,   0.0], rotY: 90,  axis: "z" }
      ]
    },
    mapBounds: {
      minX: Number((POS.mapBoard[0] - MAP_BOARD_MM.w * MM * 0.5).toFixed(3)),
      maxX: Number((POS.mapBoard[0] + MAP_BOARD_MM.w * MM * 0.5).toFixed(3)),
      minZ: Number((POS.mapBoard[2] - MAP_BOARD_MM.h * MM * 0.5).toFixed(3)),
      maxZ: Number((POS.mapBoard[2] + MAP_BOARD_MM.h * MM * 0.5).toFixed(3))
    }
  };

  const globalLua = globalLuaTemplate.replace("__QV_TTS_CONFIG__", toLua(luaConfig));

  // Build scrollable Steward's Core Tile Menu XML rows for XmlUI modal
  const escXml = (s) =>
    String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  const fmtRes = (c) => {
    const map = [["wood", "W"], ["stone", "St"], ["metal", "M"], ["food", "F"], ["herbs", "H"], ["goods", "G"]];
    const parts = map.filter(([k]) => (c?.[k] || 0) > 0).map(([k, lbl]) => `${c[k]}${lbl}`);
    return parts.length ? parts.join(" ") : "Free";
  };
  const catalogIdxByName = Object.fromEntries(coreCatalog.map((e, i) => [e.name, i + 1]));
  const menuCats = [
    ["resource", "RESOURCE TILES (Linked Production)", "#355430"],
    ["housing", "HOUSING TILES", "#7c472e"],
    ["social", "SOCIAL & WELLBEING TILES", "#643e58"],
    ["merchant", "MERCHANT & CRAFTING TILES", "#735a22"],
    ["travel", "TRAVEL TILES", "#4c4538"]
  ];
  const groupKey = (c) => (c === "wellbeing" ? "social" : c === "crafting" ? "merchant" : c);
  const xmlRows = [];
  let menuHeight = 24;
  for (const [key, title, bg] of menuCats) {
    xmlRows.push(`      <Text text="${escXml(title)}" color="#f8f2e2" fontSize="11" fontStyle="Bold" minHeight="22" preferredHeight="22" alignment="MiddleLeft" />`);
    menuHeight += 26;
    for (const t of coreTiles.filter((x) => groupKey(x.category) === key)) {
      const idx = catalogIdxByName[t.basic.name] || 1;
      const bScore = [t.basic.population ? `${t.basic.population}P` : "", t.basic.renown ? `${t.basic.renown}R` : ""].filter(Boolean).join("/");
      const uScore = [t.upgraded.population ? `${t.upgraded.population}P` : "", t.upgraded.renown ? `${t.upgraded.renown}R` : ""].filter(Boolean).join("/");
      const bLine = `${t.basic.name} (x${t.count}) — ${fmtRes(t.basic.cost)}${bScore ? ` [${bScore}]` : ""}`;
      const uLine = `Up: ${t.upgraded.name} — ${fmtRes(t.upgraded.cost)}${uScore ? ` [${uScore}]` : ""}`;
      const terrain = (t.placement?.text || "").replace(/^Place on /, "").replace(/\.$/, "");
      xmlRows.push(
        `      <HorizontalLayout minHeight="34" preferredHeight="34" spacing="6" padding="6 6 2 2" color="${bg}99">` +
        `<Text text="${escXml(bLine)}" preferredWidth="235" fontSize="11" fontStyle="Bold" color="#f8f2e2" alignment="MiddleLeft" />` +
        `<Text text="${escXml(uLine)}" preferredWidth="245" fontSize="11" color="#e8d8b0" alignment="MiddleLeft" />` +
        `<Text text="${escXml(terrain)}" flexibleWidth="1" fontSize="10" color="#d4ccb8" alignment="MiddleLeft" />` +
        `<Button text="PULL" preferredWidth="58" minWidth="58" fontSize="10" color="#3b5e36" onClick="onHudPullCoreByIdx(${idx})" />` +
        `</HorizontalLayout>`
      );
      menuHeight += 38;
    }
  }
  const compiledHudXml = hudXml
    .replace("__QV_TILE_MENU_HEIGHT__", String(menuHeight))
    .replace("__QV_TILE_MENU_ROWS__", xmlRows.join("\n"));

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
    Table: "Table_Custom",
    TableURL: asset("boards/table-surface.jpg"),
    Sky: "Sky_Museum",
    Note: "The Quiet Vale: Seasons of Settlement (v7.0). Use the left HUD panel for 1-click Setup (auto-places Stewards & deals hands), Reveal Encounters (+3 Arrival Timers), Draw Target Card, Warehouse tracking, Core Tile Menu, and End Round cleanup.",
    Rules: "",
    LuaScript: globalLua,
    LuaScriptState: "",
    XmlUI: compiledHudXml,
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
      Hiding: 2 // Disable hand hiding so all players' hands stay revealed for easy local/tabletop co-op
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
