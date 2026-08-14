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

  it("switches a shared Carts refresh instead of selecting two passives", () => {
    const state = createNewGame(1, ["vanguard"]);
    state.warehouse = { ...state.warehouse, stone: 4 };
    const pending: PendingCostChoiceState = {
      id: "cost_carts_refresh",
      title: "Upgrade Cabin",
      action: {
        type: "upgrade",
        playerId: state.currentPlayerId,
        placedTileId: "tile_cabin"
      },
      baseCost: {
        wood: 0,
        stone: 4,
        metal: 0,
        food: 0,
        herbs: 0,
        goods: 0
      },
      actionCost: 1,
      boonModifierIds: [],
      options: [
        {
          id: "workshop_a:discount",
          sourceTileId: "workshop_a",
          sourceName: "Workshop A",
          effectText: "Reduce an upgrade cost by 1 resource.",
          kind: "discount",
          cadence: "round",
          amount: 1,
          boonModifierId: "carts_1"
        },
        {
          id: "workshop_b:discount",
          sourceTileId: "workshop_b",
          sourceName: "Workshop B",
          effectText: "Reduce an upgrade cost by 2 resources.",
          kind: "discount",
          cadence: "round",
          amount: 2,
          boonModifierId: "carts_1"
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

    const workshopA = screen.getByRole("button", { name: /Workshop A/ });
    const workshopB = screen.getByRole("button", { name: /Workshop B/ });
    fireEvent.click(workshopA);
    expect(workshopA).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Adjusted Cost").closest(".cost-line"))
      .toHaveTextContent("3 Stone");

    fireEvent.click(workshopB);
    expect(workshopA).toHaveAttribute("aria-pressed", "false");
    expect(workshopB).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Adjusted Cost").closest(".cost-line"))
      .toHaveTextContent("2 Stone");
    expect(screen.getAllByText(/choose at most one eligible passive/i)).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Confirm Payment" }));
    expect(onConfirm).toHaveBeenCalledWith({
      selectedOptionIds: ["workshop_b:discount"],
      marketResourceByOptionId: {},
      discountResourceByOptionId: {}
    });
  });

  it("selects the two required additional resources for a Burden surcharge", () => {
    const state = createNewGame(1, ["vanguard"]);
    state.warehouse = { ...state.warehouse, wood: 2 };
    const options: PendingCostChoiceState["options"] = [1, 2].map((index) => ({
      id: `burden:plans:${index}`,
      sourceTileId: "plans",
      sourceKind: "boon" as const,
      sourceName: `Plans Left Waiting (${index}/2)`,
      effectText: "This placement costs 2 more resources.",
      kind: "surcharge" as const,
      cadence: "round" as const,
      amount: 1,
      resourceChoices: ["wood", "stone"] as const,
      required: true
    }));
    const pending: PendingCostChoiceState = {
      id: "cost_plans",
      title: "Place Lumber Yard",
      action: {
        type: "place",
        playerId: state.currentPlayerId,
        tileId: "c01_lumber_yard",
        placementDraft: { anchorHexId: "G1" }
      },
      baseCost: {
        wood: 0,
        stone: 0,
        metal: 0,
        food: 0,
        herbs: 0,
        goods: 0
      },
      actionCost: 1,
      boonModifierIds: ["plans"],
      options
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

    expect(screen.getAllByLabelText("Additional resource")).toHaveLength(2);
    expect(screen.getByText("Adjusted Cost").closest(".cost-line"))
      .toHaveTextContent("2 Wood");

    fireEvent.click(screen.getByRole("button", { name: "Confirm Payment" }));

    expect(onConfirm).toHaveBeenCalledWith({
      selectedOptionIds: ["burden:plans:1", "burden:plans:2"],
      marketResourceByOptionId: {},
      discountResourceByOptionId: {},
      surchargeResourceByOptionId: {
        "burden:plans:1": "wood",
        "burden:plans:2": "wood"
      }
    });
  });

  it("shows Waystation changing an Arrival from 1 Action to 0 Actions", () => {
    const state = createNewGame(1, ["vanguard"]);
    state.actionsRemaining = 0;
    const pending: PendingCostChoiceState = {
      id: "cost_waystation",
      title: "Complete Arrival",
      action: {
        type: "arrival",
        playerId: state.currentPlayerId,
        cardId: "arrival_the_quiet_quest"
      },
      baseCost: {
        wood: 0,
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
          id: "waystation:discount",
          sourceTileId: "waystation",
          sourceName: "The Waystation",
          effectText:
            "Passive: Once per round, complete 1 Arrival for 0 Actions. Pay its cost and follow normal rules.",
          kind: "discount",
          cadence: "round",
          amount: 0,
          waivesAction: true
        }
      ]
    };

    render(
      <CostChoicePanel
        state={state}
        pending={pending}
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    );

    expect(screen.getByText("Action Cost").closest(".cost-line")).toHaveTextContent(
      "1 Action"
    );
    const confirm = screen.getByRole("button", { name: "Confirm Payment" });
    expect(confirm).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /The Waystation/ }));

    expect(screen.getByText("Action Cost").closest(".cost-line")).toHaveTextContent(
      "0 Actions"
    );
    expect(confirm).toBeEnabled();
  });
});
