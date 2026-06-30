import { arrivals, boons, burdens } from "../data/encounters";
import { createWarehouse } from "../data/resources";
import { stewards } from "../data/stewards";
import { coreTiles, specialTiles } from "../data/tiles";
import { getSeasonForRound } from "./season";
import { createLedgerRunState } from "./ledger";
import type {
  GameState,
  PlayerCount,
  PlayerState,
  Season,
  StewardData,
  TileSupplyState
} from "./types";

const startingWarehouseByPlayerCount: Record<PlayerCount, number> = {
  1: 15,
  2: 10,
  3: 5,
  4: 0
};

interface EncounterSetupOptions {
  encounterSeed?: string;
}

interface NewGameOptions extends EncounterSetupOptions {
  declaredVowId?: string;
}

export function getStartingWarehouseAmount(playerCount: PlayerCount): number {
  return startingWarehouseByPlayerCount[playerCount];
}

export function createTileSupply(): TileSupplyState {
  return {
    core: Object.fromEntries(coreTiles.map((tile) => [tile.id, tile.count])),
    special: Object.fromEntries(specialTiles.map((tile) => [tile.id, 0]))
  };
}

function createSeededRandom(seed: string): () => number {
  let hash = 1779033703 ^ seed.length;
  for (let index = 0; index < seed.length; index += 1) {
    hash = Math.imul(hash ^ seed.charCodeAt(index), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }

  return () => {
    hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
    hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
    hash ^= hash >>> 16;
    return (hash >>> 0) / 4294967296;
  };
}

function shuffleWithSeed<T>(items: T[], random: () => number): T[] {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

export function buildEncounterPool(
  playerCount: PlayerCount,
  encounterSeed?: string
): string[] {
  const perType = playerCount * 4;
  const normalizedSeed = encounterSeed?.trim();
  const random = normalizedSeed
    ? createSeededRandom(`${normalizedSeed}:${playerCount}`)
    : null;
  const selectedBoons = random
    ? shuffleWithSeed(boons.map((card) => card.id), random).slice(0, perType)
    : boons.slice(0, perType).map((card) => card.id);
  const selectedBurdens = random
    ? shuffleWithSeed(burdens.map((card) => card.id), random).slice(0, perType)
    : burdens.slice(0, perType).map((card) => card.id);
  const selectedArrivals = random
    ? shuffleWithSeed(arrivals.map((card) => card.id), random).slice(0, perType)
    : arrivals.slice(0, perType).map((card) => card.id);
  const pool: string[] = [];

  if (random) {
    return shuffleWithSeed([...selectedBoons, ...selectedBurdens, ...selectedArrivals], random);
  }

  for (let index = 0; index < perType; index += 1) {
    pool.push(selectedBoons[index], selectedBurdens[index], selectedArrivals[index]);
  }

  return pool;
}

export function dealEncounterSetup(
  playerCount: PlayerCount,
  playerIds: string[],
  options: EncounterSetupOptions = {}
) {
  const pool = buildEncounterPool(playerCount, options.encounterSeed);
  const handsByPlayerId: Record<string, string[]> = {};
  let cursor = 0;

  for (const playerId of playerIds) {
    handsByPlayerId[playerId] = pool.slice(cursor, cursor + 9);
    cursor += 9;
  }

  const deck = pool.slice(cursor, cursor + playerCount * 3);

  return {
    handsByPlayerId,
    deck,
    unused: pool.slice(cursor + playerCount * 3)
  };
}

function defaultStewardHex(steward: StewardData, usedHexes: Set<string>): string {
  const bySteward: Record<string, string[]> = {
    vanguard: ["G1", "H1", "A9"],
    knight: ["A6", "B6", "L1"],
    sentinel: ["A1", "B1", "N7"],
    ranger: ["A3", "B3", "N3"],
    warden: ["F4", "F5", "J9"],
    quartermaster: ["B8", "N6", "K9"]
  };

  const candidates = bySteward[steward.id] ?? [];
  const candidate = candidates.find((hexId) => !usedHexes.has(hexId));
  if (!candidate) {
    throw new Error(`No default start hex available for ${steward.name}.`);
  }
  usedHexes.add(candidate);
  return candidate;
}

export function createNewGame(
  playerCount: PlayerCount,
  stewardIds = stewards.slice(0, playerCount).map((steward) => steward.id),
  options: NewGameOptions = {}
): GameState {
  const usedHexes = new Set<string>();
  const players: PlayerState[] = stewardIds.slice(0, playerCount).map((stewardId, index) => {
    const steward = stewards.find((candidate) => candidate.id === stewardId);
    if (!steward) throw new Error(`Unknown steward: ${stewardId}`);

    return {
      id: `player_${index + 1}`,
      name: `Player ${index + 1}`,
      stewardId: steward.id,
      stewardHexId: defaultStewardHex(steward, usedHexes),
      hasPlacedFirstTile: false,
      stewardPowerUsesBySeason: { 1: 0, 2: 0, 3: 0 } as Record<Season, number>
    };
  });

  const encounterSetup = dealEncounterSetup(
    playerCount,
    players.map((player) => player.id),
    options
  );
  const startingWarehouse = createWarehouse(getStartingWarehouseAmount(playerCount));

  return {
    playerCount,
    players,
    currentPlayerId: players[0].id,
    season: getSeasonForRound(1),
    round: 1,
    phase: "setup",
    actionsRemaining: 4,
    playersActedThisRound: [],
    seasonSeededPlayerIds: [],
    warehouse: startingWarehouse,
    map: { placedTiles: [] },
    tileSupply: createTileSupply(),
    encounters: {
      handsByPlayerId: encounterSetup.handsByPlayerId,
      deck: encounterSetup.deck,
      discardPile: [],
      activeArrivals: [],
      activeBurdens: [],
      faceUpBoons: [],
      completedArrivals: [],
      goldenEnabled: false
    },
    boonModifiers: [],
    ignoredBurdenIdsThisRound: [],
    tileActivationRecords: {},
    pendingEffects: [],
    pendingDeckReorder: null,
    pendingCostChoice: null,
    ledgerRun: createLedgerRunState(startingWarehouse, options.declaredVowId),
    log: [
      {
        id: "log_setup",
        round: 1,
        message:
          "Game created. Choose each Steward's starting hex before Season I seeding."
      }
    ]
  };
}
