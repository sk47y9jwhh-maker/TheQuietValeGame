import { describe, expect, it } from "vitest";
import { boons, burdens } from "../data/encounters";
import {
  cardEffectRuleId,
  getEffectRule
} from "../data/effectRules";
import { getBurdenResolutionCostOptions } from "../data/contentRules";
import { createBoonModifierFromCard } from "../engine/boonModifiers";
import { confirmDeckReorder, queueDeckReorder } from "../engine/deckReorder";
import { activateTile, placeTile } from "../engine/gameActions";
import {
  effectHasNoValidChoiceTargets,
  getAlternativeEffectRule,
  getEffectTileTargets,
  getStrainCascadeSpreadTargets,
  isAlternativeEffectAdjustmentValid,
  isTileAdjustmentValid,
  resolvePendingEffect,
  suggestEffectAdjustment
} from "../engine/manualEffects";
import {
  applyCostChoice,
  getPassiveCostOptions,
  recordPassiveCostChoices
} from "../engine/passiveCosts";
import { createNewGame } from "../engine/setup";
import type {
  GameState,
  PlacedTile,
  ResourceType,
  Season
} from "../engine/types";

const physicalBoonIds = [
  "boon_a_light_on_the_long_dark_lanterns_illuminated_the_way_to_a_safer_day",
  "boon_bounty_of_the_first_harvest",
  "boon_carts_before_sunrise",
  "boon_craft_fair",
  "boon_ledgers_flow",
  "boon_old_foundations_still_remain",
  "boon_one_thousand_swings_of_the_pickaxe_opens_up_a_new_path",
  "boon_the_ancient_ways_gradually_reemerge",
  "boon_the_rains_that_we_sheltered_from_now_yield_the_bounty_of_nature",
  "boon_the_scent_of_herb_and_tonic",
  "boon_what_is_written_in_the_stars_can_finally_be_heeded"
] as const;

const physicalBurdenIds = [
  "burden_coin_before_craft",
  "burden_foundations_remember_war",
  "burden_ill_omen_of_discontent",
  "burden_old_wounds_reopen",
  "burden_only_road_in",
  "burden_roads_carry_needs",
  "burden_roads_too_far_from_home",
  "burden_stores_run_thin",
  "burden_the_burden_of_command",
  "burden_the_rot_within_the_vault",
  "burden_too_many_houses_too_little_homes"
] as const;

const emptyWarehouse = () => ({
  wood: 0,
  stone: 0,
  metal: 0,
  food: 0,
  herbs: 0,
  goods: 0
});

const tile = (
  instanceId: string,
  tileId: string,
  hexId: string,
  strain = 0,
  side: PlacedTile["side"] = "basic"
): PlacedTile => ({
  instanceId,
  tileId,
  kind: side === "special" ? "special" : "core",
  side,
  hexIds: [hexId],
  strain,
  support: { passive: false, singleUse: false, preventedThisRound: false }
});

function stateWith(tiles: PlacedTile[] = []): GameState {
  const state = createNewGame(1, ["vanguard"]);
  state.phase = "turns";
  state.actionsRemaining = 4;
  state.warehouse = emptyWarehouse();
  state.map.placedTiles = tiles;
  state.players[0].stewardHexId = tiles[0]?.hexIds[0] ?? "G1";
  state.players[0].hasPlacedFirstTile = tiles.length > 0;
  return state;
}

