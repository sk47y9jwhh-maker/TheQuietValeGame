from pathlib import Path
import csv
from xml.sax.saxutils import escape
from reportlab.platypus import PageBreak,Paragraph,Spacer,Table,TableStyle,Image
from reportlab.lib.units import mm
R=Path(__file__).resolve().parents[2];A=R/'design/artist-tile-templates/assets'
def reference_pages(count,g):
 out=[]
 def para(s):return Paragraph(s,g['BODY'])
 def symbols(names):
  rows=[]
  for i in range(0,len(names),2):
   row=[]
   for name,label in names[i:i+2]:
    row.extend([g['scaled_rl_image'](A/f'icon-{name}.png',9*mm,9*mm),Paragraph(escape(label),g['BODY_SMALL'])])
   if len(row)<4:row+=['','']
   rows.append(row)
  table=Table(rows,colWidths=[13*mm,g['BODY_W']/2-13*mm]*2,hAlign='LEFT');table.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'MIDDLE'),('TOPPADDING',(0,0),(-1,-1),3),('BOTTOMPADDING',(0,0),(-1,-1),3),('LINEBELOW',(0,0),(-1,-1),.25,g['LINE'])]));return table
 out.extend([PageBreak(),g['SectionHeader']('Tile symbol reference',include_in_toc=False),Spacer(1,5*mm),para('The same symbols appear in costs, placement requirements and effect text. A number beside a resource, Population or Renown symbol gives its amount.'),Paragraph('Resources and scoring',g['H2']),symbols([(f'Resource {v}',v) for v in ['Wood','Stone','Metal','Food','Herbs','Goods']]+[('Population','Population'),('Renown','Renown')]),Paragraph('Category and Golden symbols',g['H2']),symbols([(f'Type {file}',label) for file,label in [('Resource','Resource'),('House','Housing'),('Social','Social'),('Wellbeing','Wellbeing'),('Crafting','Crafting'),('Merchant','Merchant'),('Travel','Travel'),('Gold','Golden Tile')]]),Paragraph('Placement and adjacency',g['H2']),symbols([('Placement Heath','Place on Heaths'),('Adjacent Heath','Adjacent to Heaths'),('Placement Mountains','Place on Mountains'),('Adjacent Water','Adjacent to Water/River')]),para('An adjacency requirement means sharing a hex side. Always read any additional placement text; the placement rule and the effect rule are separate requirements.')])
 if count>=2:
  out.extend([PageBreak(),g['SectionHeader']('Supported reference',include_in_toc=False),Spacer(1,5*mm),para('Supported prevents 1 Strain before checking for Overstrain. Passive and single-use Supported never stack.'),Paragraph('Passive Supported',g['H2']),para('Common Land protects 1 adjacent Housing Tile; The Pleasance protects up to 3. Choose eligible Housing Tiles when the effect becomes active. Keep those choices until the eligible set changes or the source becomes Overstrained, then choose again when required. You cannot reassign passive Supported in response to incoming Strain.'),g['scaled_rl_image'](R/'working/rulebook-v6_4-card-visuals/supported-from-core.png',g['BODY_W'],75*mm),Paragraph('Single-use Supported',g['H2']),para('Supported granted by placement, activation or another effect is single-use unless its rule says it is passive. It prevents 1 Strain, then is spent. It returns only when another effect grants it.'),Paragraph('Resolve prevention first',g['H2']),para('The Golden Garden and any other prevention resolve at the same prevention step. Prevented Strain is not placed, redirected or able to start an Overstrain spread.')])
 if count>=3:
  out.extend([PageBreak(),g['SectionHeader']('Timing reference',include_in_toc=False),Spacer(1,5*mm),Paragraph('At the end of each round',g['H2']),para('Remove 1 timer from every active Arrival and resolve each expiry. Discard effects whose duration ends, refresh used round-based effects, then advance the Round marker.'),Paragraph('After Rounds 4 and 8',g['H2']),g['season_transition_checklist'](),Paragraph('When a Tile reaches 3 Strain',g['H2']),para('Resolve Supported and other prevention first. Finish the original effect, including all printed Strain Cascades. Then resolve each new Overstrain spread with a fresh Target Card. There is no automatic Season-end Strain spread.'),Paragraph('After Round 12',g['H2']),para('Finish the round and all pending effects, then calculate the shared final score. An Arrival still active after Round 12 remains active: it does not expire, place Strain or reduce the final score.')])
 return out


def golden_scoring_gallery(table,g):
    data=[['',Paragraph('Final scoring condition',g['H3'])]]
    ids=['charter','hearth','river_gate','cairn','garden']
    for row,ident in zip(table.rows[1:],ids):
        art=g['scaled_rl_image'](R/f'output/artist-tiles-complete/tiles-web/golden_tile_the_golden_{ident}.png',36*mm,32*mm)
        content=[Paragraph(escape(row.cells[0].text),g['H2']),Paragraph(escape(g['transform_text'](row.cells[1].text)),g['BODY'])]
        data.append([art,content])
    output=Table(data,colWidths=[43*mm,g['BODY_W']-43*mm],rowHeights=[7*mm]+[35*mm]*5,hAlign='LEFT')
    output.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'MIDDLE'),('LEFTPADDING',(0,0),(-1,-1),5),('RIGHTPADDING',(0,0),(-1,-1),5),('LINEBELOW',(0,0),(-1,-1),.3,g['LINE'])]))
    return output


def special_number_table(g):
    with (R/'design/tile-set/special-back-manifest.csv').open() as f:rows=list(csv.DictReader(f))
    pairs=[]
    for i in range(13):
        a,b=rows[i],rows[i+13]
        pairs.append((a['special_tile_number'],a['paired_tile_name'],b['special_tile_number'],b['paired_tile_name']))
    return [Paragraph('Special Tile numbers',g['H2']),Paragraph('Match the Arrival Reward number to its Tile back. Stables uses both 17 and 18.',g['BODY_SMALL']),g['compact_reference_table'](['No.','Special Tile','No.','Special Tile'],pairs,[9*mm,g['BODY_W']/2-9*mm,9*mm,g['BODY_W']/2-9*mm],font_size=7.0)]


def river_diagram(g,path):
    from reportlab.platypus import Flowable
    class RiverDiagram(Flowable):
        def wrap(self,availWidth,availHeight):
            self.width=availWidth;self.height=170*mm;return self.width,self.height
        def draw(self):
            width=145*mm;height=78.5*mm;x=(self.width-width)/2
            g['draw_cropped_raster'](self.canv,path,(45,106,875,555),(x,88*mm,width,height),alpha=1)
            g['draw_cropped_raster'](self.canv,path,(925,106,1755,555),(x,3*mm,width,height),alpha=1)
    return RiverDiagram()
