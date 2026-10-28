from pathlib import Path
from PIL import Image
R=Path(__file__).resolve().parents[2];W=R/'working/rules-v6_7';A=W/'assets';T=R/'output/artist-tiles-complete/tiles-web'
for folder in ['tile-thumbnails','aid-tiles','aid-cards']:(A/folder).mkdir(exist_ok=True)
for p in T.glob('*.png'):
 sizes=[('tile-thumbnails',400),('aid-tiles',960 if p.stem.startswith('c01') else 600)]
 for folder,px in sizes:
  im=Image.open(p);im.thumbnail((px,px),Image.Resampling.LANCZOS);im.save(A/folder/p.name)
for name in ['boon','burden','arrival','golden','root-weavers']:
 im=Image.open(A/(name+'.png'));im.thumbnail((620,1100),Image.Resampling.LANCZOS);im.save(A/'aid-cards'/(name+'.png'))
im=Image.open(R/'src/assets/quiet_vale_map_v02.webp').convert('RGB');im.thumbnail((1600,1600),Image.Resampling.LANCZOS);im.save(A/'aid-map.png')
p=W/'build_steward_aid.py';s=p.read_text().replace('ROOT / "src/assets/quiet_vale_map_v02.webp"','ROOT / "working/rules-v6_7/assets/aid-map.png"').replace('ROOT / "output/artist-tiles-complete/tiles-web" / (tile_id','ROOT / "working/rules-v6_7/assets/tile-thumbnails" / (tile_id');p.write_text(s)
p=W/'suite_reference_pages.py';s=p.read_text().replace("T=ROOT/'output/artist-tiles-complete/tiles-web'","T=A/'aid-tiles'").replace("A/(file+'.png')","A/'aid-cards'/(file+'.png')").replace("A/'root-weavers.png'","A/'aid-cards/root-weavers.png'").replace('23 → 23','23 matches 23');p.write_text(s)
