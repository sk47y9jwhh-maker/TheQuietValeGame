from pathlib import Path
import hashlib,json,shutil,zipfile
from pypdf import PdfReader
R=Path(__file__).resolve().parents[2];W=R/'working/rules-v6_8';D=R/'output/releases/the-quiet-vale-rulebook-v6_8';D.mkdir(parents=True,exist_ok=True)
audit=json.loads((R/'tmp/pdfs/rulebook-v6_8/fidelity-audit.json').read_text());assert audit['pass']
paths=[R/'output/pdf/rulebook-v6_8/The_Quiet_Vale_Main_Rulebook_v6_8.pdf',R/'output/docx/rulebook-v6_8/The_Quiet_Vale_Main_Rulebook_v6_8.docx']
items=[]
for p in paths:
 shutil.copy2(p,D/p.name);item={'file':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size}
 if p.suffix=='.pdf':item['pages']=len(PdfReader(p).pages)
 items.append(item)
manifest={'version':'6.8','status':'Polished review edition','date':'2026-09-12','files':items,'rules_rebalanced':False,'fidelity_audit_passed':True,'declared_wording_edits':10,'steward_guides':'Existing v6.7 guides remain compatible and unchanged'}
(D/'README.txt').write_text('''THE QUIET VALE — POLISHED RULEBOOK v6.8

Use the PDF for reading and printing (195 × 255 mm, pages in reading order).
The DOCX is the editable text-and-artwork source; its Word layout differs from the booklet PDF.

IMPROVEMENTS
Larger body and table text; simpler, consistent headings and captions.
Cleaner lesson starts and revised page flow.
Current tile/card family illustration and six Steward guide covers replace production-photo request boxes.
The river/bridge comparison is shown as two larger stacked panels.
Golden scoring pairs each full tile image with its scoring condition on a dedicated page.
A compact lookup connects all 26 Special Tile back numbers with their names.
Long explanations of placement, Linked Production, Boons, Burdens, Arrivals, Supported and the Ledger have been clarified without changing their rules.
A worked scoring calculation demonstrates the shared final score.

PRESERVATION
Game balance and approved thematic passages are unchanged.
The v6.7 Steward guides remain compatible. All previous releases remain intact.
Production-photo and retail-credit requirements remain future publishing tasks; no photographs, identities or credits have been fabricated. They are kept out of this player-facing reading edition.
''')
(D/'manifest.json').write_text(json.dumps(manifest,indent=2))
archive=R/'output/releases/The_Quiet_Vale_Polished_Rulebook_v6_8.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for p in sorted(D.iterdir()):z.write(p,p.name)
with zipfile.ZipFile(archive) as z:assert z.testzip() is None
manifest.update({'bundle':str(archive),'bundle_sha256':hashlib.sha256(archive.read_bytes()).hexdigest()})
(R/'design/rulebook/v6_8-review-manifest.json').write_text(json.dumps(manifest,indent=2))
(R/'design/rulebook/V6_8_POLISHED_EDITION.md').write_text('''# Polished rulebook v6.8

12 September 2026. User requested visual polish and clearer wording. This revision is for review; it does not change the locked v6.6 release or the v6.7 rulebook/Steward pack.

The final PDF and editable DOCX are in `output/releases/the-quiet-vale-rulebook-v6_8/`; the bundle is `output/releases/The_Quiet_Vale_Polished_Rulebook_v6_8.zip`.

The current editable source in `output/docx/rulebook-v6_8/` is authoritative for further edits. Rebuild the print PDF with `working/rules-v6_8/build_professional_rulebook.py`; its layout helpers are in `polish_reference.py`, and art composites in `assets/`. Early migration scripts record development steps and are not the final regeneration entry point.

Validation: `working/rules-v6_8/check_editorial.py` verifies every unchanged v6.7 source paragraph and the ten declared wording edits; `audit_professional_rulebook.py` checks source content, mechanical requirements, forbidden stale terminology, pagination and fonts. Rendering and visual checks cover all PDF pages and the editable source.

Production requests for genuine component/setup/marker/final-scoring photographs and approved retail credits remain pending future production work, separately from this reader edition. Do not invent those materials. Thematic copy remains exactly as approved in `THEMATIC_TEXT_STYLE_RULE.md`.
''')
print('Packaged',items[0]['pages'],'page rulebook:',archive)
