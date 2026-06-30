import { encounterById } from "../data/encounters";
import { mapById, mapCells } from "../data/map";
import { goldenTileById, specialTileById } from "../data/tiles";
import { getHexNeighbors } from "./hex";
import {
  getTileData,
  getTileFootprintSize,
  getTilePlacementHexIds
} from "./placementRules";
import { recalculatePassiveSupported } from "./supportRules";
import type {
  GameState,
  PlacedTile,
  TilePlacementDraft,
  ValidationResult
} from "./types";

export interface GoldenSignetPlacement {
  placedTileId: string;
  placement: TilePlacementDraft;
}

function appendLog(state: GameState, message: string): GameState {
  return {
    ...state,
    log: [
      ...state.log,
      {
        id: `log_${state.log.length + 1}_${Date.now()}`,
        round: state.round,
        message
      }
    ]
  };
}

function hexesTouchTerrain(hexIds: string[], terrain: string): boolean {
  return hexIds
    .flatMap((hexId) => getHexNeighbors(hexId))
    .some((neighborId) => mapById[neighborId]?.terrain === terrain);
}

export function validateGoldenTileSetupPlacement(
  state: GameState,
  hexId: string
): ValidationResult {
  const reasons: string[] = [];
  const tileId = state.goldenSetup.selectedTileId;
  const tile = tileId ? goldenTileById[tileId] : undefined;
  const cell = mapById[hexId];

  if (state.phase !== "goldenSetup") {
    reasons.push("Golden Tile setup placement is not active.");
  }
  if (!tile) reasons.push("Choose an unlocked Golden Tile during setup.");
  if (!cell) reasons.push("Choose a map hex.");
  if (state.map.placedTiles.some((placedTile) => placedTile.hexIds.includes(hexId))) {
    reasons.push("That hex is already occupied.");
  }
  if (tile?.placement?.terrain && cell && !tile.placement.terrain.includes(cell.terrain)) {
    reasons.push(tile.placement.text ?? "That terrain is not legal for this Golden Tile.");
  }
  if (
    tile?.placement?.adjacentToTerrain?.length &&
    !tile.placement.adjacentToTerrain.some((terrain) => hexesTouchTerrain([hexId], terrain))
  ) {
    reasons.push(tile.placement.text ?? "The Golden Tile must touch the required terrain.");
  }
  if (
    tile?.placement?.notAdjacentToTerrain?.some((terrain) =>
      hexesTouchTerrain([hexId], terrain)
    )
  ) {
    reasons.push(tile.placement.text ?? "That Golden Tile cannot touch this terrain.");
  }

  return { ok: reasons.length === 0, reasons };
}

export function getGoldenTileSetupLegalHexIds(state: GameState): string[] {
  return mapCells
    .map((cell) => cell.id)
    .filter((hexId) => validateGoldenTileSetupPlacement(state, hexId).ok);
}

export function placeGoldenTileForSetup(state: GameState, hexId: string): GameState {
  const validation = validateGoldenTileSetupPlacement(state, hexId);
  const tileId = state.goldenSetup.selectedTileId;
  const tile = tileId ? goldenTileById[tileId] : undefined;
  if (!validation.ok || !tile) return state;

  const placedTile: PlacedTile = {
    instanceId: `golden_${tile.id}_${Date.now()}`,
    tileId: tile.id,
    kind: "special",
    side: "special",
    hexIds: [hexId],
    strain: 0,
    support: { passive: false, singleUse: false, preventedThisRound: false }
  };
  const nextState = recalculatePassiveSupported({
    ...state,
    phase: "seeding",
    map: { placedTiles: [...state.map.placedTiles, placedTile] },
    goldenSetup: { ...state.goldenSetup, tilePlaced: true, tileSkipped: false }
  });
  return appendLog(nextState, `${tile.name} was placed at ${hexId} during setup.`);
}

export function skipGoldenTileForSetup(state: GameState): GameState {
  if (state.phase !== "goldenSetup") return state;
  return appendLog(
    {
      ...state,
      phase: "seeding",
      goldenSetup: { ...state.goldenSetup, tileSkipped: true, tilePlaced: false }
    },
    "Golden Tile setup placement was skipped."
  );
}

