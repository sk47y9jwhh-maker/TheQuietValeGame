from pathlib import Path
import json
from xml.sax.saxutils import escape
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from reportlab.lib.units import mm
ROOT=Path(__file__).resolve().parents[2]; A=ROOT/'working/rules-v6_7/assets';T=A/'aid-tiles'
REF=json.loads((A/'reference-data.json').read_text())

def draw_extra_pages(c,role,g):
 x=8*mm; w=89*mm
 def text(txt,xx,top,ww,size=7.5,max_h=None,bold=False):
  sty=ParagraphStyle('Reference',fontName='QVCharter-Bold' if bold else 'QVCharter',fontSize=size,leading=size*1.2,textColor=g['INK'])
  p=Paragraph(txt.replace('River/Water','Water/River'),sty); _,h=p.wrap(ww,1000)
  if max_h and h>max_h:raise RuntimeError(f'Reference overflow {h/mm:.1f}>{max_h/mm:.1f}: {txt}')
  p.drawOn(c,xx,top-h);return top-h
 def art(path,xx,yy,ww,hh):c.drawImage(str(path),xx,yy,ww,hh,preserveAspectRatio=True,anchor='c',mask='auto')
 def header(n,k,t):
  g['draw_body_background'](c,n,role)
  return g['draw_section_header'](c,k,t,148*mm-10.8*mm)-2*mm
 # Page 15: full faces plus the exact artist symbols.
 y=header(15,'FACES · SYMBOLS · TIMING','READING A TILE')
 art(T/'c01_lumber_yard-basic.png',x,y-35*mm,40*mm,35*mm)
 art(T/'c01_lumber_yard-upgraded.png',x+49*mm,y-35*mm,40*mm,35*mm)
 text('BASIC',x,y-36*mm,40*mm,6.5,bold=True);text('UPGRADED',x+49*mm,y-36*mm,40*mm,6.5,bold=True)
 y=text('The upper-left icon is the category. The upper-right symbol is the placement requirement. PLACE and UPGRADE show the costs; the silver title and UPGRADED FROM identify the reverse side.',x,y-42*mm,w,7.5,max_h=23*mm)
 y=text('<b>Effect symbols</b>',x,y-3*mm,w)
 art(A/'effect-icons.png',x,y-12*mm,w,11*mm);y-=16*mm
 y=text('Read each icon as its named resource, Population or Renown. The number beside it is the amount.',x,y,w)
 y=text('<b>ACTIVATE:</b> spend an Activate Action. <b>PASSIVE / PERSISTENT:</b> follow the printed timing without an Activate Action. <b>Linked Production (once per round):</b> use the participation rule in the Core Tile reference.',x,y-3*mm,w,7.5)
 text('Special Tiles have a black border and a numbered back. Golden Tiles have a gold title and show placement text in the effect box.',x,y-3*mm,w,7.5,max_h=y-13*mm)
 c.showPage()
 # Page 16: current finished card faces, paired with concise resolution reminders.
 y=header(16,'CURRENT CARD FACES','ENCOUNTER CARD GUIDE')
 cards=[('boon','BOON','Use the current Season row. The italic line gives its duration.'),('burden','BURDEN','Apply the current row; keep active until its printed resolution is met.'),('arrival','ARRIVAL','Meet Requirements with Interact; match its Reward number to the Tile back.'),('golden','GOLDEN BOON','Resolve free, then discard. It does not count toward standard reveals.')]
 for i,(file,label,desc) in enumerate(cards):
  xx=x+(i%2)*46*mm; top=y-(i//2)*55*mm
  art(A/'aid-cards'/(file+'.png'),xx+7*mm,top-39*mm,23*mm,39*mm)
  bot=text(label,xx,top-40*mm,43*mm,6.8,bold=True)
  text(desc,xx,bot-1*mm,43*mm,7,max_h=13*mm)
 c.showPage()
 # Page 17: complete numbered example and all ten terrain placements.
 y=header(17,'ARRIVAL REWARD · TILE BACK','UNLOCK & PLACE')
 art(A/'aid-cards/root-weavers.png',x,y-45*mm,26*mm,45*mm)
 art(T/'special-back-23.png',x+32*mm,y-27*mm,25*mm,22*mm)
 art(T/'special_the_root_weavers_respite.png',x+61*mm,y-27*mm,25*mm,22*mm)
 text('<b>23 matches 23</b><br/>Match the Reward number to the Special Tile back.',x+32*mm,y-29*mm,57*mm,7.6,max_h=15*mm)
 y=text('Blade to Herb unlocks <b>Special Tile 23 The Root Weavers Respite</b>. Place it later on Heaths: 1 normal Place Action, 0 resources, on a legal reachable hex. Stables unlocks <b>17 &amp; 18</b>; follow its two-hex placement rule.',x,y-48*mm,w,7.3,max_h=23*mm)
 y=text('<b>Place on the listed terrain</b>',x,y-2*mm,w,7.4)
 for terrain,names in REF['terrain_rows']:
  y=text(f'<b>{escape(terrain)}:</b> {escape(names)}',x,y-1.5*mm,w,6.9,max_h=11*mm)
 text('These placements require no adjacent Resource Tile. Effect conditions and other printed adjacency rules still apply.',x,y-2*mm,w,6.9,max_h=y-12*mm)
 c.showPage()
 # Page 18: retained Golden conditions, now deliberately separate from the tile face.
 y=header(18,'OPTIONAL LEDGER REWARDS','GOLDEN TILE SCORING')
 y=text('At final scoring, each placed, non-Overstrained Golden Tile earns <b>+5 Renown</b> if its condition is met.',x,y,w,7.4,max_h=15*mm)-3*mm
 for tile in REF['golden']:
  art(T/(tile['id']+'.png'),x,y-20*mm,23*mm,20*mm)
  bottom=text(escape(tile['name']),x+27*mm,y-1*mm,62*mm,7.7,bold=True)
  text(escape(tile['scoringText']),x+27*mm,bottom-1*mm,62*mm,7.2,max_h=19*mm)
  y-=19.5*mm
 if y<10*mm:raise RuntimeError('Golden page enters footer')
 c.showPage()
