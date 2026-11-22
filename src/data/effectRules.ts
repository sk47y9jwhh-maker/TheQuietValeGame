import { resources } from "./resources";
import { burdenResolutionResources } from "./contentRules";
import type {
  EffectRule,
  StrainCascadeRule,
  TileAdjustmentRule,
  TileTargetRule
} from "../engine/effectRuleTypes";
import type { ResourceType, Season, TileCategory } from "../engine/types";

const rules: Record<string, EffectRule> = {};

export const cardEffectRuleId = (cardId: string, season: Season) => `${cardId}:s${season}`;
export const tileEffectRuleId = (tileId: string, side: string) => `${tileId}:${side}`;
export const stewardEffectRuleId = (stewardId: string) => `steward:${stewardId}`;
export const systemEffectRuleId = (name: string) => `system:${name}`;
export const neighbourlySupportEffectRuleId = systemEffectRuleId(
  "neighbourly-support"
);

function add(rule: EffectRule): EffectRule {
  rules[rule.id] = rule;
  return rule;
}

function seasonal(cardId: string, definitions: Array<Omit<EffectRule, "id">>): void {
  definitions.forEach((definition, index) =>
    add({ id: cardEffectRuleId(cardId, (index + 1) as Season), ...definition })
  );
}

const strain = (
  direction: "place" | "remove",
  maxTotal: number,
  maxPerTile: number,
  maxTargets: number
): TileAdjustmentRule => ({ strain: { direction, maxTotal, maxPerTile, maxTargets } });

const requiredStrain = (
  direction: "place" | "remove",
  total: number,
  maxPerTile: number,
  targets: number
): TileAdjustmentRule => ({
  strain: {
    direction,
    maxTotal: total,
    maxPerTile,
    maxTargets: targets,
    requiredTotal: total,
    requiredTargets: targets
  }
});

const support = (maxTargets: number): TileAdjustmentRule => ({ support: { maxTargets } });
const strainCascade = (
  anchorTarget: TileTargetRule,
  anchorStrain: number,
  spreadTarget: TileTargetRule,
  maxSpreadTargets: number,
  spreadStrain = 1
): StrainCascadeRule => ({
  anchorTarget,
  anchorStrain,
  spreadTarget,
  spreadStrain,
  maxSpreadTargets
});
const combined = (ruleA: TileAdjustmentRule, ruleB: TileAdjustmentRule): TileAdjustmentRule => ({
  ...ruleA,
  ...ruleB
});
const target = (definition: TileTargetRule): TileTargetRule => definition;

