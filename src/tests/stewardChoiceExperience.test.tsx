import { StrictMode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../app/App";
import { readSavedGame } from "../app/persistence";
import snapshots from "../app/scenarios.generated.json";
import type { PreviewSnapshot } from "../app/scenarioTypes";
import { EffectPrompt } from "../components/effects/EffectPrompt";
import { useStewardPower, cancelPendingBurdenWithWarden } from "../engine/gameActions";
import { isPendingEffectAdjustmentValid, resolvePendingEffect } from "../engine/manualEffects";
import { getTemporaryReachHexIds } from "../engine/reachability";
import type { EffectAdjustment } from "../engine/types";

const ranger = snapshots["ranger-reach"] as unknown as PreviewSnapshot;
const warden = snapshots["warden-response"] as unknown as PreviewSnapshot;
const rangerChoice = () => useStewardPower(structuredClone(ranger.state!), "player_1");
const wardenChoice = () => cancelPendingBurdenWithWarden(structuredClone(warden.state!));
const saved = () => readSavedGame()!.state;
beforeEach(() => { localStorage.clear(); window.history.replaceState(null, "", "/?experience=tabletop&scenario=ranger-reach"); });
afterEach(() => { vi.restoreAllMocks(); window.history.replaceState(null, "", "/"); });

function openRanger() {
  fireEvent.click(screen.getByRole("button", { name: /Ranger Power Ready now/ }));
  fireEvent.click(screen.getByRole("button", { name: "Choose Temporary Reach" }));
}

describe("Ranger choice validation", () => {
  it.each([
    ["unknown hex", { temporaryReachHexUpdates: { player_1: "Z99" } }],
    ["other player", { temporaryReachHexUpdates: { player_2: "F4" } }],
    ["two players", { temporaryReachHexUpdates: { player_1: "F4", player_2: "A1" } }],
    ["no choice", {}],
    ["resource changes", { temporaryReachHexUpdates: { player_1: "F4" }, resourceDeltas: { wood: 3 } }],
    ["Steward movement", { temporaryReachHexUpdates: { player_1: "F4" }, stewardHexUpdates: { player_1: "F4" } }]
  ] as [string, EffectAdjustment][])("rejects %s without consuming the pending decision", (_, adjustment) => {
    const state = rangerChoice();
    expect(isPendingEffectAdjustmentValid(state, state.pendingEffects[0], adjustment)).toBe(false);
    expect(resolvePendingEffect(state, adjustment)).toBe(state);
  });

  it("rejects a target that has become Overstrained, including every hex of a multi-hex tile", () => {
    const state = rangerChoice();
    state.map.placedTiles[2].strain = 3;
    state.map.placedTiles[2].hexIds.push("F3");
    expect(getTemporaryReachHexIds(state)).not.toContain("F4");
    expect(getTemporaryReachHexIds(state)).not.toContain("F3");
    const adjustment = { temporaryReachHexUpdates: { player_1: "F4" } };
    expect(resolvePendingEffect(state, adjustment)).toBe(state);
  });

  it("rejects temporary reach on an unrelated effect", () => {
    const state = wardenChoice();
    expect(resolvePendingEffect(state, { temporaryReachHexUpdates: { player_1: "F4" } })).toBe(state);
  });
});

describe("Ranger player experience", () => {
  it.each(["tabletop"])("previews, confirms, undoes and restores reach in %s", (experience) => {
    window.history.replaceState(null, "", `/?experience=${experience}&scenario=ranger-reach`);
    const view = render(<StrictMode><App initialPreview={ranger} /></StrictMode>);

    openRanger();
    expect(screen.getByRole("button", { name: "Set reach" })).toBeDisabled();
    expect(saved().players[0].stewardPowerUsesBySeason[1]).toBe(1);
    fireEvent.change(screen.getByRole("combobox", { name: "Reach target" }), { target: { value: "F4" } });
    expect(saved().players[0].temporaryReachHexId).toBeUndefined();
    expect(screen.getByText(/Your Steward stays at A2/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Set reach at F4" }));
    expect(saved().players[0].temporaryReachHexId).toBe("F4");
    expect(saved().players[0].stewardHexId).toBe("A2");
    expect(saved().warehouse).toEqual(ranger.state!.warehouse);
    expect(saved().actionsRemaining).toBe(4);

    expect(screen.getByRole("region", { name: "Ranger's temporary reach" })).toHaveTextContent("F4");
    fireEvent.click(screen.getByRole("button", { name: "Undo last game step" }));
    expect(screen.getByRole("region", { name: "Choose Ranger reach" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Undo last game step" }));
    expect(saved().players[0].stewardPowerUsesBySeason[1]).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: "Redo undone game step" }));
    fireEvent.click(screen.getByRole("button", { name: "Redo undone game step" }));
    view.unmount(); render(<App initialPreview={ranger} />);
    expect(saved().players[0].temporaryReachHexId).toBe("F4");
  });

  it("explains an invalid map choice instead of allowing an Overstrained target", () => {
    const state = rangerChoice(); state.map.placedTiles[2].strain = 3;
    const apply = vi.fn();
    render(<EffectPrompt state={state} effect={state.pendingEffects[0]} onApply={apply} />);
    fireEvent.click(screen.getByRole("button", { name: /^F4,/ }));
    expect(screen.getByText(/This tile is Overstrained/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Set reach" })).toBeDisabled();
    fireEvent.change(screen.getByRole("combobox", { name: "Reach target" }), { target: { value: "N9" } });
    fireEvent.click(screen.getByRole("button", { name: "Set reach at N9" }));
    expect(apply).toHaveBeenCalledWith({ temporaryReachHexUpdates: { player_1: "N9" } });
  });

  it("warns at handoff and clears reach only when the turn ends, with Undo", () => {
    render(<App initialPreview={ranger} />); openRanger();
    fireEvent.change(screen.getByRole("combobox", { name: "Reach target" }), { target: { value: "F4" } });
    fireEvent.click(screen.getByRole("button", { name: "Set reach at F4" }));
    fireEvent.click(screen.getByRole("button", { name: "End Turn" }));
    expect(screen.getByRole("region", { name: "After this turn" })).toHaveTextContent("Ranger’s temporary reach ends with this turn");
    expect(saved().players[0].temporaryReachHexId).toBe("F4");
    fireEvent.click(screen.getByRole("button", { name: "End Player 1's Turn" }));
    expect(saved().players[0].temporaryReachHexId).toBeUndefined();
    fireEvent.click(screen.getByRole("button", { name: "Undo last game step" }));
    expect(saved().players[0].temporaryReachHexId).toBe("F4");
  });
});

describe("Warden player experience", () => {
  it("explains the spent use and retained Burden, saves relief and supports Undo/Redo/reload", () => {
    window.history.replaceState(null, "", "/?experience=tabletop&scenario=warden-response");
    const view = render(<StrictMode><App initialPreview={warden} /></StrictMode>);
    expect(screen.getByRole("complementary", { name: "Warden's response" })).toHaveTextContent("Burden stays active");
    const burdens = saved().encounters.activeBurdens;
    fireEvent.click(screen.getByRole("button", { name: "Use the Warden’s power" }));
    expect(saved().players[1].stewardPowerUsesBySeason[1]).toBe(1);
    expect(saved().encounters.activeBurdens).toEqual(burdens);
    expect(screen.getByRole("button", { name: "Apply Warden relief" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Give Supported to Path at F4" }));
    expect(screen.getByText("Path (F4): gains Supported")).toBeVisible();
    expect(saved().map.placedTiles[2].support.singleUse).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Apply Warden relief" }));
    expect(saved().map.placedTiles[2].support.singleUse).toBe(true);
    expect(saved().encounters.activeBurdens).toEqual(burdens);
    expect(saved().warehouse).toEqual(warden.state!.warehouse);
    expect(saved().pendingEffects[0].sourceId).toBe("burden_river_breaks_its_banks");
    fireEvent.click(screen.getByRole("button", { name: "Undo last game step" }));
    expect(screen.getByRole("region", { name: "Warden relief choice" })).toBeVisible();
    expect(saved().map.placedTiles[2].support.singleUse).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Undo last game step" }));
    expect(saved().players[1].stewardPowerUsesBySeason[1]).toBe(0);
    expect(saved().pendingEffects[0].sourceId).toBe("burden_too_many_houses_too_little_homes");
    fireEvent.click(screen.getByRole("button", { name: "Redo undone game step" }));
    fireEvent.click(screen.getByRole("button", { name: "Redo undone game step" }));
    view.unmount(); render(<App initialPreview={warden} />);
    expect(saved().map.placedTiles[2].support.singleUse).toBe(true);
    expect(saved().players[1].stewardPowerUsesBySeason[1]).toBe(1);
  });

  it("switches directly between relief types and tiles, with a truthful Strain preview", () => {
    const state = wardenChoice(); state.map.placedTiles[0].strain = 2;
    state.map.placedTiles[2].support.singleUse = true;
    const apply = vi.fn();
    render(<EffectPrompt state={state} effect={state.pendingEffects[0]} onApply={apply} />);
    expect(screen.getByRole("button", { name: "Give Supported to Path at F4" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Remove 1 Strain from Cabin at A2" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Give Supported to Cabin at A2" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove 1 Strain from Path at A3" }));
    expect(screen.getByRole("button", { name: "Give Supported to Cabin at A2" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("Path (A3): Strain 2 → 1")).toBeVisible();
    expect(state.map.placedTiles[0].strain).toBe(2);
    fireEvent.click(screen.getByRole("button", { name: "Apply Warden relief" }));
    expect(apply).toHaveBeenCalledWith({ tileStrainDeltas: { tile_1_c15_path: -1 } });
  });

  it("lets a restored relief prompt continue honestly if no eligible tile remains", () => {
    const state = wardenChoice();
    for (const tile of state.map.placedTiles) tile.support.singleUse = true;
    const apply = vi.fn();
    render(<EffectPrompt state={state} effect={state.pendingEffects[0]} onApply={apply} />);
    expect(screen.getByText(/There is no relief to apply/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(apply).toHaveBeenCalledWith({});
  });
});
