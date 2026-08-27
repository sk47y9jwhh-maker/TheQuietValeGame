# The Quiet Vale tile template family

Version: 1.13

Template family status: approved and locked on 2026-08-02

These masters preserve the approved restrained tile direction: a fitted tile-name image placeholder in every artwork field, no ornamental flourishes, no copper/brass linework, and readable text-led rules fields.

## Files

- `core-basic-master.svg` — Core basic face with Place and Upgrade rows.
- `core-upgraded-master.svg` — Core upgraded face with the lineage band occupying the same vertical span as the basic cost rows.
- `core-extension-master.svg` — Shared generic continuation hex for all multi-hex Travel components, with the standard artwork window and a two-row Street/Track extension-count guide.
- `special-one-sided-master.svg` — One-sided Special face with Arrival unlock band and enlarged rules field.
- `golden-one-sided-master.svg` — One-sided Golden face with Ledger unlock, effect, and end-game scoring bands.
- `special-numbered-back-master.svg` — Generic dark Special back with one editable identifying number.
- `generate-all-tiles.mjs` — Rebuilds the complete tile face set from the current structured project data.

Generated production faces, manifests, and handoff notes are in `../tile-set/`.

Each master is a physically sized editable vector: 60.0000 mm point-to-point by 51.9615 mm flat-to-flat. The coordinate system is `0 0 1000 866.0254`, so one template unit equals 0.06 mm.

## Locked geometry

| Boundary | Template y | Physical y |
| --- | ---: | ---: |
| Header / artwork | 150 | 9.00 mm |
| Artwork / information | 430 | 25.80 mm |
| Core basic Place / Upgrade | 510 | 30.60 mm |
| Core information / effect | 590 | 35.40 mm |
| Special unlock / effect | 510 | 30.60 mm |
| Golden unlock / effect | 500 | 30.00 mm |
| Golden effect / scoring | 680 | 40.80 mm |

The Golden lower bands are the only new geometry in this family. They retain the locked header and artwork boundary while giving the persistent effect and conditional +5 Renown rule separate reading zones.

## Artwork handoff

Every front master contains a layer named `ARTWORK — INSERT HERE`, already clipped to the exact artwork polygon. Generated faces place the actual tile name followed by `Image` inside that layer, fitted automatically up to three lines. The commissioned artwork should replace that placeholder inside the same layer. Do not move the header or the information boundary at y=430.

Street and Track use one complete main rules hex plus generic Travel extension hexes. Their main Basic and Upgraded faces carry the assembly instruction `PLACE WITH 1 TRAVEL EXTENSION HEX` or `PLACE WITH 2 TRAVEL EXTENSION HEXES`. The same extension design is used for either component size: one shared Basic face and one shared Upgraded face, each titled `Travel Extension` without a component-specific title or segment number. Its clipped artwork window uses the standard y=150–430 geometry. The former Place/Upgrade band now gives the shared assembly key in two rows: `STREET — USE 1 TRAVEL EXTENSION HEX` and `TRACK — USE 2 TRAVEL EXTENSION HEXES`. It deliberately omits costs, scores, placement rules, effects, and corner symbols. Print 14 copies of each side to supply the full Street and Track stock.

Special tiles reserve the lower left and right corners of the artwork field for Population and Renown. These markers use only the icon, number, and fully written label, without an enclosing circle. Generated Core basic faces use those same reservations only when either printed score is non-zero. Golden tiles do not use those markers in the current data model.

The numbered Special backs are assigned per physical component in source order from 1 to 26. The two physical Stables copies receive separate numbers; both detached hex segments belonging to one Stables copy repeat that copy's number. Version 1.5 uses Alegreya lining/tabular figures, measured per number so all 26 visible outlines share one apparent height and optical centre. The colour remains the established parchment `#d8caaa`.

The generator also writes `design/tile-set/SPECIAL-TILE-NUMBER-REFERENCE.md`. That file is the locked human-readable authority for printing the same number on each Special tile's corresponding Arrival unlock encounter card.

## Editing rules

