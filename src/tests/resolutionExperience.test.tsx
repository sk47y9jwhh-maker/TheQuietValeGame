import { StrictMode } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../app/App";
import { readSavedGame } from "../app/persistence";
import snapshots from "../app/scenarios.generated.json";
import type { PreviewSnapshot } from "../app/scenarioTypes";
import { EffectPrompt } from "../components/effects/EffectPrompt";
import { TargetCardResolution } from "../components/effects/TargetCardResolution";
import { systemEffectRuleId } from "../data/effectRules";
import { preparePendingEffectQueueHead, resolvePendingEffect } from "../engine/manualEffects";
import { createNewGame } from "../engine/setup";
import { createTargetCardDeckState } from "../engine/targetCards";
import type { PlacedTile } from "../engine/types";

const thirdSeason = snapshots["season-three"] as unknown as PreviewSnapshot;
const saved = () => readSavedGame()!.state;
beforeEach(() => { localStorage.clear(); window.history.replaceState(null, "", "/?experience=tabletop&scenario=season-three"); });
afterEach(() => { vi.restoreAllMocks(); window.history.replaceState(null, "", "/"); });
function path(id: string, hex: string, supported = false): PlacedTile {
  return { instanceId: id, tileId: "c15_path", kind: "core", side: "basic", hexIds: [hex], strain: 0, support: { passive: false, singleUse: supported, preventedThisRound: false } };
}
function expiry(cardId = 3, tiles = [path("other", "A1"), path("protected", "C1", true)]) {
  const state = createNewGame(1, ["vanguard"], { encounterSeed: "resolution-review" });
  state.map.placedTiles = tiles;
  state.targetCards = { ...createTargetCardDeckState("resolution-review"), drawPile: [cardId, ...Array.from({ length: 30 }, (_, i) => i + 1).filter(id => id !== cardId)] };
  state.pendingEffects = [{ id: "expiry", ruleId: systemEffectRuleId("arrival-expired"), sourceType: "system", sourceName: "Expired Arrival", title: "Expired Arrival", effectText: "Place 1 Strain", requiresManualChoice: true }];
  return preparePendingEffectQueueHead(state);
}
function toggle(text: string | RegExp) { fireEvent.click(screen.getByText(text).closest("summary")!); }

