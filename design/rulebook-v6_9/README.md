# Main Rulebook v6.9 (review edition, 4 November 2026)

32 pages, 195 × 255 mm with 3.175 mm bleed (TrimBox and BleedBox set). It
pairs with the v6.9 Steward Guides and uses the same type, parchment, leather
covers and gold lettering. It replaces the v6.8 review rulebook; the v6.6
locked archive is unchanged and stays the approved record.

## Pictures made from the real components

Every picture that would normally be a photograph is drawn from the game's
own production files, so it always matches what is printed:

| Picture | Made from |
|---|---|
| Table setup, map close-ups | The v4 board renders (`design/boards-v4`) with the artist tiles from `public/tiles` laid exactly on the map's hexes (60 mm point to point, Hayman option A), wooden Strain and bronze tokens and Steward meeples (`scene.py`) |
| Encounter Cards | The online game's `EncounterCard` component in print mode (`cards/render-cards.mjs`) |
| Quest and Target Cards, card backs | The print files in `design/quest-cards/print`, `design/target-cards/print` and `design/encounter-card-templates/card-back/print` |
| Steward Guides on the table | `design/steward-guides/assets` covers |

Arrows, rings and numbers are drawn over the pictures in the page itself, so
the type stays sharp. Map figures place marks by hex id (`figures.json`).

## Rebuild

From the repository root (needs Playwright's Chromium, TypeScript and esbuild):

```bash
python3 design/boards-v4/build_leather_boards.py output/boards-v4      # about 6 minutes
node design/rulebook-v6_9/cards/render-cards.mjs output/rulebook-v6_9/cards
python3 design/rulebook-v6_9/make_assets.py                              # covers, parchment
python3 design/rulebook-v6_9/figures.py output/boards-v4 output/rulebook-v6_9/cards
node design/rulebook-v6_9/build.mjs output/rulebook-v6_9
```

`build.mjs` reports any page whose content overflows and the space left on
each page.

## What changed from v6.8

- Quest Cards and the Steward's Ledger replace the 50-entry Ledger and Vow
  declaration. Final scoring adds +20 for the Quest Card. Golden pairs unlock at
  3, 6, 9, 12 and 15 cards in the Ledger.
- Target Card tie arrows follow the flat-top hexes (N, NE, SE, S, SW, NW), as
  printed on prototype 1.
- Components and setup use the v4 boards: Encounter, Logistics and Tiles boards,
  and the round tracker on the map board. Steward Aids are now Steward Guides;
  Steward Tokens are the wooden meeples.
- Robert's ruling of 28 October: resources never go below zero.
- New worked examples: Steward meeple movement, first placement, Linked
  Production, adjacency, rivers with and without a Bridge, a full Target Card
  resolution, an Overstrain chain, Neighbourly Support and a finished settlement.

## Assumptions to confirm

- Resource pieces are drawn as coloured wooden discs (the Logistics board
  calls the spares "discs").
- Steward meeple colours follow the Steward Guides' accents.