seasonal("boon_a_little_more_time", [1, 2, 3].map((limit) => ({
  timer: { direction: "add", limit },
  manualChoice: limit > 1,
  noEffectWhenNoTarget: true
})));
seasonal("boon_many_hands_make_light_work", [
  { modifier: { actions: ["place"], amount: 1, uses: 1 } },
  { modifier: { actions: ["place"], amount: 1, uses: 2 } },
  { modifier: { actions: ["place", "upgrade"], amount: 2, uses: 2 } }
]);
seasonal("boon_raised_in_good_season", [1, 2, 3].map((amount) => ({
  modifier: { actions: ["upgrade"], amount, uses: 1, coreOnly: true }
})));
seasonal("boon_stores_made_ready", [2, 4, 6].map((exchangeLimit) => ({
  exchangeLimit,
  manualChoice: true
})));
seasonal("boon_when_the_roads_filled_once_more", [
  { modifier: { actions: ["place"], zeroAction: true, uses: 1, allowedCategories: ["travel"] } },
  { modifier: { actions: ["place", "upgrade"], zeroAction: true, uses: 1, allowedCategories: ["travel"] } },
  { modifier: { actions: ["place", "upgrade"], zeroAction: true, uses: 1, allowedCategories: ["travel"] } }
]);
seasonal("boon_from_the_brink", [
  {
    target: target({ strain: "overstrained" }),
    tileAdjustment: strain("remove", 2, 2, 1),
    fallback: {
      when: "noTileTarget",
      rule: { id: "boon_from_the_brink:s1:fallback", target: { strain: "positive" }, tileAdjustment: strain("remove", 1, 1, 1), manualChoice: true }
    },
    manualChoice: true
  },
  {
    target: target({ strain: "overstrained" }),
    tileAdjustment: strain("remove", 2, 2, 1),
    fallback: {
      when: "noTileTarget",
      rule: { id: "boon_from_the_brink:s2:fallback", target: { strain: "positive" }, tileAdjustment: strain("remove", 2, 1, 2), manualChoice: true }
    },
    manualChoice: true
  },
  {
    target: target({ strain: "overstrained" }),
    tileAdjustment: strain("remove", 4, 2, 2),
    fallback: {
      when: "noTileTarget",
      rule: { id: "boon_from_the_brink:s3:fallback", target: { strain: "positive" }, tileAdjustment: strain("remove", 3, 1, 3), manualChoice: true }
    },
    manualChoice: true
  }
]);
seasonal("boon_clear_nights_make_for_clear_plans", [2, 3, 4].map((count) => ({
  deckReorder: { count }, optional: true
})));
seasonal("boon_shared_hands_lighter_loads", [2, 4, 6].map((amount) => ({
  modifier: { actions: ["burden"], amount, uses: 1 }
})));
seasonal("boon_the_apprentice_steward", [
  { modifier: { actions: ["place"], zeroAction: true, uses: 1, allowedCategories: ["resource"] } },
  { modifier: { actions: ["place"], zeroAction: true, uses: 1, allowedCategories: ["resource", "housing"] } },
  { modifier: { actions: ["place"], zeroAction: true, uses: 1 } }
]);
seasonal("boon_shelter_holds", [1, 2, 3].map((maxTargets) => ({
  target: { strain: "positive", supported: true },
  tileAdjustment: strain("remove", maxTargets, 1, maxTargets),
  manualChoice: true,
  noEffectWhenNoTarget: true
})));
seasonal("boon_a_welcome_well_met", [1, 2, 3].map((amount) => ({
  modifier: { actions: ["arrival"], amount, uses: 1 }
})));
seasonal("boon_where_help_stands", [
  { helpStands: { gainPerUnstrained: 1, cap: 2 }, target: { stewardOccupied: true }, manualChoice: true },
  { helpStands: { gainPerUnstrained: 2, cap: 4 }, target: { stewardOccupied: true }, manualChoice: true },
  { helpStands: { gainPerUnstrained: 3, cap: 6 }, target: { stewardOccupied: true }, manualChoice: true }
]);
const digOrRuins: TileTargetRule = { anyOf: [{ tileIds: ["c20_dig_site"] }, { adjacentToTerrain: ["ruins"] }] };
seasonal("boon_a_wonderful_find", [
  {
    target: { tileIds: ["c20_dig_site"] },
    supportTarget: { tileIds: ["c20_dig_site"] },
    tileAdjustment: support(1),
    resourceGainChoice: { resources: ["metal", "goods"], amount: 1 },
    manualChoice: true
  },
  {
    target: digOrRuins,
    tileAdjustment: strain("remove", 1, 1, 1),
    fixedResources: { metal: 1, goods: 1 },
    manualChoice: true
  },
  {
    target: digOrRuins,
    tileAdjustment: strain("remove", 2, 1, 2),
    fixedResources: { metal: 2, goods: 2 },
    manualChoice: true
  }
]);
seasonal("boon_festival_of_trade", [2, 4, 6].map((amount, index) => ({
  target: { categories: ["merchant"] },
  supportTarget: index === 0 ? undefined : "housingAdjacentToPrimary",
  tileAdjustment: index === 0 ? undefined : support(1),
  resourceGainChoice: { resources: ["goods"], amount, upTo: true, perAdjacentCategoryOfTarget: true },
  manualChoice: true
})));
seasonal("boon_hearths_soften_feuds", [
  { target: { categories: ["housing"] }, supportTarget: { categories: ["housing"] }, tileAdjustment: combined(strain("remove", 1, 1, 1), support(1)), manualChoice: true },
  { target: { categories: ["housing"] }, supportTarget: { categories: ["housing"] }, tileAdjustment: combined(strain("remove", 2, 1, 2), support(2)), manualChoice: true },
  { target: { categories: ["housing"] }, supportTarget: { categories: ["housing"] }, tileAdjustment: combined(strain("remove", 2, 1, 3), support(3)), manualChoice: true }
]);
seasonal("boon_the_settlement_of_plenty", [
  { target: { strain: "positive" }, tileAdjustment: strain("remove", 1, 1, 1), resourceGainChoice: { resources: ["food", "goods"], amount: 2, alternativeToStrainRemoval: true }, manualChoice: true },
  { target: { strain: "positive" }, tileAdjustment: strain("remove", 2, 2, 2), resourceGainChoice: { resources: ["food", "goods"], amount: 3, alternativeToStrainRemoval: true }, manualChoice: true },
  { target: { strain: "positive" }, tileAdjustment: strain("remove", 3, 3, 3), resourceGainChoice: { resources: ["food", "goods"], amount: 5, alternativeToStrainRemoval: true }, manualChoice: true }
]);

seasonal(
  "boon_a_light_on_the_long_dark_lanterns_illuminated_the_way_to_a_safer_day",
  [
    {
      target: { strain: "positive" },
      tileAdjustment: strain("remove", 1, 1, 1),
      fixedResources: { metal: -2 },
      mustAffordFixedCosts: true,
      manualChoice: true
    },
    {
      target: { categories: ["travel", "housing"] },
      supportTarget: { categories: ["travel", "housing"] },
      tileAdjustment: {
        ...combined(strain("remove", 2, 2, 1), support(1)),
        supportCoversStrainTargets: true
      },
      fixedResources: { metal: -4 },
      mustAffordFixedCosts: true,
      manualChoice: true
    },
    {
      target: { categories: ["travel", "housing"] },
      supportTarget: { categories: ["travel", "housing"] },
      tileAdjustment: {
        ...combined(strain("remove", 3, 3, 2), support(2)),
        supportCoversStrainTargets: true
      },
      fixedResources: { metal: -6 },
      mustAffordFixedCosts: true,
      manualChoice: true
    }
  ]
);

const productionBoon = (
  cardId: string,
  tileId: string,
  season1Gain: NonNullable<EffectRule["modifier"]>["productionGain"],
  season2Gain: NonNullable<EffectRule["modifier"]>["productionGain"],
  season3Resources: ResourceType[]
) => {
  seasonal(cardId, [
    {
      modifier: {
        actions: ["production"],
        allowedTileIds: [tileId],
        uses: 1,
        productionGain: season1Gain
      }
    },
    {
      modifier: {
        actions: ["production"],
        allowedTileIds: [tileId],
        uses: 2,
        productionGain: season2Gain
      }
    },
    {
      modifier: {
        actions: ["production"],
        allowedTileIds: [tileId],
        uses: 1,
        duration: "round",
        productionGain: {
          choice: { resources: season3Resources, amount: 2 }
        }
      }
    }
  ]);
  add({
    id: `${cardEffectRuleId(cardId, 3)}:production`,
    resourceGainChoice: { resources: season3Resources, amount: 2 },
    manualChoice: true
  });
};

