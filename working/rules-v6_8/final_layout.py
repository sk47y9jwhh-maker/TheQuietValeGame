from pathlib import Path
from docx import Document
R=Path(__file__).resolve().parents[2];W=R/'working/rules-v6_8';p=R/'output/docx/rulebook-v6_8/The_Quiet_Vale_Main_Rulebook_v6_8.docx';d=Document(p)
for par in d.paragraphs:
 if par.text in ['Contents','2. Setup','Special Tile numbers','Glossary']:par.paragraph_format.page_break_before=True
 if par.text.startswith('Boons help the settlement.') or par.text.startswith('Using a face-up Boon'):par.paragraph_format.keep_with_next=True
# Keep the Word source navigation together; its page numbers are refreshed after rendering.
for t in d.tables:
 if t.cell(0,0).text=='Section':
  for row,pg in zip(t.rows[1:],['4–7','8–9','10–16','17–19','20–23','24','26','27','28–30']):row.cells[1].text=pg
  for row in t.rows:
   for cell in row.cells:
    for par in cell.paragraphs:par.paragraph_format.keep_with_next=True
d.save(p)
p=W/'build_professional_rulebook.py';s=p.read_text();s=s.replace('''            else:
                flowable = styled_table(table, rel_paths, crossrefs)
''','''            elif first_cell == "No." and len(table.columns) == 4:
                flowable = compact_reference_table([c.text for c in table.rows[0].cells], [[c.text for c in row.cells] for row in table.rows[1:]], [9 * mm, BODY_W / 2 - 9 * mm, 9 * mm, BODY_W / 2 - 9 * mm], font_size=7.0)
            else:
                flowable = styled_table(table, rel_paths, crossrefs)
''');p.write_text(s)
p=W/'polish_reference.py';s=p.read_text();a=s.index('    if count>=2:');b=s.index('    if count>=3:',a);s=s[:a]+'''    if count>=2:
        out.extend([PageBreak(),g['SectionHeader']('Supported reference',include_in_toc=False),Spacer(1,5*mm),para('Supported prevents 1 Strain before checking for Overstrain. Passive and single-use Supported never stack.'),Paragraph('Passive Supported',g['H2']),para('Common Land protects 1 adjacent Housing Tile; The Pleasance protects up to 3. Choose eligible Housing Tiles when the effect becomes active. Keep those choices until the eligible set changes or the source becomes Overstrained, then choose again when required. You cannot reassign passive Supported in response to incoming Strain.'),g['scaled_rl_image'](R/'working/rulebook-v6_4-card-visuals/supported-from-core.png',g['BODY_W'],75*mm),Paragraph('Single-use Supported',g['H2']),para('Supported granted by placement, activation or another effect is single-use unless its rule says it is passive. It prevents 1 Strain, then is spent. It returns only when another effect grants it.'),Paragraph('Resolve prevention first',g['H2']),para('The Golden Garden and any other prevention resolve at the same prevention step. Prevented Strain is not placed, redirected or able to start an Overstrain spread.')])
'''+s[b:];p.write_text(s)
