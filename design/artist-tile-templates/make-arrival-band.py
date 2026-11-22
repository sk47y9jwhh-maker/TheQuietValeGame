# Arrival band: the grey shading clouds in the Special template's lower band, recoloured purple
# to sit with the Arrival door icon (Robert, 22 Nov). Writes a band-sized overlay the renderer
# draws over the template on Special faces only; the parchment and frame lines are untouched.
#   python3 make-arrival-band.py
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from pathlib import Path

here = Path(__file__).parent
tpl = Image.open(here / "assets/Quiet Valley Tile Special-managed.png").convert("RGB")
X0, Y0, X1, Y1 = 170, 700, 1390, 850            # band box on the 1560 x 1370 face
band = tpl.crop((X0, Y0, X1, Y1))
a = np.asarray(band).astype(float)
L = a.mean(2)
L = np.where(L < 185, np.median(L), L)        # ignore ink lines so they do not count as shading
Lb = np.asarray(Image.fromarray(L.astype(np.uint8)).filter(ImageFilter.GaussianBlur(18))).astype(float)
ref = np.percentile(Lb, 92)
D = np.clip(ref - Lb, 0, None)                   # how much the shading darkens each spot
# Grey darkening lowers R, G and B alike; re-tint it so it darkens mostly green: lavender.
STRENGTH = float(sys.argv[1]) if len(sys.argv) > 1 else 1.5
shift = np.stack([D * 0.02, -D * 0.40, D * 0.42], 2) * STRENGTH
out = np.clip(a + shift, 0, 255).astype(np.uint8)

# keep strictly inside the frame lines (slanted sides at 30 degrees)
w, h = X1 - X0, Y1 - Y0
mask = Image.new("L", (w, h), 0)
t = 0.5774
def left(y): return 183 + t * (y - 705) + 10 - X0
def right(y): return 1374 - t * (y - 705) - 10 - X0
ya, yb = 703 - Y0, 846 - Y0
ImageDraw.Draw(mask).polygon([(left(ya + Y0), ya), (right(ya + Y0), ya), (right(yb + Y0), yb), (left(yb + Y0), yb)], fill=255)
mask = mask.filter(ImageFilter.GaussianBlur(3))
o = Image.fromarray(out).convert("RGBA"); o.putalpha(mask)
o.save(here / "assets/arrival-band.png")
print("max darkening", round(D.max(), 1), "ref", round(ref, 1))
