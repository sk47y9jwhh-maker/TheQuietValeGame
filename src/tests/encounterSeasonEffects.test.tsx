import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EncounterSeasonEffects } from "../components/common/EncounterSeasonEffects";
import { encounterById } from "../data/encounters";

describe("encounter season effects", () => {
  it("shows all three season effects for Boons and Burdens", () => {
    render(
      <EncounterSeasonEffects
        card={encounterById.boon_a_little_more_time}
        currentSeason={2}
      />
    );

    expect(screen.getByText("Season I")).toBeInTheDocument();
    expect(screen.getByText("Season II")).toBeInTheDocument();
    expect(screen.getByText("Season III")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Add up to 3 timer tokens among active Arrivals, to a maximum of 3 on each."
      )
    ).toBeInTheDocument();
  });

  it("shows Arrival requirements in the same rules block", () => {
    render(
      <EncounterSeasonEffects
        card={encounterById.arrival_the_quiet_quest}
        currentSeason={1}
      />
    );

    expect(screen.getByText("Requirement")).toBeInTheDocument();
    expect(screen.getByText("Pay 4 Goods and 2 Herbs.")).toBeInTheDocument();
  });

  it("shows Burden resolution costs alongside season effects", () => {
    render(
      <EncounterSeasonEffects
        card={encounterById.burden_smoke_over_hearths}
        currentSeason={2}
      />
    );

    expect(screen.getByText("Current Cost")).toBeInTheDocument();
    expect(
      screen.getByText("Spend 1 Action and pay 4 Goods. Then discard.")
    ).toBeInTheDocument();
    expect(screen.getByText("To Resolve")).toBeInTheDocument();
    expect(
      screen.getByText("Spend 1 Action and pay 2/4/6 Goods by Season. Then discard.")
    ).toBeInTheDocument();
  });
});
