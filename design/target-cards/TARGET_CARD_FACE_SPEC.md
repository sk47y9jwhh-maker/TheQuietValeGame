# Target Card Face Specification

**Status:** approved design system

**Product:** The Quiet Vale — optional Target Card deck

**Physical format:** 63 × 88 mm, poker-size, portrait

## Front

- Use the Vale Blue + Rose palette from `output/target-card-visual/target-card-palette-lock.json`.
- Retain the pale painted-paper field, slate-blue linework, restrained blue ink, rose accent, ornamental frame and Golden Boon compass medallion.
- Match the live game’s capitalization: sentence/title case, not display-wide capitals. Use `Target`, `Card NN`, `Tile Class`, `Tile Side`, `Adjacency`, `Current Strain`, `Core`, `Upgraded`, `3+ Neighbours`, `Already Strained`, `Unless specified`, `Tie Direction`, `Open Target`, and `Choose Any Eligible Tile`.
- Read the card from top to bottom:
-  1. `Target` identifier and `Card NN` number;
  2. `Tile Class`;
  3. `Tile Side`;
  4. `Adjacency`;
  5. `Current Strain`;
  6. `Tie Direction` for structured cards, or the Open-card instruction.
- Preference rows are centred, unnumbered, and each carries the helper line `Unless specified`.
- Structured cards use full text for every preference. Colour is supplementary only.
- The tie direction is shown in two redundant ways: a compass abbreviation and a six-hex flat-top neighbour ring with the selected outer hex in rose.
- Open cards show `Any` in all four preference rows, omit the direction ring, and state `Choose Any Eligible Tile`. The triggering effect still defines the eligible pool.

## Back

- Target Cards use the shared Encounter Card back.
- The shared back is symmetrical, non-directional, and contains no card number, preference profile, arrow, or other information tell.
- Target-specific back artwork is therefore not a separate product family; its physical proof belongs with Encounter Card back preflight.

## Canonical source and proof

- Generator: `output/target-card-visual/build_artist_asset_target_cards.py`
- Shared face template: `output/target-card-visual/target-card-vale-blue-rose-template.webp`
- Locked proof: `output/target-card-visual/target-card-vale-blue-rose-locked-proof.png`
- Representative structured card: `output/target-card-visual/target-card-05-vale-blue-rose-front.png`
- Representative Open card: `output/target-card-visual/target-card-25-open-vale-blue-rose-front.png`

This specification locks the design system. Generating all 30 cards, comparing them with the structured data/workbook, and running physical-size/vendor proofs remain separate production tasks.

## Print files for the first live prototype (31 October 2026)

`print/target-NN.png` are the 30 fronts, 1630 × 2220 px at 600 dpi (63 × 88 mm
trim, 3 mm bleed each side, sRGB), rendered by `render-target.mjs` from
`src/data/targetCards.ts`, so print and online use the same deck data. The back
is the shared card back in silver:
`design/encounter-card-templates/card-back/print/card-back-poker-silver-printerstudio-600dpi.png`.

Changes from the locked face, for review after play-testing:

- **Tie direction is a compass, not a neighbour ring.** The map's hexes are
  flat-top, so their neighbours lie N, NE, SE, S, SW and NW, and there is no
  east or west neighbour. The engine breaks a tie by the tile furthest across
  the whole map along the card's bearing (`directionVectors` in
  `src/engine/targetCards.ts`). A ring of neighbour hexes suggested adjacency,
  so the card now shows six compass arms with the bearing in rose and the words
  "Furthest east" (and so on) plus "across the whole map (E)".
- **Small glyphs beside each value** to help scanning: a hex for Core, a hex
  with a star for Special or Golden, a double hex for Upgraded, a centre hex with
  3 or 2 filled neighbours for adjacency, a black Strain disc or a dashed empty
  disc for Strain. The words still carry the meaning.
- Values in sentence case ("3+ neighbours", "Already strained",
  "Special or Golden"), matching the house style.
- Open cards: "Open target", "Choose any eligible tile", "Keep to any limits
  set by the effect."

The face template here is upscaled from the 1260 × 1760 web template (508 dpi
at trim). The original generator and template in `output/target-card-visual/`
are not in the repo; if the higher-resolution template turns up, render from it.
