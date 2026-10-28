import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../app/App";
import { readSavedGame } from "../app/persistence";
import type { PreviewSnapshot } from "../app/scenarioTypes";
import snapshots from "../app/scenarios.generated.json";
import { previewTileAction } from "../components/actions/actionForecast";
import { activateTile, useStewardPower } from "../engine/gameActions";
import { createNewGame } from "../engine/setup";
import type { GameState, PlacedTile } from "../engine/types";

const settlement = snapshots.settlement as unknown as PreviewSnapshot;
const lastAction = snapshots["last-action"] as unknown as PreviewSnapshot;
function placed(tileId: string, instanceId: string, hexId: string, side: PlacedTile["side"] = "basic"): PlacedTile {
  return { tileId, instanceId, hexIds: [hexId], kind: side === "special" ? "special" : "core", side, strain: 0, support: { passive: false, singleUse: false, preventedThisRound: false } };
}
function productionState(): GameState {
  const state = createNewGame(1, ["vanguard"]);
  state.phase = "turns";
  state.players[0].hasPlacedFirstTile = true;
  state.players[0].stewardHexId = "G1";
  state.map.placedTiles = [placed("c01_lumber_yard", "lumber", "G1")];
  return state;
}
function freezeTree(value: unknown): void {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return;
  Object.freeze(value);
  Object.values(value).forEach(freezeTree);
}

beforeEach(() => { window.localStorage.clear(); window.history.replaceState(null, "", "/?experience=tabletop&scenario=settlement"); });
afterEach(() => window.history.replaceState(null, "", "/"));

describe("uncommitted action forecasts", () => {
  it("shows a full warehouse without mutating the game, using an action or making a save", () => {
    const state = productionState();
    freezeTree(state);
    const forecast = previewTileAction(state, state.currentPlayerId, { type: "activate", placedTileId: "lumber" });
    expect(forecast.actionCost).toBe(1);
    expect(forecast.resources).toEqual([{ resource: "wood", label: "Wood", before: 15, after: 15, delta: 0, atCapacity: true }]);
    expect(forecast.warning).toContain("will not increase");
    expect(state.actionsRemaining).toBe(4);
    expect(state.tileActivationRecords).toEqual({});
    expect(window.localStorage.length).toBe(0);
  });

  it("accounts for linked production, a Shrine and repeated production in the same round", () => {
    const state = productionState();
    state.warehouse.wood = 5;
    state.warehouse.food = 5;
    state.map.placedTiles.push(placed("c01_lumber_yard", "linked", "H1", "upgraded"), placed("special_shrine_of_renewal", "shrine", "G2", "special"));
    const first = previewTileAction(state, state.currentPlayerId, { type: "activate", placedTileId: "lumber" });
    expect(first.resources.find((change) => change.resource === "wood")?.after).toBe(12);
    expect(first.resources.find((change) => change.resource === "food")?.after).toBe(7);
    const next = activateTile(state, state.currentPlayerId, "lumber");
    const second = previewTileAction(next, next.currentPlayerId, { type: "activate", placedTileId: "lumber" });
    expect(second.resources.find((change) => change.resource === "wood")?.delta).toBe(2);
    expect(second.resources.some((change) => change.resource === "food")).toBe(false);
  });

  it("shows a capped partial gain and prevents an unavailable zero-action activation", () => {
    const state = productionState();
    state.warehouse.wood = 14;
    const preview = previewTileAction(state, state.currentPlayerId, { type: "activate", placedTileId: "lumber" });
    expect(preview.resources[0]).toMatchObject({ before: 14, after: 15, delta: 1, atCapacity: true });
    expect(preview.warning).toBeUndefined();
    const empty = { ...state, actionsRemaining: 0 };
    expect(previewTileAction(empty, empty.currentPlayerId, { type: "activate", placedTileId: "lumber" })).toMatchObject({ available: false, notes: ["No actions remain for this tile."] });
  });

  it("recognises free Vanguard placement and its Supported benefit", () => {
    const state = useStewardPower(lastAction.state!, "player_1");
    const preview = previewTileAction(state, "player_1", { type: "place", tileId: "c15_path", draft: { anchorHexId: "F2" } });
    expect(preview).toMatchObject({ available: true, actionCost: 0, paymentChoice: false });
    expect(preview.notes).toContain("Path gains Supported.");
    expect(state.map.placedTiles).toHaveLength(3);
  });

  it("labels optional payment as a following choice without inventing a final cost", () => {
    const state = productionState();
    state.map.placedTiles.push(placed("c14_market_stalls", "market", "H1"));
    const preview = previewTileAction(state, state.currentPlayerId, { type: "place", tileId: "c12_apothecary", draft: { anchorHexId: "G2" } });
    expect(preview).toMatchObject({ available: true, actionCost: 1, paymentChoice: true, resources: [] });
    expect(state.pendingCostChoice).toBeNull();
    expect(state.warehouse.wood).toBe(15);
  });
});

