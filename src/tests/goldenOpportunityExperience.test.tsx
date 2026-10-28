import { StrictMode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../app/App";
import { readSavedGame } from "../app/persistence";
import type { PreviewSnapshot } from "../app/scenarioTypes";
import snapshots from "../app/scenarios.generated.json";
import { GoldenVialNotice, goldenVialId, getVialOpportunity, hasPreparedVial } from "../components/actions/GoldenVialNotice";
import { RoundEndPreview } from "../components/actions/RoundEndPreview";
import { PlayerGuide } from "../components/layout/PlayerGuide";
import { coreTiles } from "../data/tiles";
import { endCurrentTurn, useFaceUpBoon, resolveEndRound, placeTile } from "../engine/gameActions";
import { getLegalPlacementHexes } from "../engine/placementRules";

const vial = snapshots["golden-vial"] as unknown as PreviewSnapshot;
const traveller = snapshots["golden-traveller"] as unknown as PreviewSnapshot;
const freshVial = () => structuredClone(vial.state!);
beforeEach(() => { localStorage.clear(); window.history.replaceState(null, "", "/?experience=tabletop&scenario=golden-vial"); });
afterEach(() => { vi.restoreAllMocks(); window.history.replaceState(null, "", "/"); });
const saved = () => readSavedGame()!.state;
function pass() {
  fireEvent.click(screen.getByRole("button", { name: "End Turn" }));
  fireEvent.click(screen.getByRole("button", { name: /End Player \d's Turn/ }));
}

describe("Golden opportunities during play", () => {
  it.each(["tabletop"])("prepares the Vial without spending, then opens Travel placement in %s", async (experience) => {
    window.history.replaceState(null, "", `/?experience=${experience}&scenario=golden-vial`);
    const view = render(<StrictMode><App initialPreview={vial} /></StrictMode>);

    const console = within(view.container.querySelector(".turn-console") as HTMLElement);
    fireEvent.click(console.getByRole("button", { name: "Prepare 0-action Travel" }));
    expect(hasPreparedVial(saved())).toBe(true);
    expect(saved().warehouse).toEqual(vial.state!.warehouse);
    expect(saved().actionsRemaining).toBe(4);
    expect(saved().map).toEqual(vial.state!.map);
    expect(console.getByRole("region", { name: "Selected tile" })).toHaveTextContent("Travel Core");
    expect(console.getByText("Travel placement prepared")).toBeVisible();
    await waitFor(() => expect(console.getByRole("region", { name: "Selected tile" })).toHaveFocus());
    expect(console.queryByRole("button", { name: "Prepare 0-action Travel" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Undo last game step" }));
    expect(hasPreparedVial(saved())).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Redo undone game step" }));
    expect(hasPreparedVial(saved())).toBe(true);
    expect(console.getByRole("region", { name: "Selected tile" })).toBeVisible();
  });

  it("charges a Travel tile's resources while preserving actions, with Undo, Redo and reload", () => {
    const view = render(<App initialPreview={vial} />);
    fireEvent.click(screen.getByRole("button", { name: "Prepare 0-action Travel" }));
    fireEvent.click(screen.getByRole("option", { name: /^Common Land Travel Core/ }));
    const hex = getLegalPlacementHexes(saved(), saved().currentPlayerId, "c18_common_land")[0];
    expect(hex).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${hex},`) }));
    expect(screen.getByLabelText("Action preview")).toHaveTextContent("No action spent");
    fireEvent.click(screen.getByRole("button", { name: "Place Common Land" }));
    const placed = saved();
    expect(placed.actionsRemaining).toBe(4);
    expect(placed.warehouse.metal).toBe(vial.state!.warehouse.metal - 2);
    expect(placed.warehouse.herbs).toBe(vial.state!.warehouse.herbs - 2);
    expect(placed.map.placedTiles).toHaveLength(7);
    expect(hasPreparedVial(placed)).toBe(false);
    expect(within(screen.getByRole("region", { name: "Golden Vial opportunity" })).getByText("Used this round")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Undo last game step" }));
    expect(saved().map.placedTiles).toHaveLength(6);
    expect(hasPreparedVial(saved())).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Redo undone game step" }));
    expect(saved().warehouse).toEqual(placed.warehouse);
    view.unmount(); render(<App initialPreview={vial} />);
    expect(saved().map).toEqual(placed.map);
    expect(within(screen.getByRole("region", { name: "Golden Vial opportunity" })).getByText("Used this round")).toBeVisible();
  });

  it("returns from the encounter workspace to placement after preparation", () => {
    render(<App initialPreview={vial} />);
    fireEvent.click(screen.getByRole("button", { name: "Show encounters" }));
    fireEvent.click(screen.getByRole("button", { name: "Prepare 0-action Travel" }));
    expect(screen.getByRole("region", { name: "Selected tile" })).toBeVisible();
    expect(within(screen.getByRole("region", { name: "Golden Vial opportunity" })).getByText("Travel placement prepared")).toBeVisible();
  });

  it("explains exhausted supply and postpones use while effects are pending", () => {
    const state = freshVial();
    for (const tile of coreTiles.filter((tile) => tile.category === "travel")) state.tileSupply.core[tile.id] = 0;
    const prepare = vi.fn();
    const { rerender } = render(<GoldenVialNotice state={state} onPrepare={prepare} />);
    expect(screen.getByText("No Travel tiles in supply")).toBeVisible();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    const pending = freshVial(); pending.pendingEffects = [{ id: "waiting", ruleId: "noop", sourceType: "system", sourceName: "Review", title: "Review", effectText: "Review" }];
    rerender(<GoldenVialNotice state={pending} onPrepare={prepare} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(prepare).not.toHaveBeenCalled();
  });

  it("shares a prepared Vial across Stewards, warns at round end and refreshes normally", () => {
    const prepared = useFaceUpBoon(freshVial(), goldenVialId);
    const nextPlayer = endCurrentTurn(prepared);
    expect(getVialOpportunity(nextPlayer)?.prepared).toBe(true);
    const roundEnd = endCurrentTurn(nextPlayer);
    render(<RoundEndPreview state={roundEnd} />);
    expect(screen.getByRole("heading", { name: "Unused Golden Vial preparation" })).toBeVisible();
    const nextRound = resolveEndRound(roundEnd);
    expect(hasPreparedVial(nextRound)).toBe(false);
    expect(nextRound.encounters.faceUpBoons.some((boon) => boon.cardId === goldenVialId)).toBe(true);
    expect(nextRound.round).toBe(prepared.round + 1);
  });

  it("does not promise a renewed Vial after the final round or exhausted supply", () => {
    const state = freshVial(); state.round = 12; state.season = 3;
    const prepared = useFaceUpBoon(state, goldenVialId);
    const used = { ...prepared, boonModifiers: [] };
    expect(getVialOpportunity(used)?.detail).toContain("final round");
    for (const tile of coreTiles.filter((tile) => tile.category === "travel")) used.tileSupply.core[tile.id] = 0;
    expect(getVialOpportunity(used)?.detail).toContain("No Core Travel tiles remain");
    render(<RoundEndPreview state={{ ...prepared, phase: "endRound" }} />);
    expect(screen.getByText(/The game ends after these consequences/)).toBeVisible();
    expect(screen.queryByText(/prepare another placement next round/)).not.toBeInTheDocument();
  });

  it("still offers zero-action Travel with no ordinary actions left", () => {
    const state = freshVial(); state.actionsRemaining = 0;
    const prepared = useFaceUpBoon(state, goldenVialId);
    const hex = getLegalPlacementHexes(prepared, prepared.currentPlayerId, "c15_path")[0];
    const next = placeTile(prepared, prepared.currentPlayerId, "c15_path", hex);
    expect(next.map.placedTiles).toHaveLength(state.map.placedTiles.length + 1);
    expect(next.actionsRemaining).toBe(0);
    expect(getVialOpportunity(next)?.status).toBe("Used this round");
  });

  it("shows and saves the complete normal-to-bonus turn cycle without early timer changes", () => {
    window.history.replaceState(null, "", "/?experience=tabletop&scenario=golden-traveller");
    const view = render(<App initialPreview={traveller} />);
    const encounters = structuredClone(saved().encounters);
    expect(screen.getByText("Golden bonus turns follow this round")).toBeVisible();
    pass();
    fireEvent.click(screen.getByRole("button", { name: "End Turn" }));
    expect(screen.getByRole("region", { name: "After this turn" })).toHaveTextContent("Next · Golden bonus turns");
    fireEvent.click(screen.getByRole("button", { name: "End Player 2's Turn" }));
    expect(saved().bonusTurnsActive).toBe(true);
    expect(saved().currentPlayerId).toBe("player_1");
    expect(saved().actionsRemaining).toBe(4);
    expect(saved().encounters).toEqual(encounters);
    expect(screen.getByText("Your Golden bonus turn")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Undo last game step" }));
    expect(saved().bonusTurnsPending).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Redo undone game step" }));
    view.unmount(); render(<App initialPreview={traveller} />);
    expect(saved().bonusTurnsActive).toBe(true);
    expect(screen.getByText("Your Golden bonus turn")).toBeVisible();
    pass(); expect(saved().currentPlayerId).toBe("player_2");
    pass(); expect(saved().phase).toBe("endRound");
    expect(saved().encounters).toEqual(encounters);
    fireEvent.click(screen.getByRole("button", { name: "Resolve End Round" }));
    expect(saved().round).toBe(traveller.state!.round + 1);
    expect(saved().encounters.activeArrivals.map((arrival) => arrival.timerTokens)).toEqual([1, 1]);
  });

  it("announces a solo bonus handoff even though the current player and round do not change", () => {
    window.history.replaceState(null, "", "/?experience=tabletop&scenario=golden-traveller");
    const fixture = structuredClone(traveller); fixture.state!.players = fixture.state!.players.slice(0, 1); fixture.state!.playerCount = 1; fixture.setup.playerCount = 1;
    render(<App initialPreview={fixture} />);
    pass();
    expect(saved().bonusTurnsActive).toBe(true);
    expect(screen.getByRole("complementary", { name: "Table tools" })).toHaveFocus();
    expect(screen.getByText("Your Golden bonus turn")).toBeVisible();
  });

  it("marks completed and current bonus turns and explains spent powers", () => {
    const state = structuredClone(traveller.state!); state.bonusTurnsActive = true; state.bonusTurnsPending = false;
    state.playersActedThisRound = [state.players[0].id]; state.currentPlayerId = state.players[1].id;
    render(<PlayerGuide state={state} />);
    fireEvent.click(screen.getByText("Golden bonus turn order", { selector: "summary" }));
    const order = screen.getByRole("list", { name: "Golden bonus turn order" });
    expect(within(order).getByText("Bonus turn taken")).toBeVisible();
    expect(within(order).getByText("Playing now")).toBeVisible();
    expect(screen.getByText(/Once-per-round and once-per-season uses stay spent/)).toBeVisible();
  });
});
