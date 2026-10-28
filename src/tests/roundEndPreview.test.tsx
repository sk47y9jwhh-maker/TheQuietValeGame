import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../app/App";
import { readSavedGame, writeSavedGame } from "../app/persistence";
import snapshots from "../app/scenarios.generated.json";
import { RoundEndPreview } from "../components/actions/RoundEndPreview";
import { encounterById } from "../data/encounters";
import { resolveEndRound } from "../engine/gameActions";
import { createNewGame } from "../engine/setup";
import type { GameState } from "../engine/types";

afterEach(() => { window.localStorage.clear(); window.history.replaceState(null, "", "/"); });

function endOfRound(round: number): GameState {
  const state = createNewGame(1, ["vanguard"]);
  return { ...state, phase: "endRound", round, season: round <= 4 ? 1 : round <= 8 ? 2 : 3, encounters: { ...state.encounters,
    activeArrivals: [{ cardId: "arrival_the_quiet_quest", timerTokens: 1 }, { cardId: "arrival_lanterns_for_roads", timerTokens: 3 }],
    activeBurdens: ["burden_smoke_over_hearths"],
    faceUpBoons: [{ cardId: "boon_a_little_more_time", remainingUses: 1 }, { cardId: "golden_boon_the_golden_bell", remainingUses: 1 }]
  } };
}

describe("public round-end preview", () => {
  it("resolves a real seasonal queue before exposing the next private seeding hand", () => {
    window.history.replaceState(null, "", "/?experience=tabletop");
    const state: GameState = { ...snapshots.settlement.state as unknown as GameState, phase: "endRound", round: 4 };
    writeSavedGame({ playerCount: 2, stewardIds: ["vanguard", "knight"], encounterSeed: "QV-COMPARISON-1", state });
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Resolve End Round" }));
    expect(screen.getByText("Season transition")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Reveal Vanguard’s hand" })).not.toBeInTheDocument();
    // This existing fixture has no strained Housing beside Travel, so its Omen has no target.
    fireEvent.click(screen.getByRole("button", { name: "Acknowledge" }));
    expect(screen.getByRole("heading", { name: "Pass to Player 1." })).toHaveFocus();
    expect(readSavedGame()?.state.season).toBe(2);
    expect(readSavedGame()?.state.pendingEffects).toHaveLength(0);
    expect(readSavedGame()?.state.encounters.faceUpBoons).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Reveal Vanguard’s hand" }));
    expect(screen.getByText("0 of 3 cards chosen")).toBeVisible();
    expect(screen.getAllByRole("article")).toHaveLength(6);
    expect(screen.getByText(/Read the Season II effect/)).toBeVisible();
  });

  it("explains the next season and its changed Burden text before the engine transitions", () => {
    const state = endOfRound(4);
    const original = JSON.stringify(state);
    render(<RoundEndPreview state={state} />);
    expect(screen.getByText("Next · Season II, Round 5")).toBeVisible();
    expect(screen.getByText("1 Arrival expires unresolved")).toBeVisible();
    expect(screen.getByText("2 remaining")).toBeVisible();
    const section = screen.getByText("Boons leaving play").parentElement!;
    expect(section).toHaveTextContent(encounterById.boon_a_little_more_time.name);
    expect(section).not.toHaveTextContent(encounterById.golden_boon_the_golden_bell.name);
    const burden = encounterById.burden_smoke_over_hearths;
    if (burden.type !== "burden") throw new Error("Expected the approved Burden fixture.");
    expect(screen.getByText(burden.effects.season2)).toBeInTheDocument();
    expect(JSON.stringify(state)).toBe(original);
    const next = resolveEndRound(state);
    expect(next.phase).toBe("seeding");
    expect(next.season).toBe(2);
    expect(next.encounters.activeArrivals).toEqual([{ cardId: "arrival_lanterns_for_roads", timerTokens: 2 }]);
    expect(next.encounters.faceUpBoons.map((boon) => boon.cardId)).toEqual(["golden_boon_the_golden_bell"]);
    expect(next.pendingEffects.some((effect) => effect.sourceId === "burden_smoke_over_hearths")).toBe(true);
  });

  it("distinguishes ordinary rounds, Season III and final scoring without promising a fourth season", () => {
    const { rerender } = render(<RoundEndPreview state={endOfRound(3)} />);
    expect(screen.getByText("Next · Round 4")).toBeVisible();
    expect(screen.queryByText("Boons leaving play")).not.toBeInTheDocument();
    expect(screen.queryByText("A new season begins")).not.toBeInTheDocument();
    rerender(<RoundEndPreview state={endOfRound(8)} />);
    expect(screen.getByText("Next · Season III, Round 9")).toBeVisible();
    rerender(<RoundEndPreview state={endOfRound(12)} />);
    const preview = screen.getByRole("region", { name: "What happens at round end" });
    expect(within(preview).getByText("Next · Final scoring")).toBeVisible();
    expect(screen.queryByText("A new season begins")).not.toBeInTheDocument();
  });
});
