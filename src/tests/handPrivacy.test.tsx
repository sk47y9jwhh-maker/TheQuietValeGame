import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createNewGame } from "../engine/setup";
import { PrivateHandGate } from "../components/common/PrivateHandGate";
import { BottomDrawer } from "../components/panels/BottomDrawer";

beforeEach(() => { window.localStorage.clear(); window.history.replaceState(null, "", "/?experience=tabletop"); });
afterEach(() => window.history.replaceState(null, "", "/"));

describe("shared-device hand privacy", () => {
  it("requires a new reveal after every owner change, including undo back to an earlier owner", () => {
    const state = createNewGame(2, ["vanguard", "knight"]);
    const other = { ...state, currentPlayerId: state.players[1].id };
    const { rerender } = render(<PrivateHandGate state={state}><p>First private cards</p></PrivateHandGate>);
    expect(screen.queryByText("First private cards")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reveal Vanguard’s hand" }));
    expect(screen.getByText("First private cards")).toBeVisible();
    rerender(<PrivateHandGate state={other}><p>Second private cards</p></PrivateHandGate>);
    expect(screen.queryByText("Second private cards")).not.toBeInTheDocument();
    rerender(<PrivateHandGate state={state}><p>First private cards</p></PrivateHandGate>);
    expect(screen.queryByText("First private cards")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reveal Vanguard’s hand" }));
    fireEvent.click(screen.getByRole("button", { name: "Hide hand" }));
    expect(screen.queryByText("First private cards")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pass to Player 1." })).toHaveFocus();
  });

  it("resets the reveal at a new season and when the reference hand closes", () => {
    const state = createNewGame(2, ["vanguard", "knight"]);
    const { rerender } = render(<BottomDrawer state={state} onTileInspect={() => {}} />);
    fireEvent.click(screen.getByRole("tab", { name: /Hand.*hidden/ }));
    fireEvent.click(screen.getByRole("button", { name: "Reveal Vanguard’s hand" }));
    expect(screen.getByRole("button", { name: "Hide hand" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Close reference tray" }));
    fireEvent.click(screen.getByRole("tab", { name: /Hand.*hidden/ }));
    expect(screen.getByRole("button", { name: "Reveal Vanguard’s hand" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Reveal Vanguard’s hand" }));
    rerender(<BottomDrawer state={{ ...state, season: 2 }} onTileInspect={() => {}} />);
    expect(within(screen.getByRole("region", { name: "Hand" })).getByRole("button", { name: "Reveal Vanguard’s hand" })).toBeVisible();
  });

  it("keeps solo and baseline play direct", () => {
    const { rerender } = render(<PrivateHandGate state={createNewGame(1, ["vanguard"])}><p>Solo hand</p></PrivateHandGate>);
    expect(screen.getByText("Solo hand")).toBeVisible();
    window.history.replaceState(null, "", "/?experience=classic");
    rerender(<PrivateHandGate state={createNewGame(2, ["vanguard", "knight"])}><p>Baseline hand</p></PrivateHandGate>);
    expect(screen.getByText("Baseline hand")).toBeVisible();
  });
});
