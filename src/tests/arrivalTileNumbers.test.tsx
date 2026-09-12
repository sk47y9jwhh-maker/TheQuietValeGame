import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { arrivals } from "../data/encounters";
import { specialTiles } from "../data/tiles";
import { specialTileBackNumbers } from "../data/specialTileNumbers";
import { getArrivalRewardText } from "../components/common/gameText";
import { EncounterCard } from "../components/common/EncounterCard";

describe("Arrival unlock back numbers", () => {
  it("matches the full production back numbering and covers every Arrival reward", () => {
    let number=0;
    for(const tile of specialTiles) expect(specialTileBackNumbers[tile.id]).toEqual(Array.from({length:tile.count},()=>++number));
    for(const card of arrivals){
      for(const id of card.rewardSpecialTileIds) expect(specialTileBackNumbers[id]).toBeDefined();
      expect(getArrivalRewardText(card)).toMatch(/^Unlock Special Tiles? \d/);
    }
  });
  it.each(["web", "print"] as const)("shows the number before the tile name in %s mode", mode => {
    const card=arrivals.find(c=>c.name==="Blade to Herb")!;
    render(<EncounterCard card={card} outputMode={mode}/>);
    expect(screen.getByText("Unlock Special Tile 23 The Root Weavers Respite.")).toBeInTheDocument();
  });
  it("identifies both numbered Stables backs", () => {
    const card=arrivals.find(c=>c.rewardSpecialTileIds.includes("special_stables"))!;
    expect(getArrivalRewardText(card)).toBe("Unlock Special Tiles 17 & 18 Stables.");
  });
});
