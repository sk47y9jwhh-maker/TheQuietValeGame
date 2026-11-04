#!/usr/bin/env python3
"""Table scenes for the rulebook: the printed v4 map board with the artist's
tiles, black wooden Strain tokens, bronze tokens and Steward meeples set on it,
drawn the way a photograph of the real game would show them.

    from scene import Scene
    s = Scene()                       # loads the v4 map board render
    s.tile("F5", "c05_cabin", "basic", strain=2, supported=True)
    s.steward("F5", "knight")
    img, hexes = s.crop(["E4", "G6"], margin_mm=8, width_px=1800)

Coordinates: the online board's SVG units are millimetres on the printed map
(hex radius 30 = 60 mm point to point, Hayman tile option A). The v4 map board
places the artist map so that SVG (x, y) lands at board (x + 12.30, y + 6.12) mm.
"""
from __future__ import annotations

import math
import random
from functools import lru_cache
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance

ROOT = Path(__file__).resolve().parents[2]
TILES = ROOT / "public/tiles"
PPM = 12.0          # board render: 12 px per mm
BLEED = 3.175
HEX_R = 30.0        # mm, centre to point
HEX_H = math.sqrt(3) * HEX_R
# SVG -> board mm offsets, from the map frame and the board's map placement.
_MMPP_X = 714.1339 / 3200
_MMPP_Y = 545.4286 / 2444
_MAP_W = (3072 - 124) * _MMPP_X
_MAP_LEFT = (698.5 - _MAP_W) / 2
OFF_X = _MAP_LEFT + 19.6663 - 124 * _MMPP_X
OFF_Y = 18.0 + 7.7617 - 88 * _MMPP_Y

# Steward meeple colours: the prototype meeples (Steward Guides ROLE_META).
STEWARD_COLOURS = {
    "vanguard": (85, 118, 79), "knight": (168, 142, 50), "sentinel": (94, 130, 147),
    "ranger": (119, 97, 132), "warden": (173, 103, 61), "quartermaster": (166, 142, 106),
}


def svg_centre(hex_id: str) -> tuple[float, float]:
    ci = ord(hex_id[0]) - 65
    row = int(hex_id[1:])
    x = HEX_R + ci * HEX_R * 1.5 + 14
    y = HEX_H / 2 + (row - 1) * HEX_H + (HEX_H / 2 if ci % 2 else 0) + 18
    return x, y


def board_px(hex_id: str) -> tuple[float, float]:
    x, y = svg_centre(hex_id)
    return (x + OFF_X + BLEED) * PPM, (y + OFF_Y + BLEED) * PPM


def neighbours(hex_id: str) -> list[str]:
    ci, row = ord(hex_id[0]) - 65, int(hex_id[1:])
    odd = ci % 2
    deltas = [(0, -1), (0, 1), (-1, 0 if odd else -1), (-1, 1 if odd else 0), (1, 0 if odd else -1), (1, 1 if odd else 0)]
    out = []
    for dc, dr in deltas:
        c, r = ci + dc, row + dr
        if 0 <= c < 14 and 1 <= r <= 9:
            out.append(f"{chr(65 + c)}{r}")
    return out


def hex_mask(size_w: int, size_h: int, scale: int = 4) -> Image.Image:
    W, H = size_w * scale, size_h * scale
    m = Image.new("L", (W, H), 0)
    r = W / 2
    cx, cy = W / 2, H / 2
    pts = [(cx + r * math.cos(math.radians(60 * k)), cy + r * math.sin(math.radians(60 * k))) for k in range(6)]
    ImageDraw.Draw(m).polygon(pts, fill=255)
    return m.resize((size_w, size_h), Image.Resampling.LANCZOS)


@lru_cache(maxsize=None)
def _board() -> Image.Image:
    for p in (Path("/home/claude/boards/01-map-board-v4-with-bleed.png"), ROOT / "output/boards-v4/01-map-board-v4-with-bleed.png"):
        if p.exists():
            return Image.open(p).convert("RGB")
    raise FileNotFoundError("Render the map board first: python3 design/boards-v4/build_leather_boards.py output/boards-v4 map")


@lru_cache(maxsize=None)
def tile_image(name: str) -> Image.Image:
    """A tile face at board scale (60 mm point to point), with the die-cut
    edge: a thin dark core line just inside the cut, like 2 mm greyboard."""
    src = Image.open(TILES / f"{name}.webp").convert("RGBA")
    w = round(2 * HEX_R * PPM)
    h = round(HEX_H * PPM)
    im = src.resize((w, h), Image.Resampling.LANCZOS)
    m = hex_mask(w, h)
    im.putalpha(Image.fromarray(np.minimum(np.asarray(im.getchannel("A")), np.asarray(m))))
    return im


