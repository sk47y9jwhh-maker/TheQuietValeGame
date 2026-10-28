from pathlib import Path
from PIL import Image,ImageOps,ImageDraw
import pypdfium2 as pdfium
ROOT=Path(__file__).resolve().parents[2]; OUT=ROOT/'tmp/rules-v6_7-qa';OUT.mkdir(exist_ok=True)
def contact(paths,name,cols=4):
 for start in range(0,len(paths),cols*3):
  sheet=Image.new('RGB',(cols*390,3*535),'#ccc8bb');draw=ImageDraw.Draw(sheet)
  for j,p in enumerate(paths[start:start+cols*3]):
   im=Image.open(p).convert('RGB'); im.thumbnail((380,505));x=(j%cols)*390+(390-im.width)//2;y=(j//cols)*535
   sheet.paste(im,(x,y));draw.text(((j%cols)*390+8,y+507),p.stem,fill='black')
  sheet.save(OUT/f'{name}-{start//(cols*3)+1}.jpg')
if __name__=='__main__':
 import sys
 if len(sys.argv)==1:
  contact(sorted((ROOT/'tmp/rules-v6_7-docx-render').glob('page-*.png'),key=lambda p:int(p.stem.split('-')[-1])),'docx')
 else:
  p=Path(sys.argv[1]);name=p.stem;dir=OUT/name;dir.mkdir(exist_ok=True);doc=pdfium.PdfDocument(str(p));paths=[]
  for i,page in enumerate(doc):
   target=dir/f'page-{i+1}.png';page.render(scale=1.8).to_pil().save(target);paths.append(target)
  contact(paths,name);print(name,len(paths))