productionBoon(
  "boon_bounty_of_the_first_harvest",
  "c04_farmstead",
  { fixed: { food: 1 } },
  { fixed: { food: 1, goods: 1 } },
  ["food", "goods"]
);
productionBoon(
  "boon_one_thousand_swings_of_the_pickaxe_opens_up_a_new_path",
  "c02_mine_tunnel",
  { fixed: { stone: 1 } },
  { fixed: { stone: 1, metal: 1 } },
  ["stone", "metal"]
);
productionBoon(
  "boon_the_ancient_ways_gradually_reemerge",
  "c01_lumber_yard",
  { fixed: { wood: 1 } },
  { fixed: { wood: 2 } },
  ["wood", "food"]
);
productionBoon(
  "boon_the_rains_that_we_sheltered_from_now_yield_the_bounty_of_nature",
  "c03_gathering_outpost",
  { fixed: { herbs: 1 } },
  { fixed: { herbs: 2 } },
  ["herbs", "food"]
);

seasonal("boon_carts_before_sunrise", [
  {
    modifier: {
      actions: ["activate"],
      zeroAction: true,
      allowedCategories: ["resource"],
      requiresAdjacentCategories: ["travel"],
      uses: 1
    }
  },
  {
    modifier: {
      actions: ["passive"],
      allowedCategories: ["crafting", "merchant"],
      requiresAdjacentCategories: ["travel"],
      refreshPassiveUse: true,
      uses: 1
    }
  },
  {
    modifier: {
      actions: ["activate", "passive"],
      zeroAction: true,
      allowedCategoriesByAction: {
        activate: ["resource"],
        passive: ["crafting", "merchant"]
      },
      requiresAdjacentCategories: ["travel"],
      refreshPassiveUse: true,
      uses: 2
    }
  }
]);

seasonal("boon_craft_fair", [
  {
    modifier: {
      actions: ["place", "upgrade"],
      amount: 1,
      allowedCategories: ["crafting"],
      uses: 1,
      postActionRuleId: "boon_craft_fair:s1:post",
      postActionRequiresAdjacentCategories: ["housing"]
    }
  },
  {
    modifier: {
      actions: ["place", "upgrade"],
      amount: 2,
      allowedCategories: ["crafting"],
      uses: 1,
      postActionRuleId: "boon_craft_fair:s2:post",
      postActionRequiresAdjacentCategories: ["housing", "merchant"]
    }
  },
  {
    modifier: {
      actions: ["place", "upgrade"],
      zeroResourceCost: true,
      allowedCategories: ["crafting"],
      uses: 1,
      postActionRuleId: "boon_craft_fair:s3:post",
      postActionRequiresAdjacentCategories: ["housing", "merchant"]
    }
  }
]);
add({
  id: "boon_craft_fair:s1:post",
  target: { categories: ["housing"], adjacentToSource: true },
  supportTarget: { categories: ["housing"], adjacentToSource: true },
  tileAdjustment: support(1),
  manualChoice: true,
  optional: true
});
add({
  id: "boon_craft_fair:s2:post",
  target: { adjacentToSource: true, excludeSource: true, strain: "positive" },
  tileAdjustment: strain("remove", 1, 1, 1),
  manualChoice: true,
  optional: true
});
add({
  id: "boon_craft_fair:s3:post",
  target: { adjacentToSource: true, excludeSource: true },
  supportTarget: { adjacentToSource: true, excludeSource: true },
  tileAdjustment: support(2),
  manualChoice: true,
  optional: true
});

seasonal("boon_ledgers_flow", [
  {
    fixedResources: { goods: 2 },
    connectedGroup: {
      requiredCategories: ["resource"],
      anyOfCategories: ["crafting", "merchant"]
    }
  },
  {
    fixedResources: { goods: 3 },
    connectedGroup: {
      requiredCategories: ["resource", "crafting", "merchant"]
    }
  },
  {
    fixedResources: { goods: 4 },
    connectedGroup: {
      requiredCategories: ["resource", "crafting", "merchant"]
    }
  }
]);

seasonal("boon_old_foundations_still_remain", [
  {
    modifier: {
      actions: ["place"],
      allowedCategories: ["housing"],
      uses: 1,
      supportActionTile: true,
      postActionRuleId: "boon_old_foundations_still_remain:s1:post",
      postActionRequiresAdjacentTerrain: ["ruins"]
    }
  },
  {
    modifier: {
      actions: ["place"],
      allowedCategories: ["housing"],
      uses: 1,
      supportActionTile: true,
      postActionRuleId: "boon_old_foundations_still_remain:s2:post",
      postActionRequiresAdjacentCategories: ["housing"],
      postActionRequiresAdjacentTerrain: ["ruins"]
    }
  },
  {
    modifier: {
      actions: ["place", "upgrade"],
      allowedCategories: ["housing"],
      uses: 1,
      supportActionTile: true,
      postActionRuleId: "boon_old_foundations_still_remain:s3:post",
      postActionRequiresAdjacentCategories: ["housing"],
      postActionRequiresAdjacentTerrain: ["ruins"]
    }
  }
]);
for (const [seasonNumber, amount] of [[1, 1], [2, 2], [3, 3]] as const) {
  add({
    id: `boon_old_foundations_still_remain:s${seasonNumber}:post`,
    target: { adjacentToSource: true, excludeSource: true, strain: "positive" },
    tileAdjustment: strain("remove", amount, amount, amount),
    manualChoice: true,
    optional: true
  });
}

