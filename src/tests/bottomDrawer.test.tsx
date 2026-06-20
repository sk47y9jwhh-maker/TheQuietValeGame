import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BottomDrawer } from "../components/panels/BottomDrawer";
import { createNewGame } from "../engine/setup";

describe("bottom drawer", () => {
  it("opens a reference section and minimises it again", () => {
    const state = {
      ...createNewGame(1, ["vanguard"]),
      phase: "turns" as const
    };

    render(<BottomDrawer state={state} />);

    expect(screen.queryByRole("heading", { name: "Tiles" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /tiles/i }));

    expect(screen.getByRole("heading", { name: "Tiles" })).toBeInTheDocument();
    expect(screen.getByText("Lumber Yard")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /close reference tray/i }));

    expect(screen.queryByRole("heading", { name: "Tiles" })).not.toBeInTheDocument();
  });
});