def _disc(d_px: int, base, sheen=0.35, grain=0.0, seed=1, rim=0.25) -> Image.Image:
    """A wooden disc seen from above: flat top, soft light from the upper left."""
    k = 3
    D = d_px * k
    yy, xx = np.mgrid[0:D, 0:D].astype(np.float32)
    c = (D - 1) / 2
    r = np.hypot(xx - c, yy - c) / (D / 2)
    inside = (r <= 1).astype(np.float32)
    base = np.array(base, np.float32)
    light = 1 + sheen * np.clip(1 - np.hypot(xx - c * 0.62, yy - c * 0.55) / (D * 0.55), 0, 1) ** 2
    edge = 1 - rim * np.clip((r - 0.82) / 0.18, 0, 1)
    rng = np.random.default_rng(seed)
    if grain:
        ang = rng.uniform(0, math.pi)
        u = (xx * math.cos(ang) + yy * math.sin(ang)) / D
        g = 1 + grain * np.sin(u * 40 + 3 * np.sin(u * 7 + rng.uniform(0, 6)))
    else:
        g = 1
    rgb = np.clip(base * (light * edge * g)[..., None], 0, 255)
    a = (inside * 255).astype(np.uint8)
    im = Image.fromarray(np.dstack([rgb.astype(np.uint8), a]), "RGBA")
    return im.resize((d_px, d_px), Image.Resampling.LANCZOS)


