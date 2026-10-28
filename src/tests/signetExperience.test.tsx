import { StrictMode } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../app/App";
import { readSavedGame } from "../app/persistence";
import type { PreviewSnapshot } from "../app/scenarioTypes";
import snapshots from "../app/scenarios.generated.json";
import { GoldenEffectPanel } from "../components/effects/GoldenEffectPanel";
import { originalSignetDraft, signetLegalSpaces, signetPlanningState } from "../components/effects/signetPlanning";
import { getTilePlacementHexIds } from "../engine/placementRules";
import { resolveGoldenSignet, validateGoldenSignetPlacements } from "../engine/golden";
import { recalculatePassiveSupported } from "../engine/supportRules";
import type { PlacedTile } from "../engine/types";

const fixture = snapshots["golden-signet"] as unknown as PreviewSnapshot;
const fresh = () => structuredClone(fixture.state!);
beforeEach(() => { localStorage.clear(); window.history.replaceState(null, "", "/?experience=tabletop&scenario=golden-signet"); });
afterEach(() => { vi.restoreAllMocks(); window.history.replaceState(null, "", "/"); });
function panel(state = fresh(), resolve = vi.fn()) {
  const view = render(<GoldenEffectPanel state={state} onResolveSignet={resolve} onResolveBell={vi.fn()} onResolveScroll={vi.fn()} />);
  return { ...view, resolve };
}
function choose(name: string) { fireEvent.click(screen.getByRole("checkbox", { name })); }
function destination(id: string, label = "Destination") { fireEvent.change(screen.getByRole("combobox", { name: label }), { target: { value: id } }); }
function swap() {
  choose("Move Cabin at H1"); choose("Move Path at F1");
  fireEvent.click(screen.getByRole("button", { name: "Plan 2 tiles" }));
  destination("F1"); fireEvent.click(screen.getByRole("button", { name: "Next tile" })); destination("H1");
  fireEvent.click(screen.getByRole("button", { name: "Review settlement plan" }));
}
function placed(id: string, tileId: string, hexIds: string[], kind: PlacedTile["kind"] = "core"): PlacedTile {
  return { instanceId: id, tileId, hexIds, kind, side: kind === "core" ? "basic" : "special", strain: 1, support: { passive: false, singleUse: true, preventedThisRound: false } };
}

