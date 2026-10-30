from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
import json,zipfile,shutil
root=Path(__file__).resolve().parents[2];out=root/'output/artist-tiles-complete';manifest=json.loads((out/'manifest.json').read_text());faces=manifest['faces']
pdf=out/'quiet-vale-all-tile-faces-print.pdf';c=canvas.Canvas(str(pdf),pagesize=A4);c.setTitle('The Quiet Vale — complete tile faces with 3 mm bleed')
w,h=1560/600*25.4*mm,1370/600*25.4*mm
for i,f in enumerate(faces):
 slot=i%12
 if slot==0:
  if i:c.showPage()
  c.setFont('Helvetica-Bold',12);c.drawString(6*mm,285*mm,'The Quiet Vale — complete tile faces')
  c.setFont('Helvetica',8);c.drawString(6*mm,280*mm,'Print at 100% / actual size. Each face includes 3 mm bleed. Quantities shown below.')
 col,row=slot%3,slot//3;x=(4+col*68)*mm;y=(274-row*65)*mm-h
 c.drawImage(ImageReader(str(out/f['printFile'])),x,y,w,h,mask='auto')
 c.setFont('Helvetica',6);label=f"{f['name']} | {f.get('face') or f['kind']} | qty {f['quantity']}"
 if len(label)>66:label=label[:63]+'...'
 c.drawCentredString(x+w/2,y-3*mm,label)
 if slot==11 or i==len(faces)-1:
  c.setFont('Helvetica',7);c.drawRightString(204*mm,7*mm,f'Page {i//12+1}')
c.save()
readme=f'''# The Quiet Vale — approved artist tile set

{len(faces)} unique faces, covering 42 Core faces, 25 Special fronts, 5 Golden fronts,
2 Travel extension faces, 26 numbered Special backs and 1 unnumbered Golden back.
Stock quantities require {manifest['printedHexFacesAtStockQuantity']} printed hex sides.
The current game data supplies all quantities; do not use counts from older SVG packs.

## Print pack
- tiles-print/: original-size 1560 × 1370 PNG faces, 600 dpi, with 3 mm bleed.
- quiet-vale-all-tile-faces-print.pdf: all unique faces at actual size, with quantity labels.
  Print at 100%, not fit-to-page. This is a face proof, not duplex-imposed production sheets.
- print-quantities.csv: required count of each face and numbered Special back pairing.
- manifest.json: source rules, rendered text sizes, dimensions and face mappings.

Core basic/upgraded faces pair by tile ID. Street uses one main face plus one generic
Travel extension per side; Track uses one main face plus two extensions per side.
Stables uses two detached copies of its front for each component; repeat back 17 for
both hexes of copy 1 and back 18 for both hexes of copy 2. Other Special backs pair
by the tile ID and source-copy fields in the CSV. Every Golden front takes the unnumbered Golden back (the Special back artwork with no
number), so print it once per Golden tile.

Finished online faces are 1418 × 1228 pixels (about 60 × 52 mm at 600 dpi), after
removing 71 pixels per canvas edge and applying the finished hex boundary.

## Web pack
- tiles-web/: trimmed transparent PNGs, retaining original exported colours.
- website/: lossless WebP faces plus smaller map/selection thumbnails.
- index.html: offline gallery using the trimmed PNGs.
- manifest.json and print-quantities.csv retain the face mapping.

## Approved treatment
Large names without type subtitles; black Special borders; inset river and Renown
icons; Resource/Travel category icons reduced 10%, Housing 5%; resource, Population
and Renown symbols in effects; Linked Production (once per round). Golden placement
text shares the effect area and scoring copy is omitted from the face (game scoring
is retained). Named producer adjacency is replaced by its terrain for ten Specials.
Effect-heading washes are hidden. Only title/lineage silver and gold layers use
Multiply at reduced opacity, revealing parchment grain. Borders and other artwork
retain the supplied colours. Illustration windows remain empty, as approved.

The original supplied PSDs are unchanged. Regeneration sources are in
`design/artist-tile-templates` in the project.
'''
(out/'README.md').write_text(readme)
# A standalone gallery avoids local development links and references only packed files.
s=(out/'index.html').read_text().replace('<a href="http://127.0.0.1:8790/tmp/card-bleed-preview/index.html">Card print / web comparison</a>','')
(out/'index.html').write_text(s)
for kind in ['print','web']:
 dest=out/f'quiet-vale-tiles-{kind}.zip'
 with zipfile.ZipFile(dest,'w',zipfile.ZIP_DEFLATED,compresslevel=1) as z:
  for name in ['README.md','manifest.json','print-quantities.csv']:z.write(out/name,name)
  for f in (out/f'tiles-{kind}').glob('*.png'):z.write(f,f'tiles-{kind}/{f.name}')
  if kind=='print':z.write(pdf,pdf.name)
  else:
   z.write(out/'index.html','index.html')
   for f in (out/'assets').glob('*.woff2'):z.write(f,'assets/'+f.name)
   for f in (root/'public/tiles').iterdir():z.write(f,'website/'+f.name)
 print(dest)
print(pdf)
