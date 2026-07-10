import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ActionConsole } from "../components/actions/ActionConsole";
import { getDefaultPlaceTileId } from "../components/actions/placeTileChoices";
import { placeTile } from "../engine/gameActions";
import { createNewGame } from "../engine/setup";
import type { ComponentProps } from "react";
import { createEmptyLedgerCampaign } from "../app/ledgerPersistence";

function actionConsoleElement(
  overrides: Partial<ComponentProps<typeof ActionConsole>> = {}
) {
  const state = { ...createNewGame(1, ["vanguard"]), phase: "turns" as const };

  return (
    <ActionConsole
      actionMode="place"
      onActivate={() => {}}
      onCancelPendingBurdenWithWarden={() => {}}
      onCompleteArrival={() => {}}
      onConfirmPlace={() => {}}
      onEndRound={() => {}}
      onEndTurn={() => {}}
      onModeChange={() => {}}
      onPlacementOrientationChange={() => {}}
      onResolveBurden={() => {}}
      onResolvePendingEffect={() => {}}
      onReveal={() => {}}
      onSelectedTileChange={() => {}}
      onTileInspect={() => {}}
      onSkipPendingEffect={() => {}}
      onStableMove={() => {}}
      onUpgrade={() => {}}
      onUseFaceUpBoon={() => {}}
      onUseStewardPower={() => {}}
      placementOrientation={0}
      selectedHexIds={["G1"]}
      selectedTileId="c15_path"
      state={state}
      {...overrides}
    />
  );
}

function renderActionConsole(
  overrides: Partial<ComponentProps<typeof ActionConsole>> = {}
) {
  return render(actionConsoleElement(overrides));
}

