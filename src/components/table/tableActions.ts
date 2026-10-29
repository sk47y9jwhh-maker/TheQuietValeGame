import { mapById, terrainLabels } from "../../data/map";
import { resourceLabels, resources } from "../../data/resources";
import { coreTileById, goldenTileById, specialTileById } from "../../data/tiles";
import { stewardById } from "../../data/stewards";
import { hexDirections } from "../../engine/hex";
import {
  canStartPlaceTile,
  canStartUpgradeTile,
  getActivatableTileIds,
  getLinkedProductionTileIds
} from "../../engine/gameActions";
import {
  canPlaceTile,
  getLegalPlacementHexes,
  getTileCategory,
  getTileFootprintKind,
  getTilePlacementHexIds
} from "../../engine/placementRules";
import { selectReachablePlacedTileIds } from "../../engine/reachability";
import { applyShelterInTheRuins } from "../../engine/placementRules";
import { getBoonActionPreview, getBoonCostOptions } from "../../engine/boonModifiers";
import { applyCostChoice, findAffordableCostSelection, getPassiveCostOptions } from "../../engine/passiveCosts";
import { selectTileName } from "../../engine/selectors";
import type { GameState, HexDirection, PlacedTile, TileCategory, TilePlacementDraft, TileSideData } from "../../engine/types";
import { previewTileAction, type ActionForecast } from "../actions/actionForecast";
import { getPlaceTileChoices, type PlaceTileChoice } from "../actions/placeTileChoices";
import { canUseStewardPower, getUsableFaceUpBoonIds, useFaceUpBoon, useStewardPower } from "../../engine/gameActions";
import { encounterById } from "../../data/encounters";
import { settleAutomaticSteps } from "./automaticSteps";

/** A face-up Boon or the Steward's power, applied in the same tap as an action. */
export interface Enhancer { kind: "boon" | "power"; id: string; name: string }

export interface EnhancedOption {
  enhancer: Enhancer;
  forecast: ActionForecast;
  /** What the Boon or power changes, e.g. "No action" or "+1 Wood". */
  benefit: string;
}

/** Uses the Boon or power and settles any step it queues that has nothing to decide. */
export function applyEnhancer(state: GameState, enhancer: Enhancer): GameState | null {
  const used = enhancer.kind === "boon" ? useFaceUpBoon(state, enhancer.id) : useStewardPower(state, state.currentPlayerId);
  if (used === state) return null;
  return settleAutomaticSteps(used);
}

interface ReadyEnhancer extends Enhancer { state: GameState }

/** Boons and powers that can be folded into the next action without a separate choice. */
export function readyEnhancers(state: GameState): ReadyEnhancer[] {
  if (state.phase !== "turns" || state.pendingEffects.length || state.pendingCostChoice) return [];
  const list: Enhancer[] = getUsableFaceUpBoonIds(state).map((id) => ({ kind: "boon" as const, id, name: encounterById[id]?.name ?? "Boon" }));
  const player = state.players.find((candidate) => candidate.id === state.currentPlayerId);
  if (player && canUseStewardPower(state, player.id).ok) list.push({ kind: "power", id: player.stewardId, name: `${stewardById[player.stewardId]?.name ?? "Steward"}’s power` });
  return list.flatMap((enhancer) => {
    const applied = applyEnhancer(state, enhancer);
    return applied ? [{ ...enhancer, state: applied }] : [];
  });
}

function totalChange(forecast: ActionForecast | undefined): number {
  return (forecast?.resources ?? []).reduce((total, change) => total + change.delta, 0);
}

