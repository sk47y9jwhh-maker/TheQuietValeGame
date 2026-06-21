import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { EncounterPanel } from "../components/panels/EncounterPanel";
import { createNewGame } from "../engine/setup";

function renderEncounterPanel(
  state = {
    ...createNewGame(1, ["vanguard"]),
    phase: "turns" as const
  },
  overrides: Partial<ComponentProps<typeof EncounterPanel>> = {}
) {
  return render(
    <EncounterPanel
      onUseFaceUpBoon={() => {}}
      state={state}
      {...overrides}
    />
  );
}

describe("encounter panel", () => {
  it("lets players complete arrivals directly from the encounter board", () => {
    const onCompleteArrival = vi.fn();
    const state = {
      ...createNewGame(1, ["vanguard"]),
      phase: "turns" as const,
      encounters: {
        ...createNewGame(1, ["vanguard"]).encounters,
        activeArrivals: [{ cardId: "arrival_acorns_and_oak_trees", timerTokens: 3 }]
      }
    };

    renderEncounterPanel(state, { onCompleteArrival });

    expect(screen.getByText("Shrine of Renewal")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Interact with Acorns & Oak Trees" })
    );

    expect(onCompleteArrival).toHaveBeenCalledWith("arrival_acorns_and_oak_trees");
  });

  it("lets players resolve burdens directly from the encounter board", () => {
    const onResolveBurden = vi.fn();
    const state = {
      ...createNewGame(1, ["vanguard"]),
      phase: "turns" as const,
      encounters: {
        ...createNewGame(1, ["vanguard"]).encounters,
        activeBurdens: ["burden_smoke_over_hearths"]
      }
    };

    renderEncounterPanel(state, { onResolveBurden });

    expect(screen.getAllByText(/Spend 1 Action and pay 2 Goods/).length).toBeGreaterThan(0);
    fireEvent.click(
      screen.getByRole("button", { name: "Interact with Smoke over Hearths" })
    );

    expect(onResolveBurden).toHaveBeenCalledWith("burden_smoke_over_hearths");
  });
});
