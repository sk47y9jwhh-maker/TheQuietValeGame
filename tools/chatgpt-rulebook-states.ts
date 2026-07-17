import fs from "node:fs/promises";
import path from "node:path";
import { createNewGame } from "../src/engine/setup";
import type { GameState, PlacedTile } from "../src/engine/types";

const outputDir = path.resolve("docs-live-screenshots");
await fs.mkdir(outputDir, { recursive: true });

function support(passive = false, singleUse = false) {
  return { passive, singleUse, preventedThisRound: false };
}

function core(
  instanceId: string,
  tileId: string,
  hexId: string,
  strain = 0,
  side: "basic" | "upgraded" = "basic",
  passiveSupport = false
): PlacedTile {
  return {
    instanceId,
    tileId,
    kind: "core",
    side,
    hexIds: [hexId],
    strain,
    support: support(passiveSupport)
  };
}

function baseState(seed: string): GameState {
  const state = createNewGame(1, ["vanguard"], { encounterSeed: seed });
  state.phase = "turns";
  state.season = 2;
  state.round = 6;
  state.actionsRemaining = 4;
  state.currentPlayerId = "player_1";
  state.players[0].hasPlacedFirstTile = true;
  state.players[0].stewardHexId = "D5";
  state.playersActedThisRound = [];
  state.seasonSeededPlayerIds = ["player_1"];
  state.pendingEffects = [];
  state.pendingCostChoice = null;
  state.pendingDeckReorder = null;
  state.encounters.activeArrivals = [];
  state.encounters.activeBurdens = [];
  state.encounters.faceUpBoons = [];
  state.warehouse = {
    wood: 10,
    stone: 10,
    metal: 8,
    food: 12,
    herbs: 8,
    goods: 5
  };
  return state;
}

function saveEnvelope(seed: string, state: GameState) {
  return {
    version: 4,
    savedAt: new Date().toISOString(),
    playerCount: 1,
    stewardIds: ["vanguard"],
    encounterSeed: seed,
    state
  };
}

const bridgeSeed = "QV-RULEBOOK-BRIDGE";
const bridgeState = baseState(bridgeSeed);
bridgeState.players[0].stewardHexId = "D5";
bridgeState.map.placedTiles = [
  core("bridge_left_path", "c15_path", "D5"),
  core("bridge_left_cabin", "c05_cabin", "D4"),
  core("bridge_left_cottage", "c06_cottage", "C5"),
  core("bridge_crossing", "c19_bridge", "E5", 0, "upgraded", true),
  core("bridge_right_path", "c15_path", "F5"),
  core("bridge_right_inn", "c08_inn", "F4"),
  core("bridge_right_market", "c14_market_stalls", "G5")
];

const strainSeed = "QV-RULEBOOK-STRAIN";
const strainState = baseState(strainSeed);
strainState.players[0].stewardHexId = "G5";
strainState.map.placedTiles = [
  core("strain_cabin", "c05_cabin", "G5", 3),
  core("strain_cottage", "c06_cottage", "G4", 2),
  core("strain_common_land", "c18_common_land", "F5", 1, "basic", true),
  core("strain_path", "c15_path", "H5", 0),
  core("strain_apothecary", "c12_apothecary", "H4", 0),
  core("strain_market", "c14_market_stalls", "F4", 0)
];

await fs.writeFile(
  path.join(outputDir, "bridge-state.json"),
  JSON.stringify(saveEnvelope(bridgeSeed, bridgeState), null, 2)
);
await fs.writeFile(
  path.join(outputDir, "strain-state.json"),
  JSON.stringify(saveEnvelope(strainSeed, strainState), null, 2)
);
