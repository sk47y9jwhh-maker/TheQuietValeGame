import { coreTileById } from "../../data/tiles";
import { resourceLabels, resources, warehouseCap } from "../../data/resources";
import { activateTile, getLinkedProductionTileIds, placeTile, upgradeTile } from "../../engine/gameActions";
import { selectTileName } from "../../engine/selectors";
import type { GameState, ResourceType, TilePlacementDraft } from "../../engine/types";

export type TileActionRequest =
  | { type: "place"; tileId: string; draft: TilePlacementDraft }
  | { type: "upgrade" | "activate"; placedTileId: string };

export interface ActionForecast {
  available: boolean;
  actionCost: number;
  paymentChoice: boolean;
  resources: { resource: ResourceType; label: string; before: number; after: number; delta: number; atCapacity: boolean }[];
  notes: string[];
  warning?: string;
}

/** Read the consequences of an uncommitted engine transition. Never persist it. */
export function previewTileAction(state: GameState, playerId: string, request: TileActionRequest): ActionForecast {
  const next = request.type === "place"
    ? placeTile(state, playerId, request.tileId, request.draft)
    : request.type === "upgrade"
      ? upgradeTile(state, playerId, request.placedTileId)
      : activateTile(state, playerId, request.placedTileId);
  if (next === state) return { available: false, actionCost: 0, paymentChoice: false, resources: [], notes: [state.actionsRemaining === 0 ? "No actions remain for this tile." : "This action is unavailable now."] };
  const payment = next.pendingCostChoice;
  if (payment) return { available: true, actionCost: payment.actionCost, paymentChoice: true, resources: [], notes: ["Choose your payment next. Resources are spent only after you confirm it."] };

  const produced = new Set<ResourceType>();
  if (request.type === "activate") {
    const ids = [request.placedTileId, ...getLinkedProductionTileIds(state, request.placedTileId)];
    for (const tile of state.map.placedTiles.filter((candidate) => ids.includes(candidate.instanceId))) {
      const data = coreTileById[tile.tileId];
      const production = data?.[tile.side === "upgraded" ? "upgraded" : "basic"].production;
      for (const resource of resources) if ((production?.[resource] ?? 0) > 0) produced.add(resource);
    }
  }
  const changes = resources.filter((resource) => next.warehouse[resource] !== state.warehouse[resource] || produced.has(resource)).map((resource) => ({
    resource, label: resourceLabels[resource], before: state.warehouse[resource], after: next.warehouse[resource], delta: next.warehouse[resource] - state.warehouse[resource], atCapacity: next.warehouse[resource] === warehouseCap
  }));
  const notes: string[] = [];
  const player = next.players.find((candidate) => candidate.id === playerId);
  if (player && player.stewardHexId !== state.players.find((candidate) => candidate.id === playerId)?.stewardHexId) notes.push(`Your Steward moves to ${player.stewardHexId}.`);
  for (const tile of next.map.placedTiles) {
    const previous = state.map.placedTiles.find((candidate) => candidate.instanceId === tile.instanceId);
    if (previous && previous.strain !== tile.strain) notes.push(`${selectTileName(tile)}: Strain ${previous.strain} → ${tile.strain}.`);
    if ((tile.support.singleUse || tile.support.passive) && !(previous?.support.singleUse || previous?.support.passive)) notes.push(`${selectTileName(tile)} gains Supported.`);
  }
  const pendingChoice = next.pendingEffects.length > 0 || Boolean(next.pendingDeckReorder || next.pendingGoldenEffect);
  if (pendingChoice) notes.push("An effect follows. Any further choices are resolved next.");
  return {
    available: true,
    actionCost: state.actionsRemaining - next.actionsRemaining,
    paymentChoice: false,
    resources: changes,
    notes,
    warning: produced.size > 0 && !changes.some((change) => change.delta > 0)
      ? `Warehouse resources will not increase.${pendingChoice ? " A further effect still follows." : " Movement or other effects may still be useful."}`
      : undefined
  };
}
