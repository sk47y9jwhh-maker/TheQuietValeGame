#!/usr/bin/env python3
"""Hayman Creative booklet print file from a review PDF.

Hayman's booklet rules: one multi-page PDF, single pages (not spreads), the
first page the front cover and the last the back cover; 3 mm bleed; crop marks
offset by the bleed; text at least 6 mm inside the trim; 300 dpi or more; CMYK
for accurate colour.

Each page is rasterised at 600 dpi, converted to CMYK (FOGRA39, relative
colorimetric) and placed on a sheet with crop marks in registration colour,
starting 3.175 mm outside the trim. TrimBox and BleedBox are set.

    python3 design/print-hayman/make_booklet_pdf.py <review.pdf> <out.pdf> <trim-w-mm> <trim-h-mm> <workdir> [title]
"""
import glob
import os
import subprocess
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "../steward-guides"))
import pikepdf  # noqa: E402
from PIL import Image  # noqa: E402
from pdfkit import to_cmyk, jpeg_bytes, tac, MM  # noqa: E402

src, out, tw, th, work = sys.argv[1], sys.argv[2], float(sys.argv[3]), float(sys.argv[4]), sys.argv[5]
title = sys.argv[6] if len(sys.argv) > 6 else os.path.basename(out)
os.makedirs(work, exist_ok=True)
BLEED = 3.175            # the review PDFs carry 3.175 mm (1/8 in) bleed: more than Hayman's 3 mm
SLUG = 8.0               # room outside the bleed for the crop marks
MARK = 5.0               # crop mark length
W, H = tw + 2 * (BLEED + SLUG), th + 2 * (BLEED + SLUG)

pdf = pikepdf.new()
pdf.docinfo["/Title"] = title
pdf.docinfo["/Creator"] = "The Quiet Vale"
reg = pdf.make_indirect(pikepdf.Array([pikepdf.Name.Separation, pikepdf.Name("/All"), pikepdf.Name.DeviceCMYK,
                                       pikepdf.Dictionary(FunctionType=2, Domain=[0, 1], C0=[0, 0, 0, 0], C1=[1, 1, 1, 1], N=1)]))


def marks():
    x0, y0 = (SLUG + BLEED) * MM, (SLUG + BLEED) * MM          # trim corner, bottom left
    x1, y1 = x0 + tw * MM, y0 + th * MM
    off, ln = BLEED * MM, MARK * MM
    segs = []
    for x in (x0, x1):
        for y, d in ((y0, -1), (y1, 1)):
            segs.append(((x, y + d * off), (x, y + d * (off + ln))))          # vertical mark
    for y in (y0, y1):
        for x, d in ((x0, -1), (x1, 1)):
            segs.append(((x + d * off, y), (x + d * (off + ln), y)))          # horizontal mark
    ops = ["q /CS0 CS 1 SCN 0.25 w"] + [f"{a[0]:.3f} {a[1]:.3f} m {b[0]:.3f} {b[1]:.3f} l S" for a, b in segs] + ["Q"]
    return "\n".join(ops)


worst, n = 0.0, 0
for i in range(1, 1000):
    stem = f"{work}/p"
    subprocess.run(["pdftoppm", "-r", "600", "-png", "-f", str(i), "-l", str(i), src, stem], capture_output=True)
    files = sorted(glob.glob(f"{stem}-*.png"))
    if not files:
        break
    im = Image.open(files[0]).convert("RGB")
    cm = to_cmyk(im)
    worst = max(worst, tac(cm)[0])
    s = pikepdf.Stream(pdf, jpeg_bytes(cm, 86))
    s.Type, s.Subtype = pikepdf.Name.XObject, pikepdf.Name.Image
    s.Width, s.Height, s.BitsPerComponent = im.width, im.height, 8
    s.ColorSpace, s.Filter = pikepdf.Name.DeviceCMYK, pikepdf.Name.DCTDecode
    s.Decode = pikepdf.Array([1, 0, 1, 0, 1, 0, 1, 0])
    img = pdf.make_indirect(s)
    bw, bh = (tw + 2 * BLEED) * MM, (th + 2 * BLEED) * MM
    content = f"q {bw:.4f} 0 0 {bh:.4f} {SLUG * MM:.4f} {SLUG * MM:.4f} cm /Im0 Do Q\n" + marks()
    res = pikepdf.Dictionary(XObject=pikepdf.Dictionary({"/Im0": img}), ColorSpace=pikepdf.Dictionary({"/CS0": reg}))
    pg = pikepdf.Dictionary(Type=pikepdf.Name.Page, MediaBox=[0, 0, W * MM, H * MM], Resources=res,
                            Contents=pdf.make_indirect(pikepdf.Stream(pdf, content.encode())))
    pg.BleedBox = [SLUG * MM, SLUG * MM, (W - SLUG) * MM, (H - SLUG) * MM]
    pg.TrimBox = [(SLUG + BLEED) * MM, (SLUG + BLEED) * MM, (W - SLUG - BLEED) * MM, (H - SLUG - BLEED) * MM]
    pdf.pages.append(pikepdf.Page(pg))
    n += 1
    for f in files:
        os.remove(f)
pdf.save(out, compress_streams=True)
print(os.path.basename(out), n, "pages; total ink (99.99th percentile)", round(worst))
