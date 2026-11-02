#!/usr/bin/env python3
"""The Quiet Vale: secondary boards v3 (Encounter, Logistics, Core Tiles).

v2 printed as near-black at arm's length: dark recesses on dark leather, with
small, low-contrast labels. v3 keeps the stitched charcoal leather and brass of
the map board, but every play area is now an inset panel of aged parchment, the
same family as the map's paper. Each panel has a coloured header band with a
large inked label and the game's own icons, plus a printed cue for what goes
there (card outlines, numbered Warehouse spaces, token areas, tile lists).

Run from the repository root:
    python3 design/boards-v3/build_secondary_boards.py [out_dir]
Writes RGB PNGs at 12 px/mm (304.8 ppi) with 3.175 mm bleed and a preview
of each board.
"""
from __future__ import annotations

import math
import random
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "design/a1-board-unified"))
from generate_unified_a1_board import (  # noqa: E402
    draw_stitch_path,
    rounded_rect_path,
    tiled_leather,
)

PPM = 12.0  # pixels per mm, 304.8 ppi
BLEED = 3.175
FONTS = ROOT / "src/assets/fonts"
ICONS = ROOT / "design/artist-tile-templates/assets"
BRASS_CORNER = ROOT / "design/a1-board/assets/shadowless-brass-corner-v1.png"
TILES = ROOT / "src/data/tiles.ts"

INK = (47, 36, 24)
CREAM = (244, 234, 208)
PAPER = (218, 206, 174)
THREAD = (157, 119, 78)
RESOURCES = {
    # name: (header colour, icon)
    "STONE": ((112, 121, 128), "icon-Resource Stone.png"),
    "METAL": ((80, 113, 133), "icon-Resource Metal.png"),
    "GOODS": ((140, 76, 52), "icon-Resource Goods.png"),
    "WOOD": ((78, 110, 63), "icon-Resource Wood.png"),
    "FOOD": ((138, 124, 38), "icon-Resource Food.png"),
    "HERBS": ((112, 78, 128), "icon-Resource Herbs.png"),
}
CATEGORY = {
    "resource": ((78, 103, 72), "icon-Type Resource.png", "Resource"),
    "housing": ((154, 91, 60), "icon-Type House.png", "Housing"),
    "travel": ((122, 111, 88), "icon-Type Travel.png", "Travel"),
    "merchant": ((138, 109, 43), "icon-Type Merchant.png", "Merchant"),
    "crafting": ((79, 107, 122), "icon-Type Crafting.png", "Crafting"),
    "social": ((122, 79, 107), "icon-Type Social.png", "Social"),
    "wellbeing": ((63, 122, 110), "icon-Type Wellbeing.png", "Wellbeing"),
}
SEPIA = (92, 72, 50)


def P(mm: float) -> int:
    return round(mm * PPM)


def font(name: str, size_mm: float) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONTS / name), max(1, P(size_mm)))


# ---------------------------------------------------------------- textures

def value_noise(w: int, h: int, cell_px: float, rng: np.random.Generator) -> np.ndarray:
    gw, gh = max(2, int(w / cell_px) + 2), max(2, int(h / cell_px) + 2)
    small = Image.fromarray((rng.random((gh, gw)) * 255).astype(np.uint8))
    big = small.resize((int(gw * cell_px), int(gh * cell_px)), Image.Resampling.BICUBIC)
    return np.asarray(big, dtype=np.float32)[:h, :w] / 127.5 - 1.0


def parchment(w: int, h: int, seed: int) -> Image.Image:
    rng = np.random.default_rng(seed)
    lum = (1.0 + 0.055 * value_noise(w, h, P(38), rng) + 0.035 * value_noise(w, h, P(11), rng)
           + 0.022 * value_noise(w, h, P(3), rng) + 0.03 * value_noise(w, h, P(0.5), rng))
    # Old water and tea stains: soft, irregular, a little warmer and darker.
    stain = np.clip(value_noise(w, h, P(26), rng) * 2.2 - 1.15, 0, 1)
    stain = np.asarray(Image.fromarray((stain * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(P(1.2))), np.float32) / 255
    base = np.array(PAPER, np.float32)
    warm = np.array((176, 143, 96), np.float32)
    rgb = base[None, None, :] * lum[..., None]
    rgb = rgb * (1 - 0.32 * stain[..., None]) + warm * (0.32 * stain[..., None])
    # Fine fibres.
    fib = value_noise(w, h, P(0.25), rng)
    rgb *= (1 + 0.018 * fib)[..., None]
    return Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8))


