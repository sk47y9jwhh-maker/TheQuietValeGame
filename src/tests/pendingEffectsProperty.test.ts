import { describe, expect, it } from "vitest";
import { arrivals, burdens, encounterById } from "../data/encounters";
import {
  effectRulesById,
  getEffectRule,
  stewardEffectRuleId,
  systemEffectRuleId
} from "../data/effectRules";
import { resources } from "../data/resources";
import { coreTileById, specialTileById } from "../data/tiles";
import {
  getAlternativeEffectRule,
  getEffectSupportTargets,
  getResourceGainChoiceRule,
  getStrainCascadeAnchorTargets,
  getStrainCascadeRule,
  getStrainCascadeSpreadTargets,
  getTileAdjustmentRule,
  getTimerAdjustmentRule,
  getValidEffectStrainTargets,
  preparePendingEffectQueueHead,
  refreshPendingEffectForCurrentState,
  resolvePendingEffect,
  skipPendingEffect,
  suggestEffectAdjustment
} from "../engine/manualEffects";
import { createNewGame } from "../engine/setup";
import { createTargetCardDeckState } from "../engine/targetCards";
import type {
  EffectAdjustment,
  GameState,
  PendingEffectState,
  PlacedTile,
  ResourceType
} from "../engine/types";

type ScenarioVariant = "boundary-empty" | "boundary-stocked" | "rich-empty" | "rich-stocked";

function placed(
  instanceId: string,
  tileId: string,
  hexId: string,
  strain = 0,
  side: PlacedTile["side"] = "basic"
): PlacedTile {
  return {
    instanceId,
    tileId,
    kind: side === "special" ? "special" : "core",
    side,
    hexIds: [hexId],
    strain,
    support: { passive: false, singleUse: false, preventedThisRound: false }
  };
}

function richBoard(): PlacedTile[] {
  return [
    placed("resource", "c01_lumber_yard", "G1"),
    placed("housing", "c05_cabin", "H1", 1),
    placed("travel", "c15_path", "F1", 2),
    placed("crafting", "c13_workshops", "G2"),
    placed("merchant", "c14_market_stalls", "H2", 1),
    placed("social", "c09_tavern", "F2", 2),
    placed("wellbeing", "c12_apothecary", "G3"),
    placed("dig", "c20_dig_site", "I1", 1),
    placed("upgraded_resource", "c04_farmstead", "J1", 0, "upgraded")
  ];
}

function sourceTileForRule(ruleId: string): PlacedTile | undefined {
  const [sourceId, side] = ruleId.split(":");
  if (coreTileById[sourceId] && (side === "basic" || side === "upgraded")) {
    return placed("source", sourceId, "G1", 1, side);
  }
  if (specialTileById[sourceId] && side === "special") {
    return placed("source", sourceId, "G1", 1, "special");
  }
  return undefined;
}

function pendingForRule(
  state: GameState,
  ruleId: string,
  id = `property_${ruleId}`
): PendingEffectState | null {
  const rule = getEffectRule(ruleId);
  if (rule.deckReorder) return null;
  const sourceTile = sourceTileForRule(ruleId);
  const sourceCardId = ruleId.split(":")[0];
  const sourceCard = encounterById[sourceCardId];
  const isOverstrainSpread = ruleId === systemEffectRuleId("overstrain-spread");
  const overstrainSource = isOverstrainSpread
    ? state.map.placedTiles.find((tile) => tile.strain >= 3) ?? state.map.placedTiles[0]
    : undefined;
  const resolvedSourceTile = sourceTile ?? overstrainSource;
  if (sourceTile && !state.map.placedTiles.some((tile) => tile.instanceId === "source")) {
    state.map.placedTiles = [sourceTile, ...state.map.placedTiles];
  }
  const suggestion = suggestEffectAdjustment(state, ruleId, resolvedSourceTile);
  const sourceType = resolvedSourceTile
    ? "tile"
    : sourceCard
      ? "card"
      : "system";
  const pending: PendingEffectState = {
    id,
    ruleId,
    sourceType,
    sourceId: resolvedSourceTile?.instanceId ?? sourceCardId,
    sourceName: sourceCard?.name ?? sourceIdForLabel(ruleId),
    title: sourceCard?.name ?? sourceIdForLabel(ruleId),
    effectText: "Property-generated structured effect.",
    suggestedAdjustment: suggestion.adjustment,
    requiresManualChoice: suggestion.requiresManualChoice,
    canSkip: sourceCard?.type === "boon" || Boolean(rule.optional),
    allowBurdenResolve: Boolean(rule.resolveBurden),
    resourceExchangeLimit: rule.exchangeLimit,
    resourceExchangeOptional: rule.exchangeOptional
  };
  if (ruleId === stewardEffectRuleId("ranger")) {
    pending.allowTemporaryReachPlayerId = state.players[0].id;
    pending.requiresManualChoice = true;
  }
  if (ruleId === stewardEffectRuleId("quartermaster")) {
    pending.resourceExchangeLimit = 5;
    pending.resourceExchangeOptional = true;
    pending.requiresManualChoice = true;
  }
  return pending;
}

