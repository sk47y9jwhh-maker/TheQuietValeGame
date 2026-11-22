# Strain icon: a black token drawn like the artist's Population figure (Robert, 22 Nov: "it should
# visually read like the population icon"): cream paper densely scribbled with tapered black ink
# strokes on a diagonal, a few cream glints left showing (more towards the upper left, for form),
# and a heavy black outline. No grey gradients.
#   python3 make-strain-icon.py
import math, random
from pathlib import Path
from PIL import Image, ImageDraw

here = Path(__file__).parent
S = 4
N = 220
W = H = N * S
rng = random.Random(23)
INK = (26, 25, 24, 255)
PAPER = (247, 242, 222, 255)
cx = cy = W / 2
R = 100 * S

disc = Image.new("L", (W, H), 0)
ImageDraw.Draw(disc).ellipse([cx - R, cy - R, cx + R, cy + R], fill=255)

layer = Image.new("RGBA", (W, H), PAPER)
d = ImageDraw.Draw(layer)


def stroke(x0, y0, x1, y1, w):
    """A tapered pen stroke: thick in the middle, pointed at both ends."""
    dx, dy = x1 - x0, y1 - y0
    L = math.hypot(dx, dy) or 1
    nx, ny = -dy / L, dx / L
    pts_a, pts_b = [], []
    for k in range(13):
        t = k / 12
        hw = w * math.sin(math.pi * t) ** 0.6 / 2
        bx, by = x0 + dx * t, y0 + dy * t
        pts_a.append((bx + nx * hw, by + ny * hw))
        pts_b.append((bx - nx * hw, by - ny * hw))
    d.polygon(pts_a + pts_b[::-1], fill=INK)


# dense diagonal scribble, lower-left to upper-right like the Population figure
ang = math.radians(-38)
ux, uy = math.cos(ang), math.sin(ang)          # along the stroke
vx, vy = -uy, ux                                # across the strokes
for pas, (spacing, jitter) in enumerate(((5.2, 2.0), (8.0, 3.0))):
    a2 = ang + math.radians(rng.uniform(-6, 6) + (8 if pas else 0))
    ux2, uy2 = math.cos(a2), math.sin(a2)
    off = -R * 1.2
    while off < R * 1.2:
        # position across the disc; -1 = upper left, +1 = lower right
        across = off / R
        # leave more paper showing towards the upper left (lit side)
        keep = 0.78 + 0.22 * min(1, max(0, (across + 0.9) / 1.2))
        if rng.random() < keep:
            bx, by = cx + vx * off, cy + vy * off
            # a few shorter strokes rather than one long line
            pos = -R * 1.2
            while pos < R * 1.2:
                ln = rng.uniform(50, 130) * S
                gap = rng.uniform(2, 14) * S * (1.6 - keep)
                x0, y0 = bx + ux2 * pos, by + uy2 * pos
                x1, y1 = x0 + ux2 * ln + rng.uniform(-3, 3) * S, y0 + uy2 * ln + rng.uniform(-3, 3) * S
                stroke(x0, y0, x1, y1, rng.uniform(3.2, 6.5) * S)
                pos += ln + gap
        off += (spacing + rng.uniform(-jitter, jitter)) * S

img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
img.paste(layer, (0, 0), disc)

# heavy outline with a slight hand wobble, like the figure's
o = ImageDraw.Draw(img)
pts = []
for k in range(181):
    a = 2 * math.pi * k / 180
    r = R - 3.2 * S + math.sin(a * 3 + 0.7) * 0.8 * S
    pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
o.line(pts, fill=INK, width=int(8 * S), joint="curve")

out = img.resize((N, N), Image.LANCZOS)
out = out.crop(out.getbbox())
out.save(here / "assets/icon-Strain.png")
print(out.size)
