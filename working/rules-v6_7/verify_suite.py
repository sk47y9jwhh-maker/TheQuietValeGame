from pathlib import Path
from PIL import Image,ImageDraw
from pypdf import PdfReader
import pypdfium2 as pdfium
import json,hashlib
from check_layout import contact
R=Path(__file__).resolve().parents[2];Q=R/'tmp/rules-v6_7-qa';files=sorted((R/'output/pdf/steward-aids-v6_7').glob('*.pdf')); hashes={};unique=[]; common=[];report=[]
for path in files:
 reader=PdfReader(path);assert len(reader.pages)==20
 text=' '.join(p.extract_text() for p in reader.pages)
 assert 'FINAL TILE ART' not in text and 'v6.6' not in text and '■' not in text and '□' not in text
 for v in ['23 matches 23','Special Tile 23 The Root Weavers Respite','17 & 18','GOLDEN TILE SCORING','Heaths','Mountains','Ruins','Arable Land','Woodland']:
  assert v in text,(path.name,v)
 doc=pdfium.PdfDocument(str(path));out=Q/path.stem;out.mkdir(exist_ok=True)
 for i,page in enumerate(doc):
  im=page.render(scale=1.8).to_pil().convert('RGB');h=hashlib.sha256(im.tobytes()).hexdigest();png=out/f'page-{i+1}.png';im.save(png)
  if h not in hashes:
   hashes[h]=str(png)
   if i in [0,1,19]:unique.append(png)
   else:common.append(png)
 report.append({'file':str(path),'pages':len(doc),'text_checks':'pass'})
 doc.close()
contact(unique,'steward-role-pages');contact(common,'steward-common-pages')
(Q/'suite-checks.json').write_text(json.dumps({'files':report,'distinct_role_pages':len(unique),'distinct_common_pages':len(common),'unique_page_images':hashes},indent=2));print('Checked',len(files),'guides,',len(unique),'role pages and',len(common),'distinct common pages')