/** How a forecast with the Boon or power beats the plain one, or null if it doesn't. */
function enhancementBenefit(base: ActionForecast | undefined, next: ActionForecast): string | null {
  if (!next.available) return null;
  if (!base?.available) return next.actionCost === 0 ? "Possible with it, and no action" : "Possible with it";
  const parts: string[] = [];
  if (next.actionCost < base.actionCost) parts.push(next.actionCost === 0 ? "No action" : `${base.actionCost - next.actionCost} fewer actions`);
  if (!base.paymentChoice && !next.paymentChoice) {
    for (const change of next.resources) {
      const before = base.resources.find((candidate) => candidate.resource === change.resource)?.delta ?? 0;
      const gain = change.delta - before;
      if (gain > 0) parts.push(before < 0 && change.delta <= 0 ? `${gain} less ${change.label}` : `+${gain} ${change.label}`);
    }
  }
  if (!parts.length && totalChange(next) > totalChange(base)) parts.push("Costs less");
  return parts.length ? parts.join(", ") : null;
}

function bestEnhancement(enhancers: ReadyEnhancer[], base: ActionForecast | undefined, forecastWith: (state: GameState) => ActionForecast | undefined): EnhancedOption | undefined {
  for (const enhancer of enhancers) {
    const forecast = forecastWith(enhancer.state);
    if (!forecast) continue;
    const benefit = enhancementBenefit(base, forecast);
    if (benefit) return { enhancer: { kind: enhancer.kind, id: enhancer.id, name: enhancer.name }, forecast, benefit };
  }
  return undefined;
}

export interface TileActionOption {
  kind: "activate" | "upgrade";
  available: boolean;
  title: string;
  detail: string;
  reason?: string;
  forecast?: ActionForecast;
  /** The same action with a Boon or the Steward's power folded in. */
  enhanced?: EnhancedOption;
}

export interface TileActions {
  tile: PlacedTile;
  name: string;
  category: TileCategory;
  effectText: string;
  options: TileActionOption[];
  /** Tiles that would produce together if this one is activated now. */
  linkedTileIds: string[];
}

function nonCoreEffectText(tile: PlacedTile): string {
  return specialTileById[tile.tileId]?.effectText ?? goldenTileById[tile.tileId]?.effectText ?? "";
}

function currentEffectText(tile: PlacedTile): string {
  const core = coreTileById[tile.tileId];
  if (core) return core[tile.side === "upgraded" ? "upgraded" : "basic"].effectText;
  return nonCoreEffectText(tile);
}

function hasActivatedEffect(tile: PlacedTile): boolean {
  const core = coreTileById[tile.tileId];
  if (core) {
    const type = core[tile.side === "upgraded" ? "upgraded" : "basic"].effectType;
    return type === "production" || type === "activated";
  }
  const text = nonCoreEffectText(tile);
  return /activat/i.test(text) && !/^Passive/i.test(text);
}

function stewardName(state: GameState): string {
  const player = state.players.find((candidate) => candidate.id === state.currentPlayerId);
  return (player && stewardById[player.stewardId]?.name) ?? "your Steward";
}

/** Short, plain description of what a forecast adds or spends. */
export function summariseForecast(forecast: ActionForecast | undefined): string {
  if (!forecast?.available) return "";
  if (forecast.paymentChoice) return "Choose how to pay next";
  const parts = forecast.resources
    .filter((change) => change.delta !== 0)
    .map((change) => `${change.delta > 0 ? "+" : "−"}${Math.abs(change.delta)} ${change.label}`);
  return parts.length ? parts.join(", ") : forecast.resources.some((change) => change.atCapacity) ? "Warehouse already full" : "No resource change";
}

