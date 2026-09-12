# The Quiet Vale encounter-card master templates

Version: 1.0

Template family status: **approved and locked on 2026-08-11**

These are the canonical, artist-supplied PSD masters for all Encounter Cards. The four files in `master-templates/` are byte-for-byte copies of the delivered artwork files; the original delivery copies remain outside this repository.

## Locked masters

| Encounter type | Canonical master |
| --- | --- |
| Arrival | `master-templates/arrival-master.psd` |
| Boon | `master-templates/boon-master.psd` |
| Burden | `master-templates/burden-master.psd` |
| Golden Boon | `master-templates/golden-boon-master.psd` |

Every master is:

- 1800 × 3000 pixels;
- 600 DPI, equivalent to a 3 × 5 inch canvas;
- 8-bit CMYK with four channels;
- layered, with live editable text fields;
- protected by the SHA-256 checksum recorded in `manifest.json`.

## What is locked

- Canvas size and aspect ratio.
- Artist artwork, frames, ornaments, icons, colours, and layer geometry.
- Type hierarchy and the existing live-text field positions.
- The use of these four PSDs as the source templates for every Encounter Card.

## What is not yet locked

- Printer or manufacturing vendor.
- Vendor-specific bleed, safe-zone, cut line, sheet imposition, and export profile.
- Final card wording and card-by-card typesetting adjustments.
- The final flattened delivery format.

The current 1800 × 3000 canvas must not be cropped or resized while the printer decision is parked. A printer-specific derivative can be made later without changing these masters.

## Editing rules

### Online display

The artist's card bleed was confirmed as **3 mm per edge** on 2026-09-12.
The online `EncounterCard` component displays a 70.2 × 121 mm face from
the full 76.2 × 127 mm composition. It uses the trimmed images in
`src/assets/encounter-cards/web/` and offsets the live-text coordinate system
by the same amount, preserving alignment. `outputMode="print"` restores the
full artwork and text canvas with bleed. The default mode is `web`.

The original PNGs in `src/assets/encounter-cards/` and all PSD masters retain
their bleed. `tools/export-web-card-artwork.py` regenerates the four web
backgrounds and keeps explicit print/web copies under `output/card-versions/`.
It handles both the 900 × 1500 and 1800 × 3000 source resolutions at the same
physical scale. Never trim a web derivative a second time.

### Master files

1. Never edit a file inside `master-templates/` directly.
2. Duplicate the appropriate master into `working/` and edit that duplicate in Photopea or Photoshop.
3. Change only live text fields for normal card production. Preserve artwork, colour mode, frames, icons, and layer positions.
4. Fit copy by shortening and simplifying rules before considering smaller type.
5. Keep the working master as a layered PSD. Flatten only a separate print/export derivative.
6. Treat files in `output/encounter-card-native-proofs/` as proofs, not masters.
7. If a master must ever change, create a new version, record the reason, regenerate its checksum, and explicitly approve the new template family.

The files are locally marked read-only as an accidental-overwrite guard. Their checksums are the durable authority for detecting any change.

Verify the complete locked family from the repository root with:

```bash
node design/encounter-card-templates/verify-masters.mjs
```
