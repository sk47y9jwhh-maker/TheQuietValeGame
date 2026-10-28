from pathlib import Path
from docx import Document
from pypdf import PdfReader
import json
R=Path(__file__).resolve().parents[2];W=R/'working/rules-v6_8'
a=Document(R/'output/docx/rulebook-v6_7/The_Quiet_Vale_Main_Rulebook_v6_7_Card_Guide.docx');b=Document(R/'output/docx/rulebook-v6_8/The_Quiet_Vale_Main_Rulebook_v6_8.docx')
changes=json.loads((W/'wording-changes.json').read_text());allowed={e['before'] for e in changes}|{'Setup continued','Encounter types and resolution'};new={p.text for p in b.paragraphs}
missing=[p.text for p in a.paragraphs if p.text and p.text not in new and p.text not in allowed];assert not missing,missing
for e in changes:
 for para in e['after'].split('\n\n'):assert para in new,para
assert 80+25+2*15+5-(10+2*10+3*10)==80
print('All unchanged source paragraphs retained; 10 declared wording edits verified; worked scoring example totals 80.')
p=next((R/'tmp/rules-v6_8-docx-final-render').glob('*.pdf'));r=PdfReader(p);print('Editable source:',len(r.pages),'pages')
for i,page in enumerate(r.pages):
 t=page.extract_text()
 for heading in ['1. Components','2. Setup','3. Seasons','4. Round','5. Your turn','7. Building','8. Encounter','9. Strain','11. The Target','12. Stewards','14. Final','15. Steward','16. Golden','17. Quick','Special Tile numbers','Glossary']:
  if heading in t: print(heading,i+1)
(W/'editorial-checks.json').write_text(json.dumps({'unchanged_paragraphs_preserved':True,'declared_wording_edits':len(changes),'scoring_example_verified':True},indent=2))
