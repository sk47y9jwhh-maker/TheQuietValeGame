import fs from "node:fs/promises";
import path from "node:path";
import { createBoonModifierFromCard } from "../../src/engine/boonModifiers";
import { cardEffectRuleId } from "../../src/data/effectRules";
import {
  activateTile,
  canStartPlaceTile,
  confirmCostChoice,
  placeTile,
  resolveEndRound,
  useStewardPower,
} from "../../src/engine/gameActions";
import {
  effectHasNoValidChoiceTargets,
  isTileAdjustmentValid,
  resolvePendingEffect,
  suggestEffectAdjustment,
} from "../../src/engine/manualEffects";
import {
  applyCostChoice,
  costTotal,
  getPassiveCostOptions,
  recordPassiveCostChoices,
  validateCostChoiceSelection,
} from "../../src/engine/passiveCosts";
import {
  calculateFinalScore,
  evaluateStewardObjectives,
} from "../../src/engine/scoring";
import { createNewGame } from "../../src/engine/setup";
import type {
  CostChoiceSelection,
  GameState,
  PlacedTile,
  ResourceCost,
} from "../../src/engine/types";

const tile = (
  instanceId: string,
  tileId: string,
  hexId: string,
  side: PlacedTile["side"] = "basic",
): PlacedTile => ({
  instanceId,
  tileId,
  kind: side === "special" ? "special" : "core",
  side,
  hexIds: [hexId],
  strain: 0,
  support: { passive: false, singleUse: false, preventedThisRound: false },
});

const emptyWarehouse = () => ({
  wood: 0,
  stone: 0,
  metal: 0,
  food: 0,
  herbs: 0,
  goods: 0,
});

function cartsRefreshFanOutProbe() {
  const state = createNewGame(1, ["vanguard"]);
  state.phase = "turns";
  state.season = 3;
  state.warehouse = {
    wood: 20,
    stone: 20,
    metal: 20,
    food: 20,
    herbs: 20,
    goods: 20,
  };
  state.map.placedTiles = [
    tile("road_1", "c15_path", "G1"),
    tile("workshop_1", "c13_workshops", "H1", "upgraded"),
    tile("road_2", "c15_path", "G2"),
    tile("workshop_2", "c13_workshops", "H2", "upgraded"),
    tile("upgrade_target", "c05_cabin", "I1"),
    tile("market_1", "c14_market_stalls", "J1", "upgraded"),
    tile("road_3", "c15_path", "K1"),
    tile("market_2", "c14_market_stalls", "J2", "upgraded"),
    tile("road_4", "c15_path", "K2"),
  ];
  state.players[0].stewardHexId = "I1";
  state.players[0].hasPlacedFirstTile = true;
  for (const id of ["workshop_1", "workshop_2", "market_1", "market_2"]) {
    state.tileActivationRecords[id] = { round: state.round };
  }
  const modifier = createBoonModifierFromCard(
    state,
    "boon_carts_before_sunrise",
  );
  state.boonModifiers = modifier ? [modifier] : [];

  const baseCost: ResourceCost = {
    wood: 0,
    stone: 8,
    metal: 8,
    food: 0,
    herbs: 0,
    goods: 0,
  };
  const target = state.map.placedTiles.find(
    (candidate) => candidate.instanceId === "upgrade_target",
  );
  const options = getPassiveCostOptions(state, {
    action: "upgrade",
    playerId: "player_1",
    category: "housing",
    kind: "core",
    targetTile: target,
    cost: baseCost,
  });
  const refreshed = options.filter((option) => option.boonModifierId === modifier?.id);
  const fanOutSelection: CostChoiceSelection = {
    selectedOptionIds: refreshed.map((option) => option.id),
    marketResourceByOptionId: Object.fromEntries(
      refreshed
        .filter((option) => option.kind === "market")
        .map((option) => [option.id, "stone"]),
    ),
  };
  const chosen = refreshed.find((option) => option.kind === "discount") ?? refreshed[0];
  const selection: CostChoiceSelection = {
    selectedOptionIds: chosen ? [chosen.id] : [],
    ...(chosen?.kind === "market"
      ? { marketResourceByOptionId: { [chosen.id]: "stone" } }
      : {}),
  };
  const finalCost = applyCostChoice(state, baseCost, options, selection);
  const defensivelyBoundedFanOutCost = applyCostChoice(
    state,
    baseCost,
    options,
    fanOutSelection,
  );
  const recorded = recordPassiveCostChoices(state, options, selection);

  return {
    modifierId: modifier?.id,
    modifierRemainingUsesBefore: modifier?.remainingUses,
    eligibleRefreshedPassiveCount: refreshed.length,
    requiredRefreshedPassiveCount: refreshed.filter((option) => option.required).length,
    refreshedSources: refreshed.map((option) => ({
      sourceTileId: option.sourceTileId,
      kind: option.kind,
      amount: option.amount ?? option.marketRate,
      boonModifierId: option.boonModifierId,
    })),
    uniqueRefreshModifierIds: [...new Set(refreshed.map((option) => option.boonModifierId))],
    fanOutSelectionValid: validateCostChoiceSelection(options, fanOutSelection),
    selectedRefreshCount: selection.selectedOptionIds.length,
    selectedRefreshSource: chosen?.sourceTileId,
    baseCost,
    finalCost,
    defensivelyBoundedFanOutCost,
    baseCostTotal: costTotal(baseCost),
    finalCostTotal: costTotal(finalCost),
    netResourceSaving: costTotal(baseCost) - costTotal(finalCost),
    modifierCountAfterRecordingOne: recorded.boonModifiers.length,
  };
}

