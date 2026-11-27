#!/usr/bin/env python3
"""Render trimmed TTS-resolution versions of the 4 leather-and-brass boards,
plus pack card sprite sheets, pad hex tiles to 512x512 squares for TTS Custom_Tile
Type 1 (Hex), and generate circular token PNGs.

Usage:
  python3 tools/tts/export-boards.py --mode boards --out public/tts/boards
  python3 tools/tts/export-boards.py --mode pack-sheets --work output/tts/raw --out public/tts
  python3 tools/tts/export-boards.py --mode tiles --raw output/tts/raw/tiles --out public/tts/tiles
  python3 tools/tts/export-boards.py --mode tokens --out public/tts/tokens
"""
from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]


def render_boards(out_dir: Path) -> None:
    """Render the 4 v4 leather boards at TTS resolution (4.0 px/mm) with bleed trimmed."""
    sys.path.insert(0, str(ROOT / "design/boards-v4"))
    import build_leather_boards as b4

    # 4.0 px/mm gives ~2794x2274 for the 698.5x568.5 mm map board — crisp in TTS and fast to load.
    b4.PPM = 4.0
    # Fallback when Pillow is built without libraqm (OpenType features like lnum).
    _orig_label = b4.Board.label

    def _safe_label(self, *args, **kwargs):
        try:
            return _orig_label(self, *args, **kwargs)
        except KeyError:
            kwargs["features"] = None
            return _orig_label(self, *args, **kwargs)

    b4.Board.label = _safe_label
    out_dir.mkdir(parents=True, exist_ok=True)
    bleed_px = round(b4.BLEED * b4.PPM)

    builds = [
        ("map-board", b4.map_board),
        ("encounter-board", b4.encounter_board),
        ("logistics-board", b4.logistics_board),
        ("tiles-board", b4.core_board),
    ]
    for name, fn in builds:
        im = fn()
        w, h = im.size
        trimmed = im.crop((bleed_px, bleed_px, w - bleed_px, h - bleed_px))
        dest = out_dir / f"{name}.jpg"
        trimmed.convert("RGB").save(dest, format="JPEG", quality=86, optimize=True)
        print(f"board {name}: {trimmed.size[0]}x{trimmed.size[1]} ({dest.stat().st_size // 1024} KB)")


def trim_bleed_ratio(im: Image.Image, full_mm: tuple[float, float], trim_mm: tuple[float, float]) -> Image.Image:
    """Center-crop a print image with bleed down to its finished trim size."""
    w, h = im.size
    crop_w = round(w * (trim_mm[0] / full_mm[0]))
    crop_h = round(h * (trim_mm[1] / full_mm[1]))
    left = (w - crop_w) // 2
    top = (h - crop_h) // 2
    return im.crop((left, top, left + crop_w, top + crop_h))


def pack_sheet(
    image_paths: list[Path],
    cols: int,
    rows: int,
    cell_size: tuple[int, int],
    dest: Path,
    trim_from: tuple[tuple[float, float], tuple[float, float]] | None = None,
    quality: int = 84,
) -> None:
    cw, ch = cell_size
    sheet = Image.new("RGB", (cols * cw, rows * ch), (28, 25, 22))
    for idx, p in enumerate(image_paths):
        if idx >= cols * rows:
            break
        with Image.open(p) as raw:
            im = raw.convert("RGB")
            if trim_from is not None:
                im = trim_bleed_ratio(im, trim_from[0], trim_from[1])
            im = im.resize((cw, ch), Image.Resampling.LANCZOS)
            r, c = divmod(idx, cols)
            sheet.paste(im, (c * cw, r * ch))
    dest.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(dest, format="JPEG", quality=quality, optimize=True)
    print(f"sheet {dest.name}: {sheet.size[0]}x{sheet.size[1]} ({len(image_paths)} cards, {dest.stat().st_size // 1024} KB)")