export function describeTileActions(state: GameState, tile: PlacedTile): TileActions {
  const playerId = state.currentPlayerId;
  const enhancers = readyEnhancers(state);
  const name = selectTileName(tile);
  const category = getTileCategory(tile);
  const reachable = selectReachablePlacedTileIds(state, playerId).has(tile.instanceId);
  const options: TileActionOption[] = [];
  const isTurn = state.phase === "turns";
  let linkedTileIds: string[] = [];

  if (hasActivatedEffect(tile)) {
    const activatable = getActivatableTileIds(state, playerId).includes(tile.instanceId);
    const forecast = activatable && isTurn ? previewTileAction(state, playerId, { type: "activate", placedTileId: tile.instanceId }) : undefined;
    const production = coreTileById[tile.tileId]?.[tile.side === "upgraded" ? "upgraded" : "basic"].effectType === "production";
    linkedTileIds = production && activatable ? getLinkedProductionTileIds(state, tile.instanceId) : [];
    const reason = !isTurn ? "Only on a player turn."
      : tile.strain >= 3 ? "Overstrained tiles can’t be activated."
      : !reachable ? `Not reachable from ${stewardName(state)}’s position.`
      : state.actionsRemaining <= 0 ? "No actions left this turn."
      : !activatable ? "Already used as often as its card allows."
      : forecast && !forecast.available ? forecast.notes[0]
      : undefined;
    options.push({
      kind: "activate",
      available: !reason && Boolean(forecast?.available),
      title: linkedTileIds.length > 0 ? `Activate · Linked harvest` : "Activate",
      detail: linkedTileIds.length > 0 ? `${linkedTileIds.length + 1} tiles produce together` : production ? "This tile produces" : currentEffectText(tile).replace(/^Activate(?:d Effect)?[^:]*:\s*/i, ""),
      reason,
      forecast,
      enhanced: isTurn ? bestEnhancement(enhancers, !reason ? forecast : undefined, (applied) => getActivatableTileIds(applied, playerId).includes(tile.instanceId) ? previewTileAction(applied, playerId, { type: "activate", placedTileId: tile.instanceId }) : undefined) : undefined
    });
  }

  if (tile.kind === "core" && tile.side === "basic") {
    const validation = canStartUpgradeTile(state, playerId, tile.instanceId);
    const forecast = validation.ok ? previewTileAction(state, playerId, { type: "upgrade", placedTileId: tile.instanceId }) : undefined;
    const upgraded = coreTileById[tile.tileId]?.upgraded;
    options.push({
      kind: "upgrade",
      available: validation.ok && Boolean(forecast?.available),
      title: `Upgrade to ${upgraded?.name ?? "its upgraded side"}`,
      detail: upgraded ? upgradedSummary(upgraded) : "",
      reason: validation.ok ? undefined : friendlyReason(validation.reasons[0]),
      forecast,
      enhanced: isTurn ? bestEnhancement(enhancers, validation.ok ? forecast : undefined, (applied) => canStartUpgradeTile(applied, playerId, tile.instanceId).ok ? previewTileAction(applied, playerId, { type: "upgrade", placedTileId: tile.instanceId }) : undefined) : undefined
    });
  }

  return { tile, name, category, effectText: currentEffectText(tile), options, linkedTileIds };
}

function upgradedSummary(side: TileSideData): string {
  if (side.effectType === "production" && side.production) {
    const production = side.production;
    const parts = resources.filter((resource) => production[resource] > 0).map((resource) => `${production[resource]} ${resourceLabels[resource]}`);
    return `Then produces ${parts.join(" + ")}`;
  }
  const parts = [side.population ? `${side.population} Population` : "", side.renown ? `${side.renown} Renown` : ""].filter(Boolean);
  return parts.length ? `Worth ${parts.join(" and ")}` : "";
}

function friendlyReason(reason: string | undefined): string | undefined {
  if (!reason) return undefined;
  const missing = /(?:missing|insufficient) (\d+) ([a-z]+)/i.exec(reason);
  if (missing) return `Need ${missing[1]} more ${missing[2][0].toUpperCase()}${missing[2].slice(1).toLowerCase()}.`;
  return reason
    .replace(/^Cannot upgrade(?: now)?:\s*/i, "")
    .replace(/^Cannot place(?: now)?:\s*/i, "")
    .replace(/\.$/, "") + ".";
}