function sourceIdForLabel(ruleId: string): string {
  return ruleId.replaceAll("_", " ");
}

function scenario(ruleId: string, variant: ScenarioVariant): GameState | null {
  const rich = variant.startsWith("rich");
  const stocked = variant.endsWith("stocked");
  const state = createNewGame(4, ["vanguard", "warden", "knight", "quartermaster"]);
  state.phase = "turns";
  state.players = state.players.map((player, index) => ({
    ...player,
    stewardHexId: ["G1", "H2", "F2", "I1"][index],
    hasPlacedFirstTile: true
  }));
  state.map.placedTiles = rich ? richBoard() : [];
  state.warehouse = Object.fromEntries(
    resources.map((resource) => [resource, stocked ? 12 : 0])
  ) as GameState["warehouse"];
  state.encounters.activeArrivals = rich
    ? arrivals.slice(0, 3).map((arrival, index) => ({
        cardId: arrival.id,
        timerTokens: index + 1
      }))
    : [];
  state.encounters.activeBurdens = rich
    ? burdens.slice(0, 2).map((burden) => burden.id)
    : [];
  const pending = pendingForRule(state, ruleId);
  if (!pending) return null;
  state.pendingEffects = [pending];
  return state;
}

function combinations<T>(items: T[], maxSize: number): T[][] {
  const result: T[][] = [[]];
  const visit = (start: number, selected: T[]) => {
    if (selected.length >= maxSize) return;
    for (let index = start; index < items.length; index += 1) {
      const next = [...selected, items[index]];
      result.push(next);
      visit(index + 1, next);
    }
  };
  visit(0, []);
  return result;
}

function exactStrainAdjustment(
  state: GameState,
  pending: PendingEffectState,
  targets: PlacedTile[],
  total: number
): EffectAdjustment | undefined {
  const sourceTile = pending.sourceType === "tile" && pending.sourceId
    ? state.map.placedTiles.find((tile) => tile.instanceId === pending.sourceId)
    : undefined;
  const strainRule = getTileAdjustmentRule(state, pending.ruleId, sourceTile).strain;
  if (!strainRule || total < targets.length || total <= 0) return undefined;
  const capacities = targets.map((tile) => Math.min(
    strainRule.maxPerTile,
    strainRule.direction === "remove" ? tile.strain : 3 - tile.strain
  ));
  if (capacities.some((capacity) => capacity < 1)) return undefined;
  const amounts = targets.map(() => 1);
  let remaining = total - targets.length;
  for (let index = 0; index < targets.length && remaining > 0; index += 1) {
    const extra = Math.min(capacities[index] - 1, remaining);
    amounts[index] += extra;
    remaining -= extra;
  }
  if (remaining > 0) return undefined;
  return {
    tileStrainDeltas: Object.fromEntries(
      targets.map((tile, index) => [
        tile.instanceId,
        strainRule.direction === "remove" ? -amounts[index] : amounts[index]
      ])
    )
  };
}

function spendingDeltas(
  state: GameState,
  allowedResources: ResourceType[],
  total: number
): Partial<Record<ResourceType, number>> | undefined {
  let remaining = total;
  const deltas: Partial<Record<ResourceType, number>> = {};
  for (const resource of allowedResources) {
    const spent = Math.min(state.warehouse[resource], remaining);
    if (spent > 0) deltas[resource] = -spent;
    remaining -= spent;
  }
  return remaining === 0 ? deltas : undefined;
}

