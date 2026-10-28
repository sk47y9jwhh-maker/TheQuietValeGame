import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../app/App";
import { readSavedGame } from "../app/persistence";
import snapshots from "../app/scenarios.generated.json";
import type { PreviewSnapshot } from "../app/scenarioTypes";
import type { ScenarioId } from "../app/scenarioCatalog";

const scenarios = snapshots as unknown as Record<ScenarioId, PreviewSnapshot>;
beforeEach(() => { window.localStorage.clear(); });
afterEach(() => window.history.replaceState(null, "", "/"));

function open(id: ScenarioId) {
  window.history.replaceState(null, "", `/?experience=table&scenario=${id}`);
  render(<App initialPreview={scenarios[id]} />);
}

describe("board-first table resolutions", () => {
  it("settles an encounter beside the board and lets the board change the tile choice", () => {
    open("warden-response");
    expect(screen.getByRole("heading", { name: "Revealed Houses, Not Homes" })).toBeInTheDocument();
    // The board stays in play: the suggested tile is marked on it.
    const cabin = screen.getByRole("button", { name: /^A2, Cabin.*Chosen: \+1 Strain/ });
    fireEvent.click(cabin);
    expect(screen.getByText("Complete a valid choice")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^A2, Cabin/ }));
    expect(screen.getByText("Will apply")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Apply Effect" }));
    const cabinAfter = readSavedGame()?.state.map.placedTiles.find((tile) => tile.hexIds.includes("A2"));
    expect(cabinAfter?.strain).toBe(1);
  });

  it("chooses the Ranger's reach by tapping the board", () => {
    open("ranger-reach");
    fireEvent.click(screen.getByRole("button", { name: "Use Steward Power" }));
    fireEvent.click(screen.getByRole("button", { name: /^E5, .*Choice: Reach this space/ }));
    fireEvent.click(screen.getByRole("button", { name: "Set reach at E5" }));
    expect(readSavedGame()?.state.players.find((player) => player.temporaryReachHexId)?.temporaryReachHexId).toBe("E5");
  });
});

describe("Target Card walkthrough", () => {
  it("narrows the eligible tiles on the board, step by step, to the drawn target", () => {
    open("warden-response");
    fireEvent.click(screen.getByRole("button", { name: "Watch the card choose on the board" }));
    expect(screen.getByText(/Card 19 is drawn\. 2 tiles are eligible/)).toBeInTheDocument();
    let guard = 0;
    while (screen.queryByRole("button", { name: "Next" }) && guard++ < 10) fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText(/Cabin \(A2\) is chosen for \+1 Strain\./)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^A2, Cabin.*Chosen: Chosen by the Target Card/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.getByRole("button", { name: /^A2, Cabin.*Chosen: \+1 Strain/ })).toBeInTheDocument();
  });
});

describe("board-first table finale", () => {
  it("shows the final scoring beside the finished board", () => {
    open("finale");
    expect(screen.getByRole("heading", { name: "Your settlement is complete" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Final Scoring" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /The Quiet Vale map/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Record Completed Game" })).toBeInTheDocument();
  });
});
