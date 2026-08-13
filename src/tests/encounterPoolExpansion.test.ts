import { describe, expect, it } from "vitest";
import { getBurdenResolutionCost } from "../data/contentRules";
import { cardEffectRuleId, getEffectRule } from "../data/effectRules";
import {
  activateTile,
  cancelPendingBurdenWithWarden,
  completeArrival,
  confirmCostChoice,
  placeTile,
  revealEncounters,
  resolveBurden,
  useFaceUpBoon
} from "../engine/gameActions";
import {
  queuePendingEffect,
  resolvePendingEffect
} from "../engine/manualEffects";
import { createNewGame } from "../engine/setup";
import type {
  GameState,
  PlacedTile,
  ResourceCost,
  ResourceType,
  Season
} from "../engine/types";

const emptyWarehouse = (): ResourceCost => ({
  wood: 0,
  stone: 0,
  metal: 0,
  food: 0,
  herbs: 0,
  goods: 0
});

function tile(
  instanceId: string,
  tileId: string,
  hexId: string,
  strain = 0
): PlacedTile {
  return {
    instanceId,
    tileId,
    kind: "core",
    side: "basic",
    hexIds: [hexId],
    strain,
    support: {
      passive: false,
      singleUse: false,
      preventedThisRound: false
    }
  };
}

function readyState(
  season: Season,
  placedTiles: PlacedTile[] = [],
  stewardId = "vanguard"
): GameState {
  const state = createNewGame(1, [stewardId]);
  state.phase = "turns";
  state.season = season;
  state.actionsRemaining = 4;
  state.warehouse = emptyWarehouse();
  state.map.placedTiles = placedTiles;
  state.players[0].hasPlacedFirstTile = placedTiles.length > 0;
  state.players[0].stewardHexId = placedTiles[0]?.hexIds[0] ?? "G1";
  return state;
}

function revealSingle(
  cardId: string,
  season: Season,
  placedTiles: PlacedTile[] = [],
  stewardId = "vanguard"
): GameState {
  const state = readyState(season, placedTiles, stewardId);
  state.phase = "reveal";
  state.encounters.deck = [cardId];
  return revealEncounters(state);
}

function requiredCostSelection(
  state: GameState,
  kind: "discount" | "surcharge",
  resource: ResourceType
) {
  const optionIds =
    state.pendingCostChoice?.options
      .filter((option) => option.required && option.kind === kind)
      .map((option) => option.id) ?? [];

  expect(optionIds).toHaveLength(2);
  return {
    selectedOptionIds: optionIds,
    ...(kind === "discount"
      ? {
          discountResourceByOptionId: Object.fromEntries(
            optionIds.map((optionId) => [optionId, resource])
          )
        }
      : {
          surchargeResourceByOptionId: Object.fromEntries(
            optionIds.map((optionId) => [optionId, resource])
          )
        })
  };
}

