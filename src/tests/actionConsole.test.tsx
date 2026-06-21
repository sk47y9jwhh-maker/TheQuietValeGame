import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ActionConsole } from "../components/actions/ActionConsole";
import { getDefaultPlaceTileId } from "../components/actions/placeTileChoices";
import { placeTile } from "../engine/gameActions";
import { createNewGame } from "../engine/setup";
import type { ComponentProps } from "react";

function renderActionConsole(
  overrides: Partial<ComponentProps<typeof ActionConsole>> = {}
) {
  const state = { ...createNewGame(1, ["vanguard"]), phase: "turns" as const };

  return render(
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

describe("action console", () => {
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

    const arrivalButton = screen.getByText("Complete Lest We Forget").closest("button");
    const burdenButton = screen.getByText("Resolve Smoke over Hearths").closest("button");

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

    fireEvent.click(screen.getByText("Resolve Smoke over Hearths"));

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
