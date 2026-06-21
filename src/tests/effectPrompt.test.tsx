import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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

  it("does not show warehouse controls for strain-only Burden choices", () => {
    const state = createNewGame(1, ["vanguard"]);
    state.map.placedTiles = [coreTile("c15_path", "tile_path", "G1")];
    const effect: PendingEffectState = {
      id: "effect_1",
      sourceType: "card",
      sourceName: "Test Burden",
      title: "Revealed Test Burden",
      effectText:
        "Choose 1 Travel Tile with fewer than 3 Strain near Food stores and place 1 Strain on it.",
      requiresManualChoice: true
    };

    render(<EffectPrompt state={state} effect={effect} onApply={() => {}} />);

    expect(screen.getByText("Tiles")).toBeInTheDocument();
    expect(screen.getByText(/Path G1/)).toBeInTheDocument();
    expect(screen.queryByText("Resources")).not.toBeInTheDocument();
  });

  it("shows both payment and strain controls for pay-or-strain Burdens", () => {
    const state = createNewGame(1, ["vanguard"]);
    state.map.placedTiles = [coreTile("c09_tavern", "tile_social", "G1")];
    const effect: PendingEffectState = {
      id: "effect_1",
      sourceType: "card",
      sourceId: "burden_empty_shelves",
      sourceName: "Empty Shelves",
      title: "Revealed Empty Shelves",
      effectText:
        "Choose 1 Social Tile with fewer than 3 Strain. Pay 1 Goods, or place 1 Strain on it.",
      requiresManualChoice: true
    };

    render(<EffectPrompt state={state} effect={effect} onApply={() => {}} />);

    expect(screen.getByText("Resources")).toBeInTheDocument();
    expect(screen.getByText("Goods 15")).toBeInTheDocument();
    expect(screen.getByText("Tiles")).toBeInTheDocument();
    expect(screen.getByText(/Tavern G1/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /apply effect/i })).toBeDisabled();
  });

  it("limits add-timer Boon controls to legal timer additions", () => {
    const state = createNewGame(1, ["vanguard"]);
    state.encounters.activeArrivals = [
      { cardId: "arrival_the_quiet_quest", timerTokens: 1 },
      { cardId: "arrival_remnants_of_the_cavalry", timerTokens: 1 }
    ];
    const effect: PendingEffectState = {
      id: "effect_1",
      sourceType: "card",
      sourceId: "boon_a_little_more_time",
      sourceName: "A Little Time",
      title: "Use Boon: A Little Time",
      effectText: "Add 1 timer token to 1 active Arrival, to a maximum of 3.",
      requiresManualChoice: true
    };

    render(<EffectPrompt state={state} effect={effect} onApply={() => {}} />);

    expect(
      screen.getByRole("button", {
        name: /remove timer adjustment from quiet quest/i
      })
    ).toBeDisabled();

    fireEvent.click(
      screen.getByRole("button", {
        name: /add timer adjustment to quiet quest/i
      })
    );

    expect(
      screen.getByRole("button", {
        name: /add timer adjustment to quiet quest/i
      })
    ).toBeDisabled();
    expect(
      screen.getByRole("button", {
        name: /add timer adjustment to remnants of the cavalry/i
      })
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: /apply effect/i })).toBeEnabled();
  });
});
