from pathlib import Path
from copy import deepcopy
import json, zipfile
from docx import Document
from docx.shared import Mm
from docx.oxml import OxmlElement
from docx.text.paragraph import Paragraph
from PIL import Image as PILImage
from reportlab.pdfgen.canvas import Canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import pypdfium2 as pdfium
ROOT=Path(__file__).resolve().parents[2]; WORK=ROOT/'working/rules-v6_7'; A=WORK/'assets'; T=ROOT/'output/artist-tiles-complete/tiles-web'
data=json.loads((ROOT/'output/artist-tiles-complete/samples.json').read_text()); golden=[s['t'] for s in data if s['kind']=='golden']
terrain_rows=[['Heaths', '13 Shrine of Ancients; 23 The Root Weavers Respite'],['Mountains', '15 Shrine of Depths; 19 The Iron Roots Respite'],['Woodland', "16 Shrine of Renewal; 21 The Reavers' Respite"],['Arable Land', "14 Shrine of Bounty; 24 The Tamers' Respite"],['Ruins', "12 Shrine of Ancestors; 20 The Lorekeepers' Respite"]]
(A/'reference-data.json').write_text(json.dumps({'golden':golden,'terrain_rows':terrain_rows},indent=2))
pdfmetrics.registerFont(TTFont('Figure','/System/Library/Fonts/Supplemental/GillSans.ttc',subfontIndex=0))
def figure(name,w,h,items,labels=[]):
 p=A/(name+'.pdf');c=Canvas(str(p),pagesize=(w,h)); c.setFillColorRGB(.956,.941,.898); c.rect(0,0,w,h,fill=1,stroke=0)
 for path,x,y,iw,ih in items:c.drawImage(str(path),x,y,iw,ih,preserveAspectRatio=True,anchor='c',mask='auto')
 c.setFillColorRGB(.14,.19,.16);c.setFont('Figure',11)
 for x,y,txt in labels:c.drawCentredString(x,y,txt)
 c.save(); d=pdfium.PdfDocument(str(p));im=d[0].render(scale=3).to_pil();im.save(A/(name+'.png'));d.close()
figure('core-faces',660,292,[(T/'c01_lumber_yard-basic.png',20,32,300,260),(T/'c01_lumber_yard-upgraded.png',340,32,300,260)],[(170,12,'BASIC · PLACE COST / UPGRADE COST'),(490,12,'UPGRADED · SILVER TITLE / UPGRADED FROM')])
figure('arrival-match',660,330,[(A/'root-weavers.png',20,10,180,310),(T/'special-back-23.png',228,122,185,160),(T/'special_the_root_weavers_respite.png',445,122,185,160)],[(320,94,'MATCH REWARD NUMBER 23'),(537,94,'UNLOCK THIS SPECIAL TILE'),(440,52,'Place later: 1 Place Action · 0 resources · Heaths')])
icons=['Resource Wood','Resource Stone','Resource Metal','Resource Food','Resource Herbs','Resource Goods','Population','Renown']
figure('effect-icons',660,75,[(ROOT/f'design/artist-tile-templates/assets/icon-{v}.png',i*82.5+24,25,35,42) for i,v in enumerate(icons)],[(i*82.5+41.25,8,v.replace('Resource ','')) for i,v in enumerate(icons)])
figure('golden-faces',660,132,[(T/(v['id']+'.png'),i*132+3,10,126,110) for i,v in enumerate(golden)])
src=ROOT/'output/docx/rulebook-v6_6/The_Quiet_Vale_Main_Rulebook_v6_6_Card_Guide.docx';d=Document(src)
def change(p,text):
 # Preserve paragraph properties and first run character styling.
 props=deepcopy(p.runs[0]._r.rPr) if p.runs and p.runs[0]._r.rPr is not None else None
 p.clear();r=p.add_run(text)
 if props is not None:r._r.insert(0,props)
def find(prefix):return next(p for p in d.paragraphs if p.text.startswith(prefix))
def add_before(anchor,text,style=None):
 p=anchor.insert_paragraph_before(text,style or 'Normal');return p
def add_image(anchor,path,width=160):
 p=anchor.insert_paragraph_before();p.add_run().add_picture(str(path),width=Mm(width));return p