export function queueGoldenBoonResolution(state: GameState, cardId: string): GameState {
  if (cardId === "golden_boon_the_golden_bell") {
    const arrivalCardIds = state.encounters.reserveArrivalIds.slice(0, 3);
    if (arrivalCardIds.length === 0) {
      return appendLog(state, "The Golden Bell found no unused Arrival Cards.");
    }
    return {
      ...state,
      pendingGoldenEffect: { kind: "bell", cardId, arrivalCardIds }
    };
  }
  if (cardId === "golden_boon_the_golden_scroll") {
    return {
      ...state,
      pendingGoldenEffect: { kind: "scroll", cardId }
    };
  }
  if (cardId === "golden_boon_the_golden_eyed_traveler") {
    return appendLog(
      { ...state, bonusTurnsPending: true },
      "The Golden-Eyed Traveller granted every player one bonus turn this round."
    );
  }
  if (cardId === "golden_boon_the_golden_signet_ring") {
    return {
      ...state,
      pendingGoldenEffect: { kind: "signet", cardId }
    };
  }
  return state;
}

export function resolveGoldenBell(state: GameState, arrivalCardId: string): GameState {
  const pending = state.pendingGoldenEffect;
  const card = encounterById[arrivalCardId];
  if (
    pending?.kind !== "bell" ||
    !pending.arrivalCardIds.includes(arrivalCardId) ||
    !card ||
    card.type !== "arrival"
  ) {
    return state;
  }

  const nextSpecialSupply = { ...state.tileSupply.special };
  for (const tileId of card.rewardSpecialTileIds) {
    nextSpecialSupply[tileId] = (nextSpecialSupply[tileId] ?? 0) + 1;
  }
  const nextState: GameState = {
    ...state,
    pendingGoldenEffect: null,
    tileSupply: { ...state.tileSupply, special: nextSpecialSupply },
    encounters: {
      ...state.encounters,
      reserveArrivalIds: state.encounters.reserveArrivalIds.filter(
        (cardId) => cardId !== arrivalCardId
      ),
      completedArrivals: [
        ...state.encounters.completedArrivals,
        { cardId: arrivalCardId, specialTileIds: card.rewardSpecialTileIds }
      ]
    }
  };
  const names = card.rewardSpecialTileIds.map(
    (tileId) => specialTileById[tileId]?.name ?? tileId
  );
  return appendLog(
    nextState,
    `The Golden Bell completed ${card.name} for free and unlocked ${names.join(", ")}.`
  );
}

export function resolveGoldenScroll(
  state: GameState,
  returnedCardByPlayerId: Record<string, string | undefined>
): GameState {
  if (state.pendingGoldenEffect?.kind !== "scroll") return state;

  const reserve = [...state.encounters.reserveBoonIds];
  const returnedBoons: string[] = [];
  const returnedArrivals: string[] = [];
  const handsByPlayerId = { ...state.encounters.handsByPlayerId };
  const exchanges: string[] = [];

  for (const player of state.players) {
    const returnedCardId = returnedCardByPlayerId[player.id];
    if (!returnedCardId || reserve.length === 0) continue;
    const hand = handsByPlayerId[player.id] ?? [];
    const returnedCard = encounterById[returnedCardId];
    if (!hand.includes(returnedCardId) || !returnedCard || returnedCard.type === "goldenBoon") {
      continue;
    }
    const replacementId = reserve.shift();
    if (!replacementId) continue;
    handsByPlayerId[player.id] = [
      ...hand.filter((cardId) => cardId !== returnedCardId),
      replacementId
    ];
    if (returnedCard.type === "boon") returnedBoons.push(returnedCardId);
    if (returnedCard.type === "arrival") returnedArrivals.push(returnedCardId);
    exchanges.push(player.name);
  }

  return appendLog(
    {
      ...state,
      pendingGoldenEffect: null,
      encounters: {
        ...state.encounters,
        handsByPlayerId,
        reserveBoonIds: [...reserve, ...returnedBoons],
        reserveArrivalIds: [...state.encounters.reserveArrivalIds, ...returnedArrivals]
      }
    },
    exchanges.length
      ? `The Golden Scroll exchanged one hidden Encounter Card for a standard Boon for ${exchanges.join(", ")}.`
      : "No player used The Golden Scroll."
  );
}