describe("focused resolution review", () => {
  it.each(["tabletop"])("keeps a payment draft while inspecting references, then resets disclosures and focus for the next effect in %s", (experience) => {
    window.history.replaceState(null, "", `/?experience=${experience}&scenario=season-three`);
    const errors = vi.spyOn(console, "error");
    const view = render(<StrictMode><App initialPreview={thirdSeason} /></StrictMode>);
    const before = saved();
    const printedCard = view.container.querySelector(".effect-source-card .encounter-card-shell")!;
    const targetCard = within(screen.getByRole("region", { name: "Target Card resolution" })).getByText("Card 16");
    expect(printedCard).not.toBeVisible(); expect(targetCard).not.toBeVisible();
    expect(screen.getByText("Choose 3 Housing Tiles. Each: pay 1 Food or 1 Goods, or +1 Strain.", { selector: ".effect-rule-text" })).toBeVisible();
    expect(screen.getByLabelText("Effect preview")).toHaveTextContent("Cabin (H1): +1 Strain");
    expect(screen.getByLabelText("Effect preview")).toHaveTextContent("Cabin (A7): +1 Strain");
    expect(screen.getByLabelText("Effect preview")).toHaveTextContent("Cabin (A5): +1 Strain");
    fireEvent.click(screen.getByRole("button", { name: /^Pay 3 Goods/ }));
    toggle("Read full card — Houses, Not Homes");
    expect(printedCard).toBeVisible();
    toggle("Card 16 · Explain"); expect(targetCard).toBeVisible();
    expect(within(targetCard.closest(".target-draw-explanation")!).getAllByText("Unless specified")).toHaveLength(4);
    toggle("Table references"); toggle(/^View resolution order/); toggle("Review active encounters");
    expect(screen.getByRole("heading", { name: "Encounters" })).toBeVisible();
    expect(saved()).toEqual(before);
    expect(screen.getByLabelText("Effect preview")).toHaveTextContent("Lose 3 Goods");
    expect(screen.getByLabelText("Effect preview")).not.toHaveTextContent("Strain");
    expect(screen.getAllByText("Draw suggests +1 Strain")).toHaveLength(3);
    expect(screen.getByText(/Payments or prevention can change the outcome/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Apply Effect" }));
    expect(saved().warehouse.goods).toBe(before.warehouse.goods - 3);
    expect(saved().map).toEqual(before.map);
    expect(saved().pendingEffects[0].sourceId).toBe("burden_river_breaks_its_banks");
    expect(view.container.querySelector(".effect-source-card")).not.toHaveAttribute("open");
    expect(view.container.querySelector(".target-draw details[open]")).toBeNull();
    expect(view.container.querySelector(".resolution-references")).not.toHaveAttribute("open");
    expect(screen.getByRole("heading", { name: "Resolve Effect" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Undo last game step" }));
    expect(saved()).toEqual(before);
    expect(view.container.querySelector(".effect-source-card")).not.toHaveAttribute("open");
    expect(screen.getByLabelText("Effect preview")).toHaveTextContent("Cabin (H1): +1 Strain");
    expect(errors).not.toHaveBeenCalled();
  });

  it.each(["tabletop"])("identifies repeated tile names by coordinate when adjusting a %s effect", (experience) => {
    window.history.replaceState(null, "", `/?experience=${experience}&scenario=season-three`);
    render(<App initialPreview={thirdSeason} />);
    const before = saved();
    for (const hex of ["H1", "A7", "A5"]) {
      expect(screen.getByRole("button", { name: `Decrease Strain adjustment for Cabin at ${hex}` })).toBeEnabled();
    }
    fireEvent.click(screen.getByRole("button", { name: "Decrease Strain adjustment for Cabin at A7" }));
    fireEvent.click(screen.getByRole("button", { name: "Spend 1 Goods" }));
    expect(screen.getByLabelText("Effect preview")).not.toHaveTextContent("Cabin (A7)");
    expect(screen.getByLabelText("Effect preview")).toHaveTextContent("Cabin (H1): +1 Strain");
    expect(saved()).toEqual(before);
    fireEvent.click(screen.getByRole("button", { name: "Apply Effect" }));
    expect(saved().warehouse.goods).toBe(before.warehouse.goods - 1);
    for (const hex of ["A7", "H1", "A5"]) {
      const oldTile = before.map.placedTiles.find(tile => tile.hexIds.includes(hex))!;
      const newTile = saved().map.placedTiles.find(tile => tile.instanceId === oldTile.instanceId)!;
      expect(newTile.strain).toBe(oldTile.strain + (hex === "A7" ? 0 : 1));
    }
    fireEvent.click(screen.getByRole("button", { name: "Undo last game step" }));
    expect(saved()).toEqual(before);
  });

  it("keeps Open targeting actionable without opening an explanation or widening its pool", () => {
    const state = expiry(25); const original = structuredClone(state); const onApply = vi.fn();
    render(<EffectPrompt state={state} effect={state.pendingEffects[0]} onApply={onApply} />);
    expect(screen.getByText(/An Open Target Card lets you choose/)).toBeVisible();
    expect(screen.getByText(/An Open card needs your choice from the eligible tiles/)).toBeVisible();
    expect(screen.queryByText(/The draw selected these targets/)).not.toBeInTheDocument();
    expect(screen.getByText("Card 25")).not.toBeVisible();
    expect(screen.getByRole("button", { name: "Apply Effect" })).toBeDisabled();
    expect(screen.getAllByRole("button", { name: /^Increase Strain adjustment for Path at / })).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Increase Strain adjustment for Path at A1" }));
    toggle("Card 25 · Explain");
    expect(screen.getByText("Card 25")).toBeVisible();
    expect(screen.getByRole("button", { name: "Apply Effect" })).toBeEnabled();
    expect(state).toEqual(original);
    fireEvent.click(screen.getByRole("button", { name: "Apply Effect" }));
    const next = resolvePendingEffect(state, onApply.mock.calls[0][0]);
    expect(next.map.placedTiles[0].strain).toBe(1);
    expect(next.map.placedTiles[1].strain).toBe(0);
    expect(next.targetCards.drawCount).toBe(state.targetCards.drawCount);
  });

  it("keeps prevention conditional and visible while all diagnostic cards are closed", () => {
    const state = expiry();
    render(<TargetCardResolution state={state} effect={state.pendingEffects[0]} />);
    expect(screen.getByText("If Strain is placed here, Supported prevents 1 after selection.")).toBeVisible();
    expect(screen.getByText("Card 03")).not.toBeVisible();
    expect(screen.queryByText(/^Receives/)).not.toBeInTheDocument();
  });

  it("surfaces the printed fallback, Golden Garden and incomplete linked-target caveat outside the explanation", () => {
    const state = expiry();
    const effect = state.pendingEffects[0];
    effect.targetCardDiagnostics![0] = { ...effect.targetCardDiagnostics![0], goldenGardenWillPrevent: true, printedFallbackUsed: true, alternatePrimaryWouldComplete: true };
    render(<TargetCardResolution state={state} effect={effect} />);
    expect(screen.getByText("If Strain is placed here, the Golden Garden prevents 1 after selection.")).toBeVisible();
    expect(screen.getByText("The effect’s printed fallback supplied this eligible pool.", { selector: ".target-draw-notes small" })).toBeVisible();
    expect(screen.getByText(/Another primary could have completed/)).toBeVisible();
    expect(screen.getByText("Card 03")).not.toBeVisible();
  });

  it("explains an empty pool without inventing a drawn card or a target", () => {
    const state = expiry(3, []);
    render(<TargetCardResolution state={state} effect={state.pendingEffects[0]} />);
    expect(screen.getByText("0 cards drawn")).toBeVisible();
    expect(screen.getByText(/No eligible Strain target was available/)).toBeVisible();
    expect(screen.queryByText(/Draw suggests/)).not.toBeInTheDocument();
    toggle("How Target Cards work");
    expect(screen.getByText(/prevented Strain is not redirected/i)).toBeVisible();
  });
});
