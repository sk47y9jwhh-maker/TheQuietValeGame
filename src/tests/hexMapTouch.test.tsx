import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { coreTiles } from "../data/tiles";
import { HexMap } from "../components/map/HexMap";
import { placeTile } from "../engine/gameActions";
import { createNewGame } from "../engine/setup";

describe("hex map touch controls", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens the map context menu callback on long press", () => {
    vi.useFakeTimers();
    const onHexSelect = vi.fn();
    const onHexContextMenu = vi.fn();
    const state = {
      ...createNewGame(1, ["vanguard"]),
      phase: "turns" as const
    };

    render(
      <HexMap
        state={state}
        selectedTileId={coreTiles[0].id}
        actionMode="place"
        selectedHexIds={[]}
        placementOrientation={3}
        onHexSelect={onHexSelect}
        onHexContextMenu={onHexContextMenu}
      />
    );

    fireEvent.touchStart(screen.getByRole("button", { name: /^G1,/ }), {
      touches: [{ clientX: 120, clientY: 160 }]
    });
    vi.advanceTimersByTime(600);

    expect(onHexContextMenu).toHaveBeenCalledWith("G1", { x: 120, y: 160 });
    expect(onHexSelect).not.toHaveBeenCalled();
  });

  it("cancels a long press when the player drags the map", () => {
    vi.useFakeTimers();
    const onHexContextMenu = vi.fn();
    const state = {
      ...createNewGame(1, ["vanguard"]),
      phase: "turns" as const
    };
    render(
      <HexMap
        state={state}
        selectedTileId={coreTiles[0].id}
        actionMode="place"
        selectedHexIds={[]}
        placementOrientation={3}
        onHexSelect={vi.fn()}
        onHexContextMenu={onHexContextMenu}
      />
    );

    const hex = screen.getByRole("button", { name: /^G1,/ });
    fireEvent.touchStart(hex, { touches: [{ clientX: 120, clientY: 160 }] });
    fireEvent.touchMove(hex, { touches: [{ clientX: 150, clientY: 188 }] });
    vi.advanceTimersByTime(600);

    expect(onHexContextMenu).not.toHaveBeenCalled();
  });

  it("selects a focused hex with Enter or Space", () => {
    const onHexSelect = vi.fn();
    const state = {
      ...createNewGame(1, ["vanguard"]),
      phase: "turns" as const
    };

    render(
      <HexMap
        state={state}
        selectedTileId={coreTiles[0].id}
        actionMode="place"
        selectedHexIds={[]}
        placementOrientation={3}
        onHexSelect={onHexSelect}
        onHexContextMenu={vi.fn()}
      />
    );

    const hex = screen.getByRole("button", { name: /^G1,/ });
    fireEvent.keyDown(hex, { key: "Enter" });
    fireEvent.keyDown(hex, { key: " " });

    expect(onHexSelect).toHaveBeenNthCalledWith(1, "G1");
    expect(onHexSelect).toHaveBeenNthCalledWith(2, "G1");
  });

  it("opens tile inspection from a placed tile inspect control", () => {
    const onTileInspect = vi.fn();
    const state = {
      ...placeTile(
        { ...createNewGame(1, ["vanguard"]), phase: "turns" as const },
        "player_1",
        "c01_lumber_yard",
        "G1"
      ),
      phase: "turns" as const
    };
    const placedTile = state.map.placedTiles[0];

    const view = render(
      <HexMap
        state={state}
        selectedTileId={coreTiles[0].id}
        actionMode="place"
        selectedHexIds={[]}
        placementOrientation={3}
        onHexSelect={vi.fn()}
        onHexContextMenu={vi.fn()}
        onTileInspect={onTileInspect}
      />
    );

    const inspectControl = screen.getByRole("button", { name: "Inspect Lumber Yard" });
    expect(inspectControl).toHaveAttribute("tabindex", "-1");

    view.rerender(
      <HexMap
        state={state}
        selectedTileId={coreTiles[0].id}
        actionMode="place"
        selectedHexIds={["G1"]}
        placementOrientation={3}
        onHexSelect={vi.fn()}
        onHexContextMenu={vi.fn()}
        onTileInspect={onTileInspect}
      />
    );

    const activeInspectControl = screen.getByRole("button", {
      name: "Inspect Lumber Yard"
    });
    expect(activeInspectControl).toHaveAttribute("tabindex", "0");
    fireEvent.click(activeInspectControl);

    expect(onTileInspect).toHaveBeenCalledWith(placedTile.instanceId);
  });
});