newmeta={}
def fig(anchor,name,label,title,height):
 p=add_image(anchor,A/(name+'.png'));rid=p._p.xpath('.//a:blip/@r:embed')[0];newmeta[rid]=(label,title,height)
def add_table(anchor,heads,rows):
 t=d.add_table(rows=1,cols=len(heads));t.style=d.tables[27].style
 for c,v in zip(t.rows[0].cells,heads):c.text=v
 for row in rows:
  for c,v in zip(t.add_row().cells,row):c.text=v
 anchor._p.addprevious(t._tbl)
 return t
# Current quantities from the approved print manifest; multi-hex extensions listed explicitly.
change(d.tables[4].cell(2,1).paragraphs[0],'70 double-sided Core Tiles across 21 Tile types, plus 14 double-sided Travel extension hexes. Each Core Tile has a basic side and an upgraded reverse side.')
change(d.tables[4].cell(3,1).paragraphs[0],'28 Special Tile hexes across 25 designs, with numbered backs. Stables uses two separate hexes per pair.')
change(find('2.2  Organise'), '2.2  Organise the Core Tile supply with every basic side face up. Each upgraded side is the reverse of the same physical Tile; do not make a separate upgraded supply. Keep Travel extension hexes with the Travel supply. Arrange Special Tiles by their numbered backs so they can be matched to Arrival rewards.')
change(find('Arrivals are timed objectives'),find('Arrivals are timed objectives').text.replace('unlocks the Adventurers’ Guild','unlocks Special Tile 1, the Adventurers’ Guild'))
change(d.tables[15].cell(1,0).paragraphs[-1], 'Complete its Requirements with an Interact Action. Match the Reward number and name to the Special Tile back, then set that Tile aside for later placement. Put one timer token in each circle when revealed.')
anchor=find('Terrain, placement and adjacency')
add_before(anchor,'Reading a Tile','Heading 2')
fig(anchor,'core-faces','TILE GUIDE','Basic and upgraded Core faces',75)
add_before(anchor,'The icon beside the name identifies the Tile category. The placement symbol at the upper right tells you where the Tile may be placed. A terrain symbol means place on that terrain; an adjacency symbol means share a hex side with the stated terrain or Tile category. Read any additional placement text as well.')
add_before(anchor,'On a basic Core Tile, PLACE lists its placement cost and UPGRADE lists the cost to flip it. An upgraded Core Tile has a silver name area and an UPGRADED FROM label. Special Tiles have a black border and a numbered back; completing an Arrival unlocks them. Golden Tiles use a gold name area and show their placement text in the effect box.')
fig(anchor,'effect-icons','ICON KEY','Resources, Population and Renown',20)
add_before(anchor,'Read icons in the bottom effect box as the named resource, Population or Renown; the number beside an icon is its amount. ACTIVATE requires an Activate Action. PASSIVE and PERSISTENT effects follow their stated timing without an Activate Action. Linked Production (once per round) uses the full group-participation rules in Section 6.')
anchor=find('Adjacency and connection')
add_before(anchor,'Special Tile terrain placements','Heading 2')
add_before(anchor,'Place the following Special Tiles on the listed terrain. They do not require an adjacent Resource Tile. Their production and other effect conditions still apply exactly as written. Other printed category-adjacency and terrain-adjacency requirements continue to use side-sharing adjacency.')
add_table(anchor,['Place on','Special Tile number and name'],terrain_rows)
anchor=find('Golden Boons —')
add_before(anchor,'Match an Arrival to its Special Tile','Heading 2')
fig(anchor,'arrival-match','ARRIVAL REWARD','Reward number → matching back → Special Tile',88)
add_before(anchor,'Blade to Herb reads “Unlock Special Tile 23 The Root Weavers Respite.” Match 23 to the numbered Tile back. Completing the Arrival unlocks the Tile; it does not place it. Later, spend 1 normal Place Action, pay 0 resources and place it on a legal, reachable Heaths hex. Remnants of the Cavalry unlocks Special Tiles 17 & 18, the two Stables hexes; follow their printed placement rule.')
anchor=find('Use each Golden component')
change(anchor,'Use each Golden component’s effect and placement rule. Golden Tile scoring bonuses are listed below, separately from the Tile face. At final scoring, each placed, non-Overstrained Golden Tile earns +5 Renown only if its condition is met.')
nextp=find('17. Quick reference')
fig(nextp,'golden-faces','GOLDEN TILES','Five optional Ledger rewards',35)
add_table(nextp,['Golden Tile','Final scoring condition'],[[g['name'],g['scoringText']] for g in golden])
# Replace the complete current card renders, preserving each frame's aspect ratio.
images={'rId22':'boon','rId23':'burden','rId24':'arrival','rId25':'golden','rId26':'target-5','rId27':'target-25'}
for rid,name in images.items():
 d.part.rels[rid].target_part._blob=(A/(name+'.png')).read_bytes()
 for inline in d.inline_shapes:
  if rid in inline._inline.xpath('.//a:blip/@r:embed'):
   im=PILImage.open(A/(name+'.png'));inline.height=int(inline.width*im.height/im.width)