function arrivalEndgameShieldProbe() {
  const makeState = (timerTokens: number): GameState => {
    const state = createNewGame(1, ["vanguard"]);
    state.phase = "endRound";
    state.round = 12;
    state.season = 3;
    state.map.placedTiles = [tile("home", "c05_cabin", "G1")];
    state.encounters.activeArrivals = [
      { cardId: "arrival_the_quiet_quest", timerTokens },
    ];
    return state;
  };

  const shielded = resolveEndRound(makeState(2));
  const expiredPrompt = resolveEndRound(makeState(1));
  const expired = resolvePendingEffect(expiredPrompt, {
    tileStrainDeltas: { home: 1 },
  });
  const shieldedScore = calculateFinalScore(shielded);
  const expiredScore = calculateFinalScore(expired);

  return {
    shielded: {
      activeArrivalTimersAtGameEnd: shielded.encounters.activeArrivals.map(
        (arrival) => arrival.timerTokens,
      ),
      failedArrivals: shieldedScore.failedArrivals,
      failedArrivalPenalty: shieldedScore.failedArrivalPenalty,
      unfulfilledPromises: shieldedScore.unfulfilledPromises,
      unfulfilledPromisePenalty: shieldedScore.unfulfilledPromisePenalty,
      strainPenalty: shieldedScore.strainPenalty,
      finalScore: shieldedScore.finalScore,
    },
    expired: {
      activeArrivalTimersAtGameEnd: expired.encounters.activeArrivals.map(
        (arrival) => arrival.timerTokens,
      ),
      failedArrivals: expiredScore.failedArrivals,
      failedArrivalPenalty: expiredScore.failedArrivalPenalty,
      unfulfilledPromises: expiredScore.unfulfilledPromises,
      unfulfilledPromisePenalty: expiredScore.unfulfilledPromisePenalty,
      strainPenalty: expiredScore.strainPenalty,
      finalScore: expiredScore.finalScore,
    },
    scoreSwingFromOneExtraPreEndTimer:
      shieldedScore.finalScore - expiredScore.finalScore,
  };
}

