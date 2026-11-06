import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../app/App";
import { TargetCard } from "../components/common/TargetCard";
import { EffectPrompt } from "../components/effects/EffectPrompt";
import { cardEffectRuleId, systemEffectRuleId } from "../data/effectRules";
import { targetCardById } from "../data/targetCards";
import { preparePendingEffectQueueHead, resolvePendingEffect } from "../engine/manualEffects";
import { createNewGame } from "../engine/setup";
import { createTargetCardDeckState } from "../engine/targetCards";
import type { PlacedTile } from "../engine/types";

function tile(
  instanceId: string,
  hexId: string,
  supported = false
): PlacedTile {
  return {
    instanceId,
    tileId: "c15_path",
    kind: "core",
    side: "basic",
    hexIds: [hexId],
    strain: 0,
    support: {
      passive: false,
      singleUse: supported,
      preventedThisRound: false
    }
  };
}

describe("Target Card UI", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("uses Target Cards as the standard without a setup control", () => {
    render(<App />);

    expect(
      screen.queryByRole("checkbox", { name: /automatic target cards/i })
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start season i/i })).toBeEnabled();
  });

  it("renders the printed card face: four preference rows and the tie arrow", () => {
    render(<TargetCard card={targetCardById[5]} />);

    expect(screen.getByRole("heading", { name: /card 05/i })).toBeInTheDocument();
    expect(screen.getByText("3+ Neighbours")).toBeInTheDocument();
    expect(screen.getByText("Work down the rows. Skip any row no tile matches.")).toBeInTheDocument();
    expect(screen.getByText("SE")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Arrow pointing south-east" })).toBeInTheDocument();
    expect(screen.getByText("Take the tile the arrow points to")).toBeInTheDocument();
  });

  it("capitalises Neighbours in the zero-to-two adjacency answer", () => {
    render(<TargetCard card={targetCardById[11]} />);

    expect(screen.getByText("0–2 Neighbours")).toBeInTheDocument();
  });

  it("renders Open cards without a tie arrow", () => {
    render(<TargetCard card={targetCardById[25]} />);

    expect(screen.getByRole("heading", { name: /card 25/i })).toBeInTheDocument();
    expect(screen.getAllByText(/^any$/i)).toHaveLength(4);
    expect(screen.getByText(/choose any eligible tile/i)).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /Arrow pointing/ })).not.toBeInTheDocument();
  });

  it("shows the card, every filter result, final target, and prevention timing", () => {
    const state = createNewGame(1, ["vanguard"], {
      encounterSeed: "QV-TARGET-UI"
    });
    state.map.placedTiles = [tile("other", "A1"), tile("protected", "C1", true)];
    state.targetCards = {
      ...createTargetCardDeckState("QV-TARGET-UI"),
      drawPile: [3, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    };
    state.pendingEffects = [{
      id: "target_ui",
      ruleId: systemEffectRuleId("arrival-expired"),
      sourceType: "system",
      sourceName: "Expired Arrival",
      title: "Expired Arrival",
      effectText: "Place 1 Strain",
      requiresManualChoice: true
    }];
    const prepared = preparePendingEffectQueueHead(state);

    render(
      <EffectPrompt
        state={prepared}
        effect={prepared.pendingEffects[0]}
        onApply={vi.fn()}
      />
    );

    expect(screen.getByRole("region", { name: /target card resolution/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /card 03/i })).toBeInTheDocument();
    expect(screen.getByText(/target 1/i)).toBeInTheDocument();
    expect(screen.getByText("Work down the rows. Skip any row no tile matches.")).toBeInTheDocument();
    expect(screen.getByText(/selected: path/i)).toBeInTheDocument();
    expect(screen.getByText(/supported will prevent 1 strain after selection/i)).toBeInTheDocument();
    expect(screen.getAllByText(/applied|ignored/i)).toHaveLength(4);
    expect(screen.getByText(/prevented strain is not redirected/i)).toBeInTheDocument();
  });

  it.each([false, true])("allows both Coin Before Craft targets with Any (old saved plan: %s)", (oldSavedPlan) => {
    const state = createNewGame(1, ["vanguard"]);
    state.season = 2;
    state.map.placedTiles = [
      { ...tile("merchant", "G1"), tileId: "c14_market_stalls" },
      { ...tile("crafting", "H1"), tileId: "c13_workshops" },
      tile("unrelated", "J1")
    ];
    state.targetCards.drawPile = [25, ...state.targetCards.drawPile.filter((id) => id !== 25)];
    state.pendingEffects = [{
      id: "coin_any",
      ruleId: cardEffectRuleId("burden_coin_before_craft", 2),
      sourceType: "card",
      sourceId: "burden_coin_before_craft",
      sourceName: "Coin Before Craft",
      title: "Coin Before Craft",
      effectText: "Place 1 Strain on each of a Merchant and Crafting tile.",
      requiresManualChoice: true
    }];
    const prepared = preparePendingEffectQueueHead(state);
    if (oldSavedPlan) prepared.pendingEffects[0].targetCardTargetTileIds = ["merchant"];
    const onApply = vi.fn();
    render(<EffectPrompt state={prepared} effect={prepared.pendingEffects[0]} onApply={onApply} />);
    const apply = screen.getByRole("button", { name: /apply effect/i });
    expect(apply).toBeDisabled();
    expect(screen.queryByRole("button", { name: /^Increase Strain adjustment for Path(?: at |$)/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Increase Strain adjustment for Market Stalls(?: at |$)/ }));
    expect(apply).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /^Increase Strain adjustment for Workshops(?: at |$)/ }));
    expect(apply).toBeEnabled();
    fireEvent.click(apply);
    expect(onApply).toHaveBeenCalledTimes(1);
    const resolved = resolvePendingEffect(prepared, onApply.mock.calls[0][0]);
    expect(resolved.pendingEffects).toHaveLength(0);
    expect(resolved.map.placedTiles.map((tile) => tile.strain)).toEqual([1, 1, 0]);
  });
});
