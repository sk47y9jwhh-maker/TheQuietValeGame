#!/usr/bin/env python3
"""Build the locked revised modular boards and consolidated BGM order pack."""

from __future__ import annotations

import gc
import hashlib
import json
import shutil
from pathlib import Path

import generate_modular_board_set_preview as modular
import prepare_modular_board_set_for_print as prep
import show_combined_logistics_board as logistics
import show_named_layouts_with_fold_core as core_design


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "output/pdf/modular-board-set-v2-printer-ready"
PACK = ROOT / "output/pdf/quiet-vale-board-order-pack-v2"
OLD = ROOT / "output/pdf/modular-board-set-v1-printer-ready"
PPM = 12.0
PPI = PPM * 25.4


def digest(path: Path) -> str:
    value = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            value.update(chunk)
    return value.hexdigest()


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    PACK.mkdir(parents=True, exist_ok=True)
    prep.OUTPUT_ROOT = OUTPUT
    prep.PIXELS_PER_MM = PPM
    modular.PPM = PPM
    logistics.PPM = PPM
    core_design.PPM = PPM

    boards = (
        (
            "encounter-board",
            "The Quiet Vale - Encounter Board",
            modular.build_encounter_landscape,
            568.5,
            146.0,
            (284.25,),
            (),
        ),
        (
            "logistics-board",
            "The Quiet Vale - Logistics Board",
            lambda: logistics.build_board(show_capacity_guides=False),
            568.5,
            146.0,
            (284.25,),
            (),
        ),
        (
            "core-tiles-board",
            "The Quiet Vale - Core Tiles Board",
            core_design.build_core,
            284.25,
            232.83,
            (),
            (),
        ),
    )
    manifest = {
        "package": "The Quiet Vale revised modular board set v2",
        "status": "upload-ready pending BoardGamesMaker template preview and physical proof",
        "colour": "RGB artwork for 4C CMYK process printing; no Pantone or foil",
        "finish": "Matte laminated with linen finish where offered",
        "bleedMmEachSide": prep.BLEED_MM,
        "effectivePpi": PPI,
        "boards": [],
    }
    for slug, title, builder, width, height, folds_x, folds_y in boards:
        print(f"Rendering {slug}")
        image = builder()
        manifest["boards"].append(
            prep.package_board(slug, title, image, width, height, folds_x, folds_y)
        )
        del image
        gc.collect()

    manifest_path = OUTPUT / "revised-board-set-v2-manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    # Consolidate only upload assets required for the four-board order.
    upload_files = {
        "01-map-board-upload-with-bleed.pdf": OLD / "map-board/the-quiet-vale-map-board-upload-with-bleed.pdf",
        "01-map-board-upload-with-bleed.png": OLD / "map-board/the-quiet-vale-map-board-upload-with-bleed.png",
        "02-encounter-board-upload-with-bleed.pdf": OUTPUT / "encounter-board/the-quiet-vale-encounter-board-upload-with-bleed.pdf",
        "02-encounter-board-upload-with-bleed.png": OUTPUT / "encounter-board/the-quiet-vale-encounter-board-upload-with-bleed.png",
        "03-logistics-board-upload-with-bleed.pdf": OUTPUT / "logistics-board/the-quiet-vale-logistics-board-upload-with-bleed.pdf",
        "03-logistics-board-upload-with-bleed.png": OUTPUT / "logistics-board/the-quiet-vale-logistics-board-upload-with-bleed.png",
        "04-core-tiles-board-upload-with-bleed.pdf": OUTPUT / "core-tiles-board/the-quiet-vale-core-tiles-board-upload-with-bleed.pdf",
        "04-core-tiles-board-upload-with-bleed.png": OUTPUT / "core-tiles-board/the-quiet-vale-core-tiles-board-upload-with-bleed.png",
    }
    for name, source in upload_files.items():
        if not source.exists():
            raise FileNotFoundError(source)
        shutil.copy2(source, PACK / name)

    guide = PACK / "BOARDGAMESMAKER-ORDER-GUIDE-V2.txt"
    guide.write_text(
        f"""THE QUIET VALE - BOARDGAMESMAKER BOARD ORDER GUIDE V2

LOCKED BOARD STRATEGY
- Map board: 698.5 x 568.5 mm; six-fold, 3 columns x 2 rows.
- Encounter board: 568.5 x 146 mm; centre bi-fold.
- Logistics board: 568.5 x 146 mm; centre bi-fold.
- Core Tiles board: 284.25 x 232.83 mm; flat.
- The Core Tiles board matches the map's six-fold footprint.

ARTWORK AND COLOUR
- Printing: 4C full-colour process.
- Artwork colour mode: RGB; allow BoardGamesMaker's managed 4C conversion.
- Pantone colours: none.
- Foil: none.
- Resolution: {PPI:.1f} PPI.
- Bleed: {prep.BLEED_MM} mm / 0.125 inch on every edge.
- Upload at 100% / Actual Size. Never select Fit, Scale or Stretch.
- Upload the numbered PNG. BoardGamesMaker currently lists JPG, BMP, PNG and GIF
  as accepted artwork formats. Keep the matching PDF as a dimension-verified
  archival master; do not use it unless their production team explicitly asks.

MATERIAL AND FINISH
- Product: Custom Size Game Board, single-sided.
- Material: 2.0 mm Premium blue cardboard for all four boards.
- Surface: Matte laminated with Linen Finish wherever BoardGamesMaker offers it.
- Hinges: creaseless / lay-flat seam hinge.
- Edge: standard manufacturer wrapped/mounted board edge.
- Order one physical proof of every distinct size before production quantity.

BOARD 1 - MAP
- Finished size: 698.5 x 568.5 mm (27.500 x 22.382 in).
- Fold: six-fold, 3 x 2 panels.
- Fold lines: x = 232.833 and 465.667 mm; y = 284.250 mm.
- Folded size: 232.833 x 284.250 mm (9.167 x 11.191 in).
- Upload: 01-map-board-upload-with-bleed.png
- Archive/reference: 01-map-board-upload-with-bleed.pdf
- Do not resize the artist map or alter its hex geometry.

BOARD 2 - ENCOUNTER
- Finished size: 568.5 x 146 mm (22.382 x 5.748 in).
- Fold: one centre bi-fold at x = 284.25 mm.
- Folded size: 284.25 x 146 mm (11.191 x 5.748 in).
- Upload: 02-encounter-board-upload-with-bleed.png
- Archive/reference: 02-encounter-board-upload-with-bleed.pdf
- The central In Play area intentionally crosses the creaseless hinge.

BOARD 3 - LOGISTICS
- Finished size: 568.5 x 146 mm (22.382 x 5.748 in).
- Fold: one centre bi-fold at x = 284.25 mm.
- Folded size: 284.25 x 146 mm (11.191 x 5.748 in).
- Upload: 03-logistics-board-upload-with-bleed.png
- Archive/reference: 03-logistics-board-upload-with-bleed.pdf
- Grid aligns to Encounter: Target Cards / Encounter, warehouses / In Play,
  Tokens / Discard.
- Capacity circles and card outlines are intentionally absent from production art.

BOARD 4 - CORE TILES
- Finished size: 284.25 x 232.83 mm (11.191 x 9.166 in).
- Produce flat with no hinge.
- Upload: 04-core-tiles-board-upload-with-bleed.png
- Archive/reference: 04-core-tiles-board-upload-with-bleed.pdf

ORDER FORM CHECKLIST
1. Choose Custom Size Game Board.
2. Enter the exact finished size above; do not include bleed in the form size.
3. Select Single-sided and 2.0 mm Premium blue cardboard.
4. Select full-colour / 4C printing.
5. Select Matte laminated as 1st Finish and Linen Finish as 2nd Finish.
6. Do not select Pantone, spot ink, gold foil or silver foil.
7. Select creaseless / lay-flat hinges for the Map, Encounter and Logistics.
8. Select Non-fold for Core Tiles.
9. Upload the numbered PNG associated with that board.
10. Confirm the online preview shows no automatic scaling or unexpected crop.
11. Confirm hinge lines against the proof images before approving.
12. Request a digital pre-production proof and order one physical proof.

IMPORTANT MANUFACTURER CONFIRMATIONS
- Confirm that 568.5 x 146 mm mounted boards support one centre creaseless fold.
- Confirm that 284.25 x 232.83 mm is accepted as a flat board on identical stock.
- Confirm Linen Finish is available on every selected board size.
- Confirm supplied RGB artwork will be converted through their standard 4C profile.
- If their current dieline specifies a bleed other than 3.175 mm, stop and adapt
  the files to the supplied dieline before ordering.

WOODEN TOKENS
- Product: 15 x 15 x 4 mm Wooden Disc.
- Product page: https://www.boardgamesmaker.com/print/fi-8817.html
- Quantity: 130 White.
- Quantity: 25 Black, selected from the colour menu for the same blank disc.
- No printing or engraving.
- White use: all six warehouse stocks, Supported markers, the round marker and
  Arrival timers.
- Black use: Strain only.
- Do not mix black into warehouse stock or use white for Strain; the high
  contrast is an intentional accessibility and table-readability convention.

STEWARD MARKER PAWNS
- Product: Wooden Pawns, 12 mm size.
- Confirmed product page:
  https://www.boardgamesmaker.com/print/fi-8762.html
- Dimensions shown by BoardGamesMaker: 12 x 12 x 8 mm.
- Quantity: 8 total, one pawn in each of eight distinct available colours.
- No printing or engraving.
- These are optional Steward markers from which players select their colour.
- Check all eight chosen colours are visibly distinct before checkout.

REFERENCE FILES
- Upload files are the numbered PNG files in this folder.
- Matching numbered PDFs are dimension-verified archival masters.
- Production proofs and finished-size previews are in:
  output/pdf/modular-board-set-v2-printer-ready/
- Existing box order files remain in:
  output/pdf/game-box-standard-v1-printer-ready/

COMPLETE-GAME ITEMS NOT YET CERTIFIED
- The bespoke card-box and tile-box upload artwork must wait for the exact
  manufacturer-approved dielines and insert dimensions.
- Final card faces/backs and physical tile-sheet uploads are not included in
  this board package and require their own production preflight.
- Manual/booklet uploads are not included in this board package. Use page
  counts divisible by four: 4 or 8 pages per A6 Steward booklet, 8 pages for
  Quickstart, and 20 pages for the Rules manual.
""",
        encoding="utf-8",
    )
    pack_manifest = PACK / "SHA256SUMS.txt"
    pack_manifest.write_text(
        "\n".join(
            f"{digest(path)}  {path.name}"
            for path in sorted(PACK.iterdir())
            if path.is_file() and path != pack_manifest
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {OUTPUT}")
    print(f"Wrote {PACK}")


if __name__ == "__main__":
    main()
