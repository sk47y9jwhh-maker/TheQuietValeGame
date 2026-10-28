import { StrictMode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../app/App";
import { readSavedGame } from "../app/persistence";
import snapshots from "../app/scenarios.generated.json";
import type { PreviewSnapshot } from "../app/scenarioTypes";
import { EffectPrompt } from "../components/effects/EffectPrompt";
import { cardEffectRuleId } from "../data/effectRules";
import { resolvePendingEffect } from "../engine/manualEffects";
import { createNewGame } from "../engine/setup";
import type { EffectAdjustment, PendingEffectState, PlacedTile, Season } from "../engine/types";

const warden = snapshots["warden-response"] as unknown as PreviewSnapshot;
const fresh = () => structuredClone(warden.state!);
const saved = () => readSavedGame()!.state;
beforeEach(() => { localStorage.clear(); window.history.replaceState(null, "", "/?experience=tabletop&scenario=warden-response"); });
afterEach(() => { vi.restoreAllMocks(); window.history.replaceState(null, "", "/"); });
const core = (id: string, hex: string, strain = 0): PlacedTile => ({ instanceId: id, tileId: "c05_cabin", kind: "core", side: "basic", hexIds: [hex], strain, support: { passive: false, singleUse: false, preventedThisRound: false } });
function effect(sourceId: string, season: Season, suggestedAdjustment: EffectAdjustment = {}): PendingEffectState {
  return { id: "choice", sourceType: "card", sourceId, ruleId: cardEffectRuleId(sourceId, season), sourceName: "Choice", title: "Choose an outcome", effectText: "Pay resources or choose Strain or timer loss.", requiresManualChoice: true, suggestedAdjustment };
}
function applyButton() { return screen.getByRole("button", { name: "Apply Effect" }); }

describe("payment alternative shortcuts", () => {
  it.each(["tabletop"])("replaces prepared Strain with payment, commits once and supports Undo and reload in %s", (experience) => {
    window.history.replaceState(null, "", `/?experience=${experience}&scenario=warden-response`);
    const view = render(<StrictMode><App initialPreview={warden} /></StrictMode>);
    const before = saved();
    expect(screen.getByRole("button", { name: /^Pay 1 Food/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /^Pay 1 Goods No Strain/ }));
    expect(saved()).toEqual(before);
    expect(screen.getByLabelText("Effect preview")).toHaveTextContent("Goods");
    expect(screen.getByLabelText("Effect preview")).not.toHaveTextContent("Strain");
    expect(applyButton()).toBeEnabled(); fireEvent.click(applyButton());
    expect(saved().warehouse.goods).toBe(before.warehouse.goods - 1);
    expect(saved().map).toEqual(before.map);
    expect(saved().pendingEffects[0].sourceId).toBe("burden_river_breaks_its_banks");
    fireEvent.click(screen.getByRole("button", { name: "Undo last game step" }));
    expect(saved()).toEqual(before);
    fireEvent.click(screen.getByRole("button", { name: "Redo undone game step" }));
    const paid = saved(); view.unmount(); render(<App initialPreview={warden} />);
    expect(saved()).toEqual(paid);
  });

  it("restores the same suggested target without drawing or committing again", () => {
    const state = fresh(); const before = structuredClone(state); const apply = vi.fn();
    render(<EffectPrompt state={state} effect={state.pendingEffects[0]} onApply={apply} />);
    fireEvent.click(screen.getByRole("button", { name: /^Pay 1 Goods No Strain/ }));
    fireEvent.click(screen.getByRole("button", { name: "Restore suggested Strain" }));
    expect(screen.getByLabelText("Effect preview")).toHaveTextContent("Strain");
    fireEvent.click(applyButton());
    expect(apply.mock.calls[0][0].tileStrainDeltas).toEqual(state.pendingEffects[0].suggestedAdjustment!.tileStrainDeltas);
    expect(Object.values(apply.mock.calls[0][0].resourceDeltas)).toEqual([0, 0, 0, 0, 0, 0]);
    expect(state).toEqual(before);
    const result = resolvePendingEffect(state, apply.mock.calls[0][0]);
    expect(result.map.placedTiles.find((tile) => tile.instanceId === "tile_2_c05_cabin")!.strain).toBe(1);
    expect(result.warehouse).toEqual(before.warehouse);
  });

  it("allows mixed Season II choices and explains an extra payment instead of silently changing the target", () => {
    const state = createNewGame(1, ["vanguard"]); state.phase = "turns"; state.season = 2;
    state.map.placedTiles = [core("a", "G1"), core("b", "H1")]; state.warehouse.goods = 1;
    const pending = effect("burden_too_many_houses_too_little_homes", 2, { tileStrainDeltas: { a: 1, b: 1 } });
    state.pendingEffects = [pending]; const apply = vi.fn();
    render(<EffectPrompt state={state} effect={pending} onApply={apply} />);
    expect(screen.getByRole("button", { name: /^Pay 2 Goods/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Spend 1 Goods" }));
    expect(screen.getByRole("status")).toHaveTextContent("Too many outcomes selected");
    expect(applyButton()).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Clear choices" }));
    expect(applyButton()).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Spend 1 Goods" }));
    fireEvent.click(screen.getByRole("button", { name: "Increase Strain adjustment for Cabin at G1" }));
    expect(applyButton()).toBeEnabled(); fireEvent.click(applyButton());
    const next = resolvePendingEffect(state, apply.mock.calls[0][0]);
    expect(next.warehouse.goods).toBe(0); expect(next.map.placedTiles[0].strain).toBe(1); expect(next.map.placedTiles[1].strain).toBe(0);
  });

  it("replaces and restores timer loss, with a valid payment preview", () => {
    const state = createNewGame(1, ["vanguard"]); state.phase = "turns";
    const id = "arrival_the_quiet_quest"; state.encounters.activeArrivals = [{ cardId: id, timerTokens: 2 }];
    const pending = effect("burden_promises_overstretched", 1, { arrivalTimerDeltas: { [id]: -1 } }); state.pendingEffects = [pending]; const apply = vi.fn();
    render(<EffectPrompt state={state} effect={pending} onApply={apply} />);
    fireEvent.click(screen.getByRole("button", { name: /^Pay 1 Goods No timer loss/ }));
    expect(applyButton()).toBeEnabled();
    expect(screen.getByLabelText("Effect preview")).not.toHaveTextContent("timer");
    fireEvent.click(screen.getByRole("button", { name: "Restore suggested timer loss" }));
    expect(screen.getByLabelText("Effect preview")).toHaveTextContent("timer");
    fireEvent.click(screen.getByRole("button", { name: /^Pay 1 Goods No timer loss/ })); fireEvent.click(applyButton());
    const next = resolvePendingEffect(state, apply.mock.calls[0][0]);
    expect(next.encounters.activeArrivals).toEqual(state.encounters.activeArrivals);
    expect(next.warehouse.goods).toBe(state.warehouse.goods - 1);
  });

  it("retains an omitted timer suggestion but rejects clearing every outcome without payment", () => {
    const state = createNewGame(1, ["vanguard"]); state.phase = "turns";
    const id = "arrival_the_quiet_quest"; state.encounters.activeArrivals = [{ cardId: id, timerTokens: 2 }];
    state.pendingEffects = [effect("burden_promises_overstretched", 1, { arrivalTimerDeltas: { [id]: -1 } })];
    const acknowledged = resolvePendingEffect(state);
    expect(acknowledged.encounters.activeArrivals[0].timerTokens).toBe(1);
    expect(acknowledged.warehouse).toEqual(state.warehouse);
    expect(resolvePendingEffect(state, { arrivalTimerDeltas: {} })).toBe(state);
  });

  it.each(["burden_too_many_houses_too_little_homes", "burden_promises_overstretched"])("explains zero eligible outcomes for %s without showing 0/0 resource controls", (id) => {
    const state = createNewGame(1, ["vanguard"]); state.phase = "turns";
    const pending = effect(id, 1); state.pendingEffects = [pending]; const apply = vi.fn();
    render(<EffectPrompt state={state} effect={pending} onApply={apply} />);
    expect(screen.getByLabelText("No resource choice")).toHaveTextContent("No eligible outcome");
    expect(screen.queryByText("0/0 outcomes selected")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Spend 1 Goods" })).not.toBeInTheDocument();
    expect(applyButton()).toBeEnabled(); fireEvent.click(applyButton());
    expect(resolvePendingEffect(state, apply.mock.calls[0][0]).pendingEffects).toHaveLength(0);
  });

  it("explains empty Help Stands gains while retaining mandatory Strain removal", () => {
    const state = createNewGame(1, ["vanguard"]); state.phase = "turns"; state.season = 2;
    state.players[0].stewardHexId = "G1"; state.map.placedTiles = [core("a", "G1", 2)];
    const pending = effect("boon_where_help_stands", 2); state.pendingEffects = [pending]; const apply = vi.fn();
    render(<EffectPrompt state={state} effect={pending} onApply={apply} />);
    expect(screen.getByLabelText("No resource choice")).toHaveTextContent("No Steward occupies an unstrained tile");
    expect(screen.getByLabelText("Effect preview")).toHaveTextContent("-1 Strain");
    expect(screen.queryByRole("button", { name: "Add 1 Wood" })).not.toBeInTheDocument();
    fireEvent.click(applyButton());
    expect(resolvePendingEffect(state, apply.mock.calls[0][0]).map.placedTiles[0].strain).toBe(1);
  });

  it("keeps the classic comparison's existing controls", () => {
    window.history.replaceState(null, "", "/?experience=classic&scenario=warden-response");
    const state = fresh(); render(<EffectPrompt state={state} effect={state.pendingEffects[0]} onApply={vi.fn()} />);
    expect(screen.queryByRole("region", { name: "Payment alternatives" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Spend 1 Goods" })).toBeVisible();
  });
});
