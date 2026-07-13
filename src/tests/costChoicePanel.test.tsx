import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CostChoicePanel } from "../components/effects/CostChoicePanel";
import { createNewGame } from "../engine/setup";
import type { PendingCostChoiceState } from "../engine/types";

describe("cost choice panel", () => {
  it("shows the Merchant exchange dropdown immediately and applies its selection", () => {
    const state = createNewGame(1, ["vanguard"]);
    state.warehouse = {
      ...state.warehouse,
      wood: 2,
      goods: 2
    };
    const pending: PendingCostChoiceState = {
      id: "cost_market",
      title: "Upgrade Path",
      action: {
        type: "upgrade",
        playerId: state.currentPlayerId,
        placedTileId: "tile_path"
      },
      baseCost: {
        wood: 2,
        stone: 0,
        metal: 0,
        food: 0,
        herbs: 0,
        goods: 0
      },
      actionCost: 1,
      boonModifierIds: [],
      options: [
        {
          id: "tile_market:market",
          sourceTileId: "tile_market",
          sourceName: "Market Stalls",
          effectText:
            "Passive: Once per round, when paying a cost, you may spend 1 Goods as 1 resource of any type.",
          kind: "market",
          cadence: "round",
          marketRate: 1,
          resourceChoices: ["wood"]
        }
      ]
    };
    const onConfirm = vi.fn();

    render(
      <CostChoicePanel
        state={state}
        pending={pending}
        onConfirm={onConfirm}
        onCancel={() => {}}
      />
    );

    expect(screen.getByText("Merchant exchange available")).toBeInTheDocument();
    const exchange = screen.getByRole("combobox", {
      name: "Market Stalls: exchange 1 Goods for"
    });
    expect(exchange).toHaveValue("");
    expect(
      screen.getByRole("option", { name: "Do not use this exchange" })
    ).toBeInTheDocument();

    fireEvent.change(exchange, { target: { value: "wood" } });

    expect(exchange).toHaveValue("wood");
    expect(
      screen.getByText(/adjusted cost above includes this exchange/i)
    ).toBeInTheDocument();
    expect(screen.getByText("Adjusted Cost").closest(".cost-line")).toHaveTextContent(
      "1 Wood, 1 Goods"
    );

    fireEvent.click(screen.getByRole("button", { name: "Confirm Payment" }));

    expect(onConfirm).toHaveBeenCalledWith({
      selectedOptionIds: ["tile_market:market"],
      marketResourceByOptionId: { "tile_market:market": "wood" },
      discountResourceByOptionId: {}
    });
  });
});
