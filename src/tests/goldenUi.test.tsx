import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GoldenEffectPanel } from "../components/effects/GoldenEffectPanel";
import { GoldenTilePlacementPanel } from "../components/setup/GoldenTilePlacementPanel";
import { SetupPanel } from "../components/setup/SetupPanel";
import { goldenBoons } from "../data/encounters";
import { goldenTiles } from "../data/tiles";
import { createNewGame } from "../engine/setup";

describe("Golden Legacy interface", () => {
  it("offers independently unlocked Golden Tile and Boon setup choices", () => {
    const onGoldenTileChange = vi.fn();
    const onGoldenBoonChange = vi.fn();
    render(
      <SetupPanel
        playerCount={1}
        stewardIds={["vanguard"]}
        encounterSeed="QV-GOLDEN-UI"
        completedLedgerCount={5}
        availableGoldenTiles={[goldenTiles[0]]}
        availableGoldenBoons={[goldenBoons[0]]}
        onPlayerCountChange={() => {}}
        onStewardChange={() => {}}
        onEncounterSeedChange={() => {}}
        onGoldenTileChange={onGoldenTileChange}
        onGoldenBoonChange={onGoldenBoonChange}
        onShuffleSeed={() => {}}
        onStart={() => {}}
      />
    );

    fireEvent.change(screen.getByLabelText("Golden Tile"), {
      target: { value: goldenTiles[0].id }
    });
    fireEvent.change(screen.getByLabelText("Golden Boon"), {
      target: { value: goldenBoons[0].id }
    });
    expect(onGoldenTileChange).toHaveBeenCalledWith(goldenTiles[0].id);
    expect(onGoldenBoonChange).toHaveBeenCalledWith(goldenBoons[0].id);
  });

  it("provides a dedicated zero-action Golden Tile placement screen", () => {
    const state = createNewGame(1, ["vanguard"], {
      selectedGoldenTileId: goldenTiles[0].id
    });
    state.phase = "goldenSetup";
    const onConfirm = vi.fn();
    render(
      <GoldenTilePlacementPanel state={state} onConfirm={onConfirm} onSkip={() => {}} />
    );

    fireEvent.click(screen.getByRole("button", { name: /Place The Golden Charter/i }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("shows structured Golden Bell and Signet Ring resolutions", () => {
    const state = createNewGame(1, ["vanguard"]);
    const onResolveBell = vi.fn();
    const onResolveSignet = vi.fn();
    state.pendingGoldenEffect = {
      kind: "bell",
      cardId: goldenBoons[0].id,
      arrivalCardIds: state.encounters.reserveArrivalIds.slice(0, 3)
    };
    const { rerender } = render(
      <GoldenEffectPanel
        state={state}
        onResolveBell={onResolveBell}
        onResolveScroll={() => {}}
        onResolveSignet={onResolveSignet}
      />
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Complete this Arrival" })[0]);
    expect(onResolveBell).toHaveBeenCalledOnce();

    const signetState = {
      ...state,
      pendingGoldenEffect: {
        kind: "signet" as const,
        cardId: "golden_boon_the_golden_signet_ring"
      }
    };
    rerender(
      <GoldenEffectPanel
        state={signetState}
        onResolveBell={onResolveBell}
        onResolveScroll={() => {}}
        onResolveSignet={onResolveSignet}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Resolve without moving tiles" }));
    expect(onResolveSignet).toHaveBeenCalledWith([]);
  });
});
