import "@testing-library/jest-dom/vitest";
import { existsSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { coreTiles, specialTiles, goldenTiles } from "../data/tiles";
import { tileArtworkUrl } from "../components/common/TileArtwork";
import { TileInspectModal } from "../components/map/TileInspectModal";
import { HexMap } from "../components/map/HexMap";
import { createNewGame } from "../engine/setup";

describe("approved tile artwork", () => {
  it("ships full and small artwork for every playable face and Travel extension", () => {
    for (const tile of [...coreTiles, ...specialTiles, ...goldenTiles]) {
      for (const side of ("basic" in tile ? ["basic", "upgraded"] as const : ["basic"] as const)) {
        for (const thumbnail of [false, true]) {
          const url = tileArtworkUrl(tile.id, side, { thumbnail });
          expect(existsSync(`public/${url.replace(/^\//, "")}`), url).toBe(true);
        }
      }
    }
    for (const side of ["basic", "upgraded"] as const) {
      expect(existsSync(`public/${tileArtworkUrl("c16_street", side, { extension: true }).replace(/^\//, "")}`)).toBe(true);
    }
  });
  it("shows both Core faces and the Golden face in inspection", () => {
    const state=createNewGame(1,["vanguard"]);
    const view=render(<TileInspectModal state={state} tileId="c05_cabin" onClose={()=>{}} />);
    expect(screen.getByAltText("Cabin tile face")).toHaveAttribute("src",expect.stringContaining("c05_cabin-basic.webp"));
    expect(screen.getByAltText("Fine Cabin tile face")).toHaveAttribute("src",expect.stringContaining("c05_cabin-upgraded.webp"));
    view.rerender(<TileInspectModal state={state} tileId="golden_tile_the_golden_hearth" onClose={()=>{}} />);
    expect(screen.getByAltText("The Golden Hearth tile face")).toBeInTheDocument();
  });
  it("uses extension artwork for a Track footprint and repeats the Stables front", () => {
    const state=createNewGame(1,["vanguard"]);
    state.phase="turns";
    state.map.placedTiles=[
      {instanceId:"track",tileId:"c17_track",kind:"core",side:"upgraded",hexIds:["G1","G2","G3"],strain:0,support:{passive:false,singleUse:false,preventedThisRound:false}},
      {instanceId:"stables",tileId:"special_stables",kind:"special",side:"special",hexIds:["F1","F2"],strain:0,support:{passive:false,singleUse:false,preventedThisRound:false}}
    ];
    const {container}=render(<HexMap state={state} selectedTileId="" actionMode="activate" selectedHexIds={[]} placementOrientation={0} onHexSelect={()=>{}} />);
    const sources=[...container.querySelectorAll(".hex-tile-artwork")].map(im=>im.getAttribute("href"));
    expect(sources.filter(s=>s?.includes("travel-extension-upgraded-map.webp"))).toHaveLength(2);
    expect(sources.filter(s=>s?.includes("special_stables-map.webp"))).toHaveLength(2);
  });
});
