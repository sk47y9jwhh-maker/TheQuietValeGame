import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EffectPrompt } from "../components/effects/EffectPrompt";
import { createNewGame } from "../engine/setup";
import type { PendingEffectState, PlacedTile } from "../engine/types";

const coreTile = (
  tileId: string,
  instanceId: string,
  hexId: string,
  strain = 0
): PlacedTile => ({
  instanceId,
  tileId,
  kind: "core",
  side: "basic",
  hexIds: [hexId],
  strain,
  support: { passive: false, singleUse: false, preventedThisRound: false }
});

describe("effect prompt controls", () => {
  it("only shows resource rows that the effect can use", () => {
    const state = createNewGame(1, ["vanguard"]);
    const effect: PendingEffectState = {
      id: "effect_1",
      sourceType: "card",
      sourceName: "Test",
      title: "Test gain",
      effectText: "Gain 2 Wood.",
      suggestedAdjustment: { resourceDeltas: { wood: 2 } }
    };

    render(<EffectPrompt state={state} effect={effect} onApply={() => {}} />);

    expect(screen.getByText("Resources")).toBeInTheDocument();
    expect(screen.getByText("Wood 15")).toBeInTheDocument();
    expect(screen.queryByText("Stone 15")).not.toBeInTheDocument();
    expect(screen.queryByText("Tiles")).not.toBeInTheDocument();
  });

  it("does not show controls for a prepared cost modifier acknowledgement", () => {
    const state = createNewGame(1, ["vanguard"]);
    const effect: PendingEffectState = {
      id: "effect_1",
      sourceType: "card",
      sourceName: "Many Hands, Light Work",
      title: "Use Boon: Many Hands, Light Work",
      effectText: "The next tile placed this Season costs 1 fewer resource."
    };

    render(<EffectPrompt state={state} effect={effect} onApply={() => {}} />);

    expect(screen.queryByText("Resources")).not.toBeInTheDocument();
    expect(screen.queryByText("Tiles")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /apply effect/i })).toBeEnabled();
  });

  it("only shows valid tile targets for a tile-targeted Burden", () => {
    const state = createNewGame(1, ["vanguard"]);
    state.map.placedTiles = [
      coreTile("c05_cabin", "tile_cabin", "G1"),
      coreTile("c13_workshops", "tile_workshops", "H1"),
      coreTile("c15_path", "tile_path", "I1")
    ];
    const effect: PendingEffectState = {
      id: "effect_1",
      sourceType: "card",
      sourceId: "burden_smoke_over_hearths",
      sourceName: "Smoke over Hearths",
      title: "Revealed Smoke over Hearths",
      effectText:
        "Choose 1 Housing Tile with fewer than 3 Strain adjacent to a Crafting Tile and place 1 Strain on it.",
      requiresManualChoice: true
    };

    render(<EffectPrompt state={state} effect={effect} onApply={() => {}} />);

    expect(screen.getByText("Tiles")).toBeInTheDocument();
    expect(screen.getByText(/Cabin G1/)).toBeInTheDocument();
    expect(screen.queryByText(/Path I1/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Workshops H1/)).not.toBeInTheDocument();
  });
});
