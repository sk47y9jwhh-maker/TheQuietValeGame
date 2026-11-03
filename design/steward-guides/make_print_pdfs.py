"""CMYK print PDF from a review guide: python3 make_print_pdfs.py <in.pdf> <out.pdf> <workdir>"""
import sys, os, glob, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
from pdfkit import Doc, to_cmyk, jpeg_bytes, tac
src, out, work = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(work, exist_ok=True)
subprocess.run(['pdftoppm', '-r', '600', '-png', src, f'{work}/p'], check=True)
B = 3.175; W, H = 105 + 2 * B, 148 + 2 * B
name = os.path.basename(src).replace('_v6_9.pdf', '')
d = Doc(f"The Quiet Vale - {name.split('A6_')[1].replace('_', ' ')} (A6, 20 pages, CMYK)")
mx = 0
for i, f in enumerate(sorted(glob.glob(f'{work}/p-*.png'))):
    im = Image.open(f).convert('RGB'); cm = to_cmyk(im); mx = max(mx, tac(cm)[0])
    d.image(i, jpeg_bytes(cm, 95), im.width, im.height); d.page(W, H, i, (B, B, W - B, H - B))
    os.remove(f)
d.save(out); print(os.path.basename(out), len(d.pdf.pages), 'pages, TAC', round(mx))
