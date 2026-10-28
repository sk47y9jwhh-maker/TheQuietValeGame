import { StrictMode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../app/App";
import { readSavedGame } from "../app/persistence";
import snapshots from "../app/scenarios.generated.json";
import type { PreviewSnapshot } from "../app/scenarioTypes";
import { CostChoicePanel } from "../components/effects/CostChoicePanel";
import { encounterById } from "../data/encounters";
import { cancelCostChoice, completeArrival, confirmCostChoice, resolveBurden, reviewArrivalCompletion } from "../engine/gameActions";
import { createNewGame } from "../engine/setup";
import type { GameState, PlacedTile } from "../engine/types";

const settlement = snapshots.settlement as unknown as PreviewSnapshot;
const fresh = () => structuredClone(settlement.state!);
const saved = () => readSavedGame()!.state;
const houses = "burden_too_many_houses_too_little_homes";
const quest = "arrival_the_quiet_quest";
beforeEach(() => { localStorage.clear(); window.history.replaceState(null, "", "/?experience=tabletop&scenario=settlement"); });
afterEach(() => { vi.restoreAllMocks(); window.history.replaceState(null, "", "/"); });
function special(instanceId: string, tileId: string): PlacedTile {
  return { instanceId, tileId, kind: "special", side: "special", hexIds: ["G1"], strain: 0, support: { passive: false, singleUse: false, preventedThisRound: false } };
}
function questState(tile: PlacedTile): GameState {
  const state = createNewGame(1, ["vanguard"]);
  return { ...state, phase: "turns", map: { placedTiles: [tile] }, warehouse: { wood: 0, stone: 0, metal: 0, food: 0, herbs: 2, goods: 4 }, encounters: { ...state.encounters, activeArrivals: [{ cardId: quest, timerTokens: 2 }] } };
}

describe("Arrival payment review", () => {
  it("preserves the game before confirmation, cancels exactly and matches the original completion", () => {
    vi.spyOn(Date, "now").mockReturnValue(1790467200000);
    const state = fresh(); const id = state.encounters.activeArrivals[1].cardId;
    const original = structuredClone(state);
    const review = reviewArrivalCompletion(state, id);
    expect(review.pendingCostChoice?.action).toMatchObject({ type: "arrival", cardId: id });
    expect(review.pendingCostChoice?.options).toEqual([]);
    expect(cancelCostChoice(review)).toEqual(state);
    expect(confirmCostChoice(review, { selectedOptionIds: [] })).toEqual(completeArrival(state, id));
    expect(state).toEqual(original);
  });

  it("rejects unavailable Arrivals, phases, missing resources and an existing decision", () => {
    const state = fresh(); const id = state.encounters.activeArrivals[1].cardId;
    for (const unavailable of [
      { ...state, phase: "seeding" as const },
      { ...state, actionsRemaining: 0 },
      { ...state, warehouse: { wood: 0, stone: 0, metal: 0, food: 0, herbs: 0, goods: 0 } },
      { ...state, encounters: { ...state.encounters, activeArrivals: [] } },
      reviewArrivalCompletion(state, id)
    ]) expect(reviewArrivalCompletion(unavailable, id)).toBe(unavailable);
  });

  it.each(["tabletop"])("reviews, cancels, confirms once, undoes and resumes in %s", async (experience) => {
    window.history.replaceState(null, "", `/?experience=${experience}&scenario=settlement`);
    let view = render(<StrictMode><App initialPreview={settlement} /></StrictMode>);
    const before = saved(); const id = before.encounters.activeArrivals[1].cardId;
    const name = encounterById[id].name;
    fireEvent.click(screen.getByRole("button", { name: "Interact" }));
    fireEvent.click(screen.getAllByRole("button", { name: new RegExp(`^Review completion of ${name}`) })[0]);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Review payment" })).toHaveFocus());
    expect(saved().warehouse).toEqual(before.warehouse);
    expect(saved().actionsRemaining).toBe(before.actionsRemaining);
    expect(saved().encounters).toEqual(before.encounters);
    expect(screen.getByRole("region", { name: "Payment preview" })).toHaveTextContent(`${before.actionsRemaining} available → ${before.actionsRemaining - 1} remaining`);
    expect(screen.getByRole("region", { name: "Payment preview" })).toHaveTextContent("separate action");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(saved()).toEqual(before);

    fireEvent.click(screen.getAllByRole("button", { name: new RegExp(`^Review completion of ${name}`) })[0]);
    const reviewing = saved();
    fireEvent.click(screen.getByRole("button", { name: "Complete Arrival" }));
    const completed = saved();
    expect(completed.actionsRemaining).toBe(before.actionsRemaining - 1);
    expect(completed.encounters.activeArrivals.some((arrival) => arrival.cardId === id)).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Undo last game step" }));
    expect(saved()).toEqual(reviewing);
    fireEvent.click(screen.getByRole("button", { name: "Redo undone game step" }));
    expect(saved()).toEqual(completed);
    fireEvent.click(screen.getByRole("button", { name: "Undo last game step" }));
    view.unmount(); view = render(<StrictMode><App initialPreview={settlement} /></StrictMode>);
    expect(screen.getByRole("button", { name: "Complete Arrival" })).toBeEnabled();
    expect(saved()).toEqual(reviewing);
    fireEvent.click(screen.getByRole("button", { name: "Complete Arrival" }));
    expect(saved().warehouse).toEqual(completed.warehouse);
    expect(saved().actionsRemaining).toBe(completed.actionsRemaining);
    view.unmount();
  });

  it("previews a zero-action Waystation without consuming its round use until confirmation", () => {
    const state = { ...questState(special("waystation", "special_the_waystation")), actionsRemaining: 0 };
    const review = reviewArrivalCompletion(state, quest);
    expect(review.pendingCostChoice).not.toBeNull();
    expect(cancelCostChoice(review)).toEqual(state);
    const confirm = vi.fn();
    render(<CostChoicePanel state={review} pending={review.pendingCostChoice!} onConfirm={confirm} onCancel={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Complete Arrival" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /The Waystation/ }));
    expect(screen.getByRole("region", { name: "Payment preview" })).toHaveTextContent("No action spent");
    expect(screen.getByRole("region", { name: "Payment preview" })).toHaveTextContent("Pay 4");
    fireEvent.click(screen.getByRole("button", { name: "Complete Arrival" }));
    const result = confirmCostChoice(review, confirm.mock.calls[0][0]);
    expect(result.warehouse).toMatchObject({ goods: 0, herbs: 0 });
    expect(result.actionsRemaining).toBe(0);
    expect(result.tileActivationRecords.waystation.round).toBe(state.round);
    expect(state.tileActivationRecords.waystation).toBeUndefined();
  });

  it("explains an unaffordable base cost and applies House of Learning only on confirmation", () => {
    const state = questState(special("learning", "special_house_of_learning")); state.warehouse.herbs = 0;
    const review = reviewArrivalCompletion(state, quest);
    const confirm = vi.fn();
    render(<CostChoicePanel state={review} pending={review.pendingCostChoice!} onConfirm={confirm} onCancel={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent("Need 2 more Herbs");
    fireEvent.click(screen.getByRole("button", { name: /House of Learning/ }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Complete Arrival" })).toBeEnabled();
    expect(cancelCostChoice(review)).toEqual(state);
    fireEvent.click(screen.getByRole("button", { name: "Complete Arrival" }));
    const result = confirmCostChoice(review, confirm.mock.calls[0][0]);
    expect(result.warehouse).toMatchObject({ goods: 0, herbs: 0 });
    expect(result.tileActivationRecords.learning.round).toBe(state.round);
  });
});

describe("Season III Burden payment", () => {
  it("keeps a selected passive discount when the Food/Goods mix changes", () => {
    const state = questState(special("learning", "special_house_of_learning"));
    state.season = 3; state.encounters.activeBurdens = [houses];
    state.warehouse.food = 3; state.warehouse.goods = 1;
    const review = resolveBurden(state, houses); const onConfirm = vi.fn();
    render(<CostChoicePanel state={review} pending={review.pendingCostChoice!} onConfirm={onConfirm} onCancel={vi.fn()} />);
    const learning = screen.getByRole("button", { name: /House of Learning/ });
    fireEvent.click(learning);
    fireEvent.change(screen.getByRole("combobox", { name: "Food in this payment" }), { target: { value: "3" } });
    expect(learning).toHaveAttribute("aria-pressed", "true");
    const preview = screen.getByRole("region", { name: "Payment preview" });
    expect(preview).toHaveTextContent("Pay 3"); expect(preview).toHaveTextContent("Pay 1");
    fireEvent.click(screen.getByRole("button", { name: "Resolve Burden" }));
    const selection = onConfirm.mock.calls[0][0];
    expect(selection.selectedOptionIds).toHaveLength(4);
    const result = confirmCostChoice(review, selection);
    expect(result.warehouse).toMatchObject({ food: 0, goods: 0 });
    expect(result.tileActivationRecords.learning.round).toBe(state.round);
    expect(result.encounters.activeBurdens).toEqual([]);
  });

  it("replaces six repeated switches with one reversible mix and charges exactly the preview", () => {
    const state = fresh(); state.season = 3;
    state.encounters.activeBurdens = [houses]; state.warehouse.food = 3; state.warehouse.goods = 3;
    const review = resolveBurden(state, houses); const onConfirm = vi.fn();
    render(<CostChoicePanel state={review} pending={review.pendingCostChoice!} onConfirm={onConfirm} onCancel={vi.fn()} />);
    expect(screen.queryByText("Flexible payment 1/6")).not.toBeInTheDocument();
    const mix = screen.getByRole("combobox", { name: "Food in this payment" });
    fireEvent.change(mix, { target: { value: "6" } });
    expect(screen.getByRole("status")).toHaveTextContent("Need 3 more Food");
    fireEvent.change(mix, { target: { value: "3" } });
    const preview = screen.getByRole("region", { name: "Payment preview" });
    expect(within(preview).getAllByText("Pay 3")).toHaveLength(2);
    expect(preview).toHaveTextContent("Earlier Strain stays");
    expect(screen.getByRole("button", { name: "Resolve Burden" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Resolve Burden" }));
    const result = confirmCostChoice(review, onConfirm.mock.calls[0][0]);
    expect(result.warehouse).toMatchObject({ food: 0, goods: 0 });
    expect(result.actionsRemaining).toBe(state.actionsRemaining - 1);
    expect(result.map).toEqual(state.map);
    expect(result.encounters.activeBurdens).toEqual([]);
    expect(result.encounters.discardPile).toContain(houses);
    expect(cancelCostChoice(review)).toEqual(state);
  });
});
