#!/usr/bin/env python3
"""A small copy of a review PDF for the website: the text and vector art stay
as they are; every picture is resampled to at most `max_px` on its long side
(enough for about 200 ppi at its printed size in these books) and stored as
JPEG, or as PNG-style Flate when it has transparency.

    python3 design/print-hayman/make_web_pdf.py <in.pdf> <out.pdf> [max_px]
"""
import io
import sys
import zlib

import pikepdf
from pikepdf import PdfImage, Name
from PIL import Image

src, out = sys.argv[1], sys.argv[2]
MAX = int(sys.argv[3]) if len(sys.argv) > 3 else 1800
pdf = pikepdf.open(src)
masks = {o.SMask.objgen for o in pdf.objects if isinstance(o, pikepdf.Stream) and o.get("/SMask") is not None}
images = [o for o in pdf.objects if isinstance(o, pikepdf.Stream) and o.get("/Subtype") == Name.Image and o.objgen not in masks]
for raw in images:
    if True:
        try:
            pim = PdfImage(raw)
            im = pim.as_pil_image()
        except Exception:
            continue
        if im.mode in ("1", "P"):
            continue
        sm = raw.get("/SMask")
        if sm is not None:
            # Keep the transparency mask lossless, at the new size.
            try:
                mim = PdfImage(sm).as_pil_image().convert("L")
            except Exception:
                continue
        if im.mode not in ("RGB", "L"):
            im = im.convert("RGB")
        if max(im.size) > MAX:
            im.thumbnail((MAX, MAX), Image.Resampling.LANCZOS)
        elif sm is None and raw.get("/Filter") == Name.DCTDecode:
            continue
        buf = io.BytesIO()
        im.save(buf, "JPEG", quality=80, optimize=True)
        raw.write(buf.getvalue(), filter=Name.DCTDecode)
        if sm is not None:
            mim = mim.resize(im.size, Image.Resampling.LANCZOS)
            sm.write(zlib.compress(mim.tobytes(), 9), filter=Name.FlateDecode)
            sm.Width, sm.Height = mim.size
            sm.ColorSpace, sm.BitsPerComponent = Name.DeviceGray, 8
            for k in ("/DecodeParms", "/Decode"):
                if k in sm:
                    del sm[k]
        raw.Width, raw.Height = im.size
        raw.ColorSpace = Name.DeviceRGB if im.mode == "RGB" else Name.DeviceGray
        raw.BitsPerComponent = 8
        for k in ("/DecodeParms", "/Decode"):
            if k in raw:
                del raw[k]
pdf.remove_unreferenced_resources()
pdf.save(out, compress_streams=True, object_stream_mode=pikepdf.ObjectStreamMode.generate)
print(out, round(__import__("os").path.getsize(out) / 1e6, 1), "MB")
