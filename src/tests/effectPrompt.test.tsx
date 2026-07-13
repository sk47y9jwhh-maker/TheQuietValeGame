import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EffectPrompt } from "../components/effects/EffectPrompt";
import {
  cardEffectRuleId,
  stewardEffectRuleId,
  systemEffectRuleId,
  tileEffectRuleId
} from "../data/effectRules";
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
  it("keeps Help Stands disabled until every earned resource is selected", () => {
    const state = createNewGame(2, ["vanguard", "warden"]);
    state.season = 2;
    state.players = state.players.map((player, index) => ({
      ...player,
      stewardHexId: index === 0 ? "G1" : "H1"
    }));
    state.map.placedTiles = [
      coreTile("c15_path", "tile_1", "G1"),
      coreTile("c15_path", "tile_2", "H1")
    ];
    const effect: PendingEffectState = {
      id: "effect_help_stands",
      sourceType: "card",
      sourceId: "boon_where_help_stands",
      ruleId: cardEffectRuleId("boon_where_help_stands", 2),
      sourceName: "Help Stands",
      title: "Revealed Help Stands",
      effectText:
        "For each Steward-occupied tile, remove 1 Strain. For each that had none, gain 2 resources, up to 4 total.",
      requiresManualChoice: true
    };

    render(<EffectPrompt state={state} effect={effect} onApply={() => {}} />);

    const addWood = screen.getByRole("button", { name: "Add 1 Wood" });
    fireEvent.click(addWood);
    expect(screen.getByText("1/4 resources selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /apply effect/i })).toBeDisabled();

    fireEvent.click(addWood);
    fireEvent.click(screen.getByRole("button", { name: "Add 1 Food" }));
    fireEvent.click(screen.getByRole("button", { name: "Add 1 Goods" }));

    expect(screen.getByText("4/4 resources selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /apply effect/i })).toBeEnabled();
  });

  it("repairs an already-open Help Stands prompt with its required Strain removal", () => {
    const state = createNewGame(2, ["vanguard", "warden"]);
    state.season = 2;
    state.players = state.players.map((player, index) => ({
      ...player,
      stewardHexId: index === 0 ? "G1" : "H1"
    }));
    state.map.placedTiles = [
      coreTile("c15_path", "tile_1", "G1", 1),
      coreTile("c15_path", "tile_2", "H1")
    ];
    const effect: PendingEffectState = {
      id: "effect_help_stands_saved",
      sourceType: "card",
      sourceId: "boon_where_help_stands",
      ruleId: cardEffectRuleId("boon_where_help_stands", 2),
      sourceName: "Help Stands",
      title: "Revealed Help Stands",
      effectText:
        "For each Steward-occupied tile, remove 1 Strain. For each that had none, gain 2 resources, up to 4 total.",
      requiresManualChoice: true
    };

    render(<EffectPrompt state={state} effect={effect} onApply={() => {}} />);

    expect(screen.getByLabelText("Effect preview")).toHaveTextContent(
      "Path (G1): -1 Strain"
    );
    expect(screen.getByText("0/2 resources selected")).toBeInTheDocument();
  });


  it("allows Wonderful Find's resource choice when no Dig Site is placed", () => {
    const state = createNewGame(1, ["vanguard"]);
    const effect: PendingEffectState = {
      id: "effect_wonderful_find",
      sourceType: "card",
      sourceId: "boon_a_wonderful_find",
      ruleId: cardEffectRuleId("boon_a_wonderful_find", 1),
      sourceName: "The Wonderful Find",
      title: "Revealed The Wonderful Find",
      effectText:
        "Gain 1 Metal or 1 Goods. If there is a placed Dig Site / Excavation Site, one such tile gains Supported.",
      requiresManualChoice: true
    };

    render(<EffectPrompt state={state} effect={effect} onApply={() => {}} />);

    expect(screen.queryByText("Tiles")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add 1 Metal" }));
    expect(screen.getByText("1/1 resources selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /apply effect/i })).toBeEnabled();
  });


  it("allows Warden Relief to place Supported on an eligible tile", () => {
    const state = createNewGame(1, ["warden"]);
    state.map.placedTiles = [coreTile("c15_path", "tile_path", "G1")];
    const effect: PendingEffectState = {
      id: "effect_warden_relief",
      sourceType: "system",
      sourceId: "warden",
      ruleId: stewardEffectRuleId("warden"),
      sourceName: "Warden",
      title: "Warden Relief",
      effectText:
        "Choose exactly one: remove 1 Strain from any tile, or place Supported on one tile.",
      requiresManualChoice: true,
      allowWardenRelief: true,
      confirmLabel: "Apply Warden Relief"
    };

    render(<EffectPrompt state={state} effect={effect} onApply={() => {}} />);

    expect(screen.getByRole("button", { name: /apply warden relief/i })).toBeDisabled();
    fireEvent.click(
      screen.getByRole("button", { name: "Place Supported on Path" })
    );
    expect(screen.getByLabelText("Effect preview")).toHaveTextContent(
      "Path (G1): gains Supported"
    );
    expect(screen.getByRole("button", { name: /apply warden relief/i })).toBeEnabled();
  });

  it("allows an already-stuck Warden Relief prompt to continue when no target exists", () => {
    const state = createNewGame(1, ["warden"]);
    const tile = coreTile("c15_path", "tile_path", "G1");
    tile.support.singleUse = true;
    state.map.placedTiles = [tile];
    const applied: unknown[] = [];
    const effect: PendingEffectState = {
      id: "effect_warden_relief",
      sourceType: "system",
      sourceId: "warden",
      ruleId: stewardEffectRuleId("warden"),
      sourceName: "Warden",
      title: "Warden Relief",
      effectText:
        "Choose exactly one: remove 1 Strain from any tile, or place Supported on one tile.",
      requiresManualChoice: true,
      allowWardenRelief: true,
      confirmLabel: "Apply Warden Relief"
    };

    render(
      <EffectPrompt
        state={state}
        effect={effect}
        onApply={(adjustment) => applied.push(adjustment)}
      />
    );

    expect(screen.getByText("No eligible tile — continue")).toBeInTheDocument();
    const continueButton = screen.getByRole("button", { name: "Continue" });
    expect(continueButton).toBeEnabled();
    fireEvent.click(continueButton);
    expect(applied).toHaveLength(1);
  });

  it("keeps Settlement of Plenty disabled until all five resources are chosen", () => {
    const state = createNewGame(1, ["vanguard"]);
    state.season = 3;
    const effect: PendingEffectState = {
      id: "effect_settlement",
      sourceType: "card",
      sourceId: "boon_the_settlement_of_plenty",
      ruleId: cardEffectRuleId("boon_the_settlement_of_plenty", 3),
      sourceName: "Settlement of Plenty",
      title: "Use Boon: Settlement of Plenty",
      effectText:
        "Choose 1 connected group of 5 or more non-Overstrained tiles. Remove up to 3 Strain among tiles in that group. If none is removed, gain 5 Food and/or Goods.",
      requiresManualChoice: true
    };

    render(<EffectPrompt state={state} effect={effect} onApply={() => {}} />);

    const addFood = screen.getByRole("button", { name: "Add 1 Food" });
    fireEvent.click(addFood);
    expect(screen.getByText("1/5 resources selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /apply effect/i })).toBeDisabled();

    fireEvent.click(addFood);
    fireEvent.click(addFood);
    fireEvent.click(screen.getByRole("button", { name: "Add 1 Goods" }));
    fireEvent.click(screen.getByRole("button", { name: "Add 1 Goods" }));

    expect(screen.getByText("5/5 resources selected")).toBeInTheDocument();
    expect(screen.getByLabelText("Effect preview")).toHaveTextContent("Gain 3 Food");
    expect(screen.getByLabelText("Effect preview")).toHaveTextContent("Gain 2 Goods");
    expect(screen.getByRole("button", { name: /apply effect/i })).toBeEnabled();
  });

  it("shows a compact preview instead of controls for a prepared resource effect", () => {
    const state = createNewGame(1, ["vanguard"]);
    const effect: PendingEffectState = {
      id: "effect_1",
      ruleId: systemEffectRuleId("acknowledge"),
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
      ruleId: systemEffectRuleId("acknowledge"),
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
    state.map.placedTiles = [
      target,
      coreTile("c13_workshops", "tile_workshops", "H1")
    ];
    const effect: PendingEffectState = {
      id: "effect_strain_preview",
      sourceType: "card",
      sourceId: "burden_smoke_over_hearths",
      ruleId: cardEffectRuleId("burden_smoke_over_hearths", 1),
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

  it("lets an Overstrained Quiet Fractures anchor select only adjacent zero-Strain tiles", () => {
    const state = createNewGame(1, ["vanguard"]);
    state.map.placedTiles = [
      coreTile("c15_path", "anchor", "G1", 3),
      coreTile("c05_cabin", "left", "F1"),
      coreTile("c13_workshops", "right", "H1"),
      coreTile("c09_tavern", "remote", "J1")
    ];
    const applied: unknown[] = [];
    const effect: PendingEffectState = {
      id: "effect_quiet_fractures",
      sourceType: "card",
      sourceId: "burden_the_quiet_fractures",
      ruleId: cardEffectRuleId("burden_the_quiet_fractures", 3),
      sourceName: "The Quiet Fractures",
      title: "Revealed The Quiet Fractures",
      effectText:
        "Choose 1 Overstrained tile. Then place 1 Strain on each of 2 adjacent placed tiles with 0 Strain.",
      requiresManualChoice: true
    };

    render(
      <EffectPrompt
        state={state}
        effect={effect}
        onApply={(adjustment) => applied.push(adjustment)}
      />
    );

    const apply = screen.getByRole("button", { name: /apply effect/i });
    expect(screen.getByText("Strain Cascade")).toBeInTheDocument();
    expect(apply).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Choose Path as cascade anchor" }));
    expect(screen.queryByRole("button", { name: "Place 1 Strain on adjacent Tavern" }))
      .not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Place 1 Strain on adjacent Cabin" }));
    expect(apply).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Place 1 Strain on adjacent Workshops" }));
    expect(apply).toBeEnabled();
    fireEvent.click(apply);
    expect(applied).toMatchObject([{
      strainCascadeAnchorTileId: "anchor",
      tileStrainDeltas: { left: 1, right: 1 }
    }]);
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
      ruleId: cardEffectRuleId("burden_smoke_over_hearths", 1),
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
    state.map.placedTiles = [
      coreTile("c15_path", "tile_path", "G1"),
      coreTile("c01_lumber_yard", "tile_resource", "H1")
    ];
    const effect: PendingEffectState = {
      id: "effect_1",
      sourceType: "card",
      ruleId: cardEffectRuleId("burden_return_to_the_trenches", 1),
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
      ruleId: cardEffectRuleId("burden_empty_shelves", 1),
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

  it("keeps a multi-target pay-or-strain Burden disabled until every outcome is chosen", () => {
    const state = createNewGame(1, ["vanguard"]);
    state.map.placedTiles = [
      coreTile("c09_tavern", "tile_social_1", "G1"),
      coreTile("c09_tavern", "tile_social_2", "I1")
    ];
    const effect: PendingEffectState = {
      id: "effect_empty_shelves_2",
      sourceType: "card",
      sourceId: "burden_empty_shelves",
      ruleId: cardEffectRuleId("burden_empty_shelves", 2),
      sourceName: "Empty Shelves",
      title: "Revealed Empty Shelves",
      effectText:
        "Choose 2 Social Tiles with fewer than 3 Strain. For each, pay 1 Goods or place 1 Strain on it.",
      requiresManualChoice: true
    };

    render(<EffectPrompt state={state} effect={effect} onApply={() => {}} />);

    const spendGoods = screen.getByRole("button", { name: "Spend 1 Goods" });
    fireEvent.click(spendGoods);
    expect(screen.getByText("1/2 outcomes selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /apply effect/i })).toBeDisabled();

    fireEvent.click(spendGoods);
    expect(screen.getByText("2/2 outcomes selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /apply effect/i })).toBeEnabled();
  });

  it("offers the correct Storehouses Disagree resource branch in one click", () => {
    const state = createNewGame(1, ["vanguard"]);
    state.map.placedTiles = [
      coreTile("c01_lumber_yard", "tile_resource", "G1")
    ];
    const effect: PendingEffectState = {
      id: "effect_storehouses",
      sourceType: "card",
      sourceId: "burden_the_storehouses_disagree",
      ruleId: cardEffectRuleId("burden_the_storehouses_disagree", 1),
      sourceName: "Storehouses Disagree",
      title: "Revealed Storehouses Disagree",
      effectText:
        "Choose Wood, Stone, or Food. If the Warehouse has at least 2 of it, lose 2. Otherwise, place 1 Strain on 1 Resource Tile with fewer than 3 Strain.",
      requiresManualChoice: true
    };

    render(<EffectPrompt state={state} effect={effect} onApply={() => {}} />);

    expect(screen.getByText("Wood 15")).toBeInTheDocument();
    expect(screen.getByText("Stone 15")).toBeInTheDocument();
    expect(screen.getByText("Food 15")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /increase strain adjustment for lumber yard/i })
    ).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Spend 2 Wood" }));
    expect(screen.getByText("1/1 outcome selected")).toBeInTheDocument();
    expect(screen.getByLabelText("Effect preview")).toHaveTextContent("Lose 2 Wood");
    expect(screen.getByRole("button", { name: /apply effect/i })).toBeEnabled();
  });

  it("shows a compulsory resource loss as a fixed preview beside its tile choice", () => {
    const state = createNewGame(1, ["vanguard"]);
    state.map.placedTiles = [
      coreTile("c13_workshops", "tile_workshop", "G1"),
      coreTile("c14_market_stalls", "tile_market", "I1")
    ];
    const effect: PendingEffectState = {
      id: "effect_tools_rust",
      sourceType: "card",
      sourceId: "burden_tools_left_to_rust",
      ruleId: cardEffectRuleId("burden_tools_left_to_rust", 3),
      sourceName: "Tools Left to Rust",
      title: "Revealed Tools Left to Rust",
      effectText:
        "Choose 2 Crafting and/or Merchant Tiles with fewer than 3 Strain. Place 1 Strain on each. Then lose 2 Metal if able.",
      suggestedAdjustment: { resourceDeltas: { metal: -2 } },
      requiresManualChoice: true
    };

    render(<EffectPrompt state={state} effect={effect} onApply={() => {}} />);

    expect(screen.getByLabelText("Effect preview")).toHaveTextContent("Lose 2 Metal");
    expect(screen.queryByText("Resources")).not.toBeInTheDocument();
    expect(screen.getByText("Tiles")).toBeInTheDocument();
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
      ruleId: cardEffectRuleId("boon_a_little_more_time", 1),
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
      ruleId: tileEffectRuleId("special_alms_house", "special"),
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
      ruleId: cardEffectRuleId("boon_from_the_brink", 1),
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