function zeroActionLinkedProductionProbe() {
  const state = createNewGame(1, ["vanguard"]);
  state.phase = "turns";
  state.season = 3;
  state.actionsRemaining = 4;
  state.warehouse = emptyWarehouse();
  state.map.placedTiles = [
    tile("road", "c15_path", "I2"),
    tile("producer_1", "c01_lumber_yard", "H1", "upgraded"),
    tile("producer_2", "c01_lumber_yard", "G1", "upgraded"),
    tile("producer_3", "c01_lumber_yard", "I1", "upgraded"),
  ];
  state.players[0].stewardHexId = "H1";
  state.players[0].hasPlacedFirstTile = true;
  const modifier = createBoonModifierFromCard(
    state,
    "boon_carts_before_sunrise",
  );
  state.boonModifiers = modifier ? [modifier] : [];
  const activated = activateTile(state, "player_1", "producer_1");
  const repeated = activateTile(activated, "player_1", "producer_2");

  return {
    actionsBefore: state.actionsRemaining,
    actionsAfter: activated.actionsRemaining,
    actionsAfterRepeat: repeated.actionsRemaining,
    warehouseBefore: state.warehouse,
    warehouseAfter: activated.warehouse,
    warehouseAfterRepeat: repeated.warehouse,
    resourcesProduced: Object.values(activated.warehouse).reduce(
      (total, amount) => total + amount,
      0,
    ),
    resourcesProducedByRepeat: Object.values(repeated.warehouse).reduce(
      (total, amount) => total + amount,
      0,
    ) - Object.values(activated.warehouse).reduce(
      (total, amount) => total + amount,
      0,
    ),
    modifierRemainingAfter: activated.boonModifiers.find(
      (candidate) => candidate.id === modifier?.id,
    )?.remainingUses ?? 0,
    activationRecords: repeated.tileActivationRecords,
  };
}

function noTargetAcknowledgementProbe() {
  const state = createNewGame(1, ["vanguard"]);
  state.phase = "turns";
  state.season = 2;
  state.map.placedTiles = [];
  const ruleId = cardEffectRuleId("burden_coin_before_craft", 2);
  const suggestion = suggestEffectAdjustment(state, ruleId);
  return {
    ruleId,
    engineReportsNoValidChoiceTargets: effectHasNoValidChoiceTargets(
      state,
      ruleId,
    ),
    suggestedAdjustment: suggestion.adjustment,
    requiresManualChoice: suggestion.requiresManualChoice,
    emptyAcknowledgementPassesTileValidation: isTileAdjustmentValid(
      state,
      ruleId,
      {},
    ),
  };
}

function quartermasterOpeningObjectiveProbe() {
  const supportingStewards = ["vanguard", "knight", "sentinel"];
  return Object.fromEntries(
    ([1, 2, 3, 4] as const).map((playerCount) => {
      const state = createNewGame(
        playerCount,
        ["quartermaster", ...supportingStewards].slice(0, playerCount),
      );
      const objective = evaluateStewardObjectives(state).find(
        (candidate) => candidate.stewardId === "quartermaster",
      );
      return [
        playerCount,
        {
          startingWarehouse: state.warehouse,
          resourceTypesAtFiveOrMore: objective?.current,
          target: objective?.target,
          alreadyMetAtSetup: objective?.met,
        },
      ];
    }),
  );
}

function smallStorehouseSetupProbe() {
  const stewards = ["vanguard", "knight", "sentinel", "ranger"];
  return Object.fromEntries(
    ([1, 2, 3, 4] as const).map((playerCount) => {
      const state = createNewGame(
        playerCount,
        stewards.slice(0, playerCount),
        { declaredVowId: "LE-043" },
      );
      return [
        playerCount,
        {
          startingWarehouse: state.warehouse,
          startingPeak: Math.max(...Object.values(state.warehouse)),
          violationReasons: state.ledgerRun?.violatedVowReasons ?? [],
          failedBeforeFirstAction:
            (state.ledgerRun?.violatedVowReasons.length ?? 0) > 0,
        },
      ];
    }),
  );
}

function improvedPathNetworkProbe() {
  const state = createNewGame(1, ["vanguard"]);
  state.phase = "gameEnd";
  state.map.placedTiles = "GHIJKLMN".split("").map((column, index) =>
    tile(`path_${index + 1}`, "c15_path", `${column}1`, "upgraded"),
  );
  const score = calculateFinalScore(state);
  return {
    connectedImprovedPaths: state.map.placedTiles.length,
    printedRenown: score.printedRenown,
    connectedGroupPassiveRenown: score.passiveRenown,
    finalScore: score.finalScore,
    totalUpgradeStoneCost: state.map.placedTiles.length * 2,
    placementActionsWithoutGoldenVial: state.map.placedTiles.length,
    upgradeActions: state.map.placedTiles.length,
  };
}

