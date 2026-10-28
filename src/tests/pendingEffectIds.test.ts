import { afterEach, describe, expect, it, vi } from "vitest";
import { systemEffectRuleId } from "../data/effectRules";
import { queuePendingEffect, queuePendingEffectFirst, resolvePendingEffect } from "../engine/manualEffects";
import { createNewGame } from "../engine/setup";
import type { PendingEffectState, PlacedTile } from "../engine/types";
const timestamp = 1790467200000;
const ack: Omit<PendingEffectState, "id"> = { ruleId: systemEffectRuleId("acknowledge"), sourceType: "system", sourceName: "Next card", title: "Next card", effectText: "Acknowledge the next card." };
afterEach(() => vi.restoreAllMocks());
function cappedState() {
  vi.spyOn(Date, "now").mockReturnValue(timestamp);
  const state = createNewGame(1, ["vanguard"]); state.phase = "turns";
  state.log = Array.from({ length: 80 }, (_, index) => ({ id: `log_${index}`, round: 9, message: "An earlier step." }));
  return state;
}
function tile(instanceId: string, tileId: string, hex: string, strain: number): PlacedTile {
  return { instanceId, tileId, kind: "core", side: "basic", hexIds: [hex], strain, support: { passive: false, singleUse: false, preventedThisRound: false } };
}
describe("pending effect identities after the history log fills", () => {
  it.each([queuePendingEffect, queuePendingEffectFirst])("keeps a new effect distinct from every queued effect at the same millisecond", (queue) => {
    const state = cappedState();
    state.pendingEffects = [83, 84].map((id) => ({ ...ack, id: `effect_${id}_${timestamp}` }));
    const next = queue(state, ack);
    expect(new Set(next.pendingEffects.map((effect) => effect.id)).size).toBe(3);
    expect(next.pendingEffects.some((effect) => effect.id === `effect_85_${timestamp}`)).toBe(true);
    expect(state.pendingEffects).toHaveLength(2);
  });
  it.each([
    ["trigger", `effect_82_${timestamp}`],
    [`effect_82_${timestamp}`, "later-card"]
  ])("keeps the Overstrain chain distinct from the triggering and remaining effects (%s)", (triggerId, laterId) => {
    const state = cappedState();
    state.map.placedTiles = [tile("source", "c15_path", "G1", 2), tile("neighbor", "c05_cabin", "H1", 0)];
    state.pendingEffects = [{ ...ack, id: triggerId, ruleId: systemEffectRuleId("arrival-expired"), targetCardPrepared: true, targetCardTargetTileIds: ["source"], targetCardPlannedStrainByTileId: { source: 1 }, suggestedAdjustment: { tileStrainDeltas: { source: 1 } } }, { ...ack, id: laterId }];
    const spread = resolvePendingEffect(state);
    expect(spread.map.placedTiles[0].strain).toBe(3);
    expect(spread.pendingEffects).toHaveLength(2);
    expect(spread.pendingEffects[0].ruleId).toBe(systemEffectRuleId("overstrain-spread"));
    expect(spread.pendingEffects[0].id).not.toBe(spread.pendingEffects[1].id);
    expect(spread.pendingEffects[0].id).not.toBe(triggerId);
    const afterSpread = resolvePendingEffect(spread);
    expect(afterSpread.map.placedTiles[1].strain).toBe(1);
    expect(afterSpread.pendingEffects.map((effect) => effect.id)).toEqual([laterId]);
    expect(resolvePendingEffect(afterSpread).pendingEffects).toHaveLength(0);
  });
});
