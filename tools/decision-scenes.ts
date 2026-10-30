/**
 * Decision scenes for the demo walkthroughs. Each starts from the real
 * "settlement" position and is staged for one clear choice: tiles are set
 * down directly, and cards, timers, Strain and the Warehouse are adjusted.
 * Everything after the staging, every option and its outcome, is played by
 * the ordinary rules engine.
 */
import type { GameState, PlacedTile } from "../src/engine/types";

let serial = 900;
function put(state: GameState, tileId: string, hexId: string, options: { strain?: number; side?: PlacedTile["side"] } = {}): string {
  const kind = tileId.startsWith("special_") ? "special" : "core";
  const instanceId = `tile_${serial++}_${tileId}`;
  state.map.placedTiles.push({ instanceId, tileId, kind, side: options.side ?? (kind === "special" ? "special" : "basic"), hexIds: [hexId], strain: options.strain ?? 0, support: { passive: false, singleUse: false, preventedThisRound: false } });
  if ((state.tileSupply[kind][tileId] ?? 0) > 0) state.tileSupply[kind][tileId] -= 1;
  return instanceId;
}
const tileAt = (state: GameState, hexId: string) => state.map.placedTiles.find((tile) => tile.hexIds.includes(hexId))!;
function note(state: GameState, message: string) {
  state.log = [{ id: `log_scene_${serial++}`, round: state.round, message }, ...state.log];
}
function clean(state: GameState) {
  state.encounters.activeArrivals = [];
  state.encounters.activeBurdens = [];
  state.encounters.faceUpBoons = [];
  state.boonModifiers = [];
  state.pendingEffects = [];
}

/** An Arrival on its last timer, payable now. */
export function arrivalScene(settlement: GameState): GameState {
  const state = structuredClone(settlement);
  clean(state);
  state.round = 3;
  state.warehouse = { wood: 6, stone: 4, metal: 4, food: 6, herbs: 4, goods: 4 };
  state.encounters.activeArrivals = [{ cardId: "arrival_from_blade_swingers_to_herb_stringers", timerTokens: 1 }];
  note(state, "Demo scene: an Arrival on its last timer.");
  return state;
}

/** A Cabin one Strain from Overstrain, with a Burden that will strike Housing again. */
export function protectScene(settlement: GameState): GameState {
  const state = structuredClone(settlement);
  clean(state);
  state.round = 4;
  state.warehouse = { wood: 8, stone: 8, metal: 8, food: 8, herbs: 8, goods: 6 };
  tileAt(state, "H1").strain = 2;
  put(state, "c09_tavern", "H2");
  state.encounters.activeBurdens = ["burden_too_many_houses_too_little_homes"];
  note(state, "Demo scene: a Cabin under Strain.");
  return state;
}

/** A Boon that adds Wood, with the Warehouse nearly full of Wood. */
export function boonScene(settlement: GameState): GameState {
  const state = structuredClone(settlement);
  clean(state);
  state.season = 2;
  state.round = 5;
  state.warehouse = { wood: 11, stone: 8, metal: 8, food: 8, herbs: 8, goods: 8 };
  put(state, "c01_lumber_yard", "G2");
  state.encounters.faceUpBoons = [{ cardId: "boon_the_ancient_ways_gradually_reemerge", remainingUses: 1 }];
  note(state, "Demo scene: a Boon and a nearly full Warehouse.");
  return state;
}

/** The Atelier Workshop beside an Overstrained Fine Cabin and a lightly strained Path. */
export function specialScene(settlement: GameState): GameState {
  const state = structuredClone(settlement);
  clean(state);
  state.round = 3;
  state.warehouse = { wood: 6, stone: 6, metal: 6, food: 6, herbs: 6, goods: 6 };
  const cabin = tileAt(state, "H1");
  cabin.side = "upgraded";
  cabin.strain = 3;
  tileAt(state, "F1").strain = 1;
  put(state, "special_atelier_workshop", "G2");
  note(state, "Demo scene: the Atelier Workshop and two strained tiles.");
  return state;
}
