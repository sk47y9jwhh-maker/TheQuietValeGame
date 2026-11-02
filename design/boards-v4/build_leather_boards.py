#!/usr/bin/env python3
"""The Quiet Vale: Encounter, Logistics and Core Tiles boards, v4.

v2 (printed by BoardGamesMaker) kept to the map's charcoal leather, but at arm's
length it read as solid black: shallow recesses, dark-on-dark lettering.
v4 keeps the v2 layout and materials and strengthens only what was lost:

- deeper recesses with a darker floor, a crisper cut and a lit lower lip;
- a gold waxed-linen stitch line running around every recess;
- larger gold-foil lettering, raised, with a fine gold rule and diamond under it;
- debossed resource and tile-type icons, tinted with their colour;
- Core Tiles: the one tray is divided into five stitched category bays.

Run from the repository root:
    python3 design/boards-v4/build_leather_boards.py [out_dir]
Writes 12 px/mm (304.8 ppi) RGB PNGs with 3.175 mm bleed and previews.
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "design/a1-board-unified"))
from generate_unified_a1_board import (  # noqa: E402
    MAP_HEIGHT_MM,
    MAP_TOP_MM,
    MAP_WIDTH_MM,
    MAP_X_MM,
    apply_unified_neoprene_finish,
    paste_exact_map,
    render_brass_fitting,
    draw_stitch_path,
    load_brass_texture,
    render_recess,
    rounded_rect_path,
    tiled_leather,
)

PPM = 12.0
BLEED = 3.175
FONTS = ROOT / "src/assets/fonts"
ICONS = ROOT / "design/artist-tile-templates/assets"
TREE_LOGO = ROOT / "src/assets/quiet_vale_tree_brass_transparent.png"
CARD_BACK = ROOT / "design/encounter-card-templates/card-back/print/card-back-tarot-printerstudio-600dpi.png"
ALMENDRA_BOLD = FONTS / "almendra-latin-bold.woff2"
ALMENDRA = FONTS / "almendra-latin-regular.woff2"
SANS = FONTS / "alegreya-sans-latin-bold.woff2"
EDGE_THREAD = (157, 119, 78)       # the map board's outer stitch
GOLD_THREAD = (196, 158, 86)       # recess stitching
RESOURCE_THREADS = {
    "STONE": (126, 135, 142), "METAL": (101, 133, 151), "GOODS": (149, 86, 62),
    "WOOD": (91, 124, 76), "FOOD": (151, 141, 52), "HERBS": (123, 91, 137),
}
RESOURCE_ICONS = {r: f"icon-Resource {r.title()}.png" for r in RESOURCE_THREADS}
CATEGORY_ICONS = {
    "RESOURCE": ["icon-Type Resource.png"], "MERCHANT & CRAFTING": ["icon-Type Merchant.png", "icon-Type Crafting.png"],
    "SOCIAL & WELLBEING": ["icon-Type Social.png", "icon-Type Wellbeing.png"], "HOUSING": ["icon-Type House.png"],
    "TRAVEL": ["icon-Type Travel.png"],
}
CATEGORY_TINT = {
    "RESOURCE": (78, 103, 72), "MERCHANT & CRAFTING": (138, 109, 43), "SOCIAL & WELLBEING": (122, 79, 107),
    "HOUSING": (154, 91, 60), "TRAVEL": (122, 111, 88),
}


def P(mm: float) -> int:
    return round(mm * PPM)


def shift(mask: Image.Image, dx: int, dy: int) -> Image.Image:
    out = Image.new("L", mask.size, 0)
    out.paste(mask, (dx, dy))
    return out


def rgba(colour, alpha_mask: Image.Image, k: float = 1.0) -> Image.Image:
    layer = Image.new("RGBA", alpha_mask.size, (*colour, 0))
    layer.putalpha(alpha_mask.point(lambda v: round(v * k)))
    return layer


class Board:
    def __init__(self, w_mm: float, h_mm: float, seed: int):
        self.w, self.h = w_mm, h_mm
        W, H = P(w_mm + 2 * BLEED), P(h_mm + 2 * BLEED)
        self.img = tiled_leather(W, H, PPM).convert("RGBA")
        # No outer edge stitch: the gold stitching round each tray is the
        # only stitch line, and the trays use the space it took.
        self.seed = seed

    # Coordinates are in mm from the finished (trimmed) top-left corner.
    def xy(self, x: float, y: float) -> tuple[int, int]:
        return P(BLEED + x), P(BLEED + y)

    def recess(self, l: float, t: float, r: float, b: float, radius: float = 5.0, stitch: bool = True, seed: int = 0, inset: float = 3.0):
        """A deep, crisply cut tray, ringed by gold stitching."""
        x0, y0 = self.xy(l, t)
        x1, y1 = self.xy(r, b)
        render_recess(self.img, (x0, y0, x1, y1), radius_px=P(radius), depth_px=P(2.5), interior_brightness=0.6, outer_cut_opacity=0.5)
        # The lower and right lip of the cut catches the light: a fine warm
        # line just outside the edge, which is what shows the depth on a matt
        # laminate from across the table.
        pad = P(2)
        m = Image.new("L", (x1 - x0 + 2 * pad, y1 - y0 + 2 * pad), 0)
        ImageDraw.Draw(m).rounded_rectangle((pad, pad, pad + x1 - x0, pad + y1 - y0), radius=P(radius), fill=255)
        grown = m.filter(ImageFilter.MaxFilter(2 * P(0.45) + 1))
        ring = ImageChops.subtract(grown, m)
        lower_right = ImageChops.subtract(ring, shift(ring, P(0.6), P(0.6))).filter(ImageFilter.GaussianBlur(P(0.18)))
        upper_left = ImageChops.subtract(ring, shift(ring, -P(0.6), -P(0.6))).filter(ImageFilter.GaussianBlur(P(0.2)))
        layer = rgba((172, 150, 108), lower_right, 0.55)
        layer.alpha_composite(rgba((0, 0, 0), upper_left, 0.55))
        # Inner shadow along the top and left walls, slightly deeper than v2.
        inner = m.copy()
        wall = ImageChops.subtract(inner, shift(inner, P(1.6), P(1.6))).filter(ImageFilter.GaussianBlur(P(1.0)))
        wall = ImageChops.multiply(wall, m)
        layer.alpha_composite(rgba((0, 0, 0), wall, 0.5))
        self.img.alpha_composite(layer, (x0 - pad, y0 - pad))
        if stitch:
            # Gold thread sewn round the floor of the tray, a few mm in from its wall.
            g = inset
            draw_stitch_path(self.img, rounded_rect_path((x0 + P(g), y0 + P(g), x1 - P(g), y1 - P(g)), P(7.0)), GOLD_THREAD, PPM, seed=self.seed + seed)

    def gold(self, mask: Image.Image, seed: int) -> Image.Image:
        """Aged gold foil coloured from the photographed brass, with grain."""
        src = load_brass_texture()
        rng = np.random.default_rng(seed)
        side = min(src.size)
        cs = int(side * 0.5)
        ox, oy = int(rng.integers(0, src.width - cs)), int(rng.integers(0, src.height - cs))
        tex = src.crop((ox, oy, ox + cs, oy + cs)).resize((max(mask.size),) * 2, Image.Resampling.LANCZOS).crop((0, 0, *mask.size))
        lum = np.asarray(tex.convert("L"), np.float32) / 255
        tone = np.clip((lum - 0.18) / 0.62, 0, 1)
        lo = np.array((126, 94, 44), np.float32)
        mid = np.array((204, 166, 92), np.float32)
        hi = np.array((240, 214, 150), np.float32)
        t = tone[..., None]
        col = np.where(t < 0.5, lo + (mid - lo) * (t * 2), mid + (hi - mid) * ((t - 0.5) * 2))
        return Image.fromarray(np.clip(col, 0, 255).astype(np.uint8))

    def foil_mask_draw(self, mask: Image.Image, at: tuple[int, int], seed: int, wear: float = 0.12):
        """Raised gold foil: lit upper-left edge, shadow falling lower-right."""
        rng = np.random.default_rng(seed)
        m = np.asarray(mask, np.float32)
        worn = np.clip(rng.random(m.shape) * 1.0, 0, 1)
        blotch = np.asarray(Image.fromarray((rng.random((max(2, mask.height // 40), max(2, mask.width // 40))) * 255).astype(np.uint8)).resize(mask.size, Image.Resampling.BICUBIC), np.float32) / 255
        alpha = m * (1 - wear * (worn * 0.5 + blotch * 0.8))
        mask_w = Image.fromarray(np.clip(alpha, 0, 255).astype(np.uint8))
        shadow = shift(mask, P(0.32), P(0.38)).filter(ImageFilter.GaussianBlur(P(0.22)))
        lit = ImageChops.subtract(mask, shift(mask, P(0.14), P(0.14)))
        dark = ImageChops.subtract(mask, shift(mask, -P(0.14), -P(0.14)))
        layer = rgba((4, 4, 3), shadow, 0.7)
        foil = self.gold(mask, seed).convert("RGBA")
        foil.putalpha(mask_w)
        layer.alpha_composite(foil)
        layer.alpha_composite(rgba((255, 240, 196), lit, 0.6))
        layer.alpha_composite(rgba((70, 50, 22), dark, 0.55))
        self.img.alpha_composite(layer, at)

    def label(self, text: str, cx: float, cy: float, size_mm: float, seed: int, rule: bool = False, font=ALMENDRA_BOLD, max_w: float | None = None, features=None):
        f = ImageFont.truetype(str(font), P(size_mm))
        if max_w:
            while f.getlength(text) > P(max_w) and f.size > P(2.5):
                f = ImageFont.truetype(str(font), f.size - 2)
        bb = f.getbbox(text, anchor="mm", features=features)
        pad = P(1.5)
        w, h = bb[2] - bb[0] + 2 * pad, bb[3] - bb[1] + 2 * pad
        rule_h = P(4.2) if rule else 0
        mask = Image.new("L", (w, h + rule_h), 0)
        d = ImageDraw.Draw(mask)
        d.text((w / 2, pad - bb[1]), text, font=f, fill=255, anchor="mm", features=features)
        if rule:
            # A fine gilt rule with a centre diamond, the width of the word.
            ry = h + P(1.6)
            half = (bb[2] - bb[0]) / 2
            d.line((w / 2 - half, ry, w / 2 - P(2.2), ry), fill=255, width=max(2, P(0.32)))
            d.line((w / 2 + P(2.2), ry, w / 2 + half, ry), fill=255, width=max(2, P(0.32)))
            r = P(1.25)
            d.polygon([(w / 2, ry - r), (w / 2 + r, ry), (w / 2, ry + r), (w / 2 - r, ry)], fill=255)
        X, Y = self.xy(cx, cy)
        self.foil_mask_draw(mask, (round(X - w / 2), round(Y - h / 2)), seed)

    def deboss_icon(self, name: str, cx: float, cy: float, size_mm: float, tint, strength: float = 0.6):
        """An icon pressed into the leather, with a trace of its colour."""
        im = Image.open(ICONS / name).convert("RGBA")
        k = P(size_mm) / max(im.size)
        im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.Resampling.LANCZOS)
        a = im.getchannel("A")
        # Use the drawing's ink as the pressed area so its detail survives.
        ink = ImageChops.multiply(a, im.convert("L").point(lambda v: 255 - v).point(lambda v: min(255, v * 2)))
        mask = ImageChops.lighter(ink, a.point(lambda v: int(v * 0.35)))
        X, Y = self.xy(cx, cy)
        at = (round(X - im.width / 2), round(Y - im.height / 2))
        layer = rgba((8, 8, 6), mask, 0.55 * strength)
        layer.alpha_composite(rgba(tint, ImageChops.multiply(mask, a), 0.85 * strength))
        lit = ImageChops.subtract(mask, shift(mask, -P(0.2), -P(0.2)))
        layer.alpha_composite(rgba((205, 183, 132), lit, 0.45 * strength))
        self.img.alpha_composite(layer, at)

    def emblem(self, cx: float, cy: float, diameter_mm: float):
        """The compass medallion from the Encounter Card back, set into the
        leather with a soft contact shadow."""
        src = Image.open(CARD_BACK).convert("RGB")
        c, r = (897, 1497), 333
        disc = src.crop((c[0] - r, c[1] - r, c[0] + r, c[1] + r))
        size = P(diameter_mm)
        disc = disc.resize((size, size), Image.Resampling.LANCZOS)
        ss = 4
        m = Image.new("L", (size * ss, size * ss), 0)
        ImageDraw.Draw(m).ellipse((ss, ss, size * ss - ss, size * ss - ss), fill=255)
        m = m.resize((size, size), Image.Resampling.LANCZOS)
        X, Y = self.xy(cx, cy)
        at = (X - size // 2, Y - size // 2)
        # Kept quiet: muted, darkened and partly transparent so it reads as
        # tooling worked into the leather rather than a bright badge on it.
        from PIL import ImageEnhance
        disc = ImageEnhance.Color(disc).enhance(0.55)
        disc = ImageEnhance.Brightness(disc).enhance(0.62)
        disc = ImageEnhance.Contrast(disc).enhance(0.85)
        layer = disc.convert("RGBA")
        layer.putalpha(m.point(lambda v: round(v * 0.42)))
        self.img.alpha_composite(layer, at)

    def tree(self, cx: float, cy: float, height_mm: float, opacity: float = 0.5):
        """The game's brass tree, treated like the medallion: quiet, as if
        tooled into the leather. The source is small (152 x 218 px), so its
        outline is rebuilt crisply at print size and its shading upscaled."""
        from PIL import ImageEnhance
        src = Image.open(TREE_LOGO).convert("RGBA")
        src = src.crop(src.getbbox())
        h = P(height_mm)
        w = round(src.width * h / src.height)
        a = src.getchannel("A").resize((w, h), Image.Resampling.LANCZOS).filter(ImageFilter.GaussianBlur(P(0.12)))
        a = a.point(lambda v: max(0, min(255, round((v - 128) * 2.6 + 128))))
        rgb = src.convert("RGB").resize((w, h), Image.Resampling.BICUBIC)
        rgb = ImageEnhance.Color(rgb).enhance(0.55)
        rgb = ImageEnhance.Brightness(rgb).enhance(0.66)
        layer = rgb.convert("RGBA")
        layer.putalpha(a.point(lambda v: round(v * opacity)))
        X, Y = self.xy(cx, cy)
        self.img.alpha_composite(layer, (X - w // 2, Y - h // 2))

    def stitch_line(self, pts_mm, colour=GOLD_THREAD, seed=0):
        draw_stitch_path(self.img, [self.xy(x, y) for x, y in pts_mm], colour, PPM, seed=self.seed + seed)

    def finish(self) -> Image.Image:
        return apply_unified_neoprene_finish(self.img, PPM).convert("RGB")


W_LONG, H_LONG = 568.5, 146.0


# Card wells: 80 x 134 mm round a 70 x 120 mm tarot Encounter Card. The gold
# stitch runs 3 mm in (74 x 128 mm), framing a centred card with 2 to 4 mm to
# spare. The Logistics board uses the same grid.
M = 6.0                 # leather margin; keeps clear of any edge wrap
WELL_W = 80.0
WELL_H = 146.0 - 2 * M  # 134 mm
TRANSITION = 7.0
STITCH_IN = 3.0


def encounter_board() -> Image.Image:
    b = Board(W_LONG, H_LONG, 81000)
    b.recess(M, M, M + WELL_W, M + WELL_H, radius=4.0, seed=1, inset=STITCH_IN)
    b.recess(W_LONG - M - WELL_W, M, W_LONG - M, M + WELL_H, radius=4.0, seed=2, inset=STITCH_IN)
    il, ir = M + WELL_W + TRANSITION, W_LONG - M - WELL_W - TRANSITION
    b.recess(il, M, ir, M + WELL_H, seed=3, inset=STITCH_IN)
    b.emblem(M + WELL_W / 2, M + WELL_H / 2, 40)
    b.tree(W_LONG - M - WELL_W / 2, M + WELL_H / 2, 46)
    b.label("ENCOUNTER", M + WELL_W / 2, M + 11, 6.6, 11, max_w=62)
    b.label("DISCARD", W_LONG - M - WELL_W / 2, M + 11, 6.6, 12, max_w=62)
    b.label("IN PLAY", W_LONG / 2, M + 11, 8.2, 13)
    b.label("face down", M + WELL_W / 2, M + WELL_H - 9.5, 3.6, 14, font=FONTS / "alegreya-latin-italic.woff2")
    b.label("face up", W_LONG - M - WELL_W / 2, M + WELL_H - 9.5, 3.6, 15, font=FONTS / "alegreya-latin-italic.woff2")
    return b.finish()


def logistics_board() -> Image.Image:
    """Target Cards and Tokens in their own wells; the six Warehouses share
    one open tray, each marked only by its name at the top, its coloured
    stitch halfway down (stock above, spare discs below) and its icon at the
    foot."""
    b = Board(W_LONG, H_LONG, 82000)
    m, end_w, tgap = M, WELL_W, TRANSITION
    cl = m + end_w + tgap
    cr = W_LONG - cl
    # Target Cards
    b.recess(m, m, m + end_w, H_LONG - m, radius=4.5, seed=10, inset=STITCH_IN)
    b.emblem(m + end_w / 2, H_LONG / 2, 40)
    b.label("TARGET CARDS", m + end_w / 2, m + 11, 6.0, 20, max_w=end_w - 9)
    b.label("face down", m + end_w / 2, H_LONG - m - 9.5, 3.6, 50, font=FONTS / "alegreya-latin-italic.woff2")
    # Tokens
    tx = W_LONG - m - end_w
    b.recess(tx, m, tx + end_w, H_LONG - m, radius=4.5, seed=17, inset=STITCH_IN)
    b.tree(tx + end_w / 2, H_LONG / 2, 46)
    b.label("TOKENS", tx + end_w / 2, m + 11, 6.6, 27, max_w=end_w - 9)
    b.label("Strain · Supported · Timers", tx + end_w / 2, H_LONG - m - 9.5, 3.4, 51, font=FONTS / "alegreya-latin-italic.woff2")
    # Warehouses: one open tray
    b.recess(cl, m, cr, H_LONG - m, radius=5.0, seed=11, inset=STITCH_IN)
    inner_l, inner_r = cl + 4, cr - 4
    w = (inner_r - inner_l) / 6
    mid = H_LONG / 2
    for i, lab in enumerate(RESOURCE_THREADS):
        cx = inner_l + w * (i + 0.5)
        b.label(lab, cx, m + 11, 6.6, 21 + i, max_w=w - 6)
        # Whole stitches only, centred, so no clipped fragment at either end.
        span = w - 14
        n = int((span + 2.45) // (3.9 + 2.45))
        run = n * 3.9 + (n - 1) * 2.45
        for k in range(n):
            sx = cx - run / 2 + k * (3.9 + 2.45)
            b.stitch_line([(sx, mid), (sx + 3.9, mid)], RESOURCE_THREADS[lab], seed=100 + i * 10 + k)
        b.deboss_icon(RESOURCE_ICONS[lab], cx, H_LONG - m - 15, 15, RESOURCE_THREADS[lab])
    return b.finish()


def core_board() -> Image.Image:
    """The Tiles board: one open tray, as v2, with gold prompts for where
    things go: Quest Card top left, unlocked Special Tiles top right and the
    Core Tile categories along the foot (name above, icon below)."""
    CW, CH = 284.25, 232.83
    b = Board(CW, CH, 83000)
    m = 6.0
    b.recess(m, m, CW - m, CH - m, radius=5.5, seed=1)
    b.label("TILES", CW / 2, m + 15, 10.0, 60)
    b.tree(CW / 2, m + 47, 40)
    b.label("QUEST CARD", m + 40, m + 13, 5.6, 61)
    b.label("UNLOCKED", CW - m - 45, m + 10, 5.6, 62)
    b.label("SPECIAL TILES", CW - m - 45, m + 17, 5.6, 63)
    bays = ["RESOURCE", "MERCHANT & CRAFTING", "SOCIAL & WELLBEING", "HOUSING", "TRAVEL"]
    inner_l, inner_r = m + 4, CW - m - 4
    w = (inner_r - inner_l) / len(bays)
    # Names sit just below where a Quest Card turned landscape (89 x 64 mm)
    # would lie in the top-left corner, so it never covers them; stacks of
    # tiles go between the names and the icons at the foot.
    name_y = m + 3 + 64 + 13
    for i, name in enumerate(bays):
        cx = inner_l + w * (i + 0.5)
        if " & " in name:
            a_, c_ = name.split(" & ")
            b.label(a_ + " &", cx, name_y - 3.3, 4.8, 70 + i, max_w=w - 3)
            b.label(c_, cx, name_y + 3.3, 4.8, 80 + i, max_w=w - 3)
        else:
            b.label(name, cx, name_y, 5.4, 70 + i, max_w=w - 3)
        icons = CATEGORY_ICONS[name]
        isz = 16 if len(icons) == 1 else 12.5
        for k, ic in enumerate(icons):
            off = (k - (len(icons) - 1) / 2) * (isz + 1.5)
            b.deboss_icon(ic, cx + off, CH - m - 16, isz, CATEGORY_TINT[name])
    return b.finish()


def socket(b: Board, cx: float, cy: float, r: float):
    """A round, deep socket for the round marker, with a fine gold ring."""
    x0, y0 = b.xy(cx - r, cy - r)
    x1, y1 = b.xy(cx + r, cy + r)
    render_recess(b.img, (x0, y0, x1, y1), radius_px=(x1 - x0) // 2, depth_px=P(2.4), interior_brightness=0.56, outer_cut_opacity=0.45)
    size = x1 - x0 + 2 * P(2)
    ring = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(ring)
    o = P(2) - P(1.3)
    d.ellipse((o, o, size - 1 - o, size - 1 - o), outline=255, width=max(2, P(0.38)))
    b.foil_mask_draw(ring, (x0 - P(2), y0 - P(2)), seed=int(cx * 10))


def map_board() -> Image.Image:
    """The map board, matched to the v4 boards: no outer edge stitch, a gold
    stitch round the map, and a clear round tracker in three Season trays."""
    MW, MH = 698.5, 568.5
    b = Board(MW, MH, 84000)
    map_left = (MW - MAP_WIDTH_MM) / 2.0
    map_top = 18.0
    # The artist map at its locked scale and hex geometry (same routine and
    # parameters as the printed board).
    paste_exact_map(b.img, PPM, (map_left + BLEED - MAP_X_MM, map_top + BLEED - MAP_TOP_MM), paper_age_strength=0.72, paper_age_seed=93517)
    map_right, map_bottom = map_left + MAP_WIDTH_MM, map_top + MAP_HEIGHT_MM
    g = 5.0
    x0, y0 = b.xy(map_left - g, map_top - g)
    x1, y1 = b.xy(map_right + g, map_bottom + g)
    draw_stitch_path(b.img, rounded_rect_path((x0, y0, x1, y1), P(7.0)), GOLD_THREAD, PPM, seed=84001)
    for x, y, sx, sy, seed in ((map_left, map_top, 1, 1, 66101), (map_right, map_top, -1, 1, 66102), (map_left, map_bottom, 1, -1, 66103), (map_right, map_bottom, -1, -1, 66104)):
        render_brass_fitting(b.img, (x + BLEED, y + BLEED), sx, sy, PPM, seed, patina_strength=0.78)
    # Round tracker: one stitched tray per Season, each inside one fold
    # panel (folds at 232.83 and 465.67 mm), so no hinge crosses a tray.
    t_top = map_bottom + g + 4.0
    t_bot = MH - 5.0
    cy = (t_top + t_bot) / 2
    r = 8.5                                   # 17 mm socket for a 15 mm disc
    for s, centre in enumerate((MW / 6, MW / 2, MW * 5 / 6)):
        left, right = centre - 100, centre + 100
        b.recess(left, t_top, right, t_bot, radius=4.5, seed=300 + s, inset=2.5)
        # Season name on the left of the tray.
        lx = left + 26
        b.label("SEASON", lx, cy - 5.2, 4.2, 400 + s)
        b.label(("I", "II", "III")[s], lx, cy + 4.0, 9.0, 410 + s)
        for k in range(4):
            sx = left + 64 + k * 34.5
            socket(b, sx, cy, r)
            # Lining figures, so 1 and 12 stand the same height.
            b.label(str(s * 4 + k + 1), sx, cy, 8.6, 500 + s * 4 + k, font=SANS, features=["lnum"])
    return b.finish()


def main() -> None:
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "output/boards-v4"
    out.mkdir(parents=True, exist_ok=True)
    which = sys.argv[2:] or ["map", "encounter", "logistics", "core"]
    builds = {"map": ("01-map-board-v4", map_board), "encounter": ("02-encounter-board-v4", encounter_board), "logistics": ("03-logistics-board-v4", logistics_board), "core": ("04-tiles-board-v4", core_board)}
    for key in which:
        name, fn = builds[key]
        im = fn()
        im.save(out / f"{name}-with-bleed.png", dpi=(304.8, 304.8))
        pv = im.copy()
        pv.thumbnail((2000, 2000))
        pv.save(out / f"{name}-preview.png")
        print(name, im.size)


if __name__ == "__main__":
    main()
