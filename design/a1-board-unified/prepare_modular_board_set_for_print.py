#!/usr/bin/env python3
"""Create printer-ready packages for the approved modular board system."""

from __future__ import annotations

import gc
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw
from pypdf import PdfReader
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

import generate_modular_board_set_preview as modular


ROOT = Path(__file__).resolve().parents[2]
OUTPUT_ROOT = ROOT / "output/pdf/modular-board-set-v1-printer-ready"
PIXELS_PER_MM = 12.0
PPI = PIXELS_PER_MM * 25.4
BLEED_MM = 3.175
SAFE_MM = 3.175


def px(mm_value: float) -> int:
    return int(round(mm_value * PIXELS_PER_MM))


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def add_bleed(source: Image.Image) -> Image.Image:
    source = source.convert("RGB")
    bleed = px(BLEED_MM)
    result = Image.new(
        "RGB",
        (source.width + 2 * bleed, source.height + 2 * bleed),
    )
    result.paste(source, (bleed, bleed))
    left = source.crop((0, 0, bleed, source.height)).transpose(
        Image.Transpose.FLIP_LEFT_RIGHT
    )
    right = source.crop(
        (source.width - bleed, 0, source.width, source.height)
    ).transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    top = source.crop((0, 0, source.width, bleed)).transpose(
        Image.Transpose.FLIP_TOP_BOTTOM
    )
    bottom = source.crop(
        (0, source.height - bleed, source.width, source.height)
    ).transpose(Image.Transpose.FLIP_TOP_BOTTOM)
    result.paste(left, (0, bleed))
    result.paste(right, (bleed + source.width, bleed))
    result.paste(top, (bleed, 0))
    result.paste(bottom, (bleed, bleed + source.height))
    # Continue the actual surface into all four corner bleeds. The previous
    # single-colour corner fill produced visibly textureless square patches.
    corners = (
        (
            source.crop((0, 0, bleed, bleed))
            .transpose(Image.Transpose.FLIP_LEFT_RIGHT)
            .transpose(Image.Transpose.FLIP_TOP_BOTTOM),
            (0, 0),
        ),
        (
            source.crop((source.width - bleed, 0, source.width, bleed))
            .transpose(Image.Transpose.FLIP_LEFT_RIGHT)
            .transpose(Image.Transpose.FLIP_TOP_BOTTOM),
            (bleed + source.width, 0),
        ),
        (
            source.crop((0, source.height - bleed, bleed, source.height))
            .transpose(Image.Transpose.FLIP_LEFT_RIGHT)
            .transpose(Image.Transpose.FLIP_TOP_BOTTOM),
            (0, bleed + source.height),
        ),
        (
            source.crop(
                (
                    source.width - bleed,
                    source.height - bleed,
                    source.width,
                    source.height,
                )
            )
            .transpose(Image.Transpose.FLIP_LEFT_RIGHT)
            .transpose(Image.Transpose.FLIP_TOP_BOTTOM),
            (bleed + source.width, bleed + source.height),
        ),
    )
    for corner, position in corners:
        result.paste(corner, position)
    return result


def write_pdf(
    upload: Image.Image,
    path: Path,
    width_mm: float,
    height_mm: float,
    title: str,
) -> None:
    page_width = (width_mm + 2 * BLEED_MM) * mm
    page_height = (height_mm + 2 * BLEED_MM) * mm
    pdf = canvas.Canvas(
        str(path),
        pagesize=(page_width, page_height),
        pageCompression=1,
    )
    pdf.setTitle(title)
    pdf.setAuthor("The Quiet Vale project")
    pdf.setSubject("Printer-ready modular game board artwork with edge-extension bleed")
    pdf.drawImage(
        ImageReader(upload),
        0,
        0,
        width=page_width,
        height=page_height,
        preserveAspectRatio=False,
        mask="auto",
    )
    pdf.showPage()
    pdf.save()


def dashed(
    draw: ImageDraw.ImageDraw,
    xy: tuple[float, float, float, float],
    fill: tuple[int, int, int],
    width: int,
    dash: int,
) -> None:
    x1, y1, x2, y2 = xy
    length = ((x2 - x1) ** 2 + (y2 - y1) ** 2) ** 0.5
    position = 0.0
    while position < length:
        end = min(length, position + dash)
        draw.line(
            (
                x1 + (x2 - x1) * position / length,
                y1 + (y2 - y1) * position / length,
                x1 + (x2 - x1) * end / length,
                y1 + (y2 - y1) * end / length,
            ),
            fill=fill,
            width=width,
        )
        position += dash * 2