export interface HexPlaceOption {
  choice: PlaceTileChoice;
  draft: TilePlacementDraft | null;
  /** Fits the space but the Warehouse can't cover it, or no actions remain. */
  blocked?: string;
  needsOrientation: boolean;
  needsSecondSpace: boolean;
  /** The same placement with a Boon or the Steward's power folded in. */
  enhanced?: EnhancedOption & { draft: TilePlacementDraft };
  /** Only possible with the Boon or power. */
  onlyEnhanced?: boolean;
}

export interface HexOptions {
  hexId: string;
  terrain: string;
  placeable: HexPlaceOption[];
  blocked: HexPlaceOption[];
}

const costReason = /insufficient|no actions|actions remain/i;

/** True when the only problems are resources or actions, not where the tile goes. */
function fitsIgnoringCost(reasons: string[]): boolean {
  return reasons.every((reason) => costReason.test(reason));
}

function shortfallText(missing: string[]): string | undefined {
  const named = missing.map((entry) => entry.replace(/[a-z]+$/, (word) => word[0].toUpperCase() + word.slice(1)));
  return named.length ? `Need ${named.join(", ")} more` : undefined;
}

/**
 * The same payment check placing makes, including Burden and Boon modifiers
 * such as a surcharge. The opening check does not count those, so without
 * this a tile could look buildable and then fail at payment.
 */
function placementPayment(state: GameState, playerId: string, tileId: string, draft: TilePlacementDraft): { ok: boolean; reason?: string } {
  const core = coreTileById[tileId];
  const special = specialTileById[tileId];
  const data = core ?? special;
  if (!data) return { ok: true };
  const hexIds = getTilePlacementHexIds(tileId, draft);
  const baseCost = applyShelterInTheRuins(core ? core.basic.cost : { wood: 0, stone: 0, metal: 0, food: 0, herbs: 0, goods: 0 }, hexIds);
  const target = { action: "place", tileId, category: data.category, kind: core ? "core" : "special", baseCost } as const;
  const actionCost = getBoonActionPreview(state, target).actionCost;
  const options = [...getBoonCostOptions(state, target), ...getPassiveCostOptions(state, { action: "place", playerId, category: data.category, kind: core ? "core" : "special", placementHexIds: hexIds, cost: baseCost })];
  if (findAffordableCostSelection(state, baseCost, options, actionCost)) return { ok: true };
  const required = options.filter((option) => option.required);
  const cost = applyCostChoice(state, baseCost, options, {
    selectedOptionIds: required.map((option) => option.id),
    surchargeResourceByOptionId: Object.fromEntries(required.filter((option) => option.kind === "surcharge" && option.resourceChoices?.length).map((option) => [option.id, option.resourceChoices![0]]))
  });
  const short = resources.filter((resource) => cost[resource] > state.warehouse[resource]).map((resource) => `${cost[resource] - state.warehouse[resource]} ${resourceLabels[resource]}`);
  const surcharge = required.find((option) => option.kind === "surcharge");
  return { ok: false, reason: `${short.length ? `Need ${short.join(", ")} more` : "Can’t be paid right now"}${surcharge ? ` with ${surcharge.sourceName}` : ""}` };
}

