#!/usr/bin/env python3
"""Print file for the rulebook: every page at 600 dpi, converted to CMYK
(FOGRA39, relative colorimetric), with the trim and bleed boxes kept. Same
method as the Steward Guides' print files; the type is rasterised, so the
printer sees no fonts.
    python3 design/rulebook-v6_9/make_print_pdf.py <review.pdf> <print.pdf> <workdir>
"""
import glob
import os
import subprocess
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "../steward-guides"))
from PIL import Image  # noqa: E402
from pdfkit import Doc, to_cmyk, jpeg_bytes, tac  # noqa: E402

src, out, work = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(work, exist_ok=True)
B = 3.175
W, H = 195 + 2 * B, 255 + 2 * B
d = Doc("The Quiet Vale - Main Rulebook (195 x 255 mm, 36 pages, CMYK)")
worst = 0
for i in range(1, 100):
    stem = f"{work}/p"
    r = subprocess.run(["pdftoppm", "-r", "600", "-png", "-f", str(i), "-l", str(i), src, stem], capture_output=True)
    files = sorted(glob.glob(f"{stem}-*.png"))
    if not files:
        break
    im = Image.open(files[0]).convert("RGB")
    cm = to_cmyk(im)
    worst = max(worst, tac(cm)[0])
    d.image(i, jpeg_bytes(cm, 84), im.width, im.height)
    d.page(W, H, i, (B, B, W - B, H - B))
    for f in files:
        os.remove(f)
d.save(out)
print(os.path.basename(out), len(d.pdf.pages), "pages, total ink (99.99th percentile)", round(worst))