def make_proof(
    upload: Image.Image,
    width_mm: float,
    height_mm: float,
    folds_x_mm: tuple[float, ...],
    folds_y_mm: tuple[float, ...],
) -> Image.Image:
    max_width = 2600
    scale = min(1.0, max_width / upload.width)
    proof = upload.resize(
        (
            int(round(upload.width * scale)),
            int(round(upload.height * scale)),
        ),
        Image.Resampling.LANCZOS,
    )
    draw = ImageDraw.Draw(proof)
    bleed = BLEED_MM / (width_mm + 2 * BLEED_MM) * proof.width
    trim_right = proof.width - bleed
    trim_bottom = proof.height - bleed
    safe_x = SAFE_MM / (width_mm + 2 * BLEED_MM) * proof.width
    safe_y = SAFE_MM / (height_mm + 2 * BLEED_MM) * proof.height
    draw.rectangle(
        (bleed, bleed, trim_right, trim_bottom),
        outline=(229, 73, 73),
        width=2,
    )
    draw.rectangle(
        (
            bleed + safe_x,
            bleed + safe_y,
            trim_right - safe_x,
            trim_bottom - safe_y,
        ),
        outline=(76, 205, 132),
        width=2,
    )
    for fold_mm in folds_x_mm:
        x = bleed + fold_mm / width_mm * (trim_right - bleed)
        dashed(draw, (x, bleed, x, trim_bottom), (65, 160, 245), 2, 10)
    for fold_mm in folds_y_mm:
        y = bleed + fold_mm / height_mm * (trim_bottom - bleed)
        dashed(draw, (bleed, y, trim_right, y), (65, 160, 245), 2, 10)
    return proof


def validate_pdf(path: Path, width_mm: float, height_mm: float) -> None:
    reader = PdfReader(str(path))
    if len(reader.pages) != 1:
        raise RuntimeError(f"{path.name}: expected one PDF page")
    page = reader.pages[0]
    actual_width = float(page.mediabox.width) / 72 * 25.4
    actual_height = float(page.mediabox.height) / 72 * 25.4
    expected_width = width_mm + 2 * BLEED_MM
    expected_height = height_mm + 2 * BLEED_MM
    if abs(actual_width - expected_width) > 0.03:
        raise RuntimeError(f"{path.name}: incorrect width {actual_width}")
    if abs(actual_height - expected_height) > 0.03:
        raise RuntimeError(f"{path.name}: incorrect height {actual_height}")


def package_board(
    slug: str,
    title: str,
    image: Image.Image,
    width_mm: float,
    height_mm: float,
    folds_x_mm: tuple[float, ...] = (),
    folds_y_mm: tuple[float, ...] = (),
) -> dict:
    folder = OUTPUT_ROOT / slug
    folder.mkdir(parents=True, exist_ok=True)
    base = f"the-quiet-vale-{slug}"
    finished_path = folder / f"{base}-finished-size.png"
    upload_path = folder / f"{base}-upload-with-bleed.png"
    pdf_path = folder / f"{base}-upload-with-bleed.pdf"
    preview_path = folder / f"{base}-printer-preview.png"
    proof_path = folder / f"{base}-production-proof.png"

    finished = image.convert("RGB")
    expected = (px(width_mm), px(height_mm))
    if finished.size != expected:
        raise RuntimeError(
            f"{slug}: expected {expected} pixels, received {finished.size}"
        )
    finished.save(finished_path, "PNG", optimize=True, dpi=(PPI, PPI))
    upload = add_bleed(finished)
    upload.save(upload_path, "PNG", optimize=True, dpi=(PPI, PPI))
    write_pdf(upload, pdf_path, width_mm, height_mm, title)
    validate_pdf(pdf_path, width_mm, height_mm)
    preview = upload.copy()
    preview.thumbnail((2600, 1800), Image.Resampling.LANCZOS)
    preview.save(preview_path, "PNG", optimize=True)
    proof = make_proof(upload, width_mm, height_mm, folds_x_mm, folds_y_mm)
    proof.save(proof_path, "PNG", optimize=True)

    files = (
        finished_path,
        upload_path,
        pdf_path,
        preview_path,
        proof_path,
    )
    return {
        "slug": slug,
        "title": title,
        "finishedSizeMm": {"width": width_mm, "height": height_mm},
        "finishedSizeIn": {
            "width": round(width_mm / 25.4, 4),
            "height": round(height_mm / 25.4, 4),
        },
        "bleedMmEachSide": BLEED_MM,
        "effectivePpi": round(PPI, 1),
        "folds": {
            "verticalMm": list(folds_x_mm),
            "horizontalMm": list(folds_y_mm),
        },
        "files": {
            path.name: sha256(path)
            for path in files
        },
    }


