# Approved artist tile production — 12 September 2026

This is the complete, approved artist-template workflow. It supersedes the older
SVG tile faces in `design/tile-set` for the current website and print handoff.

The renderer uses the supplied 1560 × 1370 CMYK PSD composites, original artist
icons and Alegreya fonts. The approved background exports are checked in under
`assets` so rebuilding does not require access to the artist's PSD files.

## Rebuild

Run `node design/artist-tile-templates/build.mjs` from the repository root. This
reads current `src/data/tiles.ts`, renders every face, exports 600 dpi PNGs with
3 mm bleed, then creates trimmed PNGs and lossless WebP artwork in `public/tiles`.
The included smaller WebP thumbnails are for the map and selection lists.

Then run `python3 design/artist-tile-templates/make-print-pack.py` to produce the
actual-size face PDF, print quantity/pairing guide and print/web ZIP packs in
`output/artist-tiles-complete`. Python requires Pillow and ReportLab. The build
uses Playwright and Chrome; QV_PLAYWRIGHT, QV_CHROME and QV_PYTHON can override the
installed runtime locations used on the production workstation.

## Approved layout

- Type subtitles and header divider removed, names enlarged; black Special borders.
- River icons enlarged 30% and inset; Renown kept inside the trimmed border.
- Resource/Travel category icons at 90%, Housing at 95%, centred.
- Resource, Population and Renown symbols within effects; quantities kept with icons.
- `Linked Production (once per round)` replaces its expanded explanation on faces.
- Golden effects and placement share the bottom area; scoring is omitted from faces.
- Ten named-producer adjacency restrictions use that producer's terrain.
- Activated Special tiles retain timing restrictions in their effect text.
- Stables has two detached full fronts per physical copy; no Travel extension.
- Empty illustration windows are intentional and match the approved sample set.
- Tile-type edge wash (30 Oct 2026): Core faces and Travel extensions have the
  parchment margin outside the frame lightly tinted in their category colour
  (multiply, 45%), running out through the bleed. Special, Golden and back
  faces are unchanged. Colours match the online board.

## Original layer treatment

`refresh-backgrounds.py [source-psd-directory]` re-exports the original artwork
using psd-tools and macOS ColorSync via `sips`. It hides type, the title divider,
effect-heading washes, and the removed Golden scoring band. It changes only the
silver/gold title and lineage/unlock wash layers to Multiply, opacity 140/255 for
silver and 155/255 for gold. Frames, parchment, ornaments and icons retain their
original treatment. Original PSD files are never overwritten.

## Print / web

Print PNGs retain 3 mm bleed and 600 dpi metadata. The 9-page A4 PDF contains all
101 unique faces at original size and labels each stock quantity; it is a face
proof, not duplex imposition. `print-quantities.csv` pairs Core faces by tile ID
and Special backs by number/source copy. Current quantities require 234 printed
hex sides. Each Street adds one extension per side; Track adds two. Each of the
two Stables copies uses two identical fronts and two matching numbered backs.
Each Golden tile takes the unnumbered Golden back: the Special back artwork with
no number (decided 30 October 2026).

Web faces remove 71 px per edge and use a transparent finished hex boundary,
1418 × 1228 px. Full WebP images are lossless. Website rules stay available as live
text below the illustrated inspector faces, including Golden scoring and the
full Linked Production explanation.
