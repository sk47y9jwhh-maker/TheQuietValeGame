import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../app/App";
import { TargetCard } from "../components/common/TargetCard";
import { EffectPrompt } from "../components/effects/EffectPrompt";
import { systemEffectRuleId } from "../data/effectRules";
import { targetCardById } from "../data/targetCards";
import { preparePendingEffectQueueHead } from "../engine/manualEffects";
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
});
