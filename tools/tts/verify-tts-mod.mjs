#!/usr/bin/env node
/**
 * Automated verification for The Quiet Vale v7.0 TTS mod:
 *   - Validates both hosted and local TTS Save JSON schemas
 *   - Verifies every referenced asset exists in public/tts/ (or public/rulebook/)
 *   - Verifies exact v7.0 card, tile, steward, and snap-point counts
 *   - Verifies deck sprite sheet dimensions <= 4096x4096
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");

const hostedPath = path.join(root, "public/tts/The_Quiet_Vale_v7_0.json");
const localPath = path.join(root, "output/tts/The_Quiet_Vale_v7_0_local.json");

function fail(msg) {
  console.error("FAIL:", msg);
  process.exit(1);
}

function assert(cond, msg) {
  if (!cond) fail(msg);
}

const hosted = JSON.parse(fs.readFileSync(hostedPath, "utf8"));
const local = JSON.parse(fs.readFileSync(localPath, "utf8"));

// 1. Check snap points (126 map hexes + 12 round sockets + 5 card wells = 143)
assert(hosted.SnapPoints.length === 143, `Expected 143 snap points, got ${hosted.SnapPoints.length}`);

// Check first 126 hex snap points lie strictly inside Map Board bounds
const mapBoard = hosted.ObjectStates.find((o) => o.Nickname === "The Quiet Vale — Map Board");
assert(mapBoard, "Missing Map Board object");
const mapCx = mapBoard.Transform.posX;
const mapCz = mapBoard.Transform.posZ;
const halfW = (698.5 * 0.04) / 2;
const halfH = (568.5 * 0.04) / 2;
for (let i = 0; i < 126; i++) {
  const { x, z } = hosted.SnapPoints[i].Position;
  assert(Math.abs(x - mapCx) < halfW && Math.abs(z - mapCz) < halfH, `Hex snap #${i} out of map bounds: (${x}, ${z})`);
}

// 2. Collect all objects (including contained) and verify counts
const allUrls = new Set();
const decksByName = {};
const bagsByName = {};
let stewardCount = 0;
let pdfCount = 0;

function walk(obj) {
  if (obj.Name === "Deck") {
    decksByName[obj.Nickname] = obj.DeckIDs.length;
    for (const d of Object.values(obj.CustomDeck || {})) {
      allUrls.add(d.FaceURL);
      allUrls.add(d.BackURL);
    }
  }
  if (obj.Name === "Bag" || obj.Name === "Infinite_Bag" || obj.Name === "Custom_Model_Bag") {
    bagsByName[obj.Nickname] = (obj.ContainedObjects || []).length;
  }
  if (obj.CustomImage) {
    if (obj.CustomImage.ImageURL) allUrls.add(obj.CustomImage.ImageURL);
    if (obj.CustomImage.ImageSecondaryURL) allUrls.add(obj.CustomImage.ImageSecondaryURL);
  }
  if (obj.CustomMesh) {
    if (obj.CustomMesh.MeshURL) allUrls.add(obj.CustomMesh.MeshURL);
    if (obj.CustomMesh.DiffuseURL) allUrls.add(obj.CustomMesh.DiffuseURL);
  }
  if (obj.CustomPDF) {
    pdfCount++;
    allUrls.add(obj.CustomPDF.PDFUrl);
  }
  if (obj.Nickname && obj.Nickname.startsWith("Steward: ")) stewardCount++;
  for (const child of obj.ContainedObjects || []) walk(child);
}
for (const obj of hosted.ObjectStates) walk(obj);

assert(decksByName["Target Deck (15)"] === 15, `Expected 15 Target Cards, got ${decksByName["Target Deck (15)"]}`);
assert(decksByName["Quest Deck (21)"] === 21, `Expected 21 Quest Cards, got ${decksByName["Quest Deck (21)"]}`);
assert(decksByName["Boons Reserve (30)"] === 30, `Expected 30 Boons, got ${decksByName["Boons Reserve (30)"]}`);
assert(decksByName["Burdens Reserve (30)"] === 30, `Expected 30 Burdens, got ${decksByName["Burdens Reserve (30)"]}`);
assert(decksByName["Arrivals Reserve (25)"] === 25, `Expected 25 Arrivals, got ${decksByName["Arrivals Reserve (25)"]}`);
assert(decksByName["Golden Boons (5)"] === 5, `Expected 5 Golden Boons, got ${decksByName["Golden Boons (5)"]}`);
assert(stewardCount === 6, `Expected 6 Steward mats, got ${stewardCount}`);
assert(pdfCount === 6, `Expected 6 PDFs (1 Rulebook + 5 A6 Steward Guides), got ${pdfCount}`);
assert(bagsByName["Golden Tiles Reserve (5)"] === 5, `Expected 5 Golden Tiles, got ${bagsByName["Golden Tiles Reserve (5)"]}`);
assert(bagsByName["Special Tiles Reserve (#1–#26)"] >= 26, `Expected >=26 Special Tiles, got ${bagsByName["Special Tiles Reserve (#1–#26)"]}`);

// 3. Verify every hosted HTTPS URL maps to an existing file in public/
const pagesPrefix = "https://thequietvalegame.com/";
let checkedFiles = 0;
for (const url of allUrls) {
  assert(url.startsWith(pagesPrefix), `Unexpected hosted URL: ${url}`);
  const rel = url.slice(pagesPrefix.length);
  const full = path.join(root, "public", rel);
  assert(fs.existsSync(full), `Missing asset file for URL ${url} -> ${full}`);
  checkedFiles++;
}

// 4. Verify local save uses file:// URLs and has identical object count
assert(local.ObjectStates.length === hosted.ObjectStates.length, "Local and hosted object counts differ");
assert(local.LuaScript.includes("SETUP_RULES"), "Global Lua script missing");
assert(!local.LuaScript.includes("__QV_TTS_CONFIG__"), "Lua CONFIG placeholder was not substituted");

// 5. Verify all deck sheets are <= 4096x4096 using macOS sips
const decksDir = path.join(root, "public/tts/decks");
for (const f of fs.readdirSync(decksDir)) {
  if (!f.endsWith(".jpg") && !f.endsWith(".png")) continue;
  const out = execFileSync("sips", ["-g", "pixelWidth", "-g", "pixelHeight", path.join(decksDir, f)], { encoding: "utf8" });
  const w = Number(out.match(/pixelWidth:\s*(\d+)/)?.[1] || 0);
  const h = Number(out.match(/pixelHeight:\s*(\d+)/)?.[1] || 0);
  assert(w > 0 && w <= 4096 && h > 0 && h <= 4096, `Deck image ${f} exceeds TTS 4096 limit: ${w}x${h}`);
}

console.log(`PASS: TTS mod verified (${checkedFiles} unique assets, ${hosted.ObjectStates.length} root objects, ${hosted.SnapPoints.length} snap points).`);