out=ROOT/'output/docx/rulebook-v6_7/The_Quiet_Vale_Main_Rulebook_v6_7_Card_Guide.docx';out.parent.mkdir(parents=True,exist_ok=True);d.core_properties.version='6.7';d.save(out)
# New builders retain the established layout and keep the locked version intact.
p=(ROOT/'working/rulebook-professional-redesign/build_professional_rulebook.py').read_text().replace('v6_6','v6_7').replace('v6.6','v6.7')
p=p.replace('def build_story(document:', 'IMAGE_META.update('+repr({k:(a,b,h) for k,(a,b,h) in newmeta.items()})+'.items())\n\ndef build_story(document:') if False else p
insert='\nIMAGE_META.update({\n'+''.join(f'    {rid!r}: ({label!r}, {title!r}, {height} * mm),\n' for rid,(label,title,height) in newmeta.items())+'})\n\n'
p=p.replace('def build_story(document:',insert+'def build_story(document:')
p=p.replace('unlock its named Special Tile beside the board.', 'match its Reward number to the Special Tile back and set the unlocked Tile beside the board.')
(WORK/'build_professional_rulebook.py').write_text(p)
a=(ROOT/'working/rulebook-professional-redesign/audit_professional_rulebook.py').read_text().replace('working/rulebook-professional-redesign','working/rules-v6_7').replace('v6_6','v6_7').replace('63 double-sided Core Tiles across 21 Tile types','70 double-sided Core Tiles across 21 Tile types').replace('26 one-sided Special Tile components across 25 designs','28 Special Tile hexes across 25 designs')
(WORK/'audit_professional_rulebook.py').write_text(a)
p=(ROOT/'working/steward-aids-redesign/build_steward_aid.py').read_text().replace('v6_6','v6_7').replace('v6.6','v6.7').replace('steward-aids-v6_7-approved-suite','steward-aids-v6_7-suite')
p=p.replace('draw_hex_placeholder(c, art_x, art_y, art_w, accent)', 'art_path = ROOT / "output/artist-tiles-complete/tiles-web" / (tile_id + "-" + side.lower() + ".png")\n    c.drawImage(str(art_path), art_x, art_y, art_w, art_h, preserveAspectRatio=True, mask="auto")')
p=p.replace('side: str, accent) -> None:', 'side: str, accent, tile_id: str) -> None:')
p=p.replace('"BASIC", accent)', '"BASIC", accent, tile["id"])').replace('"UPGRADED", accent)', '"UPGRADED", accent, tile["id"])')
p=p.replace('draw_body_background(c, 15, role)', 'draw_body_background(c, 19, role)')
p=p.replace('    draw_reference_page(c, role)\n', '    from suite_reference_pages import draw_extra_pages\n    draw_extra_pages(c, role, globals())\n    draw_reference_page(c, role)\n')
p=p.replace('len(reader.pages) != 16','len(reader.pages) != 20').replace('Expected 16 pages','Expected 20 pages').replace('page_texts[14]', 'page_texts[18]')
p=p.replace('if placeholder_count != 42:', 'if placeholder_count != 0:').replace('Expected 42 FINAL TILE ART labels','Expected no FINAL TILE ART labels')
(WORK/'build_steward_aid.py').write_text(p)
print('Created v6.7 source and builders; new figure references',newmeta)