function resolutionCandidates(state: GameState): EffectAdjustment[] {
  const queued = state.pendingEffects[0];
  if (!queued) return [];
  const pending = refreshPendingEffectForCurrentState(state, queued);
  const sourceTile = pending.sourceType === "tile" && pending.sourceId
    ? state.map.placedTiles.find((tile) => tile.instanceId === pending.sourceId)
    : undefined;
  const candidates: EffectAdjustment[] = [
    {},
    pending.suggestedAdjustment ?? {}
  ];

  if (pending.allowTemporaryReachPlayerId) {
    candidates.push({
      temporaryReachHexUpdates: {
        [pending.allowTemporaryReachPlayerId]: "G1"
      }
    });
  }
  if (pending.allowStewardMovementPlayerId) {
    candidates.push({
      stewardHexUpdates: { [pending.allowStewardMovementPlayerId]: "G1" }
    });
  }
  if (pending.allowBurdenIgnore && state.encounters.activeBurdens[0]) {
    candidates.push({ ignoredBurdenIds: [state.encounters.activeBurdens[0]] });
  }
  if (pending.allowBurdenResolve && state.encounters.activeBurdens[0]) {
    candidates.push({ resolvedBurdenIds: [state.encounters.activeBurdens[0]] });
  }

  const resourceGain = getResourceGainChoiceRule(
    state,
    pending.ruleId,
    sourceTile
  );
  if (resourceGain && resourceGain.amount > 0) {
    for (const resource of resourceGain.resources) {
      candidates.push({
        resourceDeltas: { [resource]: resourceGain.amount },
        tileStrainDeltas: resourceGain.alternativeToStrainRemoval
          ? Object.fromEntries(
              Object.keys(pending.suggestedAdjustment?.tileStrainDeltas ?? {})
                .map((tileId) => [tileId, 0])
            )
          : undefined
      });
    }
  }

  if (pending.resourceExchangeLimit !== undefined) {
    const sourceResource = resources.find(
      (resource) => state.warehouse[resource] > 0
    );
    const targetResource = resources.find((resource) => resource !== sourceResource);
    if (sourceResource && targetResource) {
      candidates.push({
        resourceDeltas: { [sourceResource]: -1, [targetResource]: 1 }
      });
    }
    if (
      getEffectRule(pending.ruleId).exchangeGoodsMode &&
      resources.filter((resource) => resource !== "goods")
        .reduce((total, resource) => total + state.warehouse[resource], 0) >= 5
    ) {
      let remaining = 5;
      const resourceDeltas: Partial<Record<ResourceType, number>> = { goods: 3 };
      for (const resource of resources.filter((candidate) => candidate !== "goods")) {
        const spent = Math.min(state.warehouse[resource], remaining);
        if (spent > 0) resourceDeltas[resource] = -spent;
        remaining -= spent;
      }
      if (remaining === 0) candidates.push({ resourceDeltas });
    }
  }

  const timerRule = getTimerAdjustmentRule(state, pending.ruleId, sourceTile);
  if (timerRule) {
    for (const arrival of state.encounters.activeArrivals) {
      const capacity = timerRule.direction === "add"
        ? 3 - arrival.timerTokens
        : arrival.timerTokens;
      if (capacity <= 0) continue;
      candidates.push({
        arrivalTimerDeltas: {
          [arrival.cardId]: timerRule.direction === "add" ? 1 : -1
        }
      });
    }
  }

  const cascade = getStrainCascadeRule(state, pending.ruleId, sourceTile);
  if (cascade) {
    for (const anchor of getStrainCascadeAnchorTargets(
      state,
      pending.ruleId,
      sourceTile
    )) {
      const spreadTargets = getStrainCascadeSpreadTargets(
        state,
        pending.ruleId,
        anchor.instanceId,
        sourceTile
      );
      const required = Math.min(cascade.maxSpreadTargets, spreadTargets.length);
      for (const selected of combinations(spreadTargets, required)
        .filter((choice) => choice.length === required)) {
        candidates.push({
          strainCascadeAnchorTileId: anchor.instanceId,
          tileStrainDeltas: Object.fromEntries(
            selected.map((tile) => [tile.instanceId, cascade.spreadStrain])
          )
        });
      }
    }
  }

  const strainRule = getTileAdjustmentRule(
    state,
    pending.ruleId,
    sourceTile
  ).strain;
  if (strainRule) {
    const targets = getValidEffectStrainTargets(
      state,
      pending.ruleId,
      sourceTile
    );
    const targetSets = combinations(
      targets,
      Math.min(strainRule.maxTargets, targets.length)
    ).filter((selected) => selected.length > 0);
    for (const selected of targetSets) {
      for (let total = selected.length; total <= strainRule.maxTotal; total += 1) {
        const candidate = exactStrainAdjustment(
          state,
          pending,
          selected,
          total
        );
        if (candidate) candidates.push(candidate);
      }
    }
  }

  const supportTargets = getEffectSupportTargets(
    state,
    pending.ruleId,
    sourceTile
  );
  const supportLimit = getTileAdjustmentRule(
    state,
    pending.ruleId,
    sourceTile
  ).support?.maxTargets ?? 0;
  for (const selected of combinations(
    supportTargets,
    Math.min(supportLimit, supportTargets.length)
  ).filter((choice) => choice.length > 0)) {
    candidates.push({ supportTileIds: selected.map((tile) => tile.instanceId) });
  }

  const alternative = getAlternativeEffectRule(
    state,
    pending.ruleId,
    sourceTile
  );
  if (alternative) {
    if (alternative.kind === "pay_or_strain") {
      const targets = getValidEffectStrainTargets(
        state,
        pending.ruleId,
        sourceTile
      );
      for (let strainChoices = 0; strainChoices <= alternative.requiredChoices; strainChoices += 1) {
        const payment = spendingDeltas(
          state,
          alternative.resources,
          alternative.resourceStep * (alternative.requiredChoices - strainChoices)
        );
        if (!payment) continue;
        for (const selected of combinations(targets, strainChoices)
          .filter((choice) => choice.length === strainChoices)) {
          candidates.push({
            resourceDeltas: payment,
            tileStrainDeltas: Object.fromEntries(
              selected.map((tile) => [tile.instanceId, alternative.strainPerChoice])
            )
          });
        }
      }
    } else if (alternative.kind === "pay_or_timer") {
      const arrivalsWithTimers = state.encounters.activeArrivals.filter(
        (arrival) => arrival.timerTokens >= alternative.timerPerChoice
      );
      for (let timerChoices = 0; timerChoices <= alternative.requiredChoices; timerChoices += 1) {
        const payment = spendingDeltas(
          state,
          alternative.resources,
          alternative.resourceStep * (alternative.requiredChoices - timerChoices)
        );
        if (!payment) continue;
        for (const selected of combinations(arrivalsWithTimers, timerChoices)
          .filter((choice) => choice.length === timerChoices)) {
          candidates.push({
            resourceDeltas: payment,
            arrivalTimerDeltas: Object.fromEntries(
              selected.map((arrival) => [
                arrival.cardId,
                -alternative.timerPerChoice
              ])
            )
          });
        }
      }
    } else if (alternative.kind === "pay_total_or_strain") {
      for (const resource of alternative.resources) {
        candidates.push({
          resourceDeltas: { [resource]: -alternative.resourceStep }
        });
      }
    } else if (alternative.kind === "warehouse_loss_or_strain") {
      for (const resource of alternative.resources) {
        candidates.push({
          resourceDeltas: { [resource]: -alternative.resourceStep }
        });
      }
    } else {
      const targets = getValidEffectStrainTargets(
        state,
        pending.ruleId,
        sourceTile
      );
      const strainRule = getTileAdjustmentRule(
        state,
        pending.ruleId,
        sourceTile
      ).strain;
      for (const resource of alternative.resources) {
        const expectedLoss = Math.min(
          alternative.resourceStep,
          state.warehouse[resource]
        );
        const strainRequired = alternative.strainWhen === "noneLost"
          ? expectedLoss === 0
          : expectedLoss < alternative.resourceStep;
        if (!strainRequired) {
          candidates.push({
            resourceDeltas: expectedLoss > 0 ? { [resource]: -expectedLoss } : undefined
          });
          continue;
        }
        if (!strainRule) continue;
        for (const selected of combinations(
          targets,
          Math.min(strainRule.maxTargets, targets.length)
        ).filter((choice) => choice.length > 0)) {
          const strainAdjustment = exactStrainAdjustment(
            state,
            pending,
            selected,
            alternative.requiredStrainTotal
          );
          if (!strainAdjustment) continue;
          candidates.push({
            ...strainAdjustment,
            resourceDeltas: expectedLoss > 0
              ? { [resource]: -expectedLoss }
              : undefined
          });
        }
      }
    }
  }

  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = JSON.stringify(candidate);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function resolveFirstLegalOutcome(state: GameState): GameState | null {
  const pendingId = state.pendingEffects[0]?.id;
  if (!pendingId) return state;
  for (const candidate of resolutionCandidates(state)) {
    const resolved = resolvePendingEffect(state, candidate);
    if (!resolved.pendingEffects.some((effect) => effect.id === pendingId)) {
      return resolved;
    }
  }
  if (state.pendingEffects[0]?.canSkip) {
    const skipped = skipPendingEffect(state);
    if (!skipped.pendingEffects.some((effect) => effect.id === pendingId)) {
      return skipped;
    }
  }
  return null;
}

function pseudoRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

describe("pending-effect resolution properties", () => {
  it("gives every structured queued effect a legal resolution or explicit skip", () => {
    const failures: string[] = [];
    const variants: ScenarioVariant[] = [
      "boundary-empty",
      "boundary-stocked",
      "rich-empty",
      "rich-stocked"
    ];
    for (const ruleId of Object.keys(effectRulesById).sort()) {
      for (const variant of variants) {
        const state = scenario(ruleId, variant);
        if (!state) continue;
        if (!resolveFirstLegalOutcome(state)) failures.push(`${ruleId}@${variant}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it("keeps every structured effect resolvable with standard Target Cards", () => {
    const failures: string[] = [];
    const variants: ScenarioVariant[] = [
      "boundary-empty",
      "boundary-stocked",
      "rich-empty",
      "rich-stocked"
    ];
    for (const ruleId of Object.keys(effectRulesById).sort()) {
      for (const variant of variants) {
        const state = scenario(ruleId, variant);
        if (!state) continue;
        state.targetCards = createTargetCardDeckState(
          `property:${ruleId}:${variant}`
        );
        const prepared = preparePendingEffectQueueHead(state);
        if (!resolveFirstLegalOutcome(prepared)) {
          failures.push(`${ruleId}@${variant}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it("drains 1,024 queued effects after deterministic random board mutations", () => {
    const random = pseudoRandom(0x51a7e);
    const cardRuleIds = Object.keys(effectRulesById).filter((ruleId) => {
      const source = encounterById[ruleId.split(":")[0]];
      return Boolean(source && !getEffectRule(ruleId).deckReorder);
    });
    const failures: string[] = [];

    for (let iteration = 0; iteration < 128; iteration += 1) {
      const state = scenario(cardRuleIds[0], "rich-stocked");
      if (!state) throw new Error("Could not create randomized queue state.");
      state.pendingEffects = [];
      for (let queueIndex = 0; queueIndex < 8; queueIndex += 1) {
        const ruleId = cardRuleIds[Math.floor(random() * cardRuleIds.length)];
        const pending = pendingForRule(
          state,
          ruleId,
          `random_${iteration}_${queueIndex}`
        );
        if (pending) state.pendingEffects.push(pending);
      }

      state.map.placedTiles = state.map.placedTiles.map((tile) => ({
        ...tile,
        strain: Math.floor(random() * 4)
      }));
      state.warehouse = Object.fromEntries(
        resources.map((resource) => [resource, Math.floor(random() * 13)])
      ) as GameState["warehouse"];
      state.encounters.activeArrivals = state.encounters.activeArrivals
        .filter(() => random() > 0.25)
        .map((arrival) => ({
          ...arrival,
          timerTokens: Math.floor(random() * 4)
        }));

      let current = state;
      for (let guard = 0; guard < 80 && current.pendingEffects.length > 0; guard += 1) {
        const pending = current.pendingEffects[0];
        const resolved = resolveFirstLegalOutcome(current);
        if (!resolved) {
          failures.push(`${iteration}:${pending.ruleId}:${pending.title}`);
          break;
        }
        current = resolved;
      }
      if (current.pendingEffects.length > 0 && failures.length === 0) {
        failures.push(`${iteration}:guard:${current.pendingEffects[0].ruleId}`);
      }
    }

    expect(failures).toEqual([]);
  });
});