function validateSignetPlacement(
  tile: PlacedTile,
  placement: TilePlacementDraft,
  occupiedHexIds: Set<string>
): string[] | null {
  const data = getTileData(tile.tileId);
  const hexIds = getTilePlacementHexIds(tile.tileId, placement);
  if (!data || hexIds.length !== getTileFootprintSize(tile.tileId)) return null;
  if (new Set(hexIds).size !== hexIds.length) return null;
  if (hexIds.some((hexId) => !mapById[hexId] || occupiedHexIds.has(hexId))) return null;
  if (
    data.placement?.terrain &&
    hexIds.some((hexId) => !data.placement?.terrain?.includes(mapById[hexId].terrain))
  ) {
    return null;
  }
  return hexIds;
}

export function validateGoldenSignetPlacements(
  state: GameState,
  placements: GoldenSignetPlacement[]
): ValidationResult {
  const reasons: string[] = [];
  if (state.pendingGoldenEffect?.kind !== "signet") {
    reasons.push("The Golden Signet Ring is not awaiting resolution.");
  }
  if (placements.length > 5) reasons.push("Choose no more than five placed tiles.");
  const selectedIds = new Set(placements.map((placement) => placement.placedTileId));
  if (selectedIds.size !== placements.length) reasons.push("Choose each placed tile once.");
  const selectedTiles = placements.map((placement) =>
    state.map.placedTiles.find((tile) => tile.instanceId === placement.placedTileId)
  );
  if (selectedTiles.some((tile) => !tile)) reasons.push("A chosen tile is no longer on the map.");
  if (reasons.length > 0) return { ok: false, reasons };

  const occupiedHexIds = new Set(
    state.map.placedTiles
      .filter((tile) => !selectedIds.has(tile.instanceId))
      .flatMap((tile) => tile.hexIds)
  );
  for (let index = 0; index < placements.length; index += 1) {
    const tile = selectedTiles[index];
    if (!tile) continue;
    const hexIds = validateSignetPlacement(tile, placements[index].placement, occupiedHexIds);
    if (!hexIds) {
      const data = getTileData(tile.tileId);
      const name = data
        ? "basic" in data
          ? tile.side === "upgraded"
            ? data.upgraded.name
            : data.basic.name
          : data.name
        : tile.tileId;
      reasons.push(`${name} needs a legal, empty terrain placement.`);
      continue;
    }
    hexIds.forEach((hexId) => occupiedHexIds.add(hexId));
  }
  return { ok: reasons.length === 0, reasons };
}

export function resolveGoldenSignet(
  state: GameState,
  placements: GoldenSignetPlacement[]
): GameState {
  if (!validateGoldenSignetPlacements(state, placements).ok) return state;
  const selectedIds = new Set(placements.map((placement) => placement.placedTileId));
  const selectedTiles = placements.map((placement) =>
    state.map.placedTiles.find((tile) => tile.instanceId === placement.placedTileId)
  );
  if (selectedTiles.some((tile) => !tile)) return state;

  const stationaryTiles = state.map.placedTiles.filter(
    (tile) => !selectedIds.has(tile.instanceId)
  );
  const occupiedHexIds = new Set(stationaryTiles.flatMap((tile) => tile.hexIds));
  const movedTiles: PlacedTile[] = [];
  const movedHexByOriginalHex = new Map<string, string>();
  for (let index = 0; index < placements.length; index += 1) {
    const tile = selectedTiles[index];
    if (!tile) return state;
    const hexIds = validateSignetPlacement(tile, placements[index].placement, occupiedHexIds);
    if (!hexIds) return state;
    hexIds.forEach((hexId) => occupiedHexIds.add(hexId));
    tile.hexIds.forEach((hexId, hexIndex) => {
      const movedHexId = hexIds[hexIndex];
      if (movedHexId) movedHexByOriginalHex.set(hexId, movedHexId);
    });
    movedTiles.push({ ...tile, hexIds });
  }

  const nextState = recalculatePassiveSupported({
    ...state,
    pendingGoldenEffect: null,
    map: { placedTiles: [...stationaryTiles, ...movedTiles] },
    players: state.players.map((player) => ({
      ...player,
      stewardHexId: movedHexByOriginalHex.get(player.stewardHexId) ?? player.stewardHexId,
      temporaryReachHexId: player.temporaryReachHexId
        ? movedHexByOriginalHex.get(player.temporaryReachHexId) ?? player.temporaryReachHexId
        : undefined
    }))
  });
  return appendLog(
    nextState,
    movedTiles.length
      ? `The Golden Signet Ring repositioned ${movedTiles.length} placed tile${movedTiles.length === 1 ? "" : "s"}.`
      : "The Golden Signet Ring was resolved without moving a tile."
  );
}
