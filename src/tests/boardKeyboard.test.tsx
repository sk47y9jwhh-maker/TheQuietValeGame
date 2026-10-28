import { useState } from "react";
import { TileInspectModal } from "../components/map/TileInspectModal";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HexMap } from "../components/map/HexMap";
import { createNewGame } from "../engine/setup";
import { placeTile } from "../engine/gameActions";
import type { GameState } from "../engine/types";

const props = { selectedTileId: "c01_lumber_yard", actionMode: "place", selectedHexIds: [] as string[], placementOrientation: 3 as const };
const fresh = (): GameState => ({ ...createNewGame(1, ["vanguard"]), phase: "turns" });
afterEach(() => window.history.replaceState(null, "", "/"));

describe("deliberate keyboard board navigation", () => {
  it.each(["tabletop"])("provides one hex Tab stop and spatial/corner browsing in %s without selecting", (experience) => {
    window.history.replaceState(null, "", `/?experience=${experience}`);
    const select = vi.fn();
    render(<HexMap {...props} state={fresh()} onHexSelect={select} />);
    const map = screen.getByRole("group", { name: "The Quiet Vale map" });
    const hex = (id: string) => within(map).getByRole("button", { name: new RegExp(`^${id},`) });
    expect(within(map).getAllByRole("button").filter((cell) => cell.tabIndex === 0)).toEqual([hex("G1")]);
    hex("G1").focus();
    fireEvent.keyDown(hex("G1"), { key: "ArrowDown" });
    expect(hex("G2")).toHaveFocus();
    fireEvent.keyDown(hex("G2"), { key: "ArrowRight" });
    expect(hex("H2")).toHaveFocus();
    fireEvent.keyDown(hex("H2"), { key: "End" });
    expect(hex("N2")).toHaveFocus();
    fireEvent.keyDown(hex("N2"), { key: "End", ctrlKey: true });
    expect(hex("N9")).toHaveFocus();
    fireEvent.keyDown(hex("N9"), { key: "ArrowDown" });
    expect(hex("N9")).toHaveFocus();
    fireEvent.keyDown(hex("N9"), { key: "Home", metaKey: true });
    expect(hex("A1")).toHaveFocus();
    expect(select).not.toHaveBeenCalled();
    expect(within(map).getAllByRole("button").filter((cell) => cell.tabIndex === 0)).toEqual([hex("A1")]);
    fireEvent.keyDown(hex("A1"), { key: "Enter" });
    expect(select).toHaveBeenCalledTimes(1);
    expect(select).toHaveBeenCalledWith("A1");
  });

  it("finds a coordinate without making a placement and explains invalid coordinates", () => {
    window.history.replaceState(null, "", "/?experience=tabletop");
    const select = vi.fn();
    render(<HexMap {...props} state={fresh()} onHexSelect={select} />);
    fireEvent.click(screen.getByText("Navigate", { exact: true }));
    const input = screen.getByRole("textbox", { name: "Hex coordinate" });
    fireEvent.change(input, { target: { value: "Z99" } });
    fireEvent.click(screen.getByRole("button", { name: "Find hex" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a coordinate from A1 to N9");
    fireEvent.change(input, { target: { value: " b8 " } });
    fireEvent.click(screen.getByRole("button", { name: "Find hex" }));
    expect(screen.getByRole("button", { name: /^B8,/ })).toHaveFocus();
    expect(select).not.toHaveBeenCalled();
    expect(input.closest("details")).not.toHaveAttribute("open");
    fireEvent.keyDown(screen.getByRole("button", { name: /^B8,/ }), { key: " " });
    expect(select).toHaveBeenCalledTimes(1);
    expect(select).toHaveBeenCalledWith("B8");
  });

  it("inspects a focused placed tile without selecting it, and preserves focus during resource updates", () => {
    window.history.replaceState(null, "", "/?experience=tabletop");
    const state = placeTile(fresh(), "player_1", "c01_lumber_yard", "G1");
    const select = vi.fn();
    const inspect = vi.fn();
    const view = render(<HexMap {...props} state={state} onHexSelect={select} onTileInspect={inspect} />);
    const hex = screen.getByRole("button", { name: /^G1,/ });
    hex.focus();
    fireEvent.keyDown(hex, { key: "i" });
    expect(inspect).toHaveBeenCalledTimes(1);
    expect(inspect).toHaveBeenCalledWith(state.map.placedTiles[0].instanceId);
    expect(select).not.toHaveBeenCalled();
    view.rerender(<HexMap {...props} state={{ ...state, warehouse: { ...state.warehouse, food: 1 } }} onHexSelect={select} onTileInspect={inspect} />);
    expect(hex).toHaveFocus();
    fireEvent.click(screen.getByText("Navigate", { exact: true }));
    fireEvent.click(screen.getByRole("button", { name: "Inspect Lumber Yard at G1" }));
    expect(inspect).toHaveBeenCalledTimes(2);
    expect(select).not.toHaveBeenCalled();
  });


  it("returns to the actual SVG hex after closing inspection", () => {
    window.history.replaceState(null, "", "/?experience=tabletop");
    const state = placeTile(fresh(), "player_1", "c01_lumber_yard", "G1");
    function Harness() {
      const [inspected, setInspected] = useState<string | null>(null);
      return <><HexMap {...props} state={state} onHexSelect={() => {}} onTileInspect={setInspected} />{inspected && <TileInspectModal state={state} placedTileId={inspected} onClose={() => setInspected(null)} />}</>;
    }
    render(<Harness />);
    const hex = screen.getByRole("button", { name: /^G1,/ });
    hex.focus();
    fireEvent.keyDown(hex, { key: "i" });
    expect(screen.getByRole("button", { name: "Close tile inspection" })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("button", { name: "Close tile inspection" }), { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(hex).toHaveFocus();
  });

  it("keeps external and detached drafts reflected in the entry point without moving focus", () => {
    window.history.replaceState(null, "", "/?experience=tabletop");
    const state = fresh();
    const select = vi.fn();
    const view = render(<HexMap {...props} state={state} onHexSelect={select} />);
    screen.getByRole("button", { name: "Zoom in" }).focus();
    view.rerender(<HexMap {...props} selectedHexIds={["G1", "B8"]} selectedTileId="special_stables" state={state} onHexSelect={select} />);
    expect(screen.getByRole("button", { name: "Zoom in" })).toHaveFocus();
    expect(screen.getByRole("button", { name: /^B8,/ })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("button", { name: /^G1,/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /^B8,/ })).toHaveAttribute("aria-pressed", "true");
    expect(select).not.toHaveBeenCalled();
  });
});