describe("guided Golden Signet planning", () => {
  it.each(["tabletop"])("plans a simultaneous swap, previews its Steward and commits only explicitly in %s", (experience) => {
    window.history.replaceState(null, "", `/?experience=${experience}&scenario=golden-signet`);
    const state = fresh(); const original = structuredClone(state);
    const { resolve } = panel(state);
    swap();
    expect(resolve).not.toHaveBeenCalled();
    expect(state).toEqual(original);
    expect(screen.getByRole("heading", { name: "Review the new settlement." })).toHaveFocus();
    expect(screen.getByText("Vanguard: F1 → H1")).toBeVisible();
    expect(screen.getByText("H1 → F1")).toBeVisible();
    expect(screen.getByRole("region", { name: "Golden Signet settlement plan" })).toHaveTextContent("0 actions · No resource change");
    fireEvent.click(screen.getByRole("button", { name: "Back to destinations" }));
    expect(screen.getByRole("combobox", { name: "Destination" })).toHaveValue("F1");
    fireEvent.click(screen.getByRole("button", { name: "Review settlement plan" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply settlement plan" }));
    expect(resolve).toHaveBeenCalledOnce();
    const plans = resolve.mock.calls[0][0];
    const next = resolveGoldenSignet(state, plans);
    expect(next.players[0].stewardHexId).toBe("H1");
    expect(next.map.placedTiles.find((tile) => tile.instanceId === "tile_2_c05_cabin")?.hexIds).toEqual(["F1"]);
    expect(next.warehouse).toEqual(state.warehouse);
    expect(next.actionsRemaining).toBe(state.actionsRemaining);
  });

  it("returns focus when changing selected tiles without losing the draft or taking focus during checkbox edits", () => {
    render(<StrictMode><App initialPreview={fixture} /></StrictMode>);
    const before = readSavedGame();
    expect(screen.getByRole("heading", { name: "Resolve Golden Legacy" })).toHaveFocus();
    choose("Move Lumber Yard at G1");
    fireEvent.click(screen.getByRole("button", { name: "Plan 1 tile" }));
    destination("B8");
    const back = screen.getByRole("button", { name: "Change selected tiles" });
    back.focus(); fireEvent.click(back);
    expect(screen.getByRole("heading", { name: "Reshape your settlement." })).toHaveFocus();
    const checkbox = screen.getByRole("checkbox", { name: "Move Lumber Yard at G1" });
    checkbox.focus(); fireEvent.click(checkbox);
    expect(checkbox).toHaveFocus(); expect(checkbox).not.toBeChecked();
    fireEvent.click(checkbox); fireEvent.click(screen.getByRole("button", { name: "Plan 1 tile" }));
    expect(screen.getByRole("heading", { name: "Move Lumber Yard" })).toHaveFocus();
    expect(screen.getByRole("combobox", { name: "Destination" })).toHaveValue("B8");
    expect(readSavedGame()).toEqual(before);
  });

  it("persists the engine result once, with Undo, Redo and reload preserving tile tokens", () => {
    const view = render(<App initialPreview={fixture} />);
    swap();
    expect(readSavedGame()?.state.map).toEqual(fixture.state!.map);
    fireEvent.click(screen.getByRole("button", { name: "Apply settlement plan" }));
    const saved = readSavedGame()!.state;
    expect(saved.pendingGoldenEffect).toBeNull();
    expect(saved.players[0].stewardHexId).toBe("H1");
    expect(saved.map.placedTiles.find((tile) => tile.instanceId === "tile_2_c05_cabin")?.strain).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: "Undo last game step" }));
    expect(readSavedGame()?.state.map).toEqual(fixture.state!.map);
    expect(screen.getByRole("heading", { name: "Reshape your settlement." })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Redo undone game step" }));
    expect(readSavedGame()?.state.map).toEqual(saved.map);
    view.unmount(); render(<App initialPreview={fixture} />);
    expect(readSavedGame()?.state.map).toEqual(saved.map);
  });

  it("limits selection to five tiles and provides an explicit no-move exit", () => {
    const { resolve } = panel();
    const choices = screen.getAllByRole("checkbox");
    for (const checkbox of choices.slice(0, 5)) fireEvent.click(checkbox);
    expect(choices[5]).toBeDisabled();
    fireEvent.click(choices[0]); expect(choices[5]).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Keep the settlement as it is" }));
    expect(resolve).toHaveBeenCalledWith([]);
  });

  it("rechecks occupied spaces when a tile is removed from a drafted swap", () => {
    panel(); swap();
    fireEvent.click(screen.getByRole("button", { name: "Back to destinations" }));
    fireEvent.click(screen.getByRole("button", { name: "Change selected tiles" }));
    choose("Move Path at F1");
    fireEvent.click(screen.getByRole("button", { name: "Plan 1 tile" }));
    expect(screen.getByRole("combobox", { name: "Destination" })).toHaveValue("F1");
    expect(screen.getByRole("option", { name: "F1 · Unavailable in this plan" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review settlement plan" })).toBeDisabled();
    destination("I1");
    expect(screen.getByRole("button", { name: "Review settlement plan" })).toBeEnabled();
  });

  it("explains an empty board without offering an impossible plan", () => {
    const state = fresh(); state.map.placedTiles = [];
    const { resolve } = panel(state);
    expect(screen.getByText(/There are no placed tiles to move/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Plan selected tiles" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Keep the settlement as it is" }));
    expect(resolve).toHaveBeenCalledWith([]);
  });

  it("offers legal anchors for the chosen line orientation and retains upgraded state", () => {
    const state = fresh(); const street = placed("street", "c16_street", ["F2", "G2"]); street.side = "upgraded"; state.map.placedTiles = [street];
    const { resolve } = panel(state);
    choose("Move Improved Street at F2, G2"); fireEvent.click(screen.getByRole("button", { name: "Plan 1 tile" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Orientation" }), { target: { value: "2" } });
    const options = within(screen.getByRole("combobox", { name: "Destination" })).getAllByRole("option").slice(1) as HTMLOptionElement[];
    expect(options.length).toBeGreaterThan(0);
    for (const option of options) expect(validateGoldenSignetPlacements(state, [{ placedTileId: street.instanceId, placement: { anchorHexId: option.value, orientation: 2 } }]).ok).toBe(true);
    destination(options[0].value);
    fireEvent.click(screen.getByRole("button", { name: "Review settlement plan" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply settlement plan" }));
    const next = resolveGoldenSignet(state, resolve.mock.calls[0][0]);
    expect(next.map.placedTiles[0].hexIds).toHaveLength(2);
    expect(next.map.placedTiles[0].side).toBe("upgraded");
    expect(next.map.placedTiles[0].support.singleUse).toBe(true);
    expect(next.map.placedTiles[0].strain).toBe(1);
  });

  it("chooses detached spaces separately, excludes duplicates, and can restore the original footprint", () => {
    const state = fresh(); state.map.placedTiles = [placed("stables", "special_stables", ["G1", "B8"], "special")];
    const { resolve } = panel(state);
    choose("Move Stables at G1, B8"); fireEvent.click(screen.getByRole("button", { name: "Plan 1 tile" }));
    destination("A1", "Space 1 of 2");
    expect(screen.getByRole("button", { name: "Review settlement plan" })).toBeDisabled();
    const options = within(screen.getByRole("combobox", { name: "Space 2 of 2" })).getAllByRole("option") as HTMLOptionElement[];
    expect(options.map((option) => option.value)).not.toContain("A1");
    destination("N9", "Space 2 of 2");
    expect(screen.getByRole("button", { name: "Review settlement plan" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Clear this destination" }));
    expect(screen.getByRole("button", { name: "Review settlement plan" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Use original position" }));
    expect(screen.getByRole("combobox", { name: "Space 1 of 2" })).toHaveValue("G1");
    expect(screen.getByRole("combobox", { name: "Space 2 of 2" })).toHaveValue("B8");
    fireEvent.click(screen.getByRole("button", { name: "Review settlement plan" })); fireEvent.click(screen.getByRole("button", { name: "Apply settlement plan" }));
    expect(resolveGoldenSignet(state, resolve.mock.calls[0][0]).map.placedTiles[0].hexIds).toEqual(["G1", "B8"]);
  });

  it("shows support lost by an unselected neighbour in the engine preview", () => {
    let state = fresh(); const common = placed("common", "c18_common_land", ["G1"]); const cabin = placed("home", "c05_cabin", ["H1"]); cabin.support.singleUse = false;
    state.map.placedTiles = [common, cabin]; state = recalculatePassiveSupported(state);
    expect(state.map.placedTiles[1].support.passive).toBe(true);
    panel(state); choose("Move Common Land at G1"); fireEvent.click(screen.getByRole("button", { name: "Plan 1 tile" })); destination("N9");
    fireEvent.click(screen.getByRole("button", { name: "Review settlement plan" }));
    expect(screen.getByRole("heading", { name: "Other support changes" })).toBeVisible();
    expect(screen.getByText("Cabin at H1: Unsupported")).toBeVisible();
    expect(state.map.placedTiles[1].support.passive).toBe(true);
  });

  it("browses the map with one Tab stop and only chooses a destination on explicit activation", () => {
    const { resolve } = panel(); choose("Move Lumber Yard at G1"); fireEvent.click(screen.getByRole("button", { name: "Plan 1 tile" }));
    const map = screen.getByRole("group", { name: "The Quiet Vale map" });
    const initial = within(map).getAllByRole("button").find((button) => button.getAttribute("tabindex") === "0")!;
    expect(within(map).getAllByRole("button").filter((button) => button.getAttribute("tabindex") === "0")).toHaveLength(1);
    fireEvent.keyDown(initial, { key: "ArrowRight" });
    expect(screen.getByRole("combobox", { name: "Destination" })).toHaveValue("");
    fireEvent.keyDown(within(map).getByRole("button", { name: "I1, Woodland" }), { key: "Enter" });
    expect(screen.getByRole("combobox", { name: "Destination" })).toHaveValue("I1");
    expect(resolve).not.toHaveBeenCalled();
  });
});

it("reconstructs each original line footprint and reserves planned spaces while lifting unassigned tiles", () => {
  const state = fresh(); const selected = ["tile_2_c05_cabin", "tile_3_c15_path"];
  const planning = signetPlanningState(state, selected, {}, selected[0]);
  const cabin = state.map.placedTiles.find((tile) => tile.instanceId === selected[0])!;
  expect(signetLegalSpaces(planning, cabin, {}, 0)).toContain("F1");
  const reserved = signetPlanningState(state, selected, { [selected[1]]: { anchorHexId: "I1" } }, selected[0]);
  expect(signetLegalSpaces(reserved, cabin, {}, 0)).not.toContain("I1");
  for (const direction of [0, 1, 2, 3, 4, 5] as const) {
    const tile = placed("track", "c17_track", getTilePlacementHexIds("c17_track", { anchorHexId: "G5", orientation: direction }));
    expect(getTilePlacementHexIds(tile.tileId, originalSignetDraft(tile))).toEqual(tile.hexIds);
  }
});
