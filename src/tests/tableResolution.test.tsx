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
