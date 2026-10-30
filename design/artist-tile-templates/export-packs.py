"""Export approved 600 dpi faces with print bleed and cropped, alpha-masked web art."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageChops
from concurrent.futures import ThreadPoolExecutor
import json,csv,shutil
root=Path(__file__).resolve().parents[2]
out=root/'output/artist-tiles-complete';public=root/'public/tiles'
public.mkdir(parents=True,exist_ok=True)
records=json.loads((out/'samples.json').read_text())
inset=round(3*600/25.4)
def export(record):
 name=record['id'];p=out/'tiles-print'/f'{name}.png'
 im=Image.open(p).convert('RGBA');im.save(p,dpi=(600,600))
 im=im.crop((inset,inset,im.width-inset,im.height-inset));w,h=im.size
 scale=4;mask=Image.new('L',(w*scale,h*scale));ImageDraw.Draw(mask).polygon([(w*scale/4,0),(w*scale*3/4,0),(w*scale,h*scale/2),(w*scale*3/4,h*scale),(w*scale/4,h*scale),(0,h*scale/2)],fill=255)
 mask=mask.resize((w,h),Image.Resampling.LANCZOS);im.putalpha(ImageChops.multiply(im.getchannel('A'),mask))
 im.save(out/'tiles-web'/f'{name}.png',dpi=(600,600))
 im.save(public/f'{name}.webp',lossless=True,method=4)
 thumb=im.copy();thumb.thumbnail((360,312));thumb.save(public/f'{name}-map.webp',quality=90,method=4)
 board=im.copy();board.thumbnail((720,624));board.save(public/f'{name}-board.webp',quality=88,method=4)
 return {'id':name,'name':record['name'],'kind':record['kind'],'face':record.get('face'),'quantity':record['quantity'],'tileId':record.get('t',{}).get('id',record.get('pairedTileId')),'backNumber':record.get('number'),'sourceCopy':record.get('sourceCopy'),'printFile':f'tiles-print/{name}.png','webFile':f'tiles-web/{name}.png','websiteFile':f'{name}.webp','sourceEffect':record.get('t',{}).get(record.get('face'),record.get('t',{})).get('effectText'),'fit':record['fit']}
with ThreadPoolExecutor(max_workers=4) as pool:faces=list(pool.map(export,records))
manifest={'version':'2026-09-12','printPixels':[1560,1370],'dpi':600,'bleedMm':3,'webPixels':[1418,1228],'uniqueFaces':len(faces),'printedHexFacesAtStockQuantity':sum(f['quantity'] for f in faces),'faces':faces}
(out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
(public/'manifest.json').write_text(json.dumps({'version':manifest['version'],'faces':[{k:f[k] for k in ['id','name','kind','face','tileId','websiteFile']} for f in faces]},indent=2)+'\n')
with (out/'print-quantities.csv').open('w',newline='') as f:
 writer=csv.DictWriter(f,fieldnames=['id','name','kind','face','quantity','tileId','backNumber','sourceCopy','printFile']);writer.writeheader();writer.writerows({k:r[k] for k in writer.fieldnames} for r in faces)
print(f"Exported {len(faces)} faces; {manifest['printedHexFacesAtStockQuantity']} printed hex sides at stock quantity. Print: 600 dpi with 3 mm bleed. Web: trimmed PNG and lossless WebP.")
