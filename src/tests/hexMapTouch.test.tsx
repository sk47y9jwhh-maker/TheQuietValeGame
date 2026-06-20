import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { coreTiles } from "../data/tiles";
import { HexMap } from "../components/map/HexMap";
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
});