seasonal("boon_the_scent_of_herb_and_tonic", [
  {
    target: { strain: "positive" },
    tileAdjustment: strain("remove", 1, 1, 1),
    fixedResources: { herbs: -2 },
    mustAffordFixedCosts: true,
    manualChoice: true
  },
  {
    target: { strain: "positive" },
    tileAdjustment: strain("remove", 2, 2, 1),
    fixedResources: { herbs: -4 },
    mustAffordFixedCosts: true,
    manualChoice: true
  },
  {
    target: { strain: "positive" },
    tileAdjustment: strain("remove", 3, 3, 2),
    fixedResources: { herbs: -6 },
    mustAffordFixedCosts: true,
    manualChoice: true
  }
]);

seasonal("boon_what_is_written_in_the_stars_can_finally_be_heeded", [
  { deckReorder: { count: 5, mode: "moveOneToBottom" }, optional: true },
  { deckReorder: { count: 5 }, optional: true },
  { deckReorder: { count: "all" }, optional: true }
]);

seasonal("boon_change_of_watch", [
  { stewardMove: { supportDestination: true }, manualChoice: true },
  {
    stewardMove: { supportDestination: true, strainRelief: 1 },
    manualChoice: true
  },
  {
    stewardMove: {
      allowOverstrainedDestination: true,
      supportDestination: true,
      strainRelief: 2
    },
    manualChoice: true
  }
]);

seasonal("boon_the_break_holds", [1, 2, 3].map((season) => ({
  modifier: {
    actions: ["overstrain"],
    uses: season === 2 ? 2 : 1,
    duration: season === 3 ? "round" : undefined,
    immediateResources: { wood: 4 - season },
    preventsOverstrainSpread: true
  }
})));

seasonal("boon_answers_made_ready", [
  {
    modifier: {
      actions: ["arrival", "burden"],
      zeroAction: true,
      uses: 1
    }
  },
  {
    modifier: {
      actions: ["arrival", "burden"],
      zeroAction: true,
      uses: 2
    }
  },
  {
    modifier: {
      actions: ["arrival", "burden"],
      amount: 2,
      zeroAction: true,
      uses: 2
    }
  }
]);

const placed = (categories?: TileTargetRule["categories"], extra: TileTargetRule = {}): TileTargetRule => ({ categories, strain: "below3", ...extra });

// Burden overflow and follow-up rules (Robert, 22 Nov: "Burdens: making them bite").
// A row's overflow is registered once per possible shortfall, so the engine can
// queue exactly the Strain a row could not place on its own targets.
const OVERFLOW_MAX = 8;
export const burdenOverflowRuleId = (ruleId: string, amount: number) => `${ruleId}:overflow${amount}`;
export const burdenFollowUpRuleId = (ruleId: string) => `${ruleId}:protector`;
function registerBurdenExtras(ruleId: string, definition: Omit<EffectRule, "id">): void {
  const overflow = definition.overflow;
  if (overflow) {
    for (let amount = 1; amount <= OVERFLOW_MAX; amount += 1) {
      if ("resourceLoss" in overflow) {
        add({
          id: burdenOverflowRuleId(ruleId, amount),
          fixedResources: { [overflow.resourceLoss.resource]: -overflow.resourceLoss.perStrain * amount }
        });
        continue;
      }
      const perTile = Math.min(overflow.maxPerTile ?? 1, amount);
      const targets = Math.min(overflow.maxTargets ?? amount, amount);
      add({
        id: burdenOverflowRuleId(ruleId, amount),
        target: overflow.target,
        tileAdjustment: requiredStrain("place", amount, perTile, targets),
        manualChoice: true,
        noEffectWhenNoTarget: true
      });
    }
  }
  if (definition.followUp) {
    add({
      id: burdenFollowUpRuleId(ruleId),
      target: definition.followUp.target,
      tileAdjustment: requiredStrain("place", definition.followUp.strain, definition.followUp.strain, 1),
      manualChoice: true,
      noEffectWhenNoTarget: true
    });
  }
}
const burden = (id: string, definitions: Array<Omit<EffectRule, "id">>) => {
  const rows = definitions.map((definition) => ({ manualChoice: true, ...definition }));
  seasonal(id, rows);
  rows.forEach((row, index) => {
    registerBurdenExtras(cardEffectRuleId(id, (index + 1) as Season), row);
    if (row.fallback) registerBurdenExtras(row.fallback.rule.id, row.fallback.rule);
  });
};
const overflowTo = (target: TileTargetRule, maxPerTile?: number, maxTargets?: number) => ({ overflow: { target, maxPerTile, maxTargets } });
const socialOrWellbeingBesideHit = (strainAmount: number, anchorCategories?: TileCategory[]) => ({
  followUp: { anchorCategories, target: placed(["social", "wellbeing"], { adjacentToSource: true }), strain: strainAmount }
});
const resourceTiles = placed(["resource"]);
const merchantOrCrafting = placed(["merchant", "crafting"]);

burden("burden_smoke_over_hearths", [1, 2, 3].map((count) => ({
  target: placed(["housing"], { adjacentToCategories: ["crafting"] }),
  tileAdjustment: requiredStrain("place", count, 1, count),
  ...overflowTo(placed(["crafting"])),
  ...(count === 3 ? socialOrWellbeingBesideHit(2) : {})
})));

