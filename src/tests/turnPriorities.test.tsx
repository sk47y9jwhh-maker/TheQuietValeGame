import { StrictMode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../app/App";
import { readSavedGame } from "../app/persistence";
import snapshots from "../app/scenarios.generated.json";
import type { PreviewSnapshot } from "../app/scenarioTypes";
import { TurnPriorities } from "../components/layout/TurnPriorities";
import { TabletopLayout } from "../components/layout/TabletopLayout";
import { EncounterPanel } from "../components/panels/EncounterPanel";
import { encounterById } from "../data/encounters";
import { completeArrival } from "../engine/gameActions";

const settlement = snapshots.settlement as unknown as PreviewSnapshot;
const fresh = () => structuredClone(settlement.state!);
const saved = () => readSavedGame()!.state;
beforeEach(() => { localStorage.clear(); window.history.replaceState(null, "", "/?experience=tabletop&scenario=settlement"); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); window.history.replaceState(null, "", "/"); });
const callbacks = { onReviewArrival: vi.fn(), onReviewBoard: vi.fn() };
function expand() { fireEvent.click(screen.getByText("Plan this round")); }

describe("Living Table priorities", () => {
  it("orders public Arrivals by deadline and uses the engine's readiness without changing the game", () => {
    const state = fresh(); state.encounters.activeArrivals[1].timerTokens = 1;
    const before = structuredClone(state);
    render(<TurnPriorities state={state} {...callbacks} />); expand();
    expect(screen.getByText("1 Arrival expires at round end")).toBeVisible();
    const reviews = within(screen.getByRole("region", { name: "Arrival priorities" })).getAllByRole("button");
    expect(reviews[0]).toHaveAccessibleName(`Review ${encounterById[state.encounters.activeArrivals[1].cardId].name}`);
    expect(screen.getByText("Expires this round if unresolved")).toBeVisible();
    expect(screen.getAllByText("Can complete now").length).toBeGreaterThan(0);
    fireEvent.click(reviews[0]);
    expect(callbacks.onReviewArrival).toHaveBeenLastCalledWith(state.encounters.activeArrivals[1].cardId);
    expect(state).toEqual(before);
  });

  it("updates the current Steward's objective and explains actual resource and action blockers", () => {
    const state = fresh(); state.actionsRemaining = 0;
    const view = render(<TurnPriorities state={state} {...callbacks} />); expand();
    expect(screen.getByRole("region", { name: "Vanguard objective" })).toBeVisible();
    expect(screen.queryByRole("region", { name: "Knight objective" })).not.toBeInTheDocument();
    expect(screen.getAllByText("no actions remaining.").length).toBeGreaterThan(0);
    const next = { ...state, currentPlayerId: "player_2", actionsRemaining: 4, warehouse: { ...state.warehouse, food: 0, herbs: 0, goods: 0 } };
    view.rerender(<TurnPriorities state={next} {...callbacks} />);
    expect(screen.getByRole("region", { name: "Knight objective" })).toHaveTextContent("final scoring");
    expect(screen.queryByText("Can complete now")).not.toBeInTheDocument();
    expect(screen.getAllByText(/missing/).length).toBeGreaterThan(0);
  });

  it("removes a completed Arrival and restores it when the state is undone", () => {
    const state = fresh(); const id = state.encounters.activeArrivals[1].cardId;
    const view = render(<TurnPriorities state={state} {...callbacks} />); expand();
    const completed = completeArrival(state, id);
    expect(completed.encounters.activeArrivals).toHaveLength(1);
    view.rerender(<TurnPriorities state={completed} {...callbacks} />);
    expect(screen.queryByRole("button", { name: `Review ${encounterById[id].name}` })).not.toBeInTheDocument();
    view.rerender(<TurnPriorities state={state} {...callbacks} />); expand();
    expect(screen.getByRole("button", { name: `Review ${encounterById[id].name}` })).toBeVisible();
  });

  it("keeps required decisions first and shows no turn plan during reveal", () => {
    const state = fresh();
    const pending = (snapshots["warden-response"] as unknown as PreviewSnapshot).state!;
    const view = render(<TurnPriorities state={pending} {...callbacks} />);
    expect(screen.queryByText("Plan this round")).not.toBeInTheDocument();
    view.rerender(<TurnPriorities state={{ ...state, phase: "reveal" }} {...callbacks} />);
    expect(screen.queryByText("Plan this round")).not.toBeInTheDocument();
  });

  it("offers a board review only when a tile is Overstrained", () => {
    const state = fresh(); state.map.placedTiles[0].strain = 3;
    render(<TurnPriorities state={state} {...callbacks} />); expand();
    fireEvent.click(screen.getByRole("button", { name: "Review board" }));
    expect(callbacks.onReviewBoard).toHaveBeenCalled();
  });

  it.each([false, true])("opens and focuses the exact Arrival while preserving a draft, compact=%s", async (compact) => {
    vi.stubGlobal("matchMedia", () => ({ matches: compact, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    const state = fresh(); const arrival = state.encounters.activeArrivals[1]; const name = encounterById[arrival.cardId].name;
    render(<StrictMode><TabletopLayout state={state} actions={<label>Draft note<input defaultValue="" /></label>} board={<button>Read board</button>} encounters={<EncounterPanel state={state} onUseFaceUpBoon={vi.fn()} />} selectionKey="test" boardSelectionKey="0" actionMode="place" onModeChange={vi.fn()} /></StrictMode>);
    const draft = screen.getByRole("textbox", { name: "Draft note" });
    fireEvent.change(draft, { target: { value: "Keep my plan" } }); expand();
    fireEvent.click(screen.getByRole("button", { name: `Review ${name}` }));
    const target = screen.getByLabelText(`Arrival review: ${name}`);
    await waitFor(() => expect(target).toHaveFocus());
    expect(target).toBeVisible(); expect(draft).not.toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Your actions" }));
    expect(draft).toBeVisible(); expect(draft).toHaveValue("Keep my plan");
  });

  it("does not commit or spend when an actual saved game reviews an Arrival", async () => {
    render(<StrictMode><App initialPreview={settlement} /></StrictMode>);
    const before = saved(); expand();
    const name = encounterById[before.encounters.activeArrivals[1].cardId].name;
    fireEvent.click(screen.getByRole("button", { name: `Review ${name}` }));
    await waitFor(() => expect(screen.getByLabelText(`Arrival review: ${name}`)).toHaveFocus());
    expect(saved()).toEqual(before);
    expect(screen.getByRole("button", { name: `Review completion of ${name}` })).toBeEnabled();
  });
});