def edge_burn(img: Image.Image, mask: Image.Image, width_mm: float, strength: float, seed: int) -> Image.Image:
    """Darken parchment toward its edges, unevenly, like handled paper."""
    rng = np.random.default_rng(seed)
    inner = mask.filter(ImageFilter.GaussianBlur(P(width_mm)))
    a = 1 - np.asarray(inner, np.float32) / 255  # 0 inside, rising toward edge
    wobble = 0.75 + 0.5 * (value_noise(img.width, img.height, P(9), rng) * 0.5 + 0.5)
    a = np.clip(a * 1.9 * wobble, 0, 1) ** 1.3 * strength
    rgb = np.asarray(img, np.float32)
    burnt = np.array((112, 82, 48), np.float32)
    rgb = rgb * (1 - a[..., None]) + burnt * a[..., None]
    return Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8))


# ---------------------------------------------------------------- drawing

class Board:
    def __init__(self, w_mm: float, h_mm: float, seed: int):
        self.w_mm, self.h_mm = w_mm, h_mm
        W, H = P(w_mm + 2 * BLEED), P(h_mm + 2 * BLEED)
        self.img = tiled_leather(W, H, PPM).convert("RGBA")
        self.seed = seed
        self.pending: Image.Image | None = None
        # Edge stitch 6.5 mm inside the finished edge, as on the map board.
        b = BLEED + 6.5
        draw_stitch_path(self.img, rounded_rect_path((P(b), P(b), W - P(b), H - P(b)), P(4.0)), THREAD, PPM, seed=seed + 1)

    def draw(self) -> ImageDraw.ImageDraw:
        """Draw with real alpha blending: marks collect on a layer that is
        composited before anything else is placed on the board."""
        if self.pending is None:
            self.pending = Image.new("RGBA", self.img.size, (0, 0, 0, 0))
        return ImageDraw.Draw(self.pending)

    def flush(self) -> None:
        if self.pending is not None:
            self.img.alpha_composite(self.pending)
            self.pending = None

    def box(self, x: float, y: float, w: float, h: float) -> tuple[int, int, int, int]:
        return P(BLEED + x), P(BLEED + y), P(BLEED + x + w), P(BLEED + y + h)

    def panel(self, x: float, y: float, w: float, h: float, seed: int, radius: float = 3.2) -> tuple[int, int, int, int]:
        """An aged parchment panel set into a cut in the leather."""
        self.flush()
        x0, y0, x1, y1 = self.box(x, y, w, h)
        pw, ph = x1 - x0, y1 - y0
        m = Image.new("L", (pw, ph), 0)
        ImageDraw.Draw(m).rounded_rectangle((0, 0, pw - 1, ph - 1), radius=P(radius), fill=255)
        paper = edge_burn(parchment(pw, ph, seed), m, 4.5, 0.55, seed + 7)
        # Lit cut edge in the leather around the panel: a pale rim reads as
        # the bevel of a recess even on a matt board.
        pad = P(2.5)
        rim = Image.new("L", (pw + 2 * pad, ph + 2 * pad), 0)
        ImageDraw.Draw(rim).rounded_rectangle((pad - P(1.1), pad - P(1.1), pad + pw + P(1.1), pad + ph + P(1.1)), radius=P(radius + 1.1), fill=255)
        hole = Image.new("L", rim.size, 0)
        ImageDraw.Draw(hole).rounded_rectangle((pad, pad, pad + pw, pad + ph), radius=P(radius), fill=255)
        ring = ImageChops.subtract(rim, hole)
        # Bottom/right of the cut catches the light; top/left is in shade.
        lit = ImageChops.subtract(ring, ImageChops.offset(ring, P(0.9), P(0.9))).filter(ImageFilter.GaussianBlur(P(0.25)))
        shade = ImageChops.subtract(ring, ImageChops.offset(ring, -P(0.9), -P(0.9))).filter(ImageFilter.GaussianBlur(P(0.3)))
        ov = Image.new("RGBA", rim.size, (0, 0, 0, 0))
        ov.paste((196, 170, 120, 255), (0, 0), ring.point(lambda v: int(v * 0.42)))
        ov.alpha_composite(Image.merge("RGBA", (*Image.new("RGB", rim.size, (226, 204, 156)).split(), lit.point(lambda v: int(v * 0.75)))))
        ov.alpha_composite(Image.merge("RGBA", (*Image.new("RGB", rim.size, (6, 6, 5)).split(), shade.point(lambda v: int(v * 0.6)))))
        self.img.alpha_composite(ov, (x0 - pad, y0 - pad))
        # Paper, then the recess shadow cast by the upper-left leather wall.
        layer = paper.convert("RGBA")
        sh = Image.new("L", (pw, ph), 0)
        sd = ImageDraw.Draw(sh)
        sd.rounded_rectangle((-P(3), -P(3), pw + P(3), ph + P(3)), radius=P(radius), outline=255, width=P(3))
        sh = ImageChops.offset(sh, P(1.3), P(1.3)).filter(ImageFilter.GaussianBlur(P(1.5)))
        sh = ImageChops.multiply(sh, m)
        dark = Image.merge("RGBA", (*Image.new("RGB", (pw, ph), (28, 20, 12)).split(), sh.point(lambda v: int(v * 0.62))))
        layer.alpha_composite(dark)
        self.img.paste(layer, (x0, y0), m)
        # Inked double rule just inside the edge.
        d = self.draw()
        for inset, wmm in ((2.2, 0.45), (3.1, 0.2)):
            d.rounded_rectangle((x0 + P(inset), y0 + P(inset), x1 - P(inset), y1 - P(inset)), radius=P(max(0.5, radius - inset * 0.6)), outline=(*INK, 200), width=max(1, P(wmm)))
        return x0, y0, x1, y1

    def band(self, x0: int, y0: int, x1: int, h_mm: float, colours, label: str, size_mm: float, icons=(), inset_mm: float = 3.6):
        """A coloured, slightly worn header band with a large label."""
        self.flush()
        bx0, by0, bx1 = x0 + P(inset_mm), y0 + P(inset_mm), x1 - P(inset_mm)
        bh = P(h_mm)
        bw = bx1 - bx0
        rng = np.random.default_rng(len(label) * 97 + x0)
        col = Image.new("RGB", (bw, bh))
        cd = ImageDraw.Draw(col)
        n = len(colours)
        for i, c in enumerate(colours):
            cd.rectangle((round(i * bw / n), 0, round((i + 1) * bw / n), bh), fill=c)
        # Wear: mottle and a few scuffs, so it reads as painted on old paper.
        mott = value_noise(bw, bh, P(4), rng) * 0.09 + value_noise(bw, bh, P(0.6), rng) * 0.05
        arr = np.asarray(col, np.float32) * (1 + mott[..., None])
        wear = np.clip(value_noise(bw, bh, P(2.5), rng) * 3 - 2.3, 0, 1)[..., None]
        arr = arr * (1 - 0.35 * wear) + np.array(PAPER, np.float32) * 0.35 * wear
        col = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
        self.img.paste(col, (bx0, by0))
        d = self.draw()
        d.line((bx0, by0 + bh, bx1, by0 + bh), fill=(*INK, 230), width=P(0.45))
        icon_px = P(h_mm * 0.72)
        gap = P(1.6)
        room = bw - P(4) - len(icons) * (icon_px + gap)
        f = font("almendra-latin-bold.woff2", size_mm)
        lines = [label]
        while d.textlength(label, font=f) > room and f.size > P(4.4):
            f = ImageFont.truetype(f.path, f.size - 2)
        if d.textlength(label, font=f) > room and " & " in label:
            a, c = label.split(" & ", 1)
            lines = [a + " &", c]
            f = font("almendra-latin-bold.woff2", min(size_mm, h_mm * 0.36))
            while max(d.textlength(t, font=f) for t in lines) > room and f.size > P(2.5):
                f = ImageFont.truetype(f.path, f.size - 2)
        tw = max(d.textlength(t, font=f) for t in lines)
        total = tw + len(icons) * (icon_px + gap)
        cx = bx0 + (bw - total) / 2
        cy = by0 + bh / 2
        for ic in icons:
            self.icon(ic, cx + icon_px / 2, cy, icon_px, cream=True)
            cx += icon_px + gap
        lh = f.size * 1.02
        ys = [cy + (i - (len(lines) - 1) / 2) * lh for i in range(len(lines))]
        halo = Image.new("L", self.img.size, 0)
        hd = ImageDraw.Draw(halo)
        for t, yy in zip(lines, ys):
            hd.text((cx, yy), t, font=f, fill=255, anchor="lm")
        halo = halo.filter(ImageFilter.GaussianBlur(P(0.35)))
        self.img.alpha_composite(Image.merge("RGBA", (*Image.new("RGB", self.img.size, (20, 14, 8)).split(), halo.point(lambda v: int(v * 0.55)))))
        d = self.draw()
        for t, yy in zip(lines, ys):
            d.text((cx, yy), t, font=f, fill=CREAM, anchor="lm")
        return by0 + bh

    def icon(self, name: str, cx: float, cy: float, size_px: int, cream: bool = False, alpha: float = 1.0):
        self.flush()
        im = Image.open(ICONS / name).convert("RGBA")
        k = size_px / max(im.size)
        im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.Resampling.LANCZOS)
        if cream:
            # Icons on a coloured band print as cream silhouettes with the
            # drawing's own shading kept as a lighter/darker tone.
            g = im.convert("L")
            rgb = Image.merge("RGB", [g.point(lambda v, c=c: int(c * (0.55 + 0.45 * v / 255))) for c in CREAM])
            im = Image.merge("RGBA", (*rgb.split(), im.getchannel("A")))
        if alpha < 1:
            im.putalpha(im.getchannel("A").point(lambda v: int(v * alpha)))
        self.img.alpha_composite(im, (round(cx - im.width / 2), round(cy - im.height / 2)))

    def text(self, xy, s: str, fname: str, size_mm: float, fill=INK, anchor="mm", alpha=255):
        d = self.draw()
        d.text(xy, s, font=font(fname, size_mm), fill=(*fill, alpha), anchor=anchor)

    def dashed_round_rect(self, box, radius_mm, colour, width_mm=0.5, dash=3.0, gap=2.0, alpha=200):
        pts = rounded_rect_path(box, P(radius_mm))
        pts = pts + [pts[0]]
        d = self.draw()
        on, acc = True, 0.0
        seg = [pts[0]]
        for (ax, ay), (bx, by) in zip(pts, pts[1:]):
            L = math.hypot(bx - ax, by - ay)
            t = 0.0
            while t < L:
                step = min((P(dash) if on else P(gap)) - acc, L - t)
                t += step
                acc += step
                p = (ax + (bx - ax) * t / L, ay + (by - ay) * t / L)
                if on:
                    seg.append(p)
                if acc >= (P(dash) if on else P(gap)) - 1e-6:
                    if on and len(seg) > 1:
                        d.line(seg, fill=(*colour, alpha), width=max(1, P(width_mm)), joint="curve")
                    on, acc, seg = not on, 0.0, [p]
            if on:
                seg.append((bx, by))
        if on and len(seg) > 1:
            d.line(seg, fill=(*colour, alpha), width=max(1, P(width_mm)))

    def corners(self, x0, y0, x1, y1, size_mm=11.0):
        """The map board's brass corner fittings, on each panel corner."""
        self.flush()
        src = Image.open(BRASS_CORNER).convert("RGBA")
        bb = src.getbbox()
        src = src.crop(bb)
        s = P(size_mm)
        c = src.resize((s, s), Image.Resampling.LANCZOS)
        shadow = c.getchannel("A").filter(ImageFilter.GaussianBlur(P(0.6)))
        for rot, (px_, py_) in ((0, (x0, y0)), (270, (x1 - s, y0)), (180, (x1 - s, y1 - s)), (90, (x0, y1 - s))):
            cr = c.rotate(rot)
            sh = shadow.rotate(rot)
            off = P(0.6)
            self.img.alpha_composite(Image.merge("RGBA", (*Image.new("RGB", cr.size, (0, 0, 0)).split(), sh.point(lambda v: int(v * 0.55)))), (px_ - P(0.9) + off, py_ - P(0.9) + off))
            self.img.alpha_composite(cr, (px_ - P(0.9), py_ - P(0.9)))

    def finish(self) -> Image.Image:
        self.flush()
        out = self.img.convert("RGB")
        grain = Image.effect_noise(out.size, 3.2).filter(ImageFilter.GaussianBlur(0.5))
        out = Image.blend(out, ImageChops.soft_light(out, Image.merge("RGB", (grain,) * 3)), 0.03)
        return out


