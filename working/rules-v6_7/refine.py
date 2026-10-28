from pathlib import Path
from docx import Document
from docx.oxml import OxmlElement
from copy import deepcopy
R=Path(__file__).resolve().parents[2];W=R/'working/rules-v6_7';p=W/'suite_reference_pages.py';s=p.read_text().replace("p=Paragraph(txt,sty)","p=Paragraph(txt.replace('River/Water','Water/River'),sty)");p.write_text(s)
p=W/'build_professional_rulebook.py';s=p.read_text().replace("'Special Tile', 88 * mm)","'Special Tile', 68 * mm)")
s=s.replace("'Reward number → matching back → Special Tile', 88 * mm)","'Reward number → matching back → Special Tile', 68 * mm)")
s=s.replace('self.max_height = max_height','self.max_height = max_height\n        self.keepWithNext = rel_id == "rId47"')
s=s.replace('"1", "place", "select", "active burden", "card",','"1", "place", "select", "active burden", "card", "place on",')
p.write_text(s)
p=W/'audit_professional_rulebook.py';s=p.read_text().replace('        "Credits, edition and rules support",\n','').replace('        "PRODUCTION PLACEHOLDER - ICON REFERENCE",\n','');p.write_text(s)
p=R/'output/docx/rulebook-v6_7/The_Quiet_Vale_Main_Rulebook_v6_7_Card_Guide.docx';d=Document(p)
for sect in d.sections:
 for hf in [sect.header,sect.footer]:
  for para in hf.paragraphs:
   for run in para.runs:run.text=run.text.replace('v6.6','v6.7')
# Apply the established table formatting to the two new reference tables.
ref=d.tables[4]
for t in d.tables:
 if t.cell(0,0).text not in ['Place on','Golden Tile']:continue
 if t.cell(0,1).text not in ['Special Tile number and name','Final scoring condition']:continue
 for ri,row in enumerate(t.rows):
  for ci,cell in enumerate(row.cells):
   proto=ref.cell(0 if ri==0 else 1,ci)
   for child in list(cell._tc):
    if child.tag.endswith('}tcPr'):cell._tc.remove(child)
   cell._tc.insert(0,deepcopy(proto._tc.tcPr))
   if proto.paragraphs[0].runs:
    for run in cell.paragraphs[0].runs:
     if proto.paragraphs[0].runs[0]._r.rPr is not None:run._r.insert(0,deepcopy(proto.paragraphs[0].runs[0]._r.rPr))
 row=t.rows[0];trpr=row._tr.get_or_add_trPr();trpr.append(OxmlElement('w:tblHeader'))
# Word's source pagination is different from the separate print PDF.
toc=d.tables[3]
for row,pg in zip(toc.rows[1:],['3–5','6–7','8–14','15–17','18–21','22','24','25','26–27']):row.cells[1].text=pg
# Keep the new adjacency explanation as a complete paragraph across source pages.
for para in d.paragraphs:
 if para.text.startswith('Tiles are adjacent'):para.paragraph_format.keep_together=True
# The locked source has manual running folios; shift later ones for new pages using PAGE fields.
for sect in d.sections:
 for para in sect.footer.paragraphs:
  if 'Main Rulebook' in para.text:
   para.clear();para.add_run('Main Rulebook v6.7 | ');fld=OxmlElement('w:fldSimple');fld.set('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}instr','PAGE');para._p.append(fld)
d.save(p)