// Single named Tile Burdens: if the Tile is missing or full, a Resource Tile takes the Strain.
function namedTileBurden(id: string, tileId: string, spreadTarget: TileTargetRule) {
  burden(id, [
    { target: placed(undefined, { tileIds: [tileId] }), tileAdjustment: requiredStrain("place", 1, 1, 1), ...overflowTo(resourceTiles, 1, 1) },
    { target: placed(undefined, { tileIds: [tileId] }), tileAdjustment: requiredStrain("place", 2, 2, 1), ...overflowTo(resourceTiles, 2, 1) },
    {
      strainCascade: strainCascade(placed(undefined, { tileIds: [tileId] }), 2, spreadTarget, 1),
      fallback: { when: "noTileTarget", rule: { id: `${id}:s3:fallback`, strainCascade: strainCascade(resourceTiles, 2, spreadTarget, 1), manualChoice: true } }
    }
  ]);
}
namedTileBurden("burden_forest_s_grudge", "c01_lumber_yard", placed());
namedTileBurden("burden_blighted_lands", "c04_farmstead", placed());
namedTileBurden("burden_awoken_in_the_deep", "c02_mine_tunnel", placed(["travel", "resource"]));
namedTileBurden("burden_stampede", "c03_gathering_outpost", placed(["housing", "travel"]));
namedTileBurden("burden_the_rot_within_the_vault", "c20_dig_site", placed());

burden("burden_return_to_the_trenches", [1, 2, 3].map((count) => ({ target: placed(["travel"], { adjacentToCategories: ["resource"] }), tileAdjustment: requiredStrain("place", count, 1, count), ...overflowTo(resourceTiles) })));
burden("burden_wares_of_war", [1, 2, 3].map((count) => ({
  target: placed(["housing"], { adjacentToCategories: ["merchant"] }),
  tileAdjustment: requiredStrain("place", count, 1, count),
  ...overflowTo(placed(["merchant"])),
  ...(count === 3 ? socialOrWellbeingBesideHit(2) : {})
})));
burden("burden_old_names_old_debts", [1, 2, 3].map((count) => ({ target: placed(undefined, { hasRenown: true }), tileAdjustment: requiredStrain("place", count, 1, count), ...overflowTo(placed(["housing"])) })));
burden("burden_the_quiet_fractures", [
  { target: { strain: "oneToTwo" }, tileAdjustment: requiredStrain("place", 1, 1, 1), ...overflowTo({ strain: "zero" }) },
  {
    strainCascade: strainCascade({ strain: "oneToTwo" }, 1, { strain: "zero" }, 1),
    fallback: { when: "noTileTarget", rule: { id: "burden_the_quiet_fractures:s2:fallback", strainCascade: strainCascade({ strain: "zero" }, 1, { strain: "zero" }, 1), manualChoice: true } }
  },
  {
    strainCascade: strainCascade({ strain: "overstrained" }, 0, { strain: "zero" }, 2),
    fallback: {
      when: "noTileTarget",
      rule: {
        id: "burden_the_quiet_fractures:s3:fallback",
        strainCascade: strainCascade({ strain: "oneToTwo" }, 1, { strain: "zero" }, 1)
      }
    }
  }
]);
burden("burden_tools_left_to_rust", [
  { target: merchantOrCrafting, tileAdjustment: requiredStrain("place", 1, 1, 1), ...overflowTo(resourceTiles) },
  {
    target: merchantOrCrafting,
    tileAdjustment: requiredStrain("place", 1, 1, 1),
    fixedResources: { metal: -1 },
    ...overflowTo(resourceTiles),
    ...socialOrWellbeingBesideHit(1)
  },
  {
    target: merchantOrCrafting,
    tileAdjustment: requiredStrain("place", 3, 2, 2),
    fixedResources: { metal: -2 },
    ...overflowTo(resourceTiles),
    ...socialOrWellbeingBesideHit(1)
  }
]);
burden("burden_the_long_cough", [
  { target: placed(["social", "wellbeing"]), tileAdjustment: requiredStrain("place", 1, 1, 1), ...overflowTo(placed(["housing"])) },
  {
    target: placed(["social", "wellbeing"]),
    tileAdjustment: {
      strain: {
        ...strain("place", 2, 1, 2).strain!,
        categoryLimits: {
          social: { min: 1, max: 1 },
          wellbeing: { min: 1, max: 1 }
        }
      }
    },
    ...overflowTo(merchantOrCrafting)
  },
  { target: placed(["social", "wellbeing"]), tileAdjustment: requiredStrain("place", 4, 2, 3), ...overflowTo(merchantOrCrafting) }
]);
burden("burden_the_storehouses_disagree", [
  { target: placed(["resource"]), tileAdjustment: strain("place", 1, 1, 1), alternative: { kind: "warehouse_loss_or_strain", resources: ["wood", "stone", "food"], resourceStep: 2, requiredChoices: 1, requiredStrainTotal: 1 } },
  { target: placed(["resource"]), tileAdjustment: strain("place", 2, 2, 1), alternative: { kind: "warehouse_loss_or_strain", resources: ["wood", "stone", "metal", "food", "herbs"], resourceStep: 3, requiredChoices: 1, requiredStrainTotal: 2 } },
  { target: placed(["resource"]), tileAdjustment: strain("place", 4, 2, 2), alternative: { kind: "warehouse_loss_or_strain", resources: resources.filter((resource) => resource !== "goods"), resourceStep: 5, requiredChoices: 1, requiredStrainTotal: 4 } }
]);
// Bare Walls stays a layout puzzle: its overflow costs 2 Goods for each Strain missing.
burden("burden_bare_walls", [1, 2, 3].map((count) => ({ target: placed(["housing"], { notAdjacentToCategories: ["social", "wellbeing"] }), tileAdjustment: requiredStrain("place", count, 1, count), overflow: { resourceLoss: { resource: "goods" as ResourceType, perStrain: 2 } } })));
burden("burden_empty_shelves", [
  ...[1, 2].map((count) => ({ target: placed(["social"]), tileAdjustment: strain("place", count, 1, count), alternative: { kind: "pay_or_strain" as const, resources: ["goods" as ResourceType], resourceStep: 2, requiredChoices: count, strainPerChoice: 1 }, ...overflowTo(placed(["merchant"])) })),
  { target: placed(["social"]), tileAdjustment: strain("place", 4, 2, 3), alternative: { kind: "pay_total_or_strain", resources: ["goods"], resourceStep: 8, requiredChoices: 1, requiredStrainTotal: 4 }, ...overflowTo(placed(["merchant"])) }
]);
for (const [id, resource] of [["burden_promises_overstretched", "goods"], ["burden_welcome_wears_thin", "herbs"]] as const) {
  burden(id, [1, 2, 3].map((count) => ({
    timer: { direction: "remove", limit: count, maxTargets: count },
    alternative: { kind: "pay_or_timer", resources: [resource], resourceStep: 2, requiredChoices: count, timerPerChoice: 1 },
    fallback: count === 3
      ? { when: "noArrival", rule: { id: `${id}:s3:fallback`, target: placed(), tileAdjustment: requiredStrain("place", 2, 1, 2) } }
      : { when: "noArrival", rule: { id: `${id}:s${count}:fallback`, target: placed(["housing"]), tileAdjustment: requiredStrain("place", 1, 1, 1) } }
  })));
}

