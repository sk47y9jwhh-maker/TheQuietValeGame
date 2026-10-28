import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../app/App";
import { readSavedGame, writeSavedGame } from "../app/persistence";
import { TableSeeding } from "../components/seeding/TableSeeding";
import { encounterById } from "../data/encounters";
import { commitSeasonSeeding, commitStewardPlacement } from "../engine/gameActions";
import { createNewGame } from "../engine/setup";
import type { GameState } from "../engine/types";

beforeEach(() => { window.localStorage.clear(); window.history.replaceState(null, "", "/?experience=tabletop"); });
afterEach(() => window.history.replaceState(null, "", "/"));
function choose(id: string, slot: string) { fireEvent.click(screen.getByRole("button", { name: `Seed ${encounterById[id].name} at ${slot}` })); }
function seedingState(): GameState {
  let state = createNewGame(2, ["vanguard", "knight"], { encounterSeed: "QV-TABLE-SEED" });
  for (const player of state.players) state = commitStewardPlacement(state, player.id, player.stewardHexId);
  return state;
}

describe("Living Table deliberate seeding", () => {
  it("requires three deliberate choices, reviews their effects and swaps without duplicate cards", () => {
    const state: GameState = { ...createNewGame(1, ["vanguard"]), phase: "seeding" };
    const hand = state.encounters.handsByPlayerId.player_1;
    const onConfirm = vi.fn();
    render(<TableSeeding state={state} onConfirm={onConfirm} />);
    expect(screen.queryByRole("button", { name: "Confirm Seeding" })).not.toBeInTheDocument();
    choose(hand[0], "top"); choose(hand[1], "middle"); choose(hand[2], "bottom");
    expect(screen.getByRole("heading", { name: "Review your three cards." })).toHaveFocus();
    expect(screen.getByText("After confirming, reveal Round 1’s encounters together.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Edit Top choice" }));
    choose(hand[1], "top");
    fireEvent.click(screen.getByRole("button", { name: "Confirm Seeding" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith({ top: hand[1], middle: hand[0], bottom: hand[2] });
  });

  it("shows current seasonal rules and returns from full artwork to the same card control", () => {
    const state: GameState = { ...createNewGame(1, ["vanguard"]), phase: "seeding", season: 2, round: 5 };
    state.encounters.handsByPlayerId.player_1 = ["burden_smoke_over_hearths", "boon_a_little_more_time", "arrival_the_quiet_quest"];
    render(<TableSeeding state={state} onConfirm={vi.fn()} />);
    const burden = screen.getByRole("article", { name: "Smoke over Hearths" });
    expect(burden).toHaveTextContent("Spend 1 Action, pay 4 Goods, discard.");
    expect(burden).not.toHaveTextContent("Spend 1 Action, pay 2 Goods, discard.");
    const read = within(burden).getByRole("button", { name: "Read Smoke over Hearths" });
    fireEvent.click(read);
    expect(screen.getByRole("heading", { name: "Smoke over Hearths", level: 1 })).toHaveFocus();
    expect(screen.getByText("Spend 1 Action, pay 2 Goods, discard.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Back to your hand" }));
    expect(screen.getByRole("button", { name: "Read Smoke over Hearths" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Read A Little Time" }));
    fireEvent.click(screen.getByRole("button", { name: "Seed Top" }));
    expect(screen.getByRole("heading", { name: "Choose your middle card." })).toHaveFocus();
  });

  it("keeps hidden drafts out of the DOM and resets choices at every owner or season boundary", () => {
    const state = seedingState();
    const hand = state.encounters.handsByPlayerId.player_1;
    const { rerender } = render(<TableSeeding state={state} onConfirm={vi.fn()} />);
    expect(screen.queryByRole("main")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reveal Vanguard’s hand" }));
    choose(hand[0], "top");
    fireEvent.click(screen.getByRole("button", { name: "Hide hand" }));
    expect(screen.queryByText(encounterById[hand[0]].name)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reveal Vanguard’s hand" }));
    expect(screen.getByRole("button", { name: "Change Top card" })).toHaveTextContent(encounterById[hand[0]].name);
    for (const next of [{ ...state, currentPlayerId: "player_2" }, state, { ...state, season: 2 as const, round: 5 }]) {
      rerender(<TableSeeding state={next} onConfirm={vi.fn()} />);
      expect(screen.queryByRole("main")).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: next.currentPlayerId === "player_1" ? "Reveal Vanguard’s hand" : "Reveal Knight’s hand" }));
      expect(screen.getByText("0 of 3 cards chosen")).toBeVisible();
    }
  });

  it("commits the reviewed order through the existing engine and restores a private gate on undo", () => {
    const state = seedingState();
    const hand = state.encounters.handsByPlayerId.player_1;
    writeSavedGame({ playerCount: 2, stewardIds: ["vanguard", "knight"], encounterSeed: "QV-TABLE-SEED", state });
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Reveal Vanguard’s hand" }));
    choose(hand[2], "top"); choose(hand[5], "middle"); choose(hand[8], "bottom");
    expect(readSavedGame()?.state.encounters.deck).toEqual(state.encounters.deck);
    expect(screen.getByText("After confirming, pass the device to Player 2.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Confirm Seeding" }));
    const expected = commitSeasonSeeding(state, "player_1", { top: hand[2], middle: hand[5], bottom: hand[8] });
    expect(readSavedGame()?.state.encounters).toEqual(expected.encounters);
    expect(screen.getByRole("heading", { name: "Pass to Player 2." })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Undo last game step" }));
    expect(screen.getByRole("heading", { name: "Pass to Player 1." })).toHaveFocus();
    expect(screen.queryByRole("main")).not.toBeInTheDocument();
    expect(readSavedGame()?.state.encounters.handsByPlayerId.player_1).toHaveLength(9);
    fireEvent.click(screen.getByRole("button", { name: "Redo undone game step" }));
    expect(readSavedGame()?.state.encounters.handsByPlayerId.player_1).toHaveLength(6);
    expect(screen.getByRole("heading", { name: "Pass to Player 2." })).toHaveFocus();
    expect(window.localStorage.getItem("quietVale.activeGame.v1")).toBeNull();
  });
});