def pack_all_sheets(work_dir: Path, out_dir: Path) -> None:
    decks_dir = out_dir / "decks"
    decks_dir.mkdir(parents=True, exist_ok=True)

    # Poker card dimensions: 69x94 mm print (with 3mm bleed) -> 63x88 mm trimmed
    poker_cell = (450, 630)
    poker_trim = ((69.0, 94.0), (63.0, 88.0))

    # 1. Target Deck (15 v7.0 cards -> 5x3)
    target_imgs = sorted((work_dir / "target").glob("target-*.png"))
    assert len(target_imgs) == 15, f"Expected 15 target cards, found {len(target_imgs)}"
    pack_sheet(target_imgs, 5, 3, poker_cell, decks_dir / "target-deck.jpg", trim_from=poker_trim, quality=85)

    # Target back (silver poker back)
    silver_back = ROOT / "design/encounter-card-templates/card-back/print/card-back-poker-silver-printerstudio-600dpi.png"
    with Image.open(silver_back) as raw:
        im = trim_bleed_ratio(raw.convert("RGB"), (69.0, 94.0), (63.0, 88.0)).resize(poker_cell, Image.Resampling.LANCZOS)
        im.save(decks_dir / "target-back.jpg", format="JPEG", quality=86, optimize=True)

    # 2. Quest Deck (21 cards -> 7x3)
    quest_imgs = sorted((ROOT / "design/quest-cards/print").glob("quest-*.png"))
    assert len(quest_imgs) == 21, f"Expected 21 quest cards, found {len(quest_imgs)}"
    pack_sheet(quest_imgs, 7, 3, poker_cell, decks_dir / "quest-deck.jpg", trim_from=poker_trim, quality=85)

    # Quest back (gold poker back)
    gold_back = ROOT / "design/encounter-card-templates/card-back/print/card-back-poker-gold-printerstudio-600dpi.png"
    with Image.open(gold_back) as raw:
        im = trim_bleed_ratio(raw.convert("RGB"), (69.0, 94.0), (63.0, 88.0)).resize(poker_cell, Image.Resampling.LANCZOS)
        im.save(decks_dir / "quest-back.jpg", format="JPEG", quality=86, optimize=True)

    # 3. Encounter Decks (rendered in web/trimmed mode at ~400x690)
    tarot_cell = (400, 690)
    for name, cols, rows, expected in [
        ("boons", 6, 5, 30),
        ("burdens", 6, 5, 30),
        ("arrivals", 5, 5, 25),
        ("golden-boons", 5, 2, 5),
    ]:
        imgs = sorted((work_dir / "encounters" / name).glob("*.png"))
        assert len(imgs) == expected, f"Expected {expected} {name} cards, found {len(imgs)}"
        pack_sheet(imgs, cols, rows, tarot_cell, decks_dir / f"{name}-deck.jpg", quality=83)

    # Encounter back (tarot back, 76.2x127 mm with 3mm bleed -> 70.2x121 mm trimmed)
    tarot_back = ROOT / "design/encounter-card-templates/card-back/print/card-back-tarot-printerstudio-600dpi.png"
    with Image.open(tarot_back) as raw:
        im = trim_bleed_ratio(raw.convert("RGB"), (76.2, 127.0), (70.2, 121.0)).resize(tarot_cell, Image.Resampling.LANCZOS)
        im.save(decks_dir / "encounter-back.jpg", format="JPEG", quality=86, optimize=True)