describe("formerly physical-only Encounter Cards", () => {
  it("registers all 22 cards and every seasonal effect rule", () => {
    expect(boons).toHaveLength(27);
    expect(burdens).toHaveLength(27);

    for (const cardId of [...physicalBoonIds, ...physicalBurdenIds]) {
      const card = [...boons, ...burdens].find((candidate) => candidate.id === cardId);
      expect(card?.flavorText, cardId).toBeTruthy();
      for (const season of [1, 2, 3] as const) {
        expect(getEffectRule(cardEffectRuleId(cardId, season)).id).toBe(
          cardEffectRuleId(cardId, season)
        );
      }
    }
  });

  it.each([
    [
      "boon_bounty_of_the_first_harvest",
      "c04_farmstead",
      "food",
      3
    ],
    [
      "boon_one_thousand_swings_of_the_pickaxe_opens_up_a_new_path",
      "c02_mine_tunnel",
      "stone",
      3
    ],
    [
      "boon_the_ancient_ways_gradually_reemerge",
      "c01_lumber_yard",
      "wood",
      3
    ],
    [
      "boon_the_rains_that_we_sheltered_from_now_yield_the_bounty_of_nature",
      "c03_gathering_outpost",
      "herbs",
      3
    ]
  ] as const)("applies %s to its next matching Production", (cardId, tileId, resource, expected) => {
    const state = stateWith([tile("producer", tileId, "G1")]);
    const modifier = createBoonModifierFromCard(state, cardId);
    expect(modifier).not.toBeNull();
    state.boonModifiers = modifier ? [modifier] : [];

    const next = activateTile(state, "player_1", "producer");
    expect(next.warehouse[resource as ResourceType]).toBe(expected);
    expect(next.boonModifiers).toHaveLength(0);
  });

  it("lets Carts Before Sunrise activate adjacent Resource Production for 0 Actions", () => {
    const state = stateWith([
      tile("producer", "c01_lumber_yard", "G1"),
      tile("road", "c15_path", "H1")
    ]);
    state.actionsRemaining = 0;
    const modifier = createBoonModifierFromCard(
      state,
      "boon_carts_before_sunrise"
    );
    state.boonModifiers = modifier ? [modifier] : [];

    const next = activateTile(state, "player_1", "producer");
    expect(next.actionsRemaining).toBe(0);
    expect(next.warehouse.wood).toBe(2);
    expect(next.boonModifiers).toHaveLength(0);
  });

  it("spends Carts Before Sunrise only when refreshing an already-used adjacent Passive", () => {
    const state = stateWith([
      tile("road", "c15_path", "G1"),
      tile("workshop", "c13_workshops", "H1"),
      tile("home", "c05_cabin", "I1")
    ]);
    state.season = 2;
    state.tileActivationRecords.workshop = { round: state.round };
    const modifier = createBoonModifierFromCard(
      state,
      "boon_carts_before_sunrise"
    );
    state.boonModifiers = modifier ? [modifier] : [];
    const options = getPassiveCostOptions(state, {
      action: "upgrade",
      playerId: "player_1",
      category: "housing",
      kind: "core",
      targetTile: state.map.placedTiles[2],
      cost: { ...emptyWarehouse(), stone: 2, food: 5 }
    });
    const refreshed = options.find((option) => option.sourceTileId === "workshop");
    expect(refreshed?.boonModifierId).toBe(modifier?.id);

    const next = recordPassiveCostChoices(state, options, {
      selectedOptionIds: [refreshed?.id ?? ""]
    });
    expect(next.boonModifiers).toHaveLength(0);
  });

  it("applies Crafting Fair's zero cost and post-placement support", () => {
    const state = stateWith([
      tile("road", "c15_path", "G1"),
      tile("home", "c05_cabin", "I1")
    ]);
    state.season = 3;
    const modifier = createBoonModifierFromCard(state, "boon_craft_fair");
    state.boonModifiers = modifier ? [modifier] : [];

    const placed = placeTile(state, "player_1", "c13_workshops", "H1");
    expect(placed.map.placedTiles.some((candidate) => candidate.tileId === "c13_workshops"))
      .toBe(true);
    expect(placed.warehouse).toEqual(emptyWarehouse());
    expect(placed.pendingEffects).toHaveLength(1);

    const resolved = resolvePendingEffect(placed, { supportTileIds: ["home"] });
    expect(
      resolved.map.placedTiles.find((candidate) => candidate.instanceId === "home")
        ?.support.singleUse
    ).toBe(true);
  });

  it("gives a newly placed home Supported through Old Foundations", () => {
    const state = stateWith([tile("road", "c15_path", "G1")]);
    state.warehouse = { ...emptyWarehouse(), wood: 2, food: 5 };
    const modifier = createBoonModifierFromCard(
      state,
      "boon_old_foundations_still_remain"
    );
    state.boonModifiers = modifier ? [modifier] : [];

    const next = placeTile(state, "player_1", "c05_cabin", "H1");
    const home = next.map.placedTiles.find((candidate) => candidate.tileId === "c05_cabin");
    expect(home?.support.singleUse).toBe(true);
  });

  it("checks Ledgers Flow against one connected component", () => {
    const connected = stateWith([
      tile("resource", "c01_lumber_yard", "G1"),
      tile("craft", "c13_workshops", "H1"),
      tile("merchant", "c14_market_stalls", "I1")
    ]);
    expect(
      suggestEffectAdjustment(
        connected,
        cardEffectRuleId("boon_ledgers_flow", 2)
      ).adjustment?.resourceDeltas
    ).toMatchObject({ goods: 3 });

    connected.map.placedTiles[1].strain = 3;
    expect(
      effectHasNoValidChoiceTargets(
        connected,
        cardEffectRuleId("boon_ledgers_flow", 2)
      )
    ).toBe(true);
  });

  it("requires the full Metal or Herbs payment for paid Strain relief", () => {
    const state = stateWith([tile("strained", "c15_path", "G1", 2)]);
    const lanternRule = cardEffectRuleId(
      "boon_a_light_on_the_long_dark_lanterns_illuminated_the_way_to_a_safer_day",
      1
    );
    expect(effectHasNoValidChoiceTargets(state, lanternRule)).toBe(true);
    state.warehouse.metal = 2;
    expect(suggestEffectAdjustment(state, lanternRule)).toMatchObject({
      adjustment: {
        resourceDeltas: { metal: -2 },
        tileStrainDeltas: { strained: -1 }
      }
    });

    const tonicRule = cardEffectRuleId("boon_the_scent_of_herb_and_tonic", 2);
    state.warehouse.herbs = 4;
    expect(suggestEffectAdjustment(state, tonicRule).adjustment?.resourceDeltas)
      .toMatchObject({ herbs: -4 });
  });

  it("moves one of the inspected cards to the actual deck bottom", () => {
    const state = stateWith();
    state.encounters.deck = ["a", "b", "c", "d", "e", "f", "g"];
    const queued = queueDeckReorder(state, 5, {
      sourceType: "card",
      sourceName: "Stars Guide Plans",
      title: "Stars Guide Plans",
      effectText: "Move one inspected card to the bottom.",
      mode: "moveOneToBottom"
    });

    const next = confirmDeckReorder(
      queued,
      ["a", "b", "d", "e", "c"],
      "c"
    );
    expect(next.encounters.deck).toEqual(["a", "b", "d", "e", "f", "g", "c"]);

    const lastQueued = queueDeckReorder(state, 5, {
      sourceType: "card",
      sourceName: "Stars Guide Plans",
      title: "Stars Guide Plans",
      effectText: "Move one inspected card to the bottom.",
      mode: "moveOneToBottom"
    });
    const lastMoved = confirmDeckReorder(
      lastQueued,
      ["a", "b", "c", "d", "e"],
      "e"
    );
    expect(lastMoved.encounters.deck).toEqual(["a", "b", "c", "d", "f", "g", "e"]);
  });

  it("targets the new positional Burdens with map-state predicates", () => {
    const state = stateWith([
      tile("road", "c15_path", "G1"),
      tile("craft", "c13_workshops", "H1"),
      tile("home", "c05_cabin", "I1", 1),
      tile("near_home", "c05_cabin", "F1", 1),
      tile("upgraded", "c06_cottage", "J1", 0, "upgraded")
    ]);

    expect(
      getEffectTileTargets(
        state,
        cardEffectRuleId("burden_only_road_in", 1)
      ).map((candidate) => candidate.instanceId)
    ).toEqual(["craft"]);
    expect(
      getEffectTileTargets(
        state,
        cardEffectRuleId("burden_ill_omen_of_discontent", 1)
      ).map((candidate) => candidate.instanceId)
    ).toEqual(["road"]);
    expect(
      getEffectTileTargets(
        state,
        cardEffectRuleId("burden_foundations_remember_war", 1)
      ).map((candidate) => candidate.instanceId)
    ).toEqual(["upgraded"]);
    expect(
      getEffectTileTargets(
        state,
        cardEffectRuleId("burden_roads_too_far_from_home", 1)
      )
    ).toEqual([]);
  });

  it("uses the printed Season III cascade amounts for Foundations and Rot", () => {
    const foundations = stateWith([
      tile("anchor", "c05_cabin", "G1", 0, "upgraded"),
      tile("neighbor", "c15_path", "H1")
    ]);
    expect(
      getStrainCascadeSpreadTargets(
        foundations,
        cardEffectRuleId("burden_foundations_remember_war", 3),
        "anchor"
      ).map((candidate) => candidate.instanceId)
    ).toEqual(["neighbor"]);
    expect(
      getEffectRule(
        cardEffectRuleId("burden_foundations_remember_war", 3)
      ).strainCascade
    ).toMatchObject({ anchorStrain: 2, spreadStrain: 2 });

    expect(
      getEffectRule(cardEffectRuleId("burden_the_rot_within_the_vault", 3))
        .strainCascade
    ).toMatchObject({ anchorStrain: 2, spreadStrain: 1 });
  });

  it("validates Old Wounds, Stores Run Thin, and Houses Not Homes alternatives", () => {
    const state = stateWith([
      tile("social", "c08_inn", "G1"),
      tile("wellbeing", "c12_apothecary", "H1"),
      tile("home", "c05_cabin", "I1")
    ]);
    state.season = 2;
    state.warehouse = { ...emptyWarehouse(), herbs: 4, wood: 3, food: 1 };

    const wounds = cardEffectRuleId("burden_old_wounds_reopen", 2);
    expect(isAlternativeEffectAdjustmentValid(state, wounds, {
      resourceDeltas: { herbs: -4 }
    })).toBe(true);
    expect(isAlternativeEffectAdjustmentValid(state, wounds, {
      resourceDeltas: { herbs: -2 },
      tileStrainDeltas: { social: 1 }
    })).toBe(false);

    const stores = cardEffectRuleId("burden_stores_run_thin", 2);
    expect(getAlternativeEffectRule(state, stores)?.resources).toEqual(["herbs"]);
    expect(isAlternativeEffectAdjustmentValid(state, stores, {
      resourceDeltas: { herbs: -4 }
    })).toBe(true);
    expect(isAlternativeEffectAdjustmentValid(state, stores, {
      resourceDeltas: { wood: -3 },
      tileStrainDeltas: { social: 1, wellbeing: 1 }
    })).toBe(false);

    const homes = cardEffectRuleId(
      "burden_too_many_houses_too_little_homes",
      1
    );
    expect(isAlternativeEffectAdjustmentValid(state, homes, {
      resourceDeltas: { food: -1 }
    })).toBe(true);
    expect(isAlternativeEffectAdjustmentValid(state, homes, {
      tileStrainDeltas: { home: 1 }
    })).toBe(true);
  });

  it("requires all available Omen of Discontent targets", () => {
    const state = stateWith([
      tile("home", "c05_cabin", "G1", 1),
      tile("road_a", "c15_path", "H1"),
      tile("road_b", "c15_path", "F1")
    ]);
    const ruleId = cardEffectRuleId("burden_ill_omen_of_discontent", 2);

    expect(isTileAdjustmentValid(state, ruleId, {
      tileStrainDeltas: { road_a: 1 }
    })).toBe(false);
    expect(isTileAdjustmentValid(state, ruleId, {
      tileStrainDeltas: { road_a: 1, road_b: 1 }
    })).toBe(true);
  });

  it("requires all available Only Road In targets", () => {
    const state = stateWith([
      tile("road", "c15_path", "G1"),
      tile("craft_a", "c13_workshops", "H1"),
      tile("merchant", "c14_market_stalls", "F1"),
      tile("craft_b", "c13_workshops", "G2")
    ]);
    const ruleId = cardEffectRuleId("burden_only_road_in", 3);

    expect(isTileAdjustmentValid(state, ruleId, {
      tileStrainDeltas: { craft_a: 1, merchant: 1 }
    })).toBe(false);
    expect(isTileAdjustmentValid(state, ruleId, {
      tileStrainDeltas: { craft_a: 1, merchant: 1, craft_b: 1 }
    })).toBe(true);
  });

  it("requires Roads Carry Needs' printed Strain and target counts", () => {
    const seasonTwo = stateWith([
      tile("road", "c15_path", "G1"),
      tile("neighbor_a", "c05_cabin", "H1"),
      tile("neighbor_b", "c13_workshops", "F1"),
      tile("neighbor_c", "c14_market_stalls", "G2")
    ]);
    const seasonTwoRule = cardEffectRuleId("burden_roads_carry_needs", 2);

    expect(isTileAdjustmentValid(seasonTwo, seasonTwoRule, {
      tileStrainDeltas: { road: 1 }
    })).toBe(false);
    expect(isTileAdjustmentValid(seasonTwo, seasonTwoRule, {
      tileStrainDeltas: { road: 2 }
    })).toBe(true);

    seasonTwo.map.placedTiles[0].strain = 2;
    expect(isTileAdjustmentValid(seasonTwo, seasonTwoRule, {
      tileStrainDeltas: { road: 1 }
    })).toBe(true);

    const seasonThree = stateWith([
      tile("road_a", "c15_path", "G1"),
      tile("road_b", "c15_path", "J1"),
      tile("a_1", "c05_cabin", "F1"),
      tile("a_2", "c13_workshops", "H1"),
      tile("a_3", "c14_market_stalls", "G2"),
      tile("b_1", "c05_cabin", "I1"),
      tile("b_2", "c13_workshops", "K1"),
      tile("b_3", "c14_market_stalls", "J2")
    ]);
    const seasonThreeRule = cardEffectRuleId("burden_roads_carry_needs", 3);
    expect(isTileAdjustmentValid(seasonThree, seasonThreeRule, {
      tileStrainDeltas: { road_a: 1 }
    })).toBe(false);
    expect(isTileAdjustmentValid(seasonThree, seasonThreeRule, {
      tileStrainDeltas: { road_a: 1, road_b: 1 }
    })).toBe(true);
  });

  it("requires all available Roads Too Far targets", () => {
    const state = stateWith([
      tile("road_a", "c15_path", "G1"),
      tile("road_b", "c15_path", "J1"),
      tile("road_c", "c15_path", "M1")
    ]);
    const ruleId = cardEffectRuleId("burden_roads_too_far_from_home", 3);

    expect(isTileAdjustmentValid(state, ruleId, {
      tileStrainDeltas: { road_a: 1, road_b: 1 }
    })).toBe(false);
    expect(isTileAdjustmentValid(state, ruleId, {
      tileStrainDeltas: { road_a: 1, road_b: 1, road_c: 1 }
    })).toBe(true);
  });

  it("requires Rot in the Vault's full legal Season II placement", () => {
    const state = stateWith([tile("dig", "c20_dig_site", "G1")]);
    const ruleId = cardEffectRuleId("burden_the_rot_within_the_vault", 2);

    expect(isTileAdjustmentValid(state, ruleId, {
      tileStrainDeltas: { dig: 1 }
    })).toBe(false);
    expect(isTileAdjustmentValid(state, ruleId, {
      tileStrainDeltas: { dig: 2 }
    })).toBe(true);

    state.map.placedTiles[0].strain = 2;
    expect(isTileAdjustmentValid(state, ruleId, {
      tileStrainDeltas: { dig: 1 }
    })).toBe(true);
  });

  it("links Burden of Command's adjacent hits to selected Steward tiles", () => {
    const seasonTwo = stateWith([
      tile("steward", "c05_cabin", "G1"),
      tile("neighbor", "c15_path", "H1")
    ]);
    const seasonTwoRule = cardEffectRuleId("burden_the_burden_of_command", 2);

    expect(isTileAdjustmentValid(seasonTwo, seasonTwoRule, {
      tileStrainDeltas: { steward: 1 }
    })).toBe(false);
    expect(isTileAdjustmentValid(seasonTwo, seasonTwoRule, {
      tileStrainDeltas: { neighbor: 1 }
    })).toBe(false);
    expect(isTileAdjustmentValid(seasonTwo, seasonTwoRule, {
      tileStrainDeltas: { steward: 1, neighbor: 1 }
    })).toBe(true);

    seasonTwo.map.placedTiles[0].strain = 3;
    expect(getEffectTileTargets(seasonTwo, seasonTwoRule)).toEqual([]);
    expect(effectHasNoValidChoiceTargets(seasonTwo, seasonTwoRule)).toBe(true);

    const seasonThree = createNewGame(2, ["vanguard", "warden"]);
    seasonThree.phase = "turns";
    seasonThree.map.placedTiles = [
      tile("steward_a", "c05_cabin", "G1"),
      tile("steward_b", "c05_cabin", "J1"),
      tile("neighbor_b", "c15_path", "K1")
    ];
    seasonThree.players[0].stewardHexId = "G1";
    seasonThree.players[1].stewardHexId = "J1";
    const seasonThreeRule = cardEffectRuleId("burden_the_burden_of_command", 3);

    expect(isTileAdjustmentValid(seasonThree, seasonThreeRule, {
      tileStrainDeltas: { steward_a: 1, neighbor_b: 1 }
    })).toBe(false);
    expect(isTileAdjustmentValid(seasonThree, seasonThreeRule, {
      tileStrainDeltas: { steward_b: 1, neighbor_b: 1 }
    })).toBe(true);
  });

  it("supports Food-and/or-Goods Burden resolution payments without truncating choices", () => {
    const state = stateWith();
    const options = getBurdenResolutionCostOptions(
      "burden_too_many_houses_too_little_homes",
      3 as Season
    );
    expect(options).toHaveLength(6);
    const baseCost = { ...emptyWarehouse(), goods: 6 };
    const adjusted = applyCostChoice(state, baseCost, options, {
      selectedOptionIds: options.slice(0, 4).map((option) => option.id)
    });
    expect(adjusted).toEqual({ ...emptyWarehouse(), food: 4, goods: 2 });
  });
});