const merchantOrCraftingBesideOther: TileTargetRule = {
  anyOf: [
    placed(["merchant"], { adjacentToCategories: ["crafting"] }),
    placed(["crafting"], { adjacentToCategories: ["merchant"] })
  ]
};
burden("burden_coin_before_craft", [
  {
    target: merchantOrCraftingBesideOther,
    tileAdjustment: requiredStrain("place", 1, 1, 1),
    ...overflowTo(merchantOrCrafting)
  },
  {
    target: merchantOrCraftingBesideOther,
    tileAdjustment: {
      strain: {
        ...strain("place", 2, 1, 2).strain!,
        categoryLimits: {
          merchant: { min: 1, max: 1 },
          crafting: { min: 1, max: 1 }
        }
      }
    },
    ...overflowTo(merchantOrCrafting),
    ...socialOrWellbeingBesideHit(1)
  },
  {
    target: merchantOrCraftingBesideOther,
    tileAdjustment: {
      strain: {
        ...strain("place", 5, 2, 4).strain!,
        categoryLimits: {
          merchant: { max: 2 },
          crafting: { max: 2 }
        }
      }
    },
    ...overflowTo(merchantOrCrafting),
    ...socialOrWellbeingBesideHit(1)
  }
]);

const upgradedCore = placed(undefined, { side: "upgraded" });
const anyCore = placed(undefined, { anyOf: [{ side: "basic" }, { side: "upgraded" }] });
burden("burden_foundations_remember_war", [
  {
    target: upgradedCore,
    tileAdjustment: requiredStrain("place", 1, 1, 1),
    ...overflowTo(anyCore, 1, 1)
  },
  {
    strainCascade: strainCascade(upgradedCore, 1, placed(), 1),
    fallback: { when: "noTileTarget", rule: { id: "burden_foundations_remember_war:s2:fallback", strainCascade: strainCascade(anyCore, 1, placed(), 1), manualChoice: true } }
  },
  {
    strainCascade: strainCascade(upgradedCore, 2, placed(), 1, 2),
    fallback: { when: "noTileTarget", rule: { id: "burden_foundations_remember_war:s3:fallback", strainCascade: strainCascade(anyCore, 2, placed(), 1, 2), manualChoice: true } }
  }
]);

const discontentedRoad = placed(["travel"], {
  adjacentToCategoryWithPositiveStrain: "housing"
});
burden("burden_ill_omen_of_discontent", [1, 2, 3].map((count) => ({
  target: discontentedRoad,
  tileAdjustment: requiredStrain("place", count, 1, count),
  ...overflowTo(placed(["travel"]))
})));

burden("burden_old_wounds_reopen", [
  ...[1, 2].map((count) => ({
    target: placed(["social", "wellbeing"]),
    tileAdjustment: strain("place", count, 1, count),
    alternative: { kind: "pay_total_or_strain" as const, resources: ["herbs" as ResourceType], resourceStep: count * 2, requiredChoices: 1 as const, requiredStrainTotal: count },
    ...overflowTo(count === 1 ? placed(["housing"]) : merchantOrCrafting)
  })),
  {
    target: placed(["social", "wellbeing"]),
    tileAdjustment: strain("place", 4, 2, 3),
    alternative: { kind: "pay_total_or_strain", resources: ["herbs"], resourceStep: 8, requiredChoices: 1, requiredStrainTotal: 4 },
    ...overflowTo(merchantOrCrafting)
  }
]);

