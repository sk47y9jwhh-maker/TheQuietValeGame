# The Quiet Vale complete tile face set

Generated from the approved v1.13 masters and the current structured authority in `src/data/tiles.ts`.

## Set contents

- 51 unique tile designs.
- 72 unique main front faces: 42 Core faces, 25 Special faces, and 5 Golden faces.
- 2 generic Travel extension faces: one shared Basic face and one shared Upgraded face for both Street and Track.
- 74 unique printable front faces in total.
- 26 numbered Special back faces, one for each physical Special component.
- 100 unique SVG faces in total.
- 93 physical components at the stock quantities defined by the project.
- 109 physical hexes after expanding every 2- and 3-hex component by its footprint.
- 181 component sides after adding the Special backs, expanding to 213 printed hex faces at stock quantity.

Every SVG is exactly 60.0000 mm point-to-point by 51.9615 mm flat-to-flat with viewBox `0 0 1000 866.0254`. Every front's clipped `ARTWORK — INSERT HERE` layer contains the actual tile name followed by `Image`, fitted as large as the safe artwork field permits.

## Folders and manifests

- `core/` — Basic and upgraded face SVGs for all 21 Core lineages.
- `core-extensions/` — The shared generic Basic and Upgraded Travel extension SVGs.
- `special/` — One-sided face SVGs for all 25 Special designs.
- `special-backs/` — Dark numbered backs 1–26, mapped to physical Special components.
- `golden/` — One-sided face SVGs for all 5 Golden designs.
- `manifest.json` — Machine-readable dimensions, quantities, footprint metadata, source copy, and printed copy.
- `print-manifest.csv` — Production handoff table with one row per unique main front face and its ordered segment paths.
- `extension-manifest.csv` — Side, quantity, compatible source tiles and component sizes, and SVG path for each generic Travel extension face.
- `special-back-manifest.csv` — Back number, paired Special tile, physical source copy, footprint, and SVG path.
- `SPECIAL-TILE-NUMBER-REFERENCE.md` — Human-readable locked pairing table for adding each Special tile number to its matching Arrival unlock encounter card.

Visible component-code footers and aim/target glyphs are absent. Effect headings are centred. Population and Renown markers have no enclosing circle and use the icon, number, and fully written label. Core basic faces show these markers only where at least one printed score is non-zero.

Every non-free Place and Upgrade resource is printed as a locked icon-number-name token. The pictograms are Wood log, Stone faceted stone, Metal ingot, Food wheat, Herbs leaf sprig, and Goods crate. Icon strokes use the exact adopted Logistics-board resource colours. All rows use one consistent 29-unit resource type size, fixed icon and number columns, and symmetric slot centres for one, two, or three tokens; alternative costs use the same balanced geometry around a centred `OR`. Resource quantities use explicit lining/tabular figures, keeping every digit on one baseline and at one visual height.

## Corner icon treatment

The top-left symbol and label are selected together from each tile's structured category using the approved icon vocabulary: Resource/Gathering cart, Housing cottage, Crafting mallet, Merchant scales, Social bonfire, Wellbeing sunburst, and Travel wagon wheel. Golden faces retain the crown. Version 1.8 applies one clean print-safe grammar to every tile pictogram: strong outline silhouettes, rounded strokes, and only the detail required to preserve meaning. The cart has no handle or slats; the cottage has no windows, door, or chimney; the mallet has only a head and handle; the Merchant scale uses flat straight-sided trays; resource, terrain, adjacency, named-tile, Population, and Renown symbols use the same reduced-detail treatment. The top-right symbol is selected independently from each tile's structured placement rule, and category-adjacency rules reuse these same approved category glyphs. River and Ruins adjacency pictograms show two flat-top hexes sharing a complete edge rather than meeting at their points. Any Land, Non-River, and mixed-land placement are standard land rules and deliberately leave the complete top-right corner blank; their exact rules remain recorded in the manifests and embedded SVG metadata. The Golden Charter, Hearth, Cairn, and Garden are unrestricted and therefore blank; only The Golden River Gate retains its River-adjacency marker.

## Copy treatment

The generated text preserves the structured source semantics. Mechanical lead-ins such as `Activate:` and `Passive:` move into the centred heading so they are not repeated in the prose.

The expanded online explanation for Linked Production is printed as the established `Linked Production` keyword after the gain sentence. The full source wording remains embedded in each SVG's metadata and in both manifests. Golden scoring conditions use compact, equivalent wording so all rules type remains at least 30 template units within the locked scoring field.

Printable quantity is measured in 60 mm face hexes, not only components. Each Street copy uses one full main rules hex plus one generic Travel extension hex; each Track copy uses one full main rules hex plus two copies of that same generic extension. The main faces explicitly say `PLACE WITH 1 TRAVEL EXTENSION HEX` or `PLACE WITH 2 TRAVEL EXTENSION HEXES`. The generic extension repeats those counts in the former Place/Upgrade band as a two-row Street/Track assembly key. Extensions are not Street/Track-specific and carry no segment number; Basic and Upgraded sides remain distinct for duplex assembly. Fourteen copies of each generic side supply all six Streets and four Tracks. Street therefore prints 12 face hexes per side from 6 two-hex components; Track prints 12 face hexes per side from 4 three-hex components; Stables prints 4 one-sided face hexes from 2 detached two-hex components.

Special back numbering follows physical component order from 1 through 26. The two Stables copies receive separate numbers, and each copy's two detached back hexes repeat that copy's number. Version 1.5 uses lining/tabular figures with measured per-number sizing and optical offsets, giving every visible numeral outline the same apparent height and centre. The colour remains parchment `#d8caaa`.

## Regeneration

From the repository root:

```bash
node design/tile-templates/generate-all-tiles.mjs
```

The generator replaces the generated face files and manifests deterministically from `src/data/tiles.ts` while preserving the six locked master geometries.

## Manufacturing boundary

These are face-production masters, not a printer-specific imposed sheet. Street and Track retain their 2- and 3-hex footprint metadata; Stables retains its detached 2-hex metadata. Final compound cutting paths, bleed, safe zones, colour profile, and sheet imposition must use the selected manufacturer's specifications rather than an invented dieline.

## Validation completed

- 100/100 SVG files are well-formed XML.
- All 100 retain the exact physical dimensions and viewBox.
- All 72 main fronts contain the exact fitted `Tile Name Image` text for their tile; both generic Travel extensions contain the standard-size `Travel Extension Image` placeholder; all 26 backs contain their mapped number.
- All 72 fronts contain exactly one defined, data-matched tile-category icon. Every face with a specific visible placement or adjacency requirement contains one data-matched icon and label; every standard-land face contains neither. No generic tile-type symbol, generic River symbol, or undefined corner reference remains.
- All four Street/Track main faces contain the correct extension count instruction. Both generic Travel extension faces work with 2- and 3-hex components, retain only their Basic or Upgraded side label, use the standard artwork window, and show the shared Street 1 / Track 2 assembly key without repeated tile type, placement, score, cost, or effect fields.
- Every structured Place and Upgrade resource has exactly one matching named pictogram, quantity, label, and Logistics-board colour. Every token uses the uniform resource size, explicit lining/tabular numeral features, and a declared symmetric slot centre; every parseable alternative cost has its required centred `OR` separator, and no generic resource symbol remains.
- No effect heading is off-centre.
- No footer, aim/target glyph, placeholder copy, duplicate SVG identifier, or horizontal gallery overflow remains.
- All installed project fonts load in the rendered proof.
- All measured rules copy stays inside its assigned safe width; the minimum rules size is 30 template units.