describe("action console", () => {
  it("previews linked production in the Activate action", () => {
    const state = { ...createNewGame(1, ["vanguard"]), phase: "turns" as const };
    state.players[0] = {
      ...state.players[0],
      hasPlacedFirstTile: true,
      stewardHexId: "G1"
    };
    state.map.placedTiles = [
      {
        instanceId: "farm_1",
        tileId: "c04_farmstead",
        kind: "core",
        side: "basic",
        hexIds: ["G1"],
        strain: 0,
        support: { passive: false, singleUse: false, preventedThisRound: false }
      },
      {
        instanceId: "farm_2",
        tileId: "c04_farmstead",
        kind: "core",
        side: "upgraded",
        hexIds: ["H1"],
        strain: 0,
        support: { passive: false, singleUse: false, preventedThisRound: false }
      }
    ];

    renderActionConsole({ state, actionMode: "activate" });

    expect(screen.getByText("Also activates Artisan Farm")).toBeInTheDocument();
    expect(
      screen.getByText(/Adjacent matching Resource producers activate together/i)
    ).toBeInTheDocument();
  });

  it("shows failed Arrival, Burden, and Strain penalties in final scoring", () => {
    const state = { ...createNewGame(1, ["vanguard"]), phase: "gameEnd" as const };
    state.encounters.discardPile.push("arrival_acorns_and_oak_trees");
    state.encounters.activeBurdens.push("burden_smoke_over_hearths");
    state.map.placedTiles.push({
      instanceId: "tile_1",
      tileId: "c15_path",
      kind: "core",
      side: "basic",
      hexIds: ["G1"],
      strain: 1,
      support: { passive: false, singleUse: false, preventedThisRound: false }
    });

    renderActionConsole({ state });

    expect(screen.getByText("Failed Arrival Penalty -5 (1 failed)")).toBeInTheDocument();
    expect(screen.getByText("Burden Penalty -5")).toBeInTheDocument();
    expect(screen.getByText("Strain Penalty -5")).toBeInTheDocument();
  });

  it("reviews and records eligible Ledger entries at game end", () => {
    const state = { ...createNewGame(1, ["warden"]), phase: "gameEnd" as const };
    const onRecordLedgerGame = vi.fn();

    renderActionConsole({
      state,
      ledgerCampaign: createEmptyLedgerCampaign(),
      onRecordLedgerGame
    });

    expect(screen.getByRole("heading", { name: "Ledger review" })).toBeInTheDocument();
    expect(screen.getByText(/eligible Ledger Entr(?:y|ies) completed/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Record Completed Game" }));
    expect(onRecordLedgerGame).toHaveBeenCalledOnce();
  });

  it("keeps the recorded game award snapshot stable after new gates unlock", () => {
    const state = { ...createNewGame(1, ["warden"]), phase: "gameEnd" as const };
    state.ledgerRun!.recorded = true;
    const campaign = createEmptyLedgerCampaign();
    for (let index = 1; index <= 8; index += 1) {
      const entryId = `test-${index}`;
      campaign.completions[entryId] = {
        entryId,
        completedOnce: true,
        completedPlayerCounts: []
      };
    }
    campaign.completions["LE-026"] = {
      entryId: "LE-026",
      completedOnce: true,
      completedPlayerCounts: [1]
    };
    campaign.games = [{
      id: state.ledgerRun!.gameId,
      completedAt: "2026-07-06T12:00:00.000Z",
      playerCount: 1,
      stewardIds: ["warden"],
      finalScore: 0,
      completedEntryIds: ["LE-026"],
      newRecordEntryIds: ["LE-026"]
    }];

    renderActionConsole({ state, ledgerCampaign: campaign });

    expect(screen.getByText("1 new records")).toBeInTheDocument();
    expect(screen.getByText("1 eligible Ledger Entry completed this game.")).toBeInTheDocument();
    expect(screen.getByText("The Quiet Holds")).toBeInTheDocument();
    expect(screen.queryByText("Remembered Across the Vale")).not.toBeInTheDocument();
  });

  it("keeps the current Steward Power status visible during the turn", () => {
    const onModeChange = vi.fn();

    renderActionConsole({ onModeChange });

    const powerSummary = screen.getByRole("button", {
      name: /Vanguard Power Ready now Season 1/i
    });
    expect(powerSummary).toBeInTheDocument();

    fireEvent.click(powerSummary);
    expect(onModeChange).toHaveBeenCalledWith("power");
  });

  it("explains that the Warden Power appears during a Burden reveal", () => {
    const state = { ...createNewGame(1, ["warden"]), phase: "turns" as const };

    const { container } = renderActionConsole({ actionMode: "power", state });

    expect(screen.getAllByText("Ready on Burden reveal")).toHaveLength(2);
    expect(
      screen.getByText(/its effect screen will offer the Warden option/i)
    ).toBeInTheDocument();
    expect(
      container.querySelector(".steward-power-card .primary-action")
    ).not.toBeInTheDocument();
  });

  it("shows viable tile choices before greyed blocked choices", () => {
    const state = { ...createNewGame(1, ["vanguard"]), phase: "turns" as const };
    const onSelectedTileChange = vi.fn();

    renderActionConsole({ onSelectedTileChange, state });

    const rows = screen.getAllByRole("option");
    const path = screen.getByRole("option", { name: /Path/ });
    const inn = screen.getByRole("option", { name: /Inn/ });

    expect(rows[0]).toHaveClass("is-viable");
    expect(rows[0]).toHaveTextContent("Lumber Yard");
    expect(path).toHaveClass("is-viable");
    expect(path).toHaveTextContent("Placeable");
    expect(inn).toHaveClass("is-blocked");
    expect(inn).toHaveTextContent("No legal placement");

    fireEvent.click(inn);
    expect(onSelectedTileChange).toHaveBeenCalledWith("c08_inn");
  });

  it("places a line tile using a valid orientation when the current arrow is invalid", () => {
    const onConfirmPlace = vi.fn();
    const onPlacementOrientationChange = vi.fn();

    renderActionConsole({
      onConfirmPlace,
      onPlacementOrientationChange,
      placementOrientation: 2,
      selectedTileId: "c16_street"
    });

    fireEvent.click(screen.getByRole("button", { name: "Place Street" }));

    expect(onPlacementOrientationChange).toHaveBeenCalledWith(1);
    expect(onConfirmPlace).toHaveBeenCalledWith(
      {
        anchorHexId: "G1",
        orientation: 1
      },
      "c16_street"
    );
  });

  it("keeps the selected line travel tile at the top of the place list", () => {
    renderActionConsole({
      selectedTileId: "c16_street"
    });

    expect(screen.getAllByRole("option")[0]).toHaveTextContent("Street");
  });

  it("returns the tile list to the top and foregrounds direction for Street", () => {
    const view = renderActionConsole({ selectedTileId: "c15_path" });
    const list = screen.getByRole("listbox", { name: "Choose a tile" });
    list.scrollTop = 240;

    view.rerender(actionConsoleElement({ selectedTileId: "c16_street" }));

    expect(list.scrollTop).toBe(0);
    expect(screen.getByText("Choose the tile’s direction")).toBeInTheDocument();
    expect(
      screen.getByText(/choose the direction Street or Track extends/i)
    ).toBeInTheDocument();
  });

  it("walks players through choosing two independent Stables spaces", () => {
    const base = createNewGame(1, ["vanguard"]);
    const state = {
      ...base,
      phase: "turns" as const,
      players: [{ ...base.players[0], hasPlacedFirstTile: true }],
      tileSupply: {
        ...base.tileSupply,
        special: { ...base.tileSupply.special, special_stables: 2 }
      },
      map: {
        placedTiles: [
          {
            instanceId: "path_1",
            tileId: "c15_path",
            kind: "core" as const,
            side: "basic" as const,
            hexIds: ["G1"],
            strain: 0,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          }
        ]
      }
    };

    renderActionConsole({
      selectedHexIds: ["G2"],
      selectedTileId: "special_stables",
      state
    });

    expect(screen.getByText("Choose the second Stable")).toBeInTheDocument();
    expect(screen.getByText(/do not need to be adjacent/i)).toBeInTheDocument();
    expect(screen.getByText("First Stable: G2")).toBeInTheDocument();
    expect(screen.getByText("Second Stable: select on map")).toBeInTheDocument();
  });

  it("inspects a tile choice without selecting it", () => {
    const onSelectedTileChange = vi.fn();
    const onTileInspect = vi.fn();

    renderActionConsole({ onSelectedTileChange, onTileInspect });

    fireEvent.click(screen.getByRole("button", { name: "Inspect Lumber Yard" }));

    expect(onTileInspect).toHaveBeenCalledWith("c01_lumber_yard");
    expect(onSelectedTileChange).not.toHaveBeenCalled();
  });

  it("places a tile on the only legal opening space without a selected hex", () => {
    const onConfirmPlace = vi.fn();

    renderActionConsole({
      onConfirmPlace,
      selectedHexIds: [],
      selectedTileId: "c01_lumber_yard"
    });

    fireEvent.click(screen.getByRole("button", { name: "Place Lumber Yard" }));

    expect(onConfirmPlace).toHaveBeenCalledWith(
      { anchorHexId: "G1" },
      "c01_lumber_yard"
    );
  });

  it("chooses the top current tile option after a tile is placed", () => {
    const state = { ...createNewGame(1, ["vanguard"]), phase: "turns" as const };
    const next = placeTile(state, "player_1", "c01_lumber_yard", "G1");

    expect(getDefaultPlaceTileId(next, "player_1", [], 0, "c01_lumber_yard")).not.toBe(
      "c01_lumber_yard"
    );
  });

  it("keeps blocked active encounter interactions visible with reasons", () => {
    const state = {
      ...createNewGame(1, ["vanguard"]),
      phase: "turns" as const,
      warehouse: { wood: 0, stone: 0, metal: 0, food: 0, herbs: 0, goods: 0 },
      encounters: {
        ...createNewGame(1, ["vanguard"]).encounters,
        activeArrivals: [{ cardId: "arrival_lest_we_forget", timerTokens: 3 }],
        activeBurdens: ["burden_smoke_over_hearths"]
      }
    };

    renderActionConsole({ actionMode: "interact", state });

    const arrivalButton = screen.getByText("Interact with Lest We Forget").closest("button");
    const burdenButton = screen.getByText("Interact with Smoke over Hearths").closest("button");

    expect(arrivalButton).toBeDisabled();
    expect(arrivalButton).toHaveTextContent("Requirement: Pay 4 Wood and 4 Metal.");
    expect(arrivalButton).toHaveTextContent("missing 4 wood");
    expect(burdenButton).toBeDisabled();
    expect(burdenButton).toHaveTextContent("Spend 1 Action and pay 2 Goods");
    expect(burdenButton).toHaveTextContent("missing 2 goods");
  });

  it("resolves a valid Burden from the interact list", () => {
    const onResolveBurden = vi.fn();
    const state = {
      ...createNewGame(1, ["vanguard"]),
      phase: "turns" as const,
      warehouse: { wood: 0, stone: 0, metal: 0, food: 0, herbs: 0, goods: 2 },
      encounters: {
        ...createNewGame(1, ["vanguard"]).encounters,
        activeBurdens: ["burden_smoke_over_hearths"]
      }
    };

    renderActionConsole({ actionMode: "interact", onResolveBurden, state });

    fireEvent.click(screen.getByText("Interact with Smoke over Hearths"));

    expect(onResolveBurden).toHaveBeenCalledWith("burden_smoke_over_hearths");
  });

  it("shows a single clear end-turn action in end mode", () => {
    const onEndTurn = vi.fn();
    const state = {
      ...createNewGame(1, ["vanguard"]),
      phase: "turns" as const,
      actionsRemaining: 0
    };

    renderActionConsole({ actionMode: "end", onEndTurn, state });

    fireEvent.click(screen.getByRole("button", { name: "End Player 1's Turn" }));

    expect(onEndTurn).toHaveBeenCalledOnce();
  });
});
