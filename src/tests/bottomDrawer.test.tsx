import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BottomDrawer } from "../components/panels/BottomDrawer";
import { createNewGame } from "../engine/setup";

describe("bottom drawer", () => {
  it("opens a reference section and minimises it again", () => {
    const state = {
      ...createNewGame(1, ["vanguard"]),
      phase: "turns" as const
    };

    const { container } = render(
      <BottomDrawer state={state} onTileInspect={() => {}} />
    );

    expect(screen.queryByRole("heading", { name: "Tiles" })).not.toBeInTheDocument();
    expect(container.querySelectorAll(".tray-tabs svg")).toHaveLength(0);

    fireEvent.click(screen.getByRole("tab", { name: /tiles/i }));

    expect(screen.getByRole("heading", { name: "Tiles" })).toBeInTheDocument();
    expect(screen.getByText("Lumber Yard")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /close reference tray/i }));

    expect(screen.queryByRole("heading", { name: "Tiles" })).not.toBeInTheDocument();
  });

  it("shows unlocked special tiles first in the tile reference", () => {
    const baseState = createNewGame(1, ["vanguard"]);
    const state = {
      ...baseState,
      phase: "turns" as const,
      tileSupply: {
        ...baseState.tileSupply,
        special: {
          ...baseState.tileSupply.special,
          special_shrine_of_renewal: 1
        }
      }
    };

    const { container } = render(<BottomDrawer state={state} onTileInspect={() => {}} />);

    fireEvent.click(screen.getByRole("tab", { name: /tiles/i }));

    const firstTileName = container.querySelector(
      ".tile-reference-grid .tile-mini-card .tile-mini-card-heading strong"
    );
    expect(firstTileName).toHaveTextContent("Shrine of Renewal");
    expect(screen.getByText("Unlocked Special | Resource")).toBeInTheDocument();
    expect(
      screen.getByText("Place adjacent to a Lumber Yard / Sustainable Lumber Yard.")
    ).toBeInTheDocument();
  });

  it("opens tile inspection from tray tiles", () => {
    const onTileInspect = vi.fn();
    const state = {
      ...createNewGame(1, ["vanguard"]),
      phase: "turns" as const
    };

    render(<BottomDrawer state={state} onTileInspect={onTileInspect} />);

    fireEvent.click(screen.getByRole("tab", { name: /tiles/i }));
    fireEvent.click(screen.getByRole("button", { name: "Inspect Lumber Yard" }));

    expect(onTileInspect).toHaveBeenCalledWith("c01_lumber_yard");
  });

  it("provides a player-facing how-to guide and full game rules", () => {
    const state = {
      ...createNewGame(1, ["vanguard"]),
      phase: "turns" as const,
      actionsRemaining: 3
    };

    const { container } = render(
      <BottomDrawer state={state} onTileInspect={() => {}} />
    );

    fireEvent.click(screen.getByRole("tab", { name: /rules/i }));

    expect(screen.getByRole("heading", { name: "Rules" })).toBeInTheDocument();
    expect(screen.getByText("Playtester Guide")).toBeInTheDocument();
    expect(screen.getByText("Round 1/12")).toBeInTheDocument();
    expect(screen.getByText("3 actions left")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "How to play" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByText("The whole game at a glance")).toBeInTheDocument();
    expect(screen.getByText("Spend up to 4 actions")).toBeInTheDocument();
    expect(screen.getByText("Example first turn")).toBeInTheDocument();
    expect(screen.getByText(/Street and Track need a starting hex and direction/)).toBeInTheDocument();
    expect(screen.getByText(/progress saves automatically in this browser/)).toBeInTheDocument();
    expect(container.querySelectorAll(".how-to-card")).toHaveLength(6);
    expect(container.querySelectorAll(".rule-reference-card")).toHaveLength(0);

    fireEvent.click(screen.getByRole("tab", { name: "Full rules" }));

    expect(screen.getByText("Placement, reach, and movement")).toBeInTheDocument();
    expect(screen.getByText("Boons, Arrivals, and Burdens")).toBeInTheDocument();
    expect(screen.getByText(/each tile that became Overstrained spreads 1 Strain/)).toBeInTheDocument();
    expect(screen.getByText(/If the target also becomes Overstrained, it spreads next/)).toBeInTheDocument();
    expect(screen.queryByText(/After rounds 4 and 8/)).not.toBeInTheDocument();
    expect(screen.getByText("Final scoring")).toBeInTheDocument();
    expect(
      screen.getByText("Lose 5 Renown for each failed Arrival, each active Burden, and every Strain token on the map.")
    ).toBeInTheDocument();
    expect(screen.getByText("Achievements, Vows, and unlocks")).toBeInTheDocument();
    expect(container.querySelectorAll(".rule-reference-card")).toHaveLength(12);
  });
});