def card_outline(b: Board, cx: float, cy: float, w: float, h: float, label: str | None, sub: str | None, colour=SEPIA):
    x0, y0, x1, y1 = b.box(cx - w / 2, cy - h / 2, w, h)
    b.dashed_round_rect((x0, y0, x1, y1), 3.0, colour, 0.5, 3.2, 2.0, 190)
    if label:
        b.text(((x0 + x1) / 2, (y0 + y1) / 2 - P(3)), label, "almendra-latin-bold.woff2", 5.2, colour, alpha=150)
    if sub:
        b.text(((x0 + x1) / 2, (y0 + y1) / 2 + P(4)), sub, "alegreya-latin-italic.woff2", 3.6, colour, alpha=150)


def compass(b: Board, cx: int, cy: int, r_mm: float, colour=SEPIA, alpha=110):
    """A simple inked compass rose, echoing the card backs."""
    b.flush()
    ov = Image.new("RGBA", b.img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    r = P(r_mm)
    d.ellipse((cx - r, cy - r, cx + r, cy + r), outline=(*colour, alpha), width=P(0.45))
    d.ellipse((cx - r * 0.86, cy - r * 0.86, cx + r * 0.86, cy + r * 0.86), outline=(*colour, alpha), width=P(0.25))
    for k in range(8):
        a = k * math.pi / 4
        L = r * (0.8 if k % 2 == 0 else 0.5)
        w = r * 0.12
        tip = (cx + L * math.sin(a), cy - L * math.cos(a))
        l = (cx + w * math.sin(a - math.pi / 2), cy - w * math.cos(a - math.pi / 2))
        rr = (cx + w * math.sin(a + math.pi / 2), cy - w * math.cos(a + math.pi / 2))
        d.polygon([tip, l, (cx, cy)], fill=(*colour, alpha))
        d.polygon([tip, rr, (cx, cy)], outline=(*colour, alpha), fill=(*colour, alpha // 3))
    b.img.alpha_composite(ov)


# ---------------------------------------------------------------- boards

W_LONG, H_LONG = 568.5, 146.0
MARGIN = 11.0
END_W = 74.0
GAP_END = 7.0


def encounter_board() -> Image.Image:
    b = Board(W_LONG, H_LONG, 7100)
    ph = H_LONG - 2 * MARGIN
    # Encounter deck
    x0, y0, x1, y1 = b.panel(MARGIN, MARGIN, END_W, ph, 7101)
    y = b.band(x0, y0, x1, 11, [SEPIA], "ENCOUNTER", 6.0)
    compass(b, (x0 + x1) // 2, (y + y1) // 2 - P(2), 19, alpha=170)
    b.text(((x0 + x1) / 2, y1 - P(13)), "Draw pile", "almendra-latin-bold.woff2", 5.0, SEPIA)
    b.text(((x0 + x1) / 2, y1 - P(7.5)), "face down", "alegreya-latin-italic.woff2", 3.8, SEPIA)
    b.corners(x0, y0, x1, y1, 8)
    # Discard
    dx = W_LONG - MARGIN - END_W
    x0, y0, x1, y1 = b.panel(dx, MARGIN, END_W, ph, 7102)
    y = b.band(x0, y0, x1, 11, [SEPIA], "DISCARD", 6.0)
    mid = (y + y1) // 2
    b.text(((x0 + x1) / 2, mid - P(3)), "Discard", "almendra-latin-bold.woff2", 5.4, SEPIA)
    b.text(((x0 + x1) / 2, mid + P(4)), "face up", "alegreya-latin-italic.woff2", 3.8, SEPIA)
    b.corners(x0, y0, x1, y1, 8)
    # In Play
    ix = MARGIN + END_W + GAP_END
    iw = W_LONG - 2 * ix
    x0, y0, x1, y1 = b.panel(ix, MARGIN, iw, ph, 7103)
    gold = (150, 112, 40)
    y = b.band(x0, y0, x1, 11, [gold], "IN PLAY", 6.6)
    # Cards are 120 mm tall and cover most of this panel, so it carries no
    # card outlines: the parchment and band show between and around them.
    mid = (y + y1) // 2
    compass(b, (x0 + x1) // 2, mid, 15, alpha=70)
    b.text(((x0 + x1) / 2, mid + P(22)), "Active Encounter Cards", "almendra-latin-bold.woff2", 5.0, SEPIA, alpha=150)
    # The centre fold runs through In Play; mark nothing on the hinge.
    b.corners(x0, y0, x1, y1, 9)
    return b.finish()


def logistics_board() -> Image.Image:
    b = Board(W_LONG, H_LONG, 7200)
    ph = H_LONG - 2 * MARGIN
    # Target Cards (poker 64 x 89)
    x0, y0, x1, y1 = b.panel(MARGIN, MARGIN, END_W, ph, 7201)
    silver = (104, 108, 112)
    y = b.band(x0, y0, x1, 11, [silver], "TARGET CARDS", 5.6)
    card_outline(b, MARGIN + END_W / 2, MARGIN + 14.6 + (ph - 14.6) / 2 + 0.5, 64, 89, "Target", "face down", (90, 94, 98))
    b.corners(x0, y0, x1, y1, 8)
    # Six Warehouses
    cx0 = MARGIN + END_W + GAP_END
    cx1 = W_LONG - cx0
    gap = 4.5
    ww = (cx1 - cx0 - 5 * gap) / 6
    for i, (name, (colour, icon)) in enumerate(RESOURCES.items()):
        wx = cx0 + i * (ww + gap)
        x0, y0, x1, y1 = b.panel(wx, MARGIN, ww, ph, 7210 + i, radius=2.8)
        y = b.band(x0, y0, x1, 11, [colour], name, 6.2)
        # Icon on the paper, full colour.
        b.icon(icon, (x0 + x1) / 2, y + P(7.2), P(11))
        # Fifteen numbered spaces, 3 x 5, for 15 mm discs: the Warehouse cap.
        d = b.draw()
        r = 8.0
        colgap = 1.4
        rowgap = 1.1
        gw = 3 * 2 * r + 2 * colgap
        gx = wx + (ww - gw) / 2 + r
        gy = MARGIN + ph - 4.0 - 5 * 2 * r - 4 * rowgap + r
        ring = tuple(int(c * 0.8) for c in colour)
        fnum = font("alegreya-sans-latin-bold.woff2", 3.6)
        for k in range(15):
            row, col = k // 3, k % 3
            ccx = P(BLEED + gx + col * (2 * r + colgap))
            ccy = P(BLEED + gy + row * (2 * r + rowgap))
            R = P(r - 0.25)
            d.ellipse((ccx - R, ccy - R, ccx + R, ccy + R), fill=(*colour, 58), outline=(*ring, 225), width=P(0.5))
            R2 = P(r - 1.2)
            d.ellipse((ccx - R2, ccy - R2, ccx + R2, ccy + R2), outline=(*ring, 90), width=max(1, P(0.18)))
            d.text((ccx, ccy), str(k + 1), font=fnum, fill=(*ring, 200), anchor="mm")
        b.corners(x0, y0, x1, y1, 7)
    # Tokens
    tx = W_LONG - MARGIN - END_W
    x0, y0, x1, y1 = b.panel(tx, MARGIN, END_W, ph, 7202)
    y = b.band(x0, y0, x1, 11, [SEPIA], "TOKENS", 6.0)
    d = b.draw()
    # Two trays: black Strain discs, white discs for everything else.
    half = (y1 - y - P(6)) // 2
    trays = (("STRAIN", "black discs", (24, 22, 20), (234, 228, 212)), ("SUPPORTED", "white discs: also timers", (246, 242, 230), (60, 50, 38)))
    for j, (lab, sub, disc, edge) in enumerate(trays):
        ty0 = y + P(2.5) + j * (half + P(1.5))
        ty1 = ty0 + half
        tb = (x0 + P(5), ty0, x1 - P(5), ty1)
        b.dashed_round_rect(tb, 3.0, SEPIA, 0.45, 2.6, 1.8, 170)
        dcx, dcy = tb[0] + P(10.5), (ty0 + ty1) // 2
        rr = P(7)
        d.ellipse((dcx - rr + P(0.5), dcy - rr + P(0.7), dcx + rr + P(0.5), dcy + rr + P(0.7)), fill=(30, 22, 14, 90))
        d.ellipse((dcx - rr, dcy - rr, dcx + rr, dcy + rr), fill=(*disc, 255), outline=(*edge, 200), width=P(0.4))
        d.ellipse((dcx - P(5.2), dcy - P(5.2), dcx + P(5.2), dcy + P(5.2)), outline=(*edge, 80), width=P(0.25))
        tx0 = dcx + rr + P(3)
        d.text((tx0, dcy - P(2.4)), lab, font=font("almendra-latin-bold.woff2", 4.6 if j == 0 else 3.9), fill=INK, anchor="lm")
        d.text((tx0, dcy + P(3.2)), sub.split(": ")[0], font=font("alegreya-latin-italic.woff2", 3.3), fill=SEPIA, anchor="lm")
        if j == 1:
            d.text((tx0, dcy + P(7.4)), "timers, round", font=font("alegreya-latin-italic.woff2", 3.3), fill=SEPIA, anchor="lm")
    b.corners(x0, y0, x1, y1, 8)
    return b.finish()


def load_core_tiles() -> list[dict]:
    import json
    import subprocess
    js = (
        "const ts=require('typescript'),fs=require('fs');const m={exports:{}};"
        f"new Function('exports','module',ts.transpileModule(fs.readFileSync('{TILES}','utf8'),"
        "{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(m.exports,m);"
        "console.log(JSON.stringify(m.exports.coreTiles.map(t=>({id:t.id,cat:t.category,n:t.count,size:t.size||1,name:t.basic.name}))))"
    )
    return json.loads(subprocess.check_output(["node", "-e", js], cwd=ROOT))


def core_board() -> Image.Image:
    CW, CH = 284.25, 232.83
    b = Board(CW, CH, 7300)
    tiles = load_core_tiles()
    inner_w = CW - 2 * MARGIN
    rows_h = (CH - 2 * MARGIN - 5) / 2
    layout = [
        [(["resource"], 142.0), (["housing"], inner_w - 142.0 - 5)],
        [(["travel"], 100.0), (["social", "wellbeing"], 92.0), (["merchant", "crafting"], inner_w - 192.0 - 10)],
    ]
    seed = 7310
    for r, row in enumerate(layout):
        x = MARGIN
        y = MARGIN + r * (rows_h + 5)
        for cats, w in row:
            seed += 1
            x0, y0, x1, y1 = b.panel(x, y, w, rows_h, seed)
            label = " & ".join(CATEGORY[c][2].upper() for c in cats)
            yb = b.band(x0, y0, x1, 13, [CATEGORY[c][0] for c in cats], label, 6.4 if len(cats) == 1 else 5.4, icons=[CATEGORY[c][1] for c in cats])
            # The tile list along the foot of the panel: stacks sit above it.
            items = [t for t in tiles if t["cat"] in cats]
            fname = font("alegreya-latin-variable.woff2", 3.5)
            d = b.draw()
            lines, cur = [], ""
            maxw = (x1 - x0) - P(22)
            for t in items:
                part = f"{t['name']} ×{t['n']}"
                cand = f"{cur}  ·  {part}" if cur else part
                if d.textlength(cand, font=fname) > maxw:
                    lines.append(cur)
                    cur = part
                else:
                    cur = cand
            lines.append(cur)
            ly = y1 - P(7.5) - (len(lines) - 1) * P(4.8)
            d.line((x0 + P(6), ly - P(4.6), x1 - P(6), ly - P(4.6)), fill=(*SEPIA, 120), width=P(0.25))
            for i, line in enumerate(lines):
                d.text(((x0 + x1) / 2, ly + i * P(4.8)), line, font=fname, fill=INK, anchor="mm")
            # A large faded category mark: stacks of tiles sit on it.
            area_top, area_bot = yb + P(3), ly - P(7)
            hy = (area_top + area_bot) / 2
            marks = [CATEGORY[c][1] for c in cats]
            msz = min(P(34), int((area_bot - area_top) * 0.62), int((x1 - x0 - P(12)) / len(marks)))
            for k, m in enumerate(marks):
                mx = x0 + (x1 - x0) * (k + 0.5) / len(marks)
                b.icon(m, mx, hy, msz, alpha=0.16)
            b.corners(x0, y0, x1, y1, 9)
            x += w + 5
    return b.finish()


def main() -> None:
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "output/boards-v3"
    out.mkdir(parents=True, exist_ok=True)
    for name, fn in (("02-encounter-board-v3", encounter_board), ("03-logistics-board-v3", logistics_board), ("04-core-tiles-board-v3", core_board)):
        im = fn()
        im.save(out / f"{name}-with-bleed.png", dpi=(304.8, 304.8))
        pv = im.copy()
        pv.thumbnail((2000, 2000))
        pv.save(out / f"{name}-preview.png")
        print(name, im.size)


if __name__ == "__main__":
    main()