def main() -> None:
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    modular.PPM = PIXELS_PER_MM

    specifications = [
        (
            "map-board",
            "The Quiet Vale - Modular Map Board",
            modular.build_map_board,
            modular.MAP_BOARD_W_MM,
            modular.MAP_BOARD_H_MM,
            (
                modular.MAP_BOARD_W_MM / 3,
                modular.MAP_BOARD_W_MM * 2 / 3,
            ),
            (modular.MAP_BOARD_H_MM / 2,),
        ),
        (
            "encounter-board",
            "The Quiet Vale - Encounter Board",
            modular.build_encounter_landscape,
            modular.ENCOUNTER_LONG_MM,
            modular.ENCOUNTER_SHORT_MM,
            (modular.ENCOUNTER_LONG_MM / 2,),
            (),
        ),
        (
            "core-tiles-board",
            "The Quiet Vale - Core Tiles Board",
            modular.build_core_board,
            modular.CORE_W_MM,
            modular.CORE_H_MM,
            (),
            (),
        ),
        (
            "target-cards-board",
            "The Quiet Vale - Target Cards Board",
            modular.build_target_board,
            modular.ROTATED_LOGISTICS_W_MM,
            modular.TARGET_BOARD_H_MM,
            (),
            (),
        ),
    ]
    resources = ("WOOD", "FOOD", "STONE", "HERBS", "METAL", "GOODS")
    for index, resource in enumerate(resources):
        specifications.append(
            (
                f"warehouse-{resource.lower()}",
                f"The Quiet Vale - {resource.title()} Warehouse",
                lambda resource=resource, index=index: modular.build_warehouse(
                    resource,
                    69000 + index * 100,
                ),
                modular.WAREHOUSE_W_MM,
                modular.WAREHOUSE_H_MM,
                (),
                (),
            )
        )

    manifest = {
        "package": "The Quiet Vale modular board set",
        "status": "printer-ready pending manufacturer template confirmation and physical proof",
        "raster": {
            "pixelsPerMm": PIXELS_PER_MM,
            "effectivePpi": PPI,
            "colourMode": "RGB",
        },
        "geometry": {
            "artistMapResized": False,
            "hexGeometryChanged": False,
        },
        "boards": [],
    }
    for slug, title, builder, width, height, folds_x, folds_y in specifications:
        print(f"Rendering {slug}...")
        image = builder()
        manifest["boards"].append(
            package_board(
                slug,
                title,
                image,
                width,
                height,
                folds_x,
                folds_y,
            )
        )
        del image
        gc.collect()

    manifest_path = OUTPUT_ROOT / "modular-board-set-printer-manifest.json"
    manifest_path.write_text(
        json.dumps(manifest, indent=2) + "\n",
        encoding="utf-8",
    )
    instructions = OUTPUT_ROOT / "PRINT-AND-FOLD-INSTRUCTIONS.txt"
    instructions.write_text(
        f"""THE QUIET VALE - MODULAR BOARD SET - PRINT AND FOLD INSTRUCTIONS

General upload specification
- Upload each board from its own folder using the *-upload-with-bleed.png
  or matching PDF.
- Finished artwork is RGB at {PPI:.1f} PPI.
- Bleed is {BLEED_MM} mm / 0.125 inch on every side, made by extending
  only the outer leather. No board artwork has been enlarged.
- Print at 100% / Actual Size. Never use Fit or Scale.
- Proof images are reference files only and must not be uploaded.
- Red proof line = trim. Green = safe margin. Blue = fold/hinge.

Map Board
- Finished size: {modular.MAP_BOARD_W_MM:.2f} x {modular.MAP_BOARD_H_MM:.2f} mm
  ({modular.MAP_BOARD_W_MM / 25.4:.3f} x {modular.MAP_BOARD_H_MM / 25.4:.3f} inches).
- Six-fold: 3 columns x 2 rows.
- Folded size: {modular.MAP_BOARD_W_MM / 3:.2f} x {modular.MAP_BOARD_H_MM / 2:.2f} mm.
- Select creaseless / lay-flat hinges.
- The artist map and hex geometry are unchanged.
- Confirm hinge positions against the manufacturer's generated dieline.

Encounter Board
- Finished size: {modular.ENCOUNTER_LONG_MM:.2f} x {modular.ENCOUNTER_SHORT_MM:.2f} mm.
- One vertical centre bi-fold.
- Folded size: {modular.ENCOUNTER_LONG_MM / 2:.2f} x {modular.ENCOUNTER_SHORT_MM:.2f} mm.
- Select a creaseless / lay-flat hinge. The central In Play recess and label
  intentionally cross the hinge.

Flat components
- Core Tiles Board: {modular.CORE_W_MM:.2f} x {modular.CORE_H_MM:.2f} mm.
- Target Cards Board: {modular.ROTATED_LOGISTICS_W_MM:.2f} x {modular.TARGET_BOARD_H_MM:.2f} mm.
- Each warehouse: {modular.WAREHOUSE_W_MM:.2f} x {modular.WAREHOUSE_H_MM:.2f} mm.
- Produce these flat with no hinges.

Final approval gate
- Obtain the exact manufacturer templates before uploading.
- Confirm every upload preview reports the stated finished size and no scaling.
- Confirm all folds use creaseless / lay-flat construction.
- Order one physical proof of every distinct board format before quantity production.
""",
        encoding="utf-8",
    )
    lock_path = OUTPUT_ROOT / "PRINTER-READY-LOCK.txt"
    all_files = sorted(
        path
        for path in OUTPUT_ROOT.rglob("*")
        if path.is_file() and path != lock_path
    )
    lock_path.write_text(
        "THE QUIET VALE - MODULAR BOARD SET - PRINTER READY LOCK\n\n"
        + "\n".join(
            f"{sha256(path)}  {path.relative_to(OUTPUT_ROOT)}"
            for path in all_files
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {manifest_path}")
    print(f"Wrote {instructions}")
    print(f"Wrote {lock_path}")


if __name__ == "__main__":
    main()
