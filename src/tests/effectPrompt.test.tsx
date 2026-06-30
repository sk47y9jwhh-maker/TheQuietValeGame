import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EffectPrompt } from "../components/effects/EffectPrompt";
import { createNewGame } from "../engine/setup";
import { getHexNeighbors } from "../engine/hex";
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
  it("shows a compact preview instead of controls for a prepared resource effect", () => {
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

    expect(screen.getByLabelText("Effect preview")).toHaveTextContent("Gain 2 Wood");
    expect(screen.queryByText("Resources")).not.toBeInTheDocument();
    expect(screen.queryByText("Wood 15")).not.toBeInTheDocument();
    expect(screen.queryByText("Tiles")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /apply effect/i })).toBeEnabled();
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

  it("names the tile receiving prepared Strain and explains Supported prevention", () => {
    const state = createNewGame(1, ["vanguard"]);
    const target = coreTile("c05_cabin", "tile_cabin", "G1");
    target.support.singleUse = true;
    state.map.placedTiles = [target];
    const effect: PendingEffectState = {
      id: "effect_strain_preview",
      sourceType: "card",
      sourceId: "burden_smoke_over_hearths",
      sourceName: "Smoke over Hearths",
      title: "Revealed Smoke over Hearths",
      effectText: "Choose 1 Housing Tile and place 1 Strain on it.",
      suggestedAdjustment: { tileStrainDeltas: { tile_cabin: 1 } }
    };

    render(<EffectPrompt state={state} effect={effect} onApply={() => {}} />);

    expect(screen.getByLabelText("Effect preview")).toHaveTextContent(
      "Cabin (G1): +1 Strain — Supported prevents 1"
    );
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

  it("keeps an up-to Supported effect playable with fewer than the maximum", () => {
    const state = createNewGame(1, ["vanguard"]);
    const [firstHex, secondHex, thirdHex] = getHexNeighbors("G2");
    const source = coreTile("c15_path", "tile_source", "G2");
    state.map.placedTiles = [
      source,
      coreTile("c15_path", "tile_1", firstHex),
      coreTile("c15_path", "tile_2", secondHex),
      coreTile("c15_path", "tile_3", thirdHex)
    ];
    const effect: PendingEffectState = {
      id: "effect_support",
      sourceType: "tile",
      sourceId: source.instanceId,
      sourceName: "Alms House",
      title: "Placed effect: Alms House",
      effectText:
        "When placed or activated: Choose up to two adjacent tiles. They gain Supported.",
      requiresManualChoice: true
    };

    render(<EffectPrompt state={state} effect={effect} onApply={() => {}} />);

    const [first] = screen.getAllByRole("button", {
      name: /place supported on path/i
    });
    fireEvent.click(first);
    expect(screen.getByText(/Supported up to 2 tiles: 1 selected/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /apply effect/i })).toBeEnabled();
    expect(screen.queryByText("Resources")).not.toBeInTheDocument();

    const supportButtons = screen.getAllByRole("button", {
      name: /place supported on path/i
    });
    fireEvent.click(supportButtons[1]);
    expect(screen.getByText(/Supported up to 2 tiles: 2 selected/i)).toBeInTheDocument();
    const thirdSupportButton = supportButtons.at(2);
    expect(thirdSupportButton).toBeDefined();
    expect(thirdSupportButton!).toBeDisabled();
  });

  it("shows the continue action before long choice controls", () => {
    const state = createNewGame(1, ["vanguard"]);
    state.map.placedTiles = [coreTile("c15_path", "tile_path", "G1", 1)];
    const effect: PendingEffectState = {
      id: "effect_visible_action",
      sourceType: "card",
      sourceName: "Test Boon",
      title: "Use Test Boon",
      effectText: "Remove up to 2 Strain from 1 placed tile.",
      requiresManualChoice: true
    };

    const { container } = render(
      <EffectPrompt state={state} effect={effect} onApply={() => {}} />
    );

    const commandBar = container.querySelector(".effect-command-bar");
    const tileControls = screen.getByText("Tiles").closest(".effect-control-group");
    expect(commandBar).toBeInTheDocument();
    expect(
      commandBar!.compareDocumentPosition(tileControls as Node) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });
});
