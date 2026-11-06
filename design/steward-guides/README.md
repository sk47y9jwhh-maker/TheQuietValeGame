# Steward Guide v6.9 (shared edition, 6 November 2026)

One A6 booklet, 20 pages, printed six times: every copy is identical, so the
printer runs a single design. (The 2 November edition had a different cover
and Steward page in each of six guides, which tripled the print price.) The
cover has no Steward name; all six Stewards are inside, two to a page.

Rebuild from the repository root:

```bash
python3 design/steward-guides/make_assets.py      # cover and page texture
node design/steward-guides/build.mjs output/steward-guides
python3 design/print-hayman/make_booklet_pdf.py output/steward-guides/The_Quiet_Vale_A6_Steward_Guide_v6_9.pdf \
  output/hayman-booklets/QV-Steward-Guide-A6-20pp-CMYK.pdf 105 148 /tmp/sg-work
```

Content comes from the game data: `src/data/stewards.ts` (Powers, Objectives,
terrain), `src/data/tiles.ts` (every Core Tile, both sides) and
`src/data/specialTileNumbers.ts`. Tile art is the artist set in `public/tiles`;
card images come from the current print files. Pages are A6 plus 3.175 mm
bleed with TrimBox and BleedBox set.

| Page | Content |
|---|---|
| 1 | Cover: leather, gold lettering, card-back compass, "Steward Guide" (no Steward name) |
| 2 | Stewards I and II: Vanguard, Knight (terrain, Power, Objective), then "Every Steward: getting started" |
| 3 | Stewards III and IV: Sentinel, Ranger |
| 4 | Stewards V and VI: Warden, Quartermaster, then "Every Steward: during play" (Shelter in the Ruins, Power refresh) |
| 5 | Your turn: Seasons, round sequence, four Actions, your meeple |
| 6–16 | All 21 Core Tiles, both sides (unchanged). Page 8 adds Linked Production and the symbols and timing |
| 17 | Target Cards (unchanged) |
| 18 | Encounter and Quest Cards: the four Encounter types, Arrival failure and Special Tile reward, Quest Cards and the Steward's Ledger |
| 19 | At-table reference: placing Strain, Season end, final score, Golden content |
| 20 | Back cover |

To make room for the five extra Steward pages, the Special & Golden Tiles page
was dropped (Special Tile placement and Golden content moved to pages 18 and
19; the back-number list is left to the rulebook) and the Encounter and Quest
pages were merged into one.

Interior pages have no decorative border: the text area runs to about 7 mm
from the trim so the type can be as large as possible.

## Print files

`make_print_pdfs.py` (older route) rasterises a guide at 600 dpi and converts it to CMYK
(FOGRA39), keeping A6 TrimBox and BleedBox. Uses `pdfkit.py` alongside it.
