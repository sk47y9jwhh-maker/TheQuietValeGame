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

- Type subtitles and header divider removed, names enlarged. Special borders were
  black until 30 Oct 2026 and now use the stronger type-colour wash.
- River icons enlarged 30% and inset; Renown kept inside the trimmed border.
- Resource/Travel category icons at 90%, Housing at 95%, centred.
- Resource, Population and Renown symbols within effects; quantities kept with icons.
- `Linked Production (once per round)` replaces its expanded explanation on faces.
- Golden effects and placement share the bottom area; scoring is omitted from faces.
- Ten named-producer adjacency restrictions use that producer's terrain.
- Activated Special tiles retain timing restrictions in their effect text.
- Stables has two detached full fronts per physical copy; no Travel extension.
- Empty illustration windows are intentional and match the approved sample set.
- Tile-type edge colour (30 Oct 2026, made solid 22 Nov 2026): the margin
  outside the frame on Core, Travel extension and Special faces is painted in
  the tile type colour (solid, 90%), running out through the bleed. Golden and
  back faces are unchanged. See the section below.

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

## Tile-type edge colour — strengthened 22 November 2026

Robert, 22 November 2026: "make the tile type colours more pronounced, many
was too hard to differentiate at the table." The muted colours below (locked
30 October) were replaced by seven clearly different hues, laid on more
strongly:

| Type | Colour |
| --- | --- |
| Resource | #62803c moss green |
| Housing | #9c4a2e rust |
| Travel | #a8a393 pale stone |
| Merchant | #b48a2c ochre |
| Crafting | #3d5a7a slate blue |
| Social | #6a3f63 plum |
| Wellbeing | #6a9c90 sage teal |

Muted colours from the game's own palette (woodland, rust, brass, river blue,
heath), spread across hue and lightness so neighbours differ: pale Travel
against ochre Merchant, rust Housing against dark plum Social, moss Resource
against slate Crafting. Painted solid at 90% (not multiplied into the
parchment, which pulled every colour towards brown) on Core, Travel and
Special faces. Earlier the same day: a stronger multiply wash was still too
alike (Gathering/Workshops, Housing/Social, Path/Market Stalls), and bright
saturated colours were too bright (Robert). The online game's own type chips
keep the earlier muted colours. Also 22 November: "UPGRADED FROM" and the
basic tile's name are bold on upgraded faces, and Golden tiles' heading reads
PASSIVE (was PERSISTENT EFFECT).

## Picture wash — 22 November 2026

Robert: "add a colour wash in the picture area too, like the border but for
the gathering tiles do the matching terrain for its placement. also any other
tiles that feel like a different colour would better represent them use that
instead." The illustration window gets a watercolour ink wash (`watercolour()`
in renderer.html, Robert: "much more subtle … like water colour ink wash" and
"keep it exactly inside the picture area right up to the edge"): uneven
pigment with darker and paler blooms, a darker dried rim along the window's
edge and fine granulation, seeded per face so it is repeatable, multiplied onto
the parchment and clipped to the window exactly. The window (same on every
template): frame lines at y 309–312 and 673–676, inner sides at 60°, x = 377 −
tan30·(y−330) on the left and 1181 + tan30·(y−330) on the right; the wash runs
onto the frame lines by a pixel. Colours:

- Tiles placed on one terrain take that terrain's map colour (strength 0.55):
  woodland #819e60, mountains #98a088, heaths #b7aeb0, arable #d6c375,
  ruins #cc9c7c, water #a9bfc0, grasslands #c9c8a0. That covers the Resource
  tiles, Salvage Camp, Bridge, Docks, the Shrines and the Respites.
- Chosen to suit: Washhouse water, The Vaults ruins, Common Land grasslands,
  Hearth Garden woodland (`suits` in renderer.html).
- Golden tiles: gold #d9b44a (0.35).
- Everything else: its type colour (0.28).
- The wash itself lays the colour at about half strength with blooms, so the
  result is far lighter than the first flat version (80% / 45% / 42%).

