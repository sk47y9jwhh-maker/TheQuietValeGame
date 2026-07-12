import { resources } from "./resources";
import { burdenResolutionResources } from "./contentRules";
import type { EffectRule, TileAdjustmentRule, TileTargetRule } from "../engine/effectRuleTypes";
import type { Season } from "../engine/types";

const rules: Record<string, EffectRule> = {};

export const cardEffectRuleId = (cardId: string, season: Season) => `${cardId}:s${season}`;
export const tileEffectRuleId = (tileId: string, side: string) => `${tileId}:${side}`;
export const stewardEffectRuleId = (stewardId: string) => `steward:${stewardId}`;
export const systemEffectRuleId = (name: string) => `system:${name}`;

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

const support = (maxTargets: number): TileAdjustmentRule => ({ support: { maxTargets } });
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
      rule: { id: "boon_from_the_brink:s1:fallback", target: { strain: "positive" }, tileAdjustment: strain("remove", 1, 1, 1) }
    },
    manualChoice: true
  },
  {
    target: target({ strain: "overstrained" }),
    tileAdjustment: strain("remove", 2, 2, 1),
    fallback: {
      when: "noTileTarget",
      rule: { id: "boon_from_the_brink:s2:fallback", target: { strain: "positive" }, tileAdjustment: strain("remove", 2, 1, 2) }
    },
    manualChoice: true
  },
  {
    target: target({ strain: "overstrained" }),
    tileAdjustment: strain("remove", 4, 2, 2),
    fallback: {
      when: "noTileTarget",
      rule: { id: "boon_from_the_brink:s3:fallback", target: { strain: "positive" }, tileAdjustment: strain("remove", 3, 1, 3) }
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
  manualChoice: maxTargets > 1,
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
  resourceGainChoice: { resources: ["goods"], amount, upTo: true },
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

const burden = (id: string, definitions: Array<Omit<EffectRule, "id">>) => seasonal(id, definitions.map((definition) => ({ manualChoice: true, ...definition })));
const placed = (categories?: TileTargetRule["categories"], extra: TileTargetRule = {}): TileTargetRule => ({ categories, strain: "below3", ...extra });

burden("burden_smoke_over_hearths", [1, 2, 3].map((count) => ({ target: placed(["housing"], { adjacentToCategories: ["crafting"] }), tileAdjustment: strain("place", count, 1, count), fallback: count === 3 ? { when: "noTileTarget", rule: { id: "burden_smoke_over_hearths:s3:fallback", target: placed(["crafting"]), tileAdjustment: strain("place", 1, 1, 1) } } : undefined })));
burden("burden_forest_s_grudge", [1, 2, 2].map((amount) => ({ target: placed(undefined, { tileIds: ["c01_lumber_yard"] }), tileAdjustment: strain("place", amount, amount, 1) })));
burden("burden_blighted_lands", [1, 2, 2].map((amount) => ({ target: placed(undefined, { tileIds: ["c04_farmstead"] }), tileAdjustment: strain("place", amount, amount, 1) })));
burden("burden_awoken_in_the_deep", [1, 2, 2].map((amount) => ({ target: placed(undefined, { tileIds: ["c02_mine_tunnel"] }), tileAdjustment: strain("place", amount, amount, 1) })));
burden("burden_stampede", [1, 2, 2].map((amount) => ({ target: placed(undefined, { tileIds: ["c03_gathering_outpost"] }), tileAdjustment: strain("place", amount, amount, 1) })));
burden("burden_return_to_the_trenches", [1, 2, 3].map((count) => ({ target: placed(["travel"], { adjacentToCategories: ["resource"] }), tileAdjustment: strain("place", count, 1, count), fallback: count === 3 ? { when: "noTileTarget", rule: { id: "burden_return_to_the_trenches:s3:fallback", target: placed(["resource"]), tileAdjustment: strain("place", 1, 1, 1) } } : undefined })));
burden("burden_wares_of_war", [1, 2, 3].map((count) => ({ target: placed(["housing"], { adjacentToCategories: ["merchant"] }), tileAdjustment: strain("place", count, 1, count), fallback: count === 3 ? { when: "noTileTarget", rule: { id: "burden_wares_of_war:s3:fallback", target: placed(["merchant"]), tileAdjustment: strain("place", 1, 1, 1) } } : undefined })));
burden("burden_old_names_old_debts", [1, 2, 3].map((count) => ({ target: placed(undefined, { hasRenown: true }), tileAdjustment: strain("place", count, 1, count) })));
burden("burden_the_quiet_fractures", [
  { target: { strain: "oneToTwo" }, tileAdjustment: strain("place", 1, 1, 1) },
  { target: { strain: "oneToTwo" }, tileAdjustment: strain("place", 2, 1, 2) },
  { target: { strain: "overstrained" }, tileAdjustment: strain("place", 2, 1, 2), fallback: { when: "noTileTarget", rule: { id: "burden_the_quiet_fractures:s3:fallback", target: { strain: "oneToTwo" }, tileAdjustment: strain("place", 2, 1, 2) } } }
]);
burden("burden_tools_left_to_rust", [
  { target: placed(["crafting", "merchant"]), tileAdjustment: strain("place", 1, 1, 1) },
  { target: placed(["crafting", "merchant"]), tileAdjustment: strain("place", 1, 1, 1), fixedResources: { metal: -1 } },
  { target: placed(["crafting", "merchant"]), tileAdjustment: strain("place", 2, 1, 2), fixedResources: { metal: -2 } }
]);
burden("burden_the_long_cough", [
  { target: placed(["social", "wellbeing"]), tileAdjustment: strain("place", 1, 1, 1) },
  { target: placed(["social", "wellbeing"]), tileAdjustment: strain("place", 2, 1, 2) },
  { target: placed(["social", "wellbeing"]), tileAdjustment: strain("place", 3, 1, 3) }
]);
burden("burden_the_storehouses_disagree", [
  { target: placed(["resource"]), tileAdjustment: strain("place", 1, 1, 1), alternative: { kind: "warehouse_loss_or_strain", resources: ["wood", "stone", "food"], resourceStep: 2, requiredChoices: 1, requiredStrainTotal: 1 } },
  { target: placed(["resource"]), tileAdjustment: strain("place", 2, 2, 1), alternative: { kind: "warehouse_loss_or_strain", resources: ["wood", "stone", "metal", "food", "herbs"], resourceStep: 3, requiredChoices: 1, requiredStrainTotal: 2 } },
  { target: placed(["resource"]), tileAdjustment: strain("place", 4, 2, 2), alternative: { kind: "warehouse_loss_or_strain", resources: resources.filter((resource) => resource !== "goods"), resourceStep: 5, requiredChoices: 1, requiredStrainTotal: 4 } }
]);
burden("burden_bare_walls", [1, 2, 3].map((count) => ({ target: placed(["housing"], { notAdjacentToCategories: ["social", "wellbeing"] }), tileAdjustment: strain("place", count, 1, count), fallback: { when: "noTileTarget", rule: { id: `burden_bare_walls:s${count}:fallback`, fixedResources: { goods: -count } } } })));
burden("burden_empty_shelves", [1, 2, 3].map((count) => ({ target: placed(["social"]), tileAdjustment: strain("place", count, 1, count), alternative: { kind: "pay_or_strain", resources: ["goods"], resourceStep: 1, requiredChoices: count, strainPerChoice: 1 }, fallback: count === 3 ? { when: "noTileTarget", rule: { id: "burden_empty_shelves:s3:fallback", target: placed(["housing"]), tileAdjustment: strain("place", 1, 1, 1), alternative: { kind: "pay_or_strain", resources: ["goods"], resourceStep: 1, requiredChoices: 1, strainPerChoice: 1 } } } : undefined })));
for (const [id, resource] of [["burden_promises_overstretched", "goods"], ["burden_welcome_wears_thin", "herbs"]] as const) {
  burden(id, [1, 2, 3].map((count) => ({
    timer: { direction: "remove", limit: count, maxTargets: count },
    alternative: { kind: "pay_or_timer", resources: [resource], resourceStep: 1, requiredChoices: count, timerPerChoice: 1 },
    noEffectWhenNoTarget: count < 3,
    fallback: count === 3 ? { when: "noArrival", rule: { id: `${id}:s3:fallback`, target: placed(), tileAdjustment: strain("place", 2, 1, 2) } } : undefined
  })));
}

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
  add({ id: tileEffectRuleId(tileId, "basic"), target: { adjacentToSource: true, excludeSource: true, strain: "positive" }, tileAdjustment: strain("remove", 1, 1, 1) });
  add({ id: tileEffectRuleId(tileId, "upgraded"), target: { adjacentToSource: true, excludeSource: true, strain: "positive" }, tileAdjustment: strain("remove", 2, 1, 2), manualChoice: true });
}
for (const tileId of ["c12_apothecary", "c21_the_vaults"]) {
  add({ id: tileEffectRuleId(tileId, "basic"), target: { adjacentToSource: true, excludeSource: true, strain: "positive" }, tileAdjustment: strain("remove", 1, 1, 1) });
  add({ id: tileEffectRuleId(tileId, "upgraded"), target: { adjacentToSource: true, excludeSource: true, strain: "positive" }, tileAdjustment: strain("remove", 2, 2, 1) });
}

const adjacentSupportSpecials = ["special_alms_house", "special_atelier_workshop", "special_house_of_learning", "special_the_iron_roots_respite", "special_the_lorekeepers_respite", "special_the_reavers_respite", "special_the_root_weavers_respite", "special_the_tamers_respite", "special_theater"];
for (const tileId of adjacentSupportSpecials) add({ id: tileEffectRuleId(tileId, "special"), target: { adjacentToSource: true, excludeSource: true }, supportTarget: { adjacentToSource: true, excludeSource: true }, tileAdjustment: support(2), manualChoice: true, optional: true });
for (const tileId of ["special_adventurers_guild", "special_reliquary"]) add({ id: tileEffectRuleId(tileId, "special"), resolveBurden: { maxTargets: 1 }, manualChoice: true, optional: true });
add({ id: tileEffectRuleId("special_alchemist_s_workshop", "special"), exchangeLimit: 5, exchangeGoodsMode: true, manualChoice: true });
add({ id: tileEffectRuleId("special_hearth_garden", "special"), target: { categories: ["housing", "social", "wellbeing"], strain: "positive" }, tileAdjustment: strain("remove", 2, 2, 2), manualChoice: true, optional: true });
add({ id: tileEffectRuleId("special_the_waystation", "special"), deckReorder: { count: 3 } });
add({ id: tileEffectRuleId("special_the_resting_hall", "special"), target: { strain: "positive" }, tileAdjustment: strain("remove", 1, 1, 1) });

add({ id: stewardEffectRuleId("ranger"), manualChoice: true });
add({ id: stewardEffectRuleId("quartermaster"), timer: { direction: "add", limit: 1 }, exchangeLimit: 5, exchangeOptional: true, manualChoice: true });
add({ id: stewardEffectRuleId("warden"), target: {}, supportTarget: {}, tileAdjustment: combined(strain("remove", 1, 1, 1), support(1)), manualChoice: true });
for (const stewardId of ["vanguard", "knight", "sentinel"]) add({ id: stewardEffectRuleId(stewardId) });

add({ id: systemEffectRuleId("acknowledge") });
add({ id: systemEffectRuleId("arrival-expired"), target: { strain: "below3" }, tileAdjustment: strain("place", 1, 1, 1), manualChoice: true });

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
