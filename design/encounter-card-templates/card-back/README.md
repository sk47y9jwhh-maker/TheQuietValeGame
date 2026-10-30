# Shared card back — v01 (30 October 2026)

The artist's shared back for every Encounter Card (Arrivals, Boons, Burdens,
Golden Boons) and, in a poker-size variant still to be made, the Target Cards.
It settles task D-04 / EC-003 (card back system) subject to the notes below.

| File | What it is |
| --- | --- |
| `card-back-master-v01.psd` | The artist's layered master, byte-for-byte as delivered (`Quiet_Valley_Card_Back_V01.psd`). Read-only. |
| `print/card-back-tarot-printerstudio-600dpi.png` | Print derivative for PrinterStudio / MakePlayingCards tarot (2.75 × 4.75 in trim, 0.12 in bleed each side, 1794 × 2994 px at 600 dpi, sRGB). |

SHA-256:

```
e95908b53a105f840124bf962675becfcc8bcf691079c441ab9a04b29139051b  card-back-master-v01.psd
bf320617d93d395b68b57e6bf5e3f9df96eddd5608cb17f7d9a7eb8017c2461c  print/card-back-tarot-printerstudio-600dpi.png
```

## Checks on the master

- 1800 × 3000 px, 600 dpi, 8-bit CMYK, 27 layers: the same 3 × 5 in canvas and
  3 mm bleed as the four front masters. Trim is 70.2 × 121 mm.
- The hidden `Safe Area` layer is off in the composite. No guide or placeholder
  shows.
- Layout is point-symmetric: frame, corners, both titles and the compass are
  placed the same distance from each edge (within 2 px), and the lower title is
  the upper one turned 180°. A card dealt upside down reads the same.
- The gold frame sits about 3 mm inside the trim line. Cutting tolerance on
  short-run decks is around 1 mm, so the dark margin can look slightly uneven
  from card to card.
- Small directional tell: the compass and title bevels are lit from the top
  left, so a card turned 180° shows its highlights bottom right. It does not
  reveal which card it is.
- Dark rich black: average ink about 257% and peaks of about 356% total. Fine
  for digital card printers. Ask an offset printer (e.g. Ivory) for its ink
  limit before sending the CMYK file.
- No ICC profile is embedded. The RGB derivative assumes FOGRA39 (coated) and
  uses a perceptual conversion to sRGB.

## Making the derivative

The tarot file scales the full canvas by 0.998 (it fills the bleed box exactly)
and crops less than 0.1 mm from each side, so the frame stays about 3 mm inside
the cut.

## Still needed

A poker-size version (63 × 88 mm, 69 × 94 mm with bleed) for the 30 Target
Cards. The aspect ratio differs, so it needs the artist to re-lay the frame,
titles and compass rather than a scale.