const singleRoadDependency = placed(["merchant", "crafting"], {
  exactAdjacentCategoryCount: { category: "travel", count: 1 }
});
burden("burden_only_road_in", [
  { target: singleRoadDependency, tileAdjustment: requiredStrain("place", 1, 1, 1), ...overflowTo(merchantOrCrafting) },
  { target: singleRoadDependency, tileAdjustment: requiredStrain("place", 2, 1, 2), ...overflowTo(merchantOrCrafting), ...socialOrWellbeingBesideHit(1) },
  { target: singleRoadDependency, tileAdjustment: requiredStrain("place", 4, 2, 3), ...overflowTo(merchantOrCrafting), ...socialOrWellbeingBesideHit(1) }
]);

burden("burden_roads_carry_needs", [
  {
    target: placed(["travel"], { minAdjacentPlaced: 2 }),
    tileAdjustment: requiredStrain("place", 1, 1, 1),
    ...overflowTo(placed(["travel"]), 1, 1)
  },
  {
    target: placed(["travel"], { minAdjacentPlaced: 3 }),
    tileAdjustment: requiredStrain("place", 2, 2, 1),
    ...overflowTo(placed(["travel"]), 2, 1)
  },
  {
    target: placed(["travel"], { minAdjacentPlaced: 3 }),
    tileAdjustment: requiredStrain("place", 2, 1, 2),
    ...overflowTo(placed(["travel"]))
  }
]);

burden("burden_roads_too_far_from_home", [1, 2, 3].map((count) => ({
  target: placed(["travel"], { notAdjacentToCategories: ["housing"] }),
  tileAdjustment: requiredStrain("place", count, 1, count),
  ...overflowTo(placed(["travel"]))
})));

burden("burden_stores_run_thin", [
  {
    target: placed(),
    tileAdjustment: strain("place", 1, 1, 1),
    alternative: {
      kind: "most_stocked_loss_then_strain",
      resources: [...resources],
      resourceStep: 2,
      requiredChoices: 1,
      requiredStrainTotal: 1,
      strainWhen: "noneLost"
    }
  },
  {
    target: placed(),
    tileAdjustment: strain("place", 2, 1, 2),
    alternative: {
      kind: "most_stocked_loss_then_strain",
      resources: [...resources],
      resourceStep: 4,
      requiredChoices: 1,
      requiredStrainTotal: 2,
      strainWhen: "lessThanRequired"
    }
  },
  {
    target: placed(),
    tileAdjustment: strain("place", 4, 2, 2),
    alternative: {
      kind: "most_stocked_loss_then_strain",
      resources: [...resources],
      resourceStep: 6,
      requiredChoices: 1,
      requiredStrainTotal: 4,
      strainWhen: "lessThanRequired"
    }
  }
]);

const stewardOrNeighbor: TileTargetRule = {
  anyOf: [
    placed(undefined, { stewardOccupied: true }),
    placed(undefined, { adjacentToStewardOccupied: true })
  ]
};
burden("burden_the_burden_of_command", [
  {
    target: placed(undefined, { stewardOccupied: true }),
    tileAdjustment: strain("place", 2, 1, 2)
  },
  {
    target: stewardOrNeighbor,
    tileAdjustment: {
      strain: {
        ...strain("place", 3, 1, 3).strain!,
        maxStewardOccupiedTargets: 2,
        maxOtherTargets: 1,
        linkedStewardTargets: { requiredOtherTargetsIfAvailable: 1 }
      }
    }
  },
  {
    target: stewardOrNeighbor,
    tileAdjustment: {
      strain: {
        ...strain("place", 5, 1, 5).strain!,
        maxStewardOccupiedTargets: 3,
        maxOtherTargets: 2,
        linkedStewardTargets: {}
      }
    }
  }
]);

burden("burden_too_many_houses_too_little_homes", [1, 2, 3].map((count) => ({
  target: placed(["housing"]),
  tileAdjustment: strain("place", count, 1, count),
  alternative: {
    kind: "pay_or_strain",
    resources: ["food", "goods"],
    resourceStep: 2,
    requiredChoices: count,
    strainPerChoice: 1
  }
})));

burden("burden_river_breaks_its_banks", [1, 2, 3].map((count) => ({
  target: placed(undefined, { adjacentToTerrain: ["water"] }),
  tileAdjustment: requiredStrain("place", count, 1, count),
  fallback: {
    when: "noTileTarget",
    rule: {
      id: `burden_river_breaks_its_banks:s${count}:fallback`,
      fixedResources: { wood: -count }
    }
  }
})));

burden("burden_the_road_takes_its_share", [
  {
    modifier: { actions: ["production"], uses: 1, productionLoss: 2 },
    manualChoice: false
  },
  {
    modifier: { actions: ["production"], uses: 2, productionLoss: 2 },
    manualChoice: false
  },
  {
    modifier: {
      actions: ["production"],
      uses: 1,
      duration: "round",
      productionLoss: 2
    },
    manualChoice: false
  }
]);

burden("burden_plans_left_waiting", [
  {
    modifier: { actions: ["place", "upgrade"], uses: 1, extraCost: 2 },
    manualChoice: false
  },
  {
    modifier: { actions: ["place", "upgrade"], uses: 2, extraCost: 2 },
    manualChoice: false
  },
  {
    modifier: {
      actions: ["place", "upgrade"],
      uses: 1,
      duration: "round",
      extraCost: 2
    },
    manualChoice: false
  }
]);

for (const [id, resource] of Object.entries(burdenResolutionResources)) {
  add({ id: `${id}:resolution`, fixedResources: { [resource]: -2 } });
}