/** Every tile that can legally go on this empty space, best first. */
export function describeHexOptions(state: GameState, hexId: string, orientation: HexDirection): HexOptions {
  const playerId = state.currentPlayerId;
  const cell = mapById[hexId];
  const choices = getPlaceTileChoices(state, playerId, [hexId], orientation);
  const placeable: HexPlaceOption[] = [];
  const blocked: HexPlaceOption[] = [];
  const enhancers = state.phase === "turns" ? readyEnhancers(state) : [];
  for (const choice of choices) {
    if (!choice.hasEnoughSupply) continue;
    const kind = getTileFootprintKind(choice.id);
    const drafts: TilePlacementDraft[] = kind === "line"
      ? hexDirections.map((direction) => ({ anchorHexId: hexId, orientation: direction }))
      : [{ anchorHexId: hexId }];
    const fitsDraft = kind === "detached"
      ? getLegalPlacementHexes(state, playerId, choice.id, {}).includes(hexId) ? { anchorHexId: hexId } : undefined
      : drafts.find((draft) => fitsIgnoringCost(canPlaceTile(state, playerId, choice.id, draft).reasons));
    if (!fitsDraft) continue;
    const startable = kind === "detached"
      ? choice.placeableNow
      : drafts.find((draft) => canStartPlaceTile(state, playerId, choice.id, draft).ok);
    const option: HexPlaceOption = {
      choice,
      draft: startable && typeof startable === "object" ? startable : fitsDraft,
      needsOrientation: kind === "line",
      needsSecondSpace: kind === "detached"
    };
    const payment = startable && choice.placeableNow && typeof startable === "object" ? placementPayment(state, playerId, choice.id, startable) : { ok: true };
    const plainOk = Boolean(startable && choice.placeableNow && payment.ok);
    // Detached tiles (Stables) choose a second space later, so they are offered plain only.
    if (kind !== "detached" && enhancers.length) {
      let enhancedDraft: TilePlacementDraft | undefined;
      const best = bestEnhancement(enhancers, plainOk && typeof startable === "object" ? previewTileAction(state, playerId, { type: "place", tileId: choice.id, draft: startable }) : undefined, (applied) => {
        enhancedDraft = drafts.find((draft) => canStartPlaceTile(applied, playerId, choice.id, draft).ok && placementPayment(applied, playerId, choice.id, draft).ok);
        return enhancedDraft ? previewTileAction(applied, playerId, { type: "place", tileId: choice.id, draft: enhancedDraft }) : undefined;
      });
      if (best && enhancedDraft) option.enhanced = { ...best, draft: enhancedDraft };
    }
    if (!plainOk && option.enhanced) { placeable.push({ ...option, onlyEnhanced: true }); continue; }
    if (startable && choice.placeableNow && !payment.ok) { blocked.push({ ...option, blocked: payment.reason }); continue; }
    if (plainOk) placeable.push(option);
    else blocked.push({ ...option, blocked: shortfallText(choice.missingResources) ?? choice.blockedReasons.find((reason) => reason !== "No legal placement") ?? "Can’t be placed right now" });
  }
  // Options a Boon or power improves come first, so the player sees them.
  placeable.sort((a, b) => Number(Boolean(b.enhanced)) - Number(Boolean(a.enhanced)));
  return { hexId, terrain: cell ? terrainLabels[cell.terrain] : "", placeable, blocked };
}

/** Orientations of a line tile (Street, Track) that are legal and affordable at an anchor. */
export function legalOrientations(state: GameState, tileId: string, anchorHexId: string): HexDirection[] {
  return hexDirections.filter((orientation) => canStartPlaceTile(state, state.currentPlayerId, tileId, { anchorHexId, orientation }).ok);
}

export function footprintFor(tileId: string, draft: TilePlacementDraft): string[] {
  return getTilePlacementHexIds(tileId, draft);
}

/** Legal spaces for a tile chosen first (from the rail or the supply). */
export function legalSpacesFor(state: GameState, tileId: string, draft: TilePlacementDraft): string[] {
  const kind = getTileFootprintKind(tileId);
  if (kind === "line") {
    const all = new Set<string>();
    for (const orientation of hexDirections) {
      for (const hexId of getLegalPlacementHexes(state, state.currentPlayerId, tileId, { orientation })) all.add(hexId);
    }
    return [...all];
  }
  return getLegalPlacementHexes(state, state.currentPlayerId, tileId, draft);
}

export function tileName(tileId: string): string {
  return coreTileById[tileId]?.basic.name ?? specialTileById[tileId]?.name ?? goldenTileById[tileId]?.name ?? tileId;
}
