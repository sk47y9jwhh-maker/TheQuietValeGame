# Steward Guides v6.9 (review edition, 2 November 2026)

Six A6 booklets, 20 pages each, one per Steward. They replace the v6.7 Steward
Aids for the next print run. The v6.6 locked archive is unchanged.

Rebuild from the repository root:

```bash
python3 design/steward-guides/make_assets.py      # covers and page texture
node design/steward-guides/build.mjs output/steward-guides [stewardId...]
```

Content comes from the game data: `src/data/stewards.ts` (Powers, Objectives,
terrain), `src/data/tiles.ts` (every Core Tile, both sides) and
`src/data/specialTileNumbers.ts`. Tile art is the artist set in `public/tiles`;
card images come from the current print files. Pages are A6 plus 3.175 mm
bleed with TrimBox and BleedBox set.

| Page | Content |
|---|---|
| 1 | Cover: leather, gold lettering, card-back compass |
| 2 | The Steward: Power, Objective, Starting Terrain, rules for every Steward |
| 3 | Your turn: Seasons, round sequence, four Actions, Steward Token |
| 4–14 | All 21 Core Tiles, both sides, with art, cost, effect and score; Linked Production |
| 15 | Reading a Tile and the effect symbols |
| 16 | Encounter Cards |
| 17 | Quest Cards and the Steward's Ledger |
| 18 | Special Tiles (back numbers) and Golden content |
| 19 | At-table reference: Strain and Target Cards, Season end, final score |
| 20 | Back cover |
