# Shared card back — v01 (30 October 2026), poker variants (31 October 2026)

The artist's shared back for every Encounter Card (Arrivals, Boons, Burdens,
Golden Boons). Poker-size variants made from the same master serve the Target
Cards (silver frame) and the Quest Cards (gold frame). It settles task
D-04 / EC-003 (card back system) subject to the notes below.

| File | What it is |
| --- | --- |
| `card-back-master-v01.psd` | The artist's layered master, byte-for-byte as delivered (`Quiet_Valley_Card_Back_V01.psd`). Read-only. |
| `print/card-back-tarot-printerstudio-600dpi.png` | Print derivative for PrinterStudio / MakePlayingCards tarot (2.75 × 4.75 in trim, 0.12 in bleed each side, 1794 × 2994 px at 600 dpi, sRGB). |
| `card-back-poker-gold-v01.psd` | Layered poker template, gold frame, for the Quest Cards. Made in Photopea from the master. |
| `card-back-poker-silver-v02.psd` | The same template with four silver adjustment layers, for the Target Cards. |
| `print/card-back-poker-gold-printerstudio-600dpi.png` | Poker print file, gold (Quest Cards). 63 × 88 mm trim, 3 mm bleed each side, 1630 × 2220 px at 600 dpi, sRGB with ICC. |
| `print/card-back-poker-silver-printerstudio-600dpi.png` | Poker print file, silver (Target Cards). Same size. |
| `build-poker-print.py` | Rebuilds both poker print files from the master. Reproduces them exactly. |

SHA-256:

```
e95908b53a105f840124bf962675becfcc8bcf691079c441ab9a04b29139051b  card-back-master-v01.psd
bf320617d93d395b68b57e6bf5e3f9df96eddd5608cb17f7d9a7eb8017c2461c  print/card-back-tarot-printerstudio-600dpi.png
f69df5aaf3808d5dcc8458dcc6b9e3b3362b7cf66a342ec657d8f9e8cfa7d75f  card-back-poker-gold-v01.psd
d1baa0b3a48a916fcd38bee16f3ae5e32d9155b35a424de23583d65147384011  card-back-poker-silver-v02.psd
af4b2bf4abd627db1a00f4ba84bc7ca810f4864f8d76ce984a38764d416f8a72  print/card-back-poker-gold-printerstudio-600dpi.png
f5bc067628feba9b6acb1cdee6cfb475e14d8c5a0d60176336d38450537cc34a  print/card-back-poker-silver-printerstudio-600dpi.png
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
- No ICC profile is embedded. The RGB derivatives assume FOGRA39 (coated) and
  use a **relative colorimetric** conversion to sRGB, without black point
  compensation. (An earlier note here said perceptual. That was wrong:
  relative colorimetric reproduces the tarot file exactly, perceptual comes out
  about 8 levels darker.)

## Colour: where print files must come from

Make every print file from layer 0 of the PSD, Photoshop's own composite
(`convert "card-back-master-v01.psd[0]"`), converted as above. FOGRA39 is at
`/usr/share/texlive/texmf-dist/tex/generic/colorprofiles/FOGRA39L_coated.icc`
in the cloud workspace.

- **Photopea** is fine for editing the layered PSDs, but its composite and
  its PNG export do not match Photoshop: about +35 Yellow and −10 K in the
  pattern area, which reads as a yellow-green cast. Never print from it.
- **ImageMagick** ignores layer effects, clipping masks and adjustment layers
  (flat yellow frames, a purple compass, no hex pattern). Use it only to read
  the composite and layer transparency.

## Making the tarot derivative

The tarot file scales the full canvas by 0.998 (it fills the bleed box exactly)
and crops less than 0.1 mm from each side, so the frame stays about 3 mm inside
the cut.

## Poker variants (31 October 2026)

Decided by Robert: no artist commission. The poker backs are the master with
both "The Quiet Vale" titles removed, re-laid to poker size. Gold frame for the
Quest Cards, silver frame for the Target Cards. Only the metal changes
colour (frame, corners, compass, hex pattern marks); the leather and the glow
around the compass are identical on both.

**Print files** (`build-poker-print.py`), every pixel from the master's composite:

1. Both titles are filled from the pattern 464 px away (two repeats; the hex
   pattern repeats every 232 px down and 134 px across). The fill mask is the
   title widened 48 px to take its dark outer glow, minus the frame and corners.
   Brightness is matched from a ring of background around it.
2. A 464-row band is cut through the middle (rows 1268 to 1732) with a 40-row
   cross-fade, so the frame sides and pattern run straight through. The compass
   is then pasted back whole.
3. The leather margin is widened 31 px each side by mirroring, and the result is
   scaled to 1630 × 2220 px. The frame sits about 2.3 mm inside the cut at top
   and bottom and 3.4 mm at the sides.
4. Silver: pixels with an RGB chroma (max minus min) below 12 are unchanged,
   above 28 they are fully silver (saturation −100, lightness +6), smooth
   in between.

**Layered templates** (Photopea): the titles group (`Outer Frame copia`, which
held the titles and the gold texture clipped to them) is deleted. Outer Frame,
Corners, the hidden Safe Area and the Grid group mask are split at row 1500 and
the halves moved 274 px towards each other; the canvas is cropped to
1800 × 2452 and resized to 1630 × 2220. In these the frame sits 2.5 mm inside
the cut on every side, which differs slightly from the print files because the
print cut has to be a whole number of pattern repeats. Print from the PNGs.
The silver template adds Hue/Saturation layers (saturation −100, lightness +6)
clipped to Outer Frame, Corners, Bussola copia and Livello 22, so only the
metal changes.