1. Duplicate the relevant master; never resize the root SVG or alter its viewBox.
2. Replace only elements marked with `data-field` and replace the fitted image placeholder only inside the artwork layer.
3. Preserve the structural dividers and all band boundaries.
4. Keep effect prose readable. Add or remove body-text lines within the existing field instead of shrinking type below the template minimum.
5. Keep Golden identity in flat surface colour and labels, not decorative metallic rules or flourishes.
6. Keep the lower point clear. The approved template has no component-code footer.
7. Centre the effect heading in its field; do not add a target or activation glyph beside it.
8. Select the top-left tile-type icon and label together from the structured category using the locked mapping: Resource/Gathering cart, Housing cottage, Crafting mallet, Merchant scales, Social bonfire, Wellbeing sunburst, Travel wagon wheel, and Golden crown. Version 1.8 applies the clean icon grammar established by Wellbeing, Travel, and Farm to every tile pictogram: one strong silhouette, rounded strokes, and only the detail needed to preserve meaning. The cart has no handle or slats; the cottage has no windows, door, or chimney; Crafting uses a plain two-part mallet; Merchant uses flat straight-sided scale trays.
9. Select the top-right placement icon independently from the structured placement rule; never reuse a generic River symbol for unrelated requirements. Adjacency pictograms must show two flat-top hexes sharing one complete edge, never touching at points. Any Land, Non-River, and mixed-land placement are standard land rules: leave the entire top-right corner blank—no circle, icon, or text—while preserving the exact rule in SVG metadata and manifests. Golden tiles have no placement restriction except The Golden River Gate, which retains its River-adjacency requirement.
10. Build every Place and Upgrade cost from the locked resource tokens. Use the agreed pictograms—Wood log, Stone faceted stone, Metal ingot, Food wheat, Herbs leaf sprig, and Goods crate—and retain their Logistics-board colours: Wood `#5b7c4c`, Food `#978d34`, Stone `#7e878e`, Herbs `#7b5b89`, Metal `#658597`, and Goods `#95563e`. Keep each resource mark to a clean outline with no decorative texture. Version 1.13 uses one consistent 29-unit type size, fixed icon and number columns, shared baselines, and symmetric one-, two-, and three-token centres in every Place and Upgrade row. Resource quantities explicitly use Alegreya Sans lining/tabular figures so short oldstyle forms such as `2` cannot sit lower or appear smaller than `5`. Alternative costs use the same token geometry around a centred `OR`.
11. Set the Golden Ledger entry threshold in the existing aged-gold `#7f6a3d`; do not use the near-black body-copy colour in that pale gold band.
12. For a multi-hex Travel component, keep all rules on segment 1. Reuse the generic Travel extension master for every later segment, retain the matching assembly instruction on the main face, and keep the two-row Street/Track quantity key in the former Place/Upgrade band. Do not add Street/Track-specific names or segment numbers to extension faces.
13. Before print manufacture, obtain the printer's exact bleed, safe-zone, and cutting-dieline specification. These files lock the face geometry and hierarchy, but do not invent an unapproved bleed allowance.

## Authority used

- Current structured tile content: `src/data/tiles.ts`.
- Design Authority v3.1: 60 mm flat-top hex, core hierarchy, one-sided Special hierarchy, readable effect prose.
- Tile wireframe v0.2: Special tiles omit cost rows, retain the Arrival unlock line, and use an enlarged effect field.
- Adopted combined Logistics board: locked resource colour system.

## Exact-scale A4 print pack

The A4 imposition generator renders the approved web fonts at 600 DPI and places each face into the PDF at its exact physical dimensions:

```bash
node design/tile-templates/make-a4-print-pack.mjs
```

It creates a long-edge duplex Core PDF, a long-edge duplex Special/Golden PDF with numbered Special backs and a blank Golden reverse, a compact one-of-each proof PDF, and a machine-readable placement manifest under `output/pdf/`. The layout uses a centred 3 by 5 grid with 3 mm gaps and a 50 mm calibration line on printed pages. Printable quantities are multiplied by each component's 1-, 2-, or 3-hex footprint; Street and Track use their main face for segment 1 and reuse the same generic extension face for every later segment.