describe("30-card Boon and Burden pool expansion", () => {
  it("locks the approved seasonal scaling and resolution resources", () => {
    expect(getEffectRule(cardEffectRuleId("boon_change_of_watch", 1)).stewardMove)
      .toEqual({ supportDestination: true });
    expect(getEffectRule(cardEffectRuleId("boon_change_of_watch", 2)).stewardMove)
      .toEqual({ supportDestination: true, strainRelief: 1 });
    expect(getEffectRule(cardEffectRuleId("boon_change_of_watch", 3)).stewardMove)
      .toEqual({
        allowOverstrainedDestination: true,
        supportDestination: true,
        strainRelief: 2
      });

    expect(getEffectRule(cardEffectRuleId("boon_the_break_holds", 1)).modifier)
      .toMatchObject({
        uses: 1,
        immediateResources: { wood: 3 },
        preventsOverstrainSpread: true
      });
    expect(getEffectRule(cardEffectRuleId("boon_the_break_holds", 2)).modifier)
      .toMatchObject({
        uses: 2,
        immediateResources: { wood: 2 },
        preventsOverstrainSpread: true
      });
    expect(getEffectRule(cardEffectRuleId("boon_the_break_holds", 3)).modifier)
      .toMatchObject({
        duration: "round",
        immediateResources: { wood: 1 },
        preventsOverstrainSpread: true
      });

    expect(getEffectRule(cardEffectRuleId("boon_answers_made_ready", 1)).modifier)
      .toMatchObject({ actions: ["arrival", "burden"], uses: 1, zeroAction: true });
    expect(getEffectRule(cardEffectRuleId("boon_answers_made_ready", 2)).modifier)
      .toMatchObject({ actions: ["arrival", "burden"], uses: 2, zeroAction: true });
    expect(getEffectRule(cardEffectRuleId("boon_answers_made_ready", 3)).modifier)
      .toMatchObject({
        actions: ["arrival", "burden"],
        amount: 2,
        uses: 2,
        zeroAction: true
      });

    for (const season of [1, 2, 3] as const) {
      const road = getEffectRule(
        cardEffectRuleId("burden_the_road_takes_its_share", season)
      ).modifier;
      const plans = getEffectRule(
        cardEffectRuleId("burden_plans_left_waiting", season)
      ).modifier;

      expect(road).toMatchObject({
        actions: ["production"],
        productionLoss: 2
      });
      expect(plans).toMatchObject({
        actions: ["place", "upgrade"],
        extraCost: 2
      });
      expect(road?.uses).toBe(season === 2 ? 2 : 1);
      expect(plans?.uses).toBe(season === 2 ? 2 : 1);
      expect(road?.duration).toBe(season === 3 ? "round" : undefined);
      expect(plans?.duration).toBe(season === 3 ? "round" : undefined);
    }

    expect(getBurdenResolutionCost("burden_river_breaks_its_banks", 3))
      .toEqual({ ...emptyWarehouse(), wood: 6 });
    expect(getBurdenResolutionCost("burden_the_road_takes_its_share", 3))
      .toEqual({ ...emptyWarehouse(), goods: 6 });
    expect(getBurdenResolutionCost("burden_plans_left_waiting", 3))
      .toEqual({ ...emptyWarehouse(), food: 6 });
  });

  it.each([
    [1, 0, 0],
    [2, 2, 1],
    [3, 3, 1]
  ] as const)(
    "moves, supports, and relieves with Change of Watch in Season %s",
    (season, startingStrain, expectedStrain) => {
      const state = readyState(season, [
        tile("source", "c15_path", "G1"),
        tile("destination", "c05_cabin", "H1", startingStrain)
      ]);
      state.encounters.faceUpBoons = [
        { cardId: "boon_change_of_watch", remainingUses: 1 }
      ];

      const prompted = useFaceUpBoon(state, "boon_change_of_watch");
      const resolved = resolvePendingEffect(prompted, {
        stewardHexUpdates: { player_1: "H1" }
      });
      const destination = resolved.map.placedTiles.find(
        (candidate) => candidate.instanceId === "destination"
      );

      expect(resolved.players[0].stewardHexId).toBe("H1");
      expect(destination?.strain).toBe(expectedStrain);
      expect(destination?.support.singleUse).toBe(true);
    }
  );

  it("grants The Break Holds wood once and prevents each protected spread", () => {
    const state = readyState(2, [
      tile("lumber", "c01_lumber_yard", "G1", 2),
      tile("neighbour", "c05_cabin", "H1")
    ]);
    state.encounters.faceUpBoons = [
      { cardId: "boon_the_break_holds", remainingUses: 2 }
    ];

    const firstUse = resolvePendingEffect(
      useFaceUpBoon(state, "boon_the_break_holds")
    );
    expect(firstUse.warehouse.wood).toBe(2);

    const burdenPrompt = queuePendingEffect(firstUse, {
      sourceType: "card",
      ruleId: cardEffectRuleId("burden_forest_s_grudge", 2),
      sourceId: "burden_forest_s_grudge",
      sourceName: "Forest’s Grudge",
      title: "Test Burden",
      effectText: "Choose 1 Lumber Tile: +2 Strain.",
      requiresManualChoice: true
    });
    const burdenResolved = resolvePendingEffect(burdenPrompt);

    expect(
      burdenResolved.map.placedTiles.find(
        (candidate) => candidate.instanceId === "lumber"
      )?.strain
    ).toBe(3);
    expect(
      burdenResolved.map.placedTiles.find(
        (candidate) => candidate.instanceId === "neighbour"
      )?.strain
    ).toBe(0);
    expect(burdenResolved.pendingEffects).toHaveLength(0);
    expect(burdenResolved.boonModifiers).toHaveLength(0);

    const secondUse = useFaceUpBoon(
      burdenResolved,
      "boon_the_break_holds"
    );
    expect(secondUse.warehouse.wood).toBe(2);
  });

  it("makes two Season III Arrivals or Burdens free in Actions and 2 resources cheaper", () => {
    const state = readyState(3);
    state.actionsRemaining = 0;
    state.warehouse = {
      ...emptyWarehouse(),
      wood: 6,
      herbs: 2,
      goods: 4
    };
    state.encounters.activeArrivals = [
      { cardId: "arrival_the_quiet_quest", timerTokens: 3 }
    ];
    state.encounters.activeBurdens = ["burden_forest_s_grudge"];
    state.encounters.faceUpBoons = [
      { cardId: "boon_answers_made_ready", remainingUses: 2 }
    ];

    const arrivalReady = resolvePendingEffect(
      useFaceUpBoon(state, "boon_answers_made_ready")
    );
    const arrivalPrompt = completeArrival(
      arrivalReady,
      "arrival_the_quiet_quest"
    );
    expect(arrivalPrompt.pendingCostChoice?.actionCost).toBe(0);
    const arrivalCompleted = confirmCostChoice(
      arrivalPrompt,
      requiredCostSelection(arrivalPrompt, "discount", "goods")
    );

    expect(arrivalCompleted.actionsRemaining).toBe(0);
    expect(arrivalCompleted.warehouse.goods).toBe(2);
    expect(arrivalCompleted.warehouse.herbs).toBe(0);
    expect(arrivalCompleted.encounters.activeArrivals).toHaveLength(0);

    const burdenReady = resolvePendingEffect(
      useFaceUpBoon(
        resolvePendingEffect(arrivalCompleted),
        "boon_answers_made_ready"
      )
    );
    const burdenPrompt = resolveBurden(
      burdenReady,
      "burden_forest_s_grudge"
    );
    expect(burdenPrompt.pendingCostChoice?.actionCost).toBe(0);
    const burdenResolved = confirmCostChoice(
      burdenPrompt,
      requiredCostSelection(burdenPrompt, "discount", "wood")
    );

    expect(burdenResolved.actionsRemaining).toBe(0);
    expect(burdenResolved.warehouse.wood).toBe(2);
    expect(burdenResolved.encounters.activeBurdens).toHaveLength(0);
    expect(burdenResolved.encounters.faceUpBoons).toHaveLength(0);
  });

  it("strains a riverbank tile or loses Wood when no riverbank tile exists", () => {
    const riverbank = revealSingle("burden_river_breaks_its_banks", 1, [
      tile("riverbank", "c05_cabin", "C1")
    ]);
    const strained = resolvePendingEffect(riverbank);

    expect(strained.map.placedTiles[0].strain).toBe(1);

    const noRiverbankState = readyState(3);
    noRiverbankState.phase = "reveal";
    noRiverbankState.warehouse.wood = 3;
    noRiverbankState.encounters.deck = ["burden_river_breaks_its_banks"];
    const noRiverbank = resolvePendingEffect(
      revealEncounters(noRiverbankState)
    );

    expect(noRiverbank.warehouse.wood).toBe(0);
  });

  it("reduces the next two Season II Resource Tile Productions by 2", () => {
    const revealed = revealSingle("burden_the_road_takes_its_share", 2, [
      tile("lumber", "c01_lumber_yard", "G1"),
      tile("mine", "c02_mine_tunnel", "H1")
    ]);
    const ready = resolvePendingEffect(revealed);

    expect(ready.boonModifiers[0]).toMatchObject({
      sourceCardId: "burden_the_road_takes_its_share",
      remainingUses: 2,
      productionLoss: 2
    });

    const afterLumber = activateTile(ready, "player_1", "lumber");
    expect(afterLumber.warehouse.wood).toBe(0);
    expect(afterLumber.boonModifiers[0].remainingUses).toBe(1);

    const afterMine = activateTile(afterLumber, "player_1", "mine");
    expect(afterMine.warehouse.stone).toBe(0);
    expect(afterMine.boonModifiers).toHaveLength(0);
  });

  it("charges the Plans Left Waiting surcharge on a normally free placement", () => {
    const revealed = revealSingle("burden_plans_left_waiting", 1, [
      tile("road", "c15_path", "G1")
    ]);
    revealed.warehouse.wood = 2;
    const ready = resolvePendingEffect(revealed);

    const prompted = placeTile(
      ready,
      "player_1",
      "c01_lumber_yard",
      "H1"
    );
    expect(
      prompted.pendingCostChoice?.options.filter(
        (option) => option.kind === "surcharge"
      )
    ).toHaveLength(2);

    const placed = confirmCostChoice(
      prompted,
      requiredCostSelection(prompted, "surcharge", "wood")
    );

    expect(placed.warehouse.wood).toBe(0);
    expect(placed.map.placedTiles).toHaveLength(2);
    expect(placed.boonModifiers).toHaveLength(0);
  });

  it("removes a temporary Burden modifier when Warden cancels its reveal", () => {
    const revealed = revealSingle(
      "burden_the_road_takes_its_share",
      1,
      [],
      "warden"
    );
    expect(revealed.boonModifiers).toHaveLength(1);

    const cancelled = cancelPendingBurdenWithWarden(revealed);

    expect(cancelled.boonModifiers).toHaveLength(0);
    expect(cancelled.encounters.activeBurdens).toEqual([
      "burden_the_road_takes_its_share"
    ]);
  });
});
