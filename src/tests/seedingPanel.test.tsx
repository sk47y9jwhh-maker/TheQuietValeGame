import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SeedingPanel } from "../components/seeding/SeedingPanel";
import { encounterById } from "../data/encounters";
import { createNewGame } from "../engine/setup";

describe("seeding panel", () => {
  it("lets players right-click a card into a seed slot", () => {
    const state = { ...createNewGame(1, ["vanguard"]), phase: "seeding" as const };
    const hand = state.encounters.handsByPlayerId.player_1;
    const targetCardId = hand[3];

    render(<SeedingPanel state={state} onConfirm={() => {}} />);

    const cardTitle = screen
      .getAllByText(encounterById[targetCardId].name)
      .find((element) => element.tagName === "STRONG");
    expect(cardTitle).toBeTruthy();

    fireEvent.contextMenu(cardTitle as HTMLElement);
    fireEvent.click(screen.getByRole("button", { name: "Seed Top" }));

    expect(screen.getByLabelText("Top")).toHaveValue(targetCardId);
  });
});