## Tile-type edge colour — approved and locked, 30 October 2026 (superseded 22 November)

Approved by Robert on 30 October 2026. Superseded by the section above.

| Faces | Treatment |
| --- | --- |
| Core Basic and Upgraded, Travel extensions | Parchment margin tinted in the tile type colour: multiply at 45% |
| Special fronts | Black margin replaced by the Core parchment margin, then tinted: multiply at 80% |
| Golden fronts, Special backs, Golden back | Unchanged |

- The tint runs from the outer bleed to 52 px (2.2 mm) inside the cut, stopping
  just outside the fine border line (which starts 55 px, 2.3 mm, inside the
  cut on both backgrounds). Edge feather: 2 px blur.
- Because the tint reaches through the bleed, the cut position does not change
  how it looks.
- Colours (the online board's category colours): Resource #4e6748,
  Housing #9a5b3c, Travel #7a6f58, Merchant #8a6d2b, Crafting #4f6b7a,
  Social #7a4f6b, Wellbeing #3f7a6e.
- Options tried and not chosen: a thin line at or inside the cut (cut
  tolerance made it uneven), and a stronger wash on Core tiles.
- Locked renderer: `renderer.html` SHA-256 `2726245b4510e158ceed779d22e9914f13329280f80faf4dde9e4fc335105633`.

## Upgrade icon — 22 November 2026

`assets/icon-Upgrade.png` (online `public/icons/upgrade.webp`): a thin hex tile
under a clean brass arrow that arcs over it and turns down, drawn to sit with
the artist's cart wheel (Robert: the first version's tile was too thick and its
arrow too messy): smooth arcs, a heavy black outer line, a thinner inner line,
a fine inner rim line and a brass band shaded with streaks that follow the
curve; a crisp triangular head. Drawn by `make-upgrade-icon.py` (Pillow; rerun
to regenerate). Placed on every upgraded face (Robert, 22 Nov: "to help see
these tiles on the table"): one each side of UPGRADED FROM and the basic tile's
name, 100 px tall, centred at x 340 and 1218, y 774, so it sits inside the lower
band's frame lines (Robert asked for it smaller); the two text lines narrowed
to 600 and 640 px to make room.

## Arrival icon — 22 November 2026

`assets/icon-Arrival.png`: the artist's open arched door, cut out of the Arrival
card frame (`src/assets/encounter-cards/arrival.png`) so the tile icon matches
the card. Placed on every Special face exactly as the Upgrade icon is placed on
upgraded faces: one each side of UNLOCKED BY ARRIVAL and the Arrival's name,
108 px tall (the door is narrow), centred at x 340 and 1218, y 774; the two
text lines narrowed to 600 and 640 px. The longest name, Transmutation
Traveller, still fits at full size.

## Arrival band shading — 22 November 2026

On Special faces the lower band behind UNLOCKED BY ARRIVAL carries a soft
lavender watercolour wash (`#8566aa`, strength 0.3, the same `watercolour()`
style as the picture area) to suit the Arrival door. A first version re-tinted
the template's grey clouds purple, which Robert found too strong. Now
`make-arrival-band.py` lifts the artist's grey shading clouds back to clean
parchment (ink lines ignored), writing `assets/arrival-band.png`, which the
renderer draws over the band before the wash and the text. The wash stays inside
the frame lines; the other tile types keep their grey shading.

## Supported icon — 22 November 2026

`assets/icon-Supported.png` (online `public/icons/supported.webp`) is redrawn
to match the artist's ink icons (metal bars, crate): a bronze heater shield with
a heavy black outline, a riveted rim, a raised centre ridge, the left face lit
with pale streaks and the right face shaded with ink hatching. Drawn by
`make-supported-icon.py`. The online cards and the Supported token on the online
board use the same picture in place of the old flat vector shield.
