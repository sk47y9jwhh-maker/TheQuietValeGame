# The Quiet Vale A1 board study

This study places the artist map on an exact ISO A1 landscape page at the
physical hex scale established by the approved tile masters.

## Physical authority

- A1 trim: 841 x 594 mm.
- Tile face: 60.0000 mm point-to-point by 51.9615 mm flat-to-flat.
- Original artwork frame: 714.1339 x 545.4286 mm.
- Cropped placed map: 657.8959 x 507.0433 mm.
- Side clearance: 91.5521 mm on both left and right.
- Top and bottom clearance: 43.4784 mm each.
- With a 6 mm outer safety and 4 mm gap from the map, the usable side rail is
  81.5521 mm wide; the usable top and bottom band is 33.4784 mm deep.

The original map frame dimensions come from `src/data/map.ts`. The placed
version crops only the unused cream surround, retaining approximately 5.4 mm
of cream reveal around the painted content. It does not resample the map:
one map SVG unit remains one physical millimetre and the playable hex radius
remains exactly 30 mm.

## Study contents

The generated PDF has two A1 pages:

1. A framed playable-board concept with six large shared resource wells:
   Wood, Stone, and Metal on the left; Food, Herbs, and Goods on the right.
2. A measured clearance sheet showing exact map, rail, trim, and 60 mm hex
   dimensions.

Each resource well is an open rectangle for a loose pool of counter tokens.
There are no numbered positions. The six wells are approximately 79.6 x 156 mm
overall, with an open token area approximately 71.6 x 131 mm.

## Generate

From the repository root:

```bash
python3 design/a1-board/generate_a1_board_study.py
```

Final artifacts are written under `output/pdf/`.

## Neoprene-realistic variant

`generate_a1_board_realistic.py` creates a separate one-page A1 version with
coarse black leather texture, recessed stone-like warehouse pools, dimensional
aged brass fittings, patina, worn grain, lifted shadow blacks, and print-safe
detailing intended to remain visible on a woven neoprene surface. It retains
the same crop, map placement, and exact 60 mm tile scale as the measured study.

The lower border contains a 12-position round tracker grouped into Season I
(rounds 1-4), Season II (rounds 5-8), and Season III (rounds 9-12). Each
position is a recessed 13.2 mm circular marker socket. The earlier print-check
bar is omitted.

A1 is treated as the finished trim size. The background runs to the trim and
important details remain inside a 6 mm safety. No printer-specific bleed has
been added; that should be applied from the eventual neoprene printer's
template.

```bash
python3 design/a1-board/generate_a1_board_realistic.py
```

## Refined handmade variant

`generate_a1_board_handmade.py` uses the selected refined material pass in
`assets/handmade-border-source-v2.png` across the entire non-map surround:
both warehouse columns, all six open wells, the title plate, outer stitching,
map fittings, and the bottom round tracker. The finish is intentionally less
rustic than the first handmade exploration: smooth full-grain leather, neat
saddle stitching, restrained wear, and satin aged brass.

The artist map is composited back over the material study from its original
source crop at the exact measured placement. It is not resampled or generated.
Its artwork receives a restrained painted-linen finish: subtle cross-fibre
grain, a matte tonal grade, and shallow compression at the mounting edge. This
does not move or distort the illustrated hex geometry.
Exact labels and all twelve round numbers are applied with lightly irregular
material lettering. The round tracker is cut directly into the continuous
bottom-border leather as one warehouse-style recess; it has no raised backing
plate, end rivets, or plate shadow. It spans the map width and keeps its sockets
grouped 4-4-4 for Seasons I-III: round centres are 42.5 mm apart within a season
and 84.5 mm apart across each season break. Season markers and round numbers use
the same worn, shallow-debossed gold treatment as the warehouse labels. Compact
I, II, and III markers sit immediately left of rounds 1, 5, and 9 instead of
occupying the upper seam, preserving clear space around the tracker stitching
and socket rims.

The final material layer is assembled at 203.2 ppi for large-format
dye-sublimation printing. The production PDF remains the physical-size
authority; the PNG files are visual proofs. A board-specific neoprene handoff
sheet is written beside the PDF with scale, bleed, material, and vendor-proof
instructions.

For print cohesion, the title, resource labels, dyed leather buttons, season
markers, and round numbers are resolved at the same physical pixel density as
the leather and composited before the shared surface-grain pass. The resource
markers use an in-context ImageGen leather button photographed against the
warehouse material, then recoloured deterministically for all six resources
without flattening its hide grain, burnished edge, holes, or linen thread. A
contracted face-only alpha removes the source shadow, and no replacement cast
or contact shadow is added beneath a marker. The four map fittings use one
isolated shadowless aged-brass master, mirrored without changing its aspect
ratio so all four rivets remain circular. Their transparent edges end at the
brass silhouette, with no rectangular crop, paper halo, or external shadow.

```bash
python3 design/a1-board/generate_a1_board_handmade.py
```
