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

## Prototype 1 print design (31 October 2026) — supersedes the face above for printing

Robert did not like the Vale Blue + Rose draft. The Target Cards now share the
Chronicle Card family with a silver frame, and the tie directions follow the
map's flat-top hexes.

- `target-cards.json`: the print deck. The same 30 preference profiles as
  `src/data/targetCards.ts`, with tie directions rotated 30° to the six
  flat-top hex directions: NE→N, E→NE, SE→SE, SW→S, W→SW, NW→NW. Cards 13–24
  still repeat 1–12 with the opposite direction, and each direction appears on
  4 cards.
- `target-front-background-600dpi.png`: the Golden Boon front re-laid to poker
  (as for the Chronicle Cards) with the frame and compass turned silver
  (saturation −100, lightness +6, like the silver back) and the compass glow
  recoloured to parchment.
- `render-target.mjs`: renders the fronts. Rows: Tile class, Tile side,
  Adjacency, Current Strain, each with a small glyph; then "If still tied" with
  a flat-top hex whose arrow leaves the edge facing the card's direction and the
  words "The tile closest to the North edge of the map" (and so on); Open cards say
  "Choose any eligible tile". Footer: "Work down the rows. Skip any row no tile
  matches." (replaces "Unless specified" on every row).
- `print/target-NN.png`: 1630 × 2220 px at 600 dpi (63 × 88 mm with 3 mm
  bleed), sRGB. Back: `card-back-poker-silver-printerstudio-600dpi.png`.

The online game uses the old E/W-centred directions until the branch
`claude/target-flat-top-directions` is merged.