def process_tiles(raw_dir: Path, out_dir: Path) -> None:
    """Trim 3mm print bleed from 1560x1370 artist tiles and center inside a 512x512 square
    JPEG for TTS Custom_Tile Type 1 (Hex). TTS clips Type 1 tiles to its 3D hex mesh, so
    opaque JPEG keeps the full 101-tile set under ~5 MB with zero UV stretching."""
    out_dir.mkdir(parents=True, exist_ok=True)
    # Remove any stale PNGs from earlier runs
    for stale in out_dir.glob("*.png"):
        stale.unlink()
    # Artist tile canvas is 1560x1370 (66x58 mm with 3mm bleed); trimmed hex is 1418x1228 (60x51.96 mm).
    TRIM_W, TRIM_H = 1418, 1228
    OUT_SIZE = 512
    HEX_W = OUT_SIZE
    HEX_H = round(OUT_SIZE * math.sqrt(3) / 2)  # 443 px

    files = sorted(raw_dir.glob("*.png"))
    for p in files:
        with Image.open(p) as raw:
            im = raw.convert("RGBA")
            w, h = im.size
            left = (w - TRIM_W) // 2
            top = (h - TRIM_H) // 2
            cropped = im.crop((left, top, left + TRIM_W, top + TRIM_H))
            resized = cropped.resize((HEX_W, HEX_H), Image.Resampling.LANCZOS)
            canvas = Image.new("RGBA", (OUT_SIZE, OUT_SIZE), (35, 32, 28, 255))
            canvas.alpha_composite(resized, (0, (OUT_SIZE - HEX_H) // 2))
            dest = out_dir / f"{p.stem}.jpg"
            canvas.convert("RGB").save(dest, format="JPEG", quality=85, optimize=True)
    print(f"tiles: {len(files)} hex JPEGs written to {out_dir}")


def make_circle_token(
    dest: Path,
    bg_color: tuple[int, int, int],
    ring_color: tuple[int, int, int],
    icon_path: Path | None = None,
    text: str | None = None,
    text_color: tuple[int, int, int] = (245, 238, 220),
    icon_scale: float = 0.62,
) -> None:
    S = 256
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    # Outer metallic rim
    d.ellipse((4, 4, S - 5, S - 5), fill=ring_color)
    # Inner face
    d.ellipse((16, 16, S - 17, S - 17), fill=bg_color)
    # Subtle inner highlight ring
    d.ellipse((20, 20, S - 21, S - 21), outline=(*ring_color, 160), width=3)

    if icon_path and icon_path.exists():
        with Image.open(icon_path) as raw_ic:
            ic = raw_ic.convert("RGBA")
            sz = round(S * icon_scale)
            ic.thumbnail((sz, sz), Image.Resampling.LANCZOS)
            ix = (S - ic.width) // 2
            iy = (S - ic.height) // 2
            im.alpha_composite(ic, (ix, iy))
    elif text:
        font_path = ROOT / "src/assets/fonts/almendra-latin-bold.woff2"
        try:
            font = ImageFont.truetype(str(font_path), 132 if len(text) == 1 else 78)
        except Exception:
            font = ImageFont.load_default()
        bbox = d.textbbox((0, 0), text, font=font)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        d.text(((S - tw) / 2 - bbox[0], (S - th) / 2 - bbox[1] - 4), text, fill=text_color, font=font)

    dest.parent.mkdir(parents=True, exist_ok=True)
    im.save(dest, format="PNG", optimize=True)


def render_tokens(out_dir: Path) -> None:
    icons = ROOT / "public/icons"
    specs = [
        ("strain.png", (28, 26, 26), (110, 92, 76), icons / "strain.webp", None, (245, 238, 220), 0.64),
        ("supported.png", (64, 48, 28), (196, 152, 74), icons / "supported.webp", None, (245, 238, 220), 0.66),
        ("cooldown-x.png", (52, 34, 34), (176, 140, 82), None, "X", (236, 212, 162), 0.60),
        ("arrival-timer.png", (38, 52, 62), (186, 154, 92), icons / "arrival.webp", None, (245, 238, 220), 0.62),
        ("round-marker.png", (42, 34, 24), (212, 174, 92), ROOT / "src/assets/quiet_vale_tree_brass_transparent.png", None, (245, 238, 220), 0.68),
        ("player-1.png", (44, 34, 22), (218, 178, 92), None, "P1", (245, 222, 160), 0.60),
        ("res-wood.png", (44, 62, 38), (154, 178, 122), icons / "wood.webp", None, (245, 238, 220), 0.62),
        ("res-stone.png", (58, 64, 68), (168, 178, 184), icons / "stone.webp", None, (245, 238, 220), 0.62),
        ("res-metal.png", (44, 60, 72), (146, 176, 194), icons / "metal.webp", None, (245, 238, 220), 0.62),
        ("res-food.png", (78, 66, 28), (206, 184, 98), icons / "food.webp", None, (245, 238, 220), 0.62),
        ("res-herbs.png", (62, 44, 72), (174, 146, 190), icons / "herbs.webp", None, (245, 238, 220), 0.62),
        ("res-goods.png", (78, 44, 32), (198, 138, 108), icons / "goods.webp", None, (245, 238, 220), 0.62),
    ]
    for fname, bg, ring, ic, txt, tc, sc in specs:
        make_circle_token(out_dir / fname, bg, ring, ic, txt, tc, sc)
    print(f"tokens: {len(specs)} token PNGs written to {out_dir}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", required=True, choices=["boards", "pack-sheets", "tiles", "tokens"])
    ap.add_argument("--work", type=Path, default=ROOT / "output/tts/raw")
    ap.add_argument("--raw", type=Path, default=ROOT / "output/tts/raw/tiles")
    ap.add_argument("--out", type=Path, default=ROOT / "public/tts")
    args = ap.parse_args()

    if args.mode == "boards":
        render_boards(args.out)
    elif args.mode == "pack-sheets":
        pack_all_sheets(args.work, args.out)
    elif args.mode == "tiles":
        process_tiles(args.raw, args.out)
    elif args.mode == "tokens":
        render_tokens(args.out)


if __name__ == "__main__":
    main()
