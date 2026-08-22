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

  it("renders the locked card face with four qualifiers and the six-hex direction ring", () => {
    const { container } = render(<TargetCard card={targetCardById[5]} />);

    expect(screen.getByRole("heading", { name: /card 05/i })).toBeInTheDocument();
    expect(screen.getByText("3+ Neighbours")).toBeInTheDocument();
    expect(screen.getAllByText(/unless specified/i)).toHaveLength(4);
    expect(screen.getByText("SE")).toBeInTheDocument();
    expect(container.querySelectorAll(".physical-target-card-direction-hex")).toHaveLength(6);
    expect(container.querySelector(".direction-se.selected")).toBeInTheDocument();
  });

  it("capitalises Neighbours in the zero-to-two adjacency answer", () => {
    render(<TargetCard card={targetCardById[11]} />);

    expect(screen.getByText("0–2 Neighbours")).toBeInTheDocument();
  });

  it("renders Open cards without a tie-direction ring", () => {
    const { container } = render(<TargetCard card={targetCardById[25]} />);

    expect(screen.getByRole("heading", { name: /card 25/i })).toBeInTheDocument();
    expect(screen.getAllByText(/^any$/i)).toHaveLength(4);
    expect(screen.getByText(/choose any eligible tile/i)).toBeInTheDocument();
    expect(container.querySelector(".physical-target-card-direction-ring")).not.toBeInTheDocument();
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
    expect(screen.getAllByText(/unless specified/i)).toHaveLength(4);
    expect(screen.getByText(/selected: path/i)).toBeInTheDocument();
    expect(screen.getByText(/supported will prevent 1 strain after selection/i)).toBeInTheDocument();
    expect(screen.getAllByText(/applied|ignored/i)).toHaveLength(4);
    expect(screen.getByText(/prevented strain is not redirected/i)).toBeInTheDocument();
  });
});