const productionTileIds = ["c01_lumber_yard", "c02_mine_tunnel", "c03_gathering_outpost", "c04_farmstead", "c20_dig_site"];
for (const tileId of productionTileIds) {
  add({ id: tileEffectRuleId(tileId, "basic") });
  add({ id: tileEffectRuleId(tileId, "upgraded") });
}
add({ id: tileEffectRuleId("c08_inn", "basic"), timer: { direction: "add", limit: 1 } });
add({ id: tileEffectRuleId("c08_inn", "upgraded"), timer: { direction: "add", limit: 2 } });
for (const tileId of ["c09_tavern", "c10_eatery", "c11_washhouse"]) {
  add({ id: tileEffectRuleId(tileId, "basic"), target: { adjacentToSource: true, excludeSource: true, strain: "positive" }, tileAdjustment: strain("remove", 1, 1, 1), manualChoice: true });
  add({ id: tileEffectRuleId(tileId, "upgraded"), target: { adjacentToSource: true, excludeSource: true, strain: "positive" }, tileAdjustment: strain("remove", 2, 1, 2), manualChoice: true });
}
for (const tileId of ["c12_apothecary", "c21_the_vaults"]) {
  add({ id: tileEffectRuleId(tileId, "basic"), target: { adjacentToSource: true, excludeSource: true, strain: "positive" }, tileAdjustment: strain("remove", 1, 1, 1), manualChoice: true });
  add({ id: tileEffectRuleId(tileId, "upgraded"), target: { adjacentToSource: true, excludeSource: true, strain: "positive" }, tileAdjustment: strain("remove", 2, 2, 1), manualChoice: true });
}

add({ id: tileEffectRuleId("special_alms_house", "special"), target: { adjacentToSource: true, excludeSource: true }, supportTarget: { adjacentToSource: true, excludeSource: true }, tileAdjustment: support(2), manualChoice: true, optional: true });
add({
  id: tileEffectRuleId("special_atelier_workshop", "special"),
  target: { strain: "positive" },
  supportTarget: { strain: "positive" },
  tileAdjustment: {
    strain: {
      direction: "remove",
      maxTotal: 3,
      maxPerTile: 3,
      maxTargets: 1,
      requiredTargets: 1,
      removeAllFromTargets: true
    },
    support: { maxTargets: 1, requiredTargets: 1 },
    supportCoversStrainTargets: true
  },
  fixedResources: { wood: -1, metal: -1 },
  mustAffordFixedCosts: true,
  manualChoice: true
});
add({ id: tileEffectRuleId("special_adventurers_guild", "special"), resolveBurden: { maxTargets: 1 }, manualChoice: true, optional: true });
add({ id: tileEffectRuleId("special_alchemist_s_workshop", "special"), exchangeLimit: 5, exchangeOptional: true, exchangeGoodsMode: true, manualChoice: true });
add({ id: tileEffectRuleId("special_hearth_garden", "special"), target: { categories: ["housing", "social", "wellbeing"], strain: "positive" }, tileAdjustment: strain("remove", 2, 2, 2), manualChoice: true, optional: true });
add({
  id: tileEffectRuleId("special_reliquary", "special"),
  target: { categories: ["crafting", "merchant"], strain: "positive" },
  tileAdjustment: strain("remove", 2, 2, 1),
  resourceGainChoice: {
    resources: ["metal"],
    amount: 2,
    alternativeToStrainRemoval: true
  },
  manualChoice: true
});
add({ id: tileEffectRuleId("special_the_resting_hall", "special"), target: { strain: "positive" }, tileAdjustment: strain("remove", 1, 1, 1), manualChoice: true });

add({ id: stewardEffectRuleId("ranger"), manualChoice: true });
add({ id: stewardEffectRuleId("quartermaster"), timer: { direction: "add", limit: 1 }, exchangeLimit: 5, exchangeOptional: true, manualChoice: true });
add({ id: stewardEffectRuleId("warden"), target: {}, supportTarget: {}, tileAdjustment: combined(strain("remove", 1, 1, 1), support(1)), manualChoice: true });
for (const stewardId of ["vanguard", "knight", "sentinel"]) add({ id: stewardEffectRuleId(stewardId) });

add({ id: systemEffectRuleId("acknowledge") });
add({ id: systemEffectRuleId("arrival-expired"), target: { strain: "below3" }, tileAdjustment: strain("place", 1, 1, 1), manualChoice: true });
add({
  id: neighbourlySupportEffectRuleId,
  target: { categories: ["housing"], strain: "below3" },
  supportTarget: { categories: ["housing"], strain: "below3" },
  tileAdjustment: support(99),
  manualChoice: true,
  noEffectWhenNoTarget: true
});
add({
  id: systemEffectRuleId("overstrain-spread"),
  target: { adjacentToSource: true, excludeSource: true, strain: "below3" },
  tileAdjustment: strain("place", 1, 1, 1),
  manualChoice: true,
  noEffectWhenNoTarget: true
});

export function getEffectRule(ruleId: string | undefined): EffectRule {
  if (!ruleId) return rules[systemEffectRuleId("acknowledge")];
  const rule = rules[ruleId];
  if (!rule) throw new Error(`Missing structured effect rule: ${ruleId}`);
  return rule;
}

export function getActiveEffectRule(
  rule: EffectRule,
  hasTileTargets: boolean,
  hasArrivals: boolean
): EffectRule {
  if (!rule.fallback) return rule;
  if (rule.fallback.when === "noTileTarget" && !hasTileTargets) return rule.fallback.rule;
  if (rule.fallback.when === "noArrival" && !hasArrivals) return rule.fallback.rule;
  return rule;
}

export const effectRulesById = rules;
