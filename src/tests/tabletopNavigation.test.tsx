import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../app/App";
import { TabletopLayout } from "../components/layout/TabletopLayout";
import { readSavedGame, writeSavedGame } from "../app/persistence";
import { createNewGame } from "../engine/setup";
import type { GameState } from "../engine/types";

let compact = true;
let change: (() => void) | undefined;
beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/?experience=tabletop");
  compact = true;
  vi.stubGlobal("matchMedia", () => ({ get matches() { return compact; }, addEventListener: (_: string, listener: () => void) => { change = listener; }, removeEventListener: vi.fn() }));
});
afterEach(() => { vi.unstubAllGlobals(); window.history.replaceState(null, "", "/"); });

const state: GameState = { ...createNewGame(2, ["vanguard", "knight"]), phase: "turns" };
const props = { state, selectionKey: "tile:G1:place", boardSelectionKey: "0", actionMode: "place", onModeChange: vi.fn(), actions: <label>Draft note<input defaultValue="" /></label>, board: <button>Read the board</button>, encounters: <p>Arrival details</p> };

describe("Living Table compact navigation", () => {
  it("keeps drafts mounted across full-width views and returns focus to the decision after a complete board choice", () => {
    const { rerender } = render(<TabletopLayout {...props} />);
    const note = screen.getByRole("textbox", { name: "Draft note" });
    fireEvent.change(note, { target: { value: "Keep this choice" } });
    fireEvent.click(screen.getByRole("button", { name: "Choose or change a space" }));
    expect(screen.getByRole("button", { name: "Board" })).toHaveAttribute("aria-pressed", "true");
    expect(note).toBeInTheDocument();
    expect(note).not.toBeVisible();
    expect(screen.getByRole("button", { name: "Read the board" })).toBeVisible();
    // An incomplete draft changes selected hexes but does not finish the board step.
    rerender(<TabletopLayout {...props} selectionKey="tile:H1:place" />);
    expect(note).not.toBeVisible();
    rerender(<TabletopLayout {...props} selectionKey="tile:H1:place" boardSelectionKey="1" />);
    expect(note).toBeVisible();
    expect(note).toHaveValue("Keep this choice");
    expect(screen.getByRole("complementary", { name: "Table tools" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Show encounters" }));
    expect(screen.getByText("Arrival details")).toBeVisible();
    expect(note).not.toBeVisible();
    rerender(<TabletopLayout {...props} selectionKey="tile:H1:activate" boardSelectionKey="1" actionMode="activate" />);
    expect(screen.getByRole("button", { name: "Your actions" })).toHaveAttribute("aria-pressed", "true");
    expect(note).toBeVisible();
    expect(note).toHaveValue("Keep this choice");
  });

  it("keeps resource updates quiet, returns on a new player, and restores the simultaneous desktop view after resizing", () => {
    const { rerender } = render(<TabletopLayout {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Board" }));
    const boardButton = screen.getByRole("button", { name: "Read the board" });
    boardButton.focus();
    rerender(<TabletopLayout {...props} state={{ ...state, warehouse: { ...state.warehouse, wood: 8 } }} />);
    expect(boardButton).toHaveFocus();
    expect(screen.getByRole("button", { name: "Board" })).toHaveAttribute("aria-pressed", "true");
    rerender(<TabletopLayout {...props} state={{ ...state, currentPlayerId: state.players[1].id }} />);
    expect(screen.getByRole("button", { name: "Your actions" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(`Knight · Round 1 · ${state.actionsRemaining} actions`)).toBeVisible();
    act(() => { compact = false; change?.(); });
    expect(boardButton).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Draft note" })).toBeVisible();
    expect(screen.getByRole("navigation", { name: "Table panels" })).toBeVisible();
  });

  it("returns from a repeated space without committing until Place is pressed", () => {
    const base = createNewGame(1, ["vanguard"]);
    writeSavedGame({ playerCount: 1, stewardIds: ["vanguard"], encounterSeed: "responsive", state: { ...base, phase: "turns" } });
    render(<App />);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      fireEvent.click(screen.getByRole("button", { name: "Board" }));
      fireEvent.click(screen.getByRole("button", { name: "G1, Woodland" }));
      expect(screen.getByRole("button", { name: "Your actions" })).toHaveAttribute("aria-pressed", "true");
      expect(readSavedGame()?.state.map.placedTiles).toHaveLength(0);
    }
    fireEvent.click(screen.getByRole("button", { name: "Place Lumber Yard" }));
    expect(readSavedGame()?.state.map.placedTiles[0].hexIds).toEqual(["G1"]);
  });

  it("keeps a detached Stables footprint on the map until its second space is chosen", () => {
    const base = createNewGame(1, ["vanguard"]);
    const detached: GameState = { ...base, phase: "turns", players: [{ ...base.players[0], hasPlacedFirstTile: true }], tileSupply: { ...base.tileSupply, special: { ...base.tileSupply.special, special_stables: 2 } }, map: { placedTiles: [{ instanceId: "path_1", tileId: "c15_path", kind: "core", side: "basic", hexIds: ["G1"], strain: 0, support: { passive: false, singleUse: false, preventedThisRound: false } }] } };
    writeSavedGame({ playerCount: 1, stewardIds: ["vanguard"], encounterSeed: "responsive-stables", state: detached });
    render(<App />);
    fireEvent.click(screen.getByRole("option", { name: /^Stables Travel Special/ }));
    fireEvent.click(screen.getByRole("button", { name: "Board" }));
    fireEvent.click(screen.getByRole("button", { name: "H1, Woodland" }));
    expect(screen.getByRole("button", { name: "Board" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "N7, Mountains" }));
    expect(screen.getByRole("button", { name: "Your actions" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("First Stable: H1")).toBeVisible();
    expect(screen.getByText("Second Stable: N7")).toBeVisible();
    expect(readSavedGame()?.state.map.placedTiles).toHaveLength(1);
  });
});
