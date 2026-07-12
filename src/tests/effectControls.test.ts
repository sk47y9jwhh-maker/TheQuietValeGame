import { describe, expect, it } from "vitest";
import { cardEffectRuleId } from "../data/effectRules";
import { describeEffectControls } from "../engine/effectControls";

describe("typed effect controls", () => {
  it("describes broad resource exchanges without UI text parsing", () => {
    expect(
      describeEffectControls(cardEffectRuleId("boon_stores_made_ready", 2))
    ).toMatchObject({
      broadResourceChoice: true,
      hasResourceAction: true,
      timerChoice: false,
      tileChoice: false
    });
  });

  it("identifies timer controls", () => {
    expect(
      describeEffectControls(cardEffectRuleId("boon_a_little_more_time", 2))
    ).toMatchObject({
      timerChoice: true,
      tileChoice: false
    });
  });

  it("limits named resource controls while retaining tile choices", () => {
    expect(
      describeEffectControls(cardEffectRuleId("burden_empty_shelves", 1))
    ).toMatchObject({
      mentionedResources: ["goods"],
      hasExplicitResourceAlternative: true,
      tileChoice: true
    });
  });
});
