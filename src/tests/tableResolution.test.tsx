import { fireEvent, render, screen, within } from "@testing-library/react";
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

describe("guided first game", () => {
  it("coaches seeding, then the first placement, and settles the Arrival notice by itself", () => {
    open("guided");
    expect(screen.getByRole("heading", { name: "Shape the Season ahead" })).toBeInTheDocument();
    for (const [index, slot] of ["top", "middle", "bottom"].entries()) fireEvent.click(screen.getAllByRole("button", { name: new RegExp(`at ${slot}$`) })[index]);
    fireEvent.click(screen.getByRole("button", { name: "Confirm Seeding" }));
    expect(screen.queryByRole("button", { name: "Acknowledge" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Build your first tile" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Turn off the guide" }));
    expect(screen.queryByRole("complementary", { name: "Guide" })).not.toBeInTheDocument();
  });
});

describe("score breakdown", () => {
  it("explains Score now line by line", () => {
    open("showcase-late");
    fireEvent.click(screen.getByRole("button", { name: /^Score now/ }));
    const dialog = screen.getByRole("dialog", { name: "How the score adds up" });
    for (const label of ["Population", "Renown from tiles", "Active Burdens", "Strain"]) expect(dialog).toHaveTextContent(label);
  });
});

describe("setup on the board", () => {
  it("places each Steward from the main board, then moves on to seeding", () => {
    window.history.replaceState(null, "", "/?experience=table");
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "2 players" }));
    fireEvent.click(screen.getByRole("button", { name: /Begin your settlement/ }));
    expect(screen.getByRole("heading", { name: "Place your Vanguard" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Start at / }));
    expect(screen.getByRole("heading", { name: "Place your Knight" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Start at / }));
    expect(readSavedGame()?.state.phase).toBe("seeding");
  });
});

describe("Golden Boons on the table", () => {
  it("keeps the board in view for the Golden Bell", () => {
    open("golden-bell");
    expect(screen.getByRole("group", { name: /The Quiet Vale map/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Place this Arrival/ })).toBeInTheDocument();
  });

  it("selects Golden Signet tiles by tapping them on the board", () => {
    open("golden-signet");
    fireEvent.click(screen.getByRole("button", { name: /^F1, Path.*Choice: Select to move/ }));
    expect(screen.getByText(/1 of 5 selected/)).toBeInTheDocument();
  });
});

describe("payments that start affordable", () => {
  it("opens a surcharged payment on resources the Warehouse can cover", async () => {
    const { placeTile } = await import("../engine/gameActions");
    const { CostChoicePanel } = await import("../components/effects/CostChoicePanel");
    window.history.replaceState(null, "", "/?experience=table");
    let state = structuredClone(scenarios.settlement.state!);
    state.boonModifiers = [...state.boonModifiers, { id: "modifier_test", sourceCardId: "burden_plans_left_waiting", name: "Plans Left Waiting", effectText: "Next Tile placed/upgraded this round costs 2 more resources.", actions: ["place", "upgrade"], remainingUses: 1, extraCost: 2 }];
    state.warehouse = { wood: 2, stone: 0, metal: 0, food: 5, herbs: 2, goods: 0 };
    state = placeTile(state, state.currentPlayerId, "c05_cabin", { anchorHexId: "E1" });
    expect(state.pendingCostChoice).toBeTruthy();
    render(<CostChoicePanel state={state} pending={state.pendingCostChoice!} onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.getByText(/set to a combination you can afford/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Confirm Payment/ })).toBeEnabled();
  });
});

describe("rules definitions", () => {
  it("opens a game term's definition with its rulebook page", () => {
    open("showcase-late");
    fireEvent.click(screen.getAllByRole("button", { name: "Arrival" })[0]);
    const note = screen.getByRole("note");
    expect(note).toHaveTextContent("Newcomers asking to join");
    expect(note).toHaveTextContent("Rulebook p. 14–16");
  });
});

describe("Boons and powers folded into actions", () => {
  it("places a Path with the Vanguard's power in one tap, and one Undo reverts both", () => {
    open("settlement");
    expect(screen.queryByRole("button", { name: "Use Steward Power" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^E1, empty/ }));
    const pathRow = screen.getAllByRole("listitem").find((item) => /^Path/.test(item.textContent ?? ""))!;
    fireEvent.click(within(pathRow).getByRole("button", { name: /No action.*Vanguard/ }));
    const after = readSavedGame()!.state;
    expect(after.actionsRemaining).toBe(4);
    expect(after.map.placedTiles.some((tile) => tile.hexIds.includes("E1"))).toBe(true);
    expect(after.players[0].stewardPowerUsesBySeason[after.season]).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(readSavedGame()!.state.map.placedTiles.some((tile) => tile.hexIds.includes("E1"))).toBe(false);
    expect(readSavedGame()!.state.players[0].stewardPowerUsesBySeason[after.season] ?? 0).toBe(0);
  });
});
