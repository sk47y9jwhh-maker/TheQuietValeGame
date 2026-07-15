import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TileInspectModal } from "../components/map/TileInspectModal";
import { createNewGame } from "../engine/setup";

describe("tile inspector", () => {
  it("shows Linked Production on both sides of a Core Resource Tile", () => {
    const state = createNewGame(1, ["vanguard"]);

    render(
      <TileInspectModal
        state={state}
        tileId="c01_lumber_yard"
        onClose={() => {}}
      />
    );

    expect(screen.getByRole("heading", { name: "Lumber Yard" })).toBeInTheDocument();
    expect(screen.getByText("Supply 3/3")).toBeInTheDocument();
    const effectTexts = screen.getAllByText(/Passive: Linked Production/);
    expect(effectTexts).toHaveLength(2);
    expect(effectTexts[0]).toHaveTextContent(
      /every immediately adjacent, non-Overstrained producer from the same tile stack/i
    );
    expect(effectTexts[0]).toHaveTextContent(
      /Later activations that round produce only from the chosen tile/i
    );
  });
});
