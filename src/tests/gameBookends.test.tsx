import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../app/App";
import { readSavedGame } from "../app/persistence";
import { readLedgerCampaign } from "../app/ledgerPersistence";
import { StewardPlacementPanel } from "../components/setup/StewardPlacementPanel";
import { createNewGame } from "../engine/setup";
import { commitStewardPlacement, validateStewardPlacement } from "../engine/gameActions";
import { mapCells } from "../data/map";
import { recordLedgerGame } from "../engine/ledger";
import { calculateFinalScore } from "../engine/scoring";
import snapshots from "../app/scenarios.generated.json";
import type { PreviewSnapshot } from "../app/scenarioTypes";

const finale = snapshots.finale as unknown as PreviewSnapshot;
beforeEach(() => { localStorage.clear(); window.history.replaceState(null, "", "/?experience=tabletop"); });
afterEach(() => { vi.restoreAllMocks(); window.history.replaceState(null, "", "/"); });

describe("starting places", () => {
  it("offers exactly the legal positions, then commits only the confirmed choice and focuses the next Steward", () => {
    const initial = createNewGame(2, ["vanguard", "knight"]);
    let latest = initial;
    const confirm = vi.fn();
    function Harness() {
      const [state, setState] = useState(initial);
      latest = state;
      return <StewardPlacementPanel state={state} onConfirm={(hex) => { confirm(hex); setState(commitStewardPlacement(state, state.currentPlayerId, hex)); }} />;
    }
    render(<Harness />);
    expect(screen.getByRole("heading", { name: "Place your Vanguard" })).toHaveFocus();
    const valid = mapCells.filter((cell) => validateStewardPlacement(initial, initial.currentPlayerId, cell.id).ok);
    expect(within(screen.getByRole("combobox", { name: "Starting space" })).getAllByRole("option").map((option) => (option as HTMLOptionElement).value)).toEqual(valid.map((cell) => cell.id));
    const chosen = valid[valid.length - 1].id;
    fireEvent.change(screen.getByRole("combobox", { name: "Starting space" }), { target: { value: chosen } });
    expect(confirm).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent(chosen);
    fireEvent.click(screen.getByRole("button", { name: "Confirm Vanguard Start" }));
    expect(confirm).toHaveBeenCalledWith(chosen);
    expect(latest.players[0].stewardHexId).toBe(chosen);
    expect(latest.currentPlayerId).toBe(initial.players[1].id);
    expect(screen.getByRole("heading", { name: "Place your Knight" })).toHaveFocus();
  });

  it("names map choices with coordinates and supports roving keyboard selection without committing", () => {
    const state = createNewGame(1, ["vanguard"]);
    const onConfirm = vi.fn();
    render(<StewardPlacementPanel state={state} onConfirm={onConfirm} />);
    const map = screen.getByRole("group", { name: "Vanguard starting map" });
    const starts = within(map).getAllByRole("button");
    expect(starts[0]).toHaveAccessibleName(/^[A-N][1-9], Woodland, valid start/);
    const selected = starts.find((button) => button.getAttribute("aria-pressed") === "true")!;
    fireEvent.keyDown(selected, { key: "End" });
    expect(starts[starts.length - 1]).toHaveFocus();
    expect(starts[starts.length - 1]).toHaveAttribute("aria-pressed", "true");
    expect(starts.filter((button) => button.tabIndex === 0)).toHaveLength(1);
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Zoom starting map" }));
    expect(screen.getByRole("button", { name: "Fit starting map" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Fit starting map" }));
    expect(screen.getByRole("button", { name: "Fit starting map" })).toBeDisabled();
  });
});

describe("completed settlement review", () => {
  it.each(["tabletop"])("presents a settled score in %s and records the same game exactly once", (experience) => {
    window.history.replaceState(null, "", `/?experience=${experience}`);
    const first = render(<App initialPreview={finale} />);
    const score = calculateFinalScore(finale.state!);
    expect(screen.getByText("Final board · Inspect tiles or zoom in to review your settlement.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Final scoring" })).toHaveFocus();
    const review = screen.getByRole("article", { name: "Completed settlement review" });
    expect(review).toHaveTextContent(`Final score${score.finalScore}`);
    expect(review).toHaveTextContent("77 Population + 85 Renown − 70 penalties");
    expect(within(review).queryByText("In progress")).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Round progression" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Record this game" }));
    expect(screen.getByRole("button", { name: "Recorded in Ledger" })).toBeDisabled();
    expect(readLedgerCampaign().games).toHaveLength(1);
    expect(readLedgerCampaign().games[0].finalScore).toBe(score.finalScore);
    const entries = readLedgerCampaign().box;
    first.unmount();
    render(<App initialPreview={finale} />);
    expect(screen.getByRole("button", { name: "Recorded in Ledger" })).toBeDisabled();
    expect(readLedgerCampaign().games).toHaveLength(1);
    expect(readLedgerCampaign().box).toEqual(entries);
    expect(localStorage.getItem("quietVale.stewardsLedger.v1")).toBeNull();
  });

  it("recognises a campaign record after undo or restoring an earlier board snapshot", () => {
    const recorded = recordLedgerGame(finale.state!, finale.campaign);
    const changed = structuredClone(recorded.state);
    changed.ledgerRun!.recorded = false;
    changed.map.placedTiles.find((tile) => tile.strain < 3)!.strain += 1;
    render(<App initialPreview={{ ...finale, state: changed, campaign: recorded.campaign }} />);
    expect(screen.getByRole("button", { name: "Recorded in Ledger" })).toBeDisabled();
    expect(screen.getByText(/The Ledger keeps the recorded score of 92/)).toBeVisible();
    expect(readLedgerCampaign().games).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Start another settlement" }));
    expect(screen.getByRole("alertdialog")).not.toHaveTextContent("has not been recorded");
  });

  it("warns before discarding an unrecorded ending and keeps recorded progress when starting again", () => {
    render(<App initialPreview={finale} />);
    fireEvent.click(screen.getByRole("button", { name: "Start another settlement" }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent("has not been recorded");
    expect(screen.getByRole("button", { name: "Keep reviewing" })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("button", { name: "Keep reviewing" }), { key: "Tab", shiftKey: true });
    expect(screen.getByRole("button", { name: "Begin new settlement" })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("button", { name: "Begin new settlement" }), { key: "Escape" });
    expect(screen.getByRole("button", { name: "Start another settlement" })).toHaveFocus();
    expect(screen.getByRole("heading", { name: "Final scoring" })).toBeInTheDocument();
    expect(readSavedGame()?.state.phase).toBe("gameEnd");
    fireEvent.click(screen.getByRole("button", { name: "Record this game" }));
    const campaign = readLedgerCampaign();
    fireEvent.click(screen.getByRole("button", { name: "Start another settlement" }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent("Recorded Ledger progress is kept");
    fireEvent.click(screen.getByRole("button", { name: "Begin new settlement" }));
    expect(readSavedGame()).toBeNull();
    expect(readLedgerCampaign()).toEqual(campaign);
    expect(screen.queryByRole("heading", { name: "Final scoring" })).not.toBeInTheDocument();
  });
});
