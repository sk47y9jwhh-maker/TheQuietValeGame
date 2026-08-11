import { describe, expect, it } from "vitest";
import { arrivals, boons, burdens, goldenBoons } from "../data/encounters";
import {
  canonicalArrivalText,
  canonicalBoonText,
  canonicalBurdenText,
  canonicalGoldenBoonText
} from "../data/encounterText.generated";
import type { SeasonEffectText } from "../engine/types";

const seasons = ["season1", "season2", "season3"] as const;

function expectWithinLimit(
  cardId: string,
  field: string,
  text: string | undefined,
  limit: number
) {
  expect(text, `${cardId} ${field} is missing`).toBeTruthy();
  expect(
    text?.length ?? 0,
    `${cardId} ${field} exceeds its ${limit}-character template limit`
  ).toBeLessThanOrEqual(limit);
}

function expectSeasonFieldsWithinLimit(
  cardId: string,
  field: string,
  values: SeasonEffectText,
  limit: number
) {
  for (const season of seasons) {
    expectWithinLimit(cardId, `${field} ${season}`, values[season], limit);
  }
}

describe("locked encounter-card template fit", () => {
  it("applies the complete canonical workbook export to every runtime card", () => {
    expect(Object.keys(canonicalBoonText).sort()).toEqual(
      boons.map((card) => card.id).sort()
    );
    expect(Object.keys(canonicalBurdenText).sort()).toEqual(
      burdens.map((card) => card.id).sort()
    );
    expect(Object.keys(canonicalArrivalText).sort()).toEqual(
      arrivals.map((card) => card.id).sort()
    );
    expect(Object.keys(canonicalGoldenBoonText).sort()).toEqual(
      goldenBoons.map((card) => card.id).sort()
    );

    for (const card of boons) {
      expect({
        name: card.name,
        flavorText: card.flavorText,
        effects: card.effects,
        lifecycles: card.lifecycles
      }).toEqual(canonicalBoonText[card.id]);
    }

    for (const card of burdens) {
      expect({
        name: card.name,
        flavorText: card.flavorText,
        effects: card.effects,
        resolutions: card.resolutions
      }).toEqual(canonicalBurdenText[card.id]);
    }

    for (const card of arrivals) {
      expect({
        name: card.name,
        flavorText: card.flavorText,
        requirementText: card.requirementText,
        rewardText: card.rewardText
      }).toEqual(canonicalArrivalText[card.id]);
    }

    for (const card of goldenBoons) {
      expect({
        name: card.name,
        flavorText: card.flavorText,
        effectText: card.effectText,
        lifecycle: card.lifecycle
      }).toEqual(canonicalGoldenBoonText[card.id]);
    }
  });

  it("keeps every canonical Boon field within its calibrated PSD limit", () => {
    expect(boons).toHaveLength(27);

    for (const card of boons) {
      expectWithinLimit(card.id, "name", card.name, 24);
      expectWithinLimit(card.id, "flavour", card.flavorText, 190);
      expectSeasonFieldsWithinLimit(card.id, "effect", card.effects, 110);
      expectSeasonFieldsWithinLimit(
        card.id,
        "lifecycle",
        card.lifecycles ?? {
          season1: card.lifecycle,
          season2: card.lifecycle,
          season3: card.lifecycle
        },
        65
      );
    }
  });

  it("keeps every canonical Burden field within its calibrated PSD limit", () => {
    expect(burdens).toHaveLength(27);

    for (const card of burdens) {
      expectWithinLimit(card.id, "name", card.name, 24);
      expectWithinLimit(card.id, "flavour", card.flavorText, 200);
      expectSeasonFieldsWithinLimit(card.id, "effect", card.effects, 110);
      expectSeasonFieldsWithinLimit(
        card.id,
        "resolution",
        card.resolutions ?? {
          season1: card.resolutionText ?? "",
          season2: card.resolutionText ?? "",
          season3: card.resolutionText ?? ""
        },
        65
      );
    }
  });

  it("keeps every canonical Arrival field within its calibrated PSD limit", () => {
    expect(arrivals).toHaveLength(25);

    for (const card of arrivals) {
      expectWithinLimit(card.id, "name", card.name, 24);
      expectWithinLimit(card.id, "flavour", card.flavorText, 235);
      expectWithinLimit(card.id, "requirement", card.requirementText, 60);
      expectWithinLimit(card.id, "reward", card.rewardText, 40);
    }
  });

  it("keeps every canonical Golden Boon field within its calibrated PSD limit", () => {
    expect(goldenBoons).toHaveLength(5);

    for (const card of goldenBoons) {
      expectWithinLimit(card.id, "name", card.name, 28);
      expectWithinLimit(card.id, "flavour", card.flavorText, 230);
      expectWithinLimit(card.id, "effect", card.effectText, 430);
      expectWithinLimit(card.id, "lifecycle", card.lifecycle, 50);
    }
  });
});