def _meeple(h_px: int, colour) -> Image.Image:
    """A Steward meeple from above and a little in front, painted wood."""
    k = 4
    W, H = int(h_px * 0.92) * k, h_px * k
    m = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(m)
    cx = W / 2
    hr = W * 0.17
    d.ellipse((cx - hr, H * 0.02, cx + hr, H * 0.02 + 2 * hr), fill=255)
    body = [(cx - W * 0.16, H * 0.30), (cx - W * 0.47, H * 0.44), (cx - W * 0.47, H * 0.56), (cx - W * 0.20, H * 0.53),
            (cx - W * 0.36, H * 0.97), (cx - W * 0.10, H * 0.97), (cx, H * 0.72), (cx + W * 0.10, H * 0.97),
            (cx + W * 0.36, H * 0.97), (cx + W * 0.20, H * 0.53), (cx + W * 0.47, H * 0.56), (cx + W * 0.47, H * 0.44),
            (cx + W * 0.16, H * 0.30)]
    d.polygon(body, fill=255)
    m = m.filter(ImageFilter.GaussianBlur(k * 0.6)).point(lambda v: 255 if v > 128 else 0).resize((W // k, H // k), Image.Resampling.LANCZOS)
    w2, h2 = m.size
    yy, xx = np.mgrid[0:h2, 0:w2].astype(np.float32)
    shade = 1.18 - 0.42 * (xx / w2) - 0.15 * (yy / h2)
    rgb = np.clip(np.array(colour, np.float32) * shade[..., None], 0, 255).astype(np.uint8)
    im = Image.fromarray(np.dstack([rgb, np.asarray(m)]), "RGBA")
    # A darker side face: the meeple's thickness, offset down and right.
    side = Image.new("RGBA", (w2 + 8, h2 + 8), (0, 0, 0, 0))
    dark = Image.new("RGBA", m.size, tuple(int(c * 0.55) for c in colour) + (255,))
    for o in range(1, 7):
        side.paste(dark, (o, o), m)
    side.alpha_composite(im, (0, 0))
    return side


def _shadow(alpha: Image.Image, blur: float, strength: float) -> Image.Image:
    pad = int(blur * 3)
    a = Image.new("L", (alpha.width + 2 * pad, alpha.height + 2 * pad), 0)
    a.paste(alpha, (pad, pad))
    a = a.filter(ImageFilter.GaussianBlur(blur)).point(lambda v: int(v * strength))
    sh = Image.new("RGBA", a.size, (8, 6, 4, 0))
    sh.putalpha(a)
    return sh, pad


class Scene:
    def __init__(self):
        self.img = _board().convert("RGBA").copy()
        self.marks: dict[str, tuple[float, float]] = {}
        self.extra: list[tuple[str, float, float]] = []

    def _paste(self, im: Image.Image, cx: float, cy: float, shadow=(6, 0.55), lift=(4, 6)):
        if shadow:
            sh, pad = _shadow(im.getchannel("A"), shadow[0], shadow[1])
            self.img.alpha_composite(sh, (int(cx - im.width / 2 - pad + lift[0]), int(cy - im.height / 2 - pad + lift[1])))
        self.img.alpha_composite(im, (int(cx - im.width / 2), int(cy - im.height / 2)))

    def tile(self, hex_id: str, tile: str, side: str | None = "basic", strain: int = 0, supported: bool = False, rot: float = 0.0, darken: float = 0.0):
        name = f"{tile}-{side}" if side else tile
        im = tile_image(name)
        if darken:
            im = ImageEnhance.Brightness(im).enhance(1 - darken)
        # The 2 mm greyboard edge: a dark rim seen just below the face.
        cx, cy = board_px(hex_id)
        edge = Image.new("RGBA", im.size, (38, 32, 26, 255))
        edge.putalpha(im.getchannel("A"))
        sh, pad = _shadow(im.getchannel("A"), 10, 0.6)
        self.img.alpha_composite(sh, (int(cx - im.width / 2 - pad + 8), int(cy - im.height / 2 - pad + 12)))
        self.img.alpha_composite(edge, (int(cx - im.width / 2 + 3), int(cy - im.height / 2 + 6)))
        self.img.alpha_composite(im, (int(cx - im.width / 2), int(cy - im.height / 2)))
        self.marks[hex_id] = (cx, cy)
        self.tokens(hex_id, strain=strain, supported=supported)
        return self

    def tokens(self, hex_id: str, strain: int = 0, supported: bool = False):
        cx, cy = board_px(hex_id)
        d = int(11 * PPM)
        # Strain sits in a row across the picture area, above the rules box.
        xs = {1: [0.0], 2: [-0.1, 0.1], 3: [-0.19, 0.0, 0.19]}.get(strain, [])
        for k, dx in enumerate(xs):
            disc = _disc(d, (34, 31, 28), sheen=0.55, grain=0.06, seed=(sum(map(ord, hex_id)) * 7 + k) & 0xFFFF, rim=0.35)
            self._paste(disc, cx + dx * 2 * HEX_R * PPM, cy - 0.08 * HEX_H * PPM, shadow=(5, 0.7), lift=(3, 6))
        if supported:
            disc = _disc(d, (176, 124, 62), sheen=0.6, grain=0.0, rim=0.3)
            self._paste(disc, cx - 0.31 * 2 * HEX_R * PPM, cy - 0.06 * HEX_H * PPM, shadow=(5, 0.7), lift=(3, 6))
        return self

    def steward(self, hex_id: str, steward: str, dx: float = 0.24, dy: float = -0.18):
        cx, cy = board_px(hex_id)
        m = _meeple(int(17 * PPM), STEWARD_COLOURS[steward])
        self._paste(m, cx + dx * 2 * HEX_R * PPM, cy + dy * HEX_H * PPM, shadow=(7, 0.6), lift=(10, 12))
        self.marks.setdefault(hex_id, (cx, cy))
        return self

    def crop(self, hexes: list[str], margin_mm: float = 6.0, width_px: int | None = None, aspect: float | None = None):
        """Crop round the given hexes. Returns the image and every hex centre
        (as fractions of the crop) so the rulebook can draw over it."""
        pts = [board_px(h) for h in list(hexes) + list(self.marks)]
        x0 = min(p[0] for p in pts) - (HEX_R + margin_mm) * PPM
        x1 = max(p[0] for p in pts) + (HEX_R + margin_mm) * PPM
        y0 = min(p[1] for p in pts) - (HEX_H / 2 + margin_mm) * PPM
        y1 = max(p[1] for p in pts) + (HEX_H / 2 + margin_mm) * PPM
        if aspect:
            w, h = x1 - x0, y1 - y0
            if w / h < aspect:
                grow = (h * aspect - w) / 2; x0 -= grow; x1 += grow
            else:
                grow = (w / aspect - h) / 2; y0 -= grow; y1 += grow
        box = tuple(int(round(v)) for v in (x0, y0, x1, y1))
        im = self.img.crop(box).convert("RGB")
        W, H = im.size
        centres = {}
        for c in range(14):
            for r in range(1, 10):
                hid = f"{chr(65 + c)}{r}"
                px, py = board_px(hid)
                fx, fy = (px - box[0]) / W, (py - box[1]) / H
                if -0.2 <= fx <= 1.2 and -0.2 <= fy <= 1.2:
                    centres[hid] = (round(fx, 5), round(fy, 5))
        meta = {"hexes": centres, "hexW": round(2 * HEX_R * PPM / W, 5), "hexH": round(HEX_H * PPM / H, 5), "aspect": round(W / H, 5)}
        if width_px:
            im = im.resize((width_px, round(width_px * H / W)), Image.Resampling.LANCZOS)
        return im, meta
