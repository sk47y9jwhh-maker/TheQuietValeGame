import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../app/App";
import { EffectPrompt } from "../components/effects/EffectPrompt";
import { systemEffectRuleId } from "../data/effectRules";
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

    expect(screen.getByRole("region", { name: /automatic target card resolution/i })).toBeInTheDocument();
    expect(screen.getByText(/card 3 · target 1/i)).toBeInTheDocument();
    expect(screen.getByText(/selected: path/i)).toBeInTheDocument();
    expect(screen.getByText(/supported will prevent 1 strain after selection/i)).toBeInTheDocument();
    expect(screen.getAllByText(/applied|ignored/i)).toHaveLength(4);
    expect(screen.getByText(/prevented strain is not redirected/i)).toBeInTheDocument();
  });
});
