# Supported icon: a bronze heater shield drawn to sit with the artist's ink icons (metal bars,
# crate, scales): a heavy black outline, a loose bronze wash, a raised centre ridge with the
# left face lit and the right face shaded by ink hatching, a riveted rim.
#   python3 make-supported-icon.py
import math, random
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

here = Path(__file__).parent
S = 4
W, H = 220 * S, 250 * S
rng = random.Random(7)
INK = (22, 20, 18, 255)
BRONZE = (204, 142, 70)
BRONZE_LIGHT = (246, 206, 142)
BRONZE_DARK = (150, 94, 44)
RIM = (176, 116, 56)

img = Image.new("RGBA", (W, H), (0, 0, 0, 0))


def shield(inset=0.0, n=120):
    """Heater shield outline; inset shrinks it towards the centre (in px at 1x)."""
    cx, top, bottom, half = 110, 14, 236, 96
    sh = 92                                   # height of the straight sides
    pts = []
    # top edge: a shallow upward curve
    for i in range(n // 4 + 1):
        t = i / (n // 4)
        x = cx - half + 2 * half * t
        y = top + 10 - 10 * math.sin(math.pi * t) * 0.9
        pts.append((x, y))
    # right side down, then curving to the point
    for i in range(1, n // 2 + 1):
        t = i / (n // 2)
        if t < 0.35:
            y = top + 10 + (sh - 10) * t / 0.35
            x = cx + half
        else:
            u = (t - 0.35) / 0.65
            y = top + sh + (bottom - top - sh) * u
            x = cx + half * math.cos(u * math.pi / 2) ** 0.85
        pts.append((x, y))
    right = pts[n // 4 + 1:]
    left = [(2 * cx - x, y) for x, y in reversed(right[:-1])]
    pts = pts + left
    if inset:
        c = (cx, 118)
        pts = [(c[0] + (x - c[0]) * (1 - inset / 100), c[1] + (y - c[1]) * (1 - inset / 92)) for x, y in pts]
    return [(x * S, y * S) for x, y in pts]


def mask_of(poly):
    m = Image.new("L", (W, H), 0)
    ImageDraw.Draw(m).polygon(poly, fill=255)
    return m


def paint(layer, mask):
    img.alpha_composite(Image.composite(layer, Image.new("RGBA", (W, H), (0, 0, 0, 0)), mask))


def ink(d, pts, width, colour=INK, wobble=0.3):
    pts = [(x + rng.uniform(-wobble, wobble) * S, y + rng.uniform(-wobble, wobble) * S) for x, y in pts]
    d.line(pts, fill=colour, width=max(1, int(width * S)), joint="curve")


outer, inner = shield(), shield(inset=17)
mo, mi = mask_of(outer), mask_of(inner)
cx = 110 * S

# rim: darker bronze band
rim = Image.new("RGBA", (W, H), RIM + (255,))
paint(rim, mo)

# face: loose wash, lit on the left of the ridge, shaded on the right
face = Image.new("RGBA", (W, H), (0, 0, 0, 0))
fd = ImageDraw.Draw(face)
fd.rectangle([0, 0, cx, H], fill=BRONZE + (255,))
fd.rectangle([cx, 0, W, H], fill=BRONZE_DARK + (255,))
for _ in range(40):                               # wash blooms
    x = rng.uniform(30, 105) * S; y = rng.uniform(30, 200) * S; r = rng.uniform(10, 30) * S
    fd.ellipse([x - r, y - r, x + r, y + r], fill=BRONZE_LIGHT + (rng.randint(40, 90),))
for _ in range(25):
    x = rng.uniform(115, 195) * S; y = rng.uniform(30, 200) * S; r = rng.uniform(10, 26) * S
    fd.ellipse([x - r, y - r, x + r, y + r], fill=(96, 58, 28, rng.randint(40, 90)))
face = face.filter(ImageFilter.GaussianBlur(5 * S))
paint(face, mi)

# ink hatching across the shaded (right) side only
hl = Image.new("RGBA", (W, H), (0, 0, 0, 0))
hd = ImageDraw.Draw(hl)
for i in range(0, 16):
    x0 = (112 + i * 9) * S
    hd.line([(x0, 20 * S), (x0 + 60 * S, 250 * S)], fill=(40, 26, 14, 170), width=int(1.5 * S))
right_mask = mi.copy()
ImageDraw.Draw(right_mask).rectangle([0, 0, cx, H], fill=0)
paint(hl, right_mask)
# keep hatching only on the right: repaint the left from a lit-only layer
left_mask = mi.copy()
ImageDraw.Draw(left_mask).rectangle([cx, 0, W, H], fill=0)
lit = Image.new("RGBA", (W, H), (0, 0, 0, 0))
ld = ImageDraw.Draw(lit)
ld.rectangle([0, 0, cx, H], fill=BRONZE + (255,))
for _ in range(40):
    x = rng.uniform(30, 105) * S; y = rng.uniform(30, 200) * S; r = rng.uniform(10, 30) * S
    ld.ellipse([x - r, y - r, x + r, y + r], fill=BRONZE_LIGHT + (rng.randint(50, 100),))
lit = lit.filter(ImageFilter.GaussianBlur(5 * S))
ld = ImageDraw.Draw(lit)
for i in range(4):
    x = (44 + i * 13 + rng.uniform(-2, 2)) * S
    ld.line([(x, 40 * S + rng.uniform(0, 20) * S), (x + 8 * S, (150 + rng.uniform(-30, 20)) * S)],
            fill=(252, 232, 196, 190), width=int(1.6 * S))
paint(lit, left_mask)

# rim shading: hatch the right-hand rim too, and a few pale ticks on the left rim
rimhatch = Image.new("RGBA", (W, H), (0, 0, 0, 0))
rd = ImageDraw.Draw(rimhatch)
for i in range(0, 24):
    x0 = (112 + i * 8) * S
    rd.line([(x0, 0), (x0 + 60 * S, 250 * S)], fill=(40, 26, 14, 130), width=int(1.3 * S))
rim_mask = Image.fromarray(((np.asarray(mo) > 0) & (np.asarray(mi) == 0)).astype(np.uint8) * 255)
paint(rimhatch, rim_mask)

d = ImageDraw.Draw(img)
# rivets on the rim
for t in (0.06, 0.25, 0.45, 0.62, 0.78):
    idx = int(t * (len(outer) - 1))
    (x1, y1), (x2, y2) = outer[idx], inner[idx]
    for (px, py) in ((x1 * 0.5 + x2 * 0.5, y1 * 0.5 + y2 * 0.5), (2 * cx - (x1 * 0.5 + x2 * 0.5), y1 * 0.5 + y2 * 0.5)):
        r = 3.6 * S
        d.ellipse([px - r, py - r, px + r, py + r], fill=(232, 196, 140, 255), outline=INK, width=int(1.4 * S))

# centre ridge: ink line down the middle, with a pale edge on its lit side
ink(d, [(cx - 2.2 * S, 30 * S), (cx - 2.2 * S, 214 * S)], 1.6, colour=(252, 226, 180, 230), wobble=0)
ink(d, [(cx, 30 * S), (cx, 216 * S)], 2.4)
# outlines: thin inner line, heavy outer line
ink(d, inner + [inner[0]], 2.0)
ink(d, outer + [outer[0]], 6.0)

out = img.resize((W // S, H // S), Image.LANCZOS)
bbox = out.getbbox()
out = out.crop(bbox)
out.save(here / "assets/icon-Supported.png")
print(out.size)
