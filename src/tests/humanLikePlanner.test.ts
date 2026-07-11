import { describe, expect, it } from "vitest";
import { createNewGame } from "../engine/setup";
import type { GameState, Season } from "../engine/types";
import { encounterById } from "../data/encounters";
import {
  buildCardIntent,
  chooseHumanLikeSeed,
} from "../../tools/playtest-bot/humanLikePlanner";

describe("human-like bot resource planning", () => {
  it.each([
    { season: 1 as Season, round: 1, expected: 2 },
    { season: 2 as Season, round: 5, expected: 4 },
    { season: 3 as Season, round: 9, expected: 6 },
  ])(
    "uses the Season $season Burden resolution cost",
    ({ season, round, expected }) => {
      const state: GameState = {
        ...createNewGame(1, ["vanguard"]),
        season,
        round,
      };

      expect(
        buildCardIntent(state, "burden_smoke_over_hearths").requiredResources,
      ).toEqual({ goods: expected });
      expect(
        buildCardIntent(state, "burden_forest_s_grudge").requiredResources,
      ).toEqual({ wood: expected });
    },
  );

  it("can reserve an early Burden for a Burden-dependent Ledger plan", () => {
    const initial = createNewGame(1, ["warden"]);
    const state: GameState = {
      ...initial,
      encounters: {
        ...initial.encounters,
        handsByPlayerId: {
          ...initial.encounters.handsByPlayerId,
          player_1: [
            "boon_shelter_holds",
            "arrival_the_dryads",
            "burden_smoke_over_hearths",
            "burden_forest_s_grudge",
          ],
        },
      },
    };

    const seeded = chooseHumanLikeSeed(state, "player_1", {
      minimumBurdens: 1,
      maximumBurdens: 1,
      preferEarlyBurden: true,
      burdenReason: "Ledger target requires a Burden this Season.",
    });

    expect(encounterById[seeded.selection.top].type).toBe("burden");
    expect(Object.values(seeded.selection).filter(
      (cardId) => encounterById[cardId].type === "burden"
    )).toHaveLength(1);
    expect(seeded.forecasts[0].reasonSeeded).toBe(
      "Ledger target requires a Burden this Season.",
    );
  });
});
