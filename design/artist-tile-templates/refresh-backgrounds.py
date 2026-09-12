from pathlib import Path
from psd_tools import PSDImage
from psd_tools.constants import BlendMode
from psd_tools.composite import composite
from PIL import Image
import subprocess,tempfile,sys
root=Path(__file__).resolve().parent
source=Path(sys.argv[1]) if len(sys.argv)>1 else Path('/Users/robertlittle/Downloads/transfer-01a09574')
for p in source.glob('*.psd'):
 if 'Icons' in p.name or 'back' in p.name:continue
 psd=PSDImage.open(p)
 # Blend only the original title/lineage wash layers into the parchment.
 # Outer frames and all other layers retain their original settings.
 for layer in psd.descendants():
  is_silver_wash=layer.kind=='pixel' and (layer.name.lower()=='colored bar' or ('Special.psd' in p.name and layer.name=='Livello 10' and layer.top==139))
  is_gold_wash='Golden' in p.name and layer.kind=='pixel' and layer.name=='Gold' and layer.top in (139,691)
  if is_silver_wash or is_gold_wash:
   layer.blend_mode=BlendMode.MULTIPLY
   layer.opacity=140 if is_silver_wash else 155
 def keep(layer):
  is_title_divider=layer.kind=='pixel' and layer.top==247 and layer.bottom==257
  is_golden_scoring_band='Golden' in p.name and layer.kind=='pixel' and ((layer.top==989 and layer.bottom==999) or (layer.name=='Silver' and layer.top==994))
  is_effect_wash=layer.kind=='pixel' and ((layer.name=='Livello 5' and layer.bbox==(329,856,1232,963)) or ('Golden' in p.name and layer.name=='Silver' and layer.top==790))
  return not is_effect_wash and layer.visible and layer.kind!='type' and not is_title_divider and not is_golden_scoring_band
 color,_,alpha=composite(psd,color=(0.,0.,0.,0.),alpha=1.,force=True,layer_filter=keep)
 im=Image.fromarray(((1.-color.clip(0,1))*255+.5).astype('uint8'),'CMYK')
 with tempfile.TemporaryDirectory() as td:
  tif=Path(td)/'clean.tiff';im.save(tif)
  dest=root/'assets'/(p.stem+'-managed.png')
  subprocess.run(['sips','-s','format','png',str(tif),'--out',str(dest)],check=True,capture_output=True)
 print(p.stem,flush=True)