function zeroActionZeroResourceHousingProbe() {
  const state = createNewGame(1, ["knight"]);
  state.phase = "turns";
  state.actionsRemaining = 4;
  state.warehouse = emptyWarehouse();
  state.map.placedTiles = [
    tile("brewery", "special_brewery_of_legends", "H1", "special"),
    tile("home", "c05_cabin", "I2"),
  ];
  state.players[0].stewardHexId = "I2";
  state.players[0].hasPlacedFirstTile = true;

  const powered = useStewardPower(state, "player_1");
  const steddingBaseCost: ResourceCost = {
    wood: 0,
    stone: 4,
    metal: 6,
    food: 8,
    herbs: 0,
    goods: 0,
  };
  const placementCostOptions = getPassiveCostOptions(powered, {
    action: "place",
    playerId: "player_1",
    category: "housing",
    kind: "core",
    placementHexIds: ["I1"],
    cost: steddingBaseCost,
  });
  const placementValidation = canStartPlaceTile(
    powered,
    "player_1",
    "c07_stedding",
    { anchorHexId: "I1" },
  );
  const prompted = placeTile(
    powered,
    "player_1",
    "c07_stedding",
    { anchorHexId: "I1" },
  );
  const requiredOptions = prompted.pendingCostChoice?.options.filter(
    (option) => option.required,
  ) ?? [];
  const placed = prompted.pendingCostChoice
    ? confirmCostChoice(prompted, {
        selectedOptionIds: requiredOptions.map((option) => option.id),
      })
    : prompted;
  const stedding = placed.map.placedTiles.find(
    (candidate) => candidate.tileId === "c07_stedding",
  );
  const scoreBeforePlacement = calculateFinalScore({
    ...state,
    phase: "gameEnd",
  }).finalScore;
  const scoreAfterPlacement = calculateFinalScore({
    ...placed,
    phase: "gameEnd",
  }).finalScore;

  return {
    actionsBefore: state.actionsRemaining,
    actionsAfter: placed.actionsRemaining,
    warehouseBefore: state.warehouse,
    warehouseAfter: placed.warehouse,
    baseResourceCost: steddingBaseCost,
    baseResourceCostTotal: costTotal(steddingBaseCost),
    applicableCostOptions: placementCostOptions.map((option) => ({
      kind: option.kind,
      sourceName: option.sourceName,
      required: option.required,
    })),
    placementValidation,
    steddingPlaced: Boolean(stedding),
    breweryUseRecordedForSeason:
      placed.tileActivationRecords.brewery?.season,
    activeModifiersAfterPlacement: placed.boonModifiers.map((modifier) => ({
      sourceCardId: modifier.sourceCardId,
      remainingUses: modifier.remainingUses,
    })),
    scoreBeforePlacement,
    scoreAfterPlacement,
    marginalScoreFromPlacement: scoreAfterPlacement - scoreBeforePlacement,
  };
}

async function main() {
  const output = process.argv[2] ??
    "outputs/adversarial-audit/focused-rules-probes.json";
  const result = {
    generatedAt: new Date().toISOString(),
    cartsRefreshFanOut: cartsRefreshFanOutProbe(),
    cartsZeroActionLinkedProduction: zeroActionLinkedProductionProbe(),
    arrivalEndgameShield: arrivalEndgameShieldProbe(),
    noTargetAcknowledgement: noTargetAcknowledgementProbe(),
    quartermasterOpeningObjective: quartermasterOpeningObjectiveProbe(),
    smallStorehouseAtSetup: smallStorehouseSetupProbe(),
    improvedPathNetwork: improvedPathNetworkProbe(),
    zeroActionZeroResourceHousing: zeroActionZeroResourceHousingProbe(),
  };
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}

await main();