describe("tile discovery and commitment", () => {
  it("keeps the selection while filtering, searching and recovering from no matches", () => {
    render(<App initialPreview={settlement} />);
    fireEvent.click(screen.getByRole("button", { name: "Search or filter tiles" }));
    expect(screen.getByRole("searchbox", { name: "Find a tile" })).toHaveFocus();
    fireEvent.change(screen.getByRole("combobox", { name: "Category" }), { target: { value: "travel" } });
    const list = screen.getByRole("listbox", { name: "Choose a tile" });
    expect(within(list).getAllByRole("option")).toHaveLength(5);
    expect(screen.getByRole("region", { name: "Selected tile" })).toHaveTextContent("Lumber Yard");
    expect(screen.getByText("Your selected tile is outside these filters.")).toBeVisible();
    fireEvent.change(screen.getByRole("searchbox", { name: "Find a tile" }), { target: { value: "zzzz" } });
    expect(screen.getByText("No tiles match. Try another name, effect or category.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(within(screen.getByRole("listbox", { name: "Choose a tile" })).getAllByRole("option")).toHaveLength(21);
    expect(readSavedGame()?.state.actionsRemaining).toBe(4);
  });

  it("moves keyboard selection without spending actions and focuses the selected controls on explicit choice", () => {
    render(<App initialPreview={settlement} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Category" }), { target: { value: "travel" } });
    const options = within(screen.getByRole("listbox", { name: "Choose a tile" })).getAllByRole("option");
    options[0].focus();
    fireEvent.keyDown(options[0], { key: "ArrowDown" });
    expect(options[1]).toHaveFocus();
    expect(options[1]).toHaveAttribute("aria-selected", "true");
    fireEvent.click(options[1]);
    expect(screen.getByRole("region", { name: "Selected tile" })).toHaveFocus();
    expect(readSavedGame()?.state.actionsRemaining).toBe(4);
  });

  it("searches effect text and filters exhausted supply without clearing the chosen tile", () => {
    const preview = structuredClone(settlement);
    preview.state!.tileSupply.core.c01_lumber_yard = 0;
    render(<App initialPreview={preview} />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Find a tile" }), { target: { value: "gain 2 wood" } });
    expect(within(screen.getByRole("listbox", { name: "Choose a tile" })).getByRole("option", { name: /^Lumber Yard/ })).toBeVisible();
    fireEvent.click(screen.getByRole("checkbox", { name: "Only tiles in supply" }));
    expect(screen.queryByRole("listbox", { name: "Choose a tile" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Selected tile" })).toHaveTextContent("Lumber Yard");
    expect(screen.getByRole("button", { name: "Place Lumber Yard" })).toBeDisabled();
  });

  it("shows the full-store consequence and commits only when Activate is pressed", () => {
    const state = productionState();
    render(<App initialPreview={{ ...settlement, setup: { ...settlement.setup, playerCount: 1, stewardIds: ["vanguard"] }, state }} />);
    const saved = readSavedGame()!.state;
    fireEvent.click(screen.getByRole("button", { name: "Activate Tile" }));
    expect(screen.getByText(/Warehouse resources will not increase/)).toBeVisible();
    expect(screen.getByText("15 → 15")).toBeVisible();
    expect(readSavedGame()!.state).toEqual(saved);
    fireEvent.click(screen.getByRole("button", { name: "Activate Lumber Yard" }));
    expect(readSavedGame()?.state.actionsRemaining).toBe(3);
    expect(readSavedGame()?.state.warehouse.wood).toBe(15);
    fireEvent.click(screen.getByRole("button", { name: "Undo last game step" }));
    expect(readSavedGame()?.state.actionsRemaining).toBe(4);
  });
});
