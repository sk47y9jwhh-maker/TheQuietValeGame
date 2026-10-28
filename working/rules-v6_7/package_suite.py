from pathlib import Path
import json,hashlib,shutil,zipfile
from pypdf import PdfReader
R=Path(__file__).resolve().parents[2];D=R/'output/releases/the-quiet-vale-rules-v6_7';D.mkdir(parents=True,exist_ok=True)
files=[R/'output/pdf/rulebook-v6_7/The_Quiet_Vale_Main_Rulebook_v6_7.pdf',R/'output/docx/rulebook-v6_7/The_Quiet_Vale_Main_Rulebook_v6_7_Card_Guide.docx',*sorted((R/'output/pdf/steward-aids-v6_7').glob('*.pdf'))]
manifest={'version':'6.7','date':'2026-09-12','status':'Updated review edition; v6.6 locked release preserved','files':[]}
for p in files:
 out=D/p.name;shutil.copy2(p,out);entry={'file':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size}
 if p.suffix=='.pdf':entry['pages']=len(PdfReader(p).pages)
 manifest['files'].append(entry)
(D/'manifest.json').write_text(json.dumps(manifest,indent=2))
(D/'READ ME.txt').write_text('''THE QUIET VALE — RULEBOOK AND STEWARD GUIDES v6.7
Updated 12 September 2026

CONTENTS
Main Rulebook: 28-page PDF, 195 × 255 mm.
Six Steward guides: Vanguard, Knight, Sentinel, Ranger, Warden and Quartermaster; each 20 pages, A6 (105 × 148 mm).
Editable Main Rulebook source: DOCX. Its Word layout differs from the separate booklet PDF; use the PDF for printing.

WHAT IS UPDATED
Finished artist tile faces and current trimmed Encounter and Target Card examples.
All 42 Core Tile face placeholders replaced in each Steward guide.
Tile-face explanations and resource, Population and Renown icon key.
Special Tile terrain placements for the ten Shrine / Respite tiles.
Arrival reward numbers matched to Special Tile backs, including 23 for The Root Weavers Respite and 17 & 18 for Stables.
Golden Tile scoring conditions retained in the written reference after their removal from the tile faces.
Core and Special supply quantities aligned to the current tile print-pack manifest; Travel extensions listed separately.

PRINTING
PDF pages are in reading order at finished booklet size. Print at actual size; use the printer's booklet imposition if binding as booklets.
The tile and card illustrations show their trimmed edges. This does not alter the separate component printing masters, which retain 3 mm bleed.

REVIEW STATUS
This is the updated v6.7 review edition. The approved, locked v6.6 release remains intact.
Existing physical component, setup, Steward-marker and final-scoring photograph placeholders remain in the Main Rulebook. They await the real photographs.
The Steward's Ledger booklet is unchanged and is not duplicated in this pack.
''')
archive=R/'output/releases/The_Quiet_Vale_Rulebook_and_Steward_Guides_v6_7.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for p in sorted(D.iterdir()):z.write(p,p.name)
with zipfile.ZipFile(archive) as z:assert z.testzip() is None
records=R/'design/rulebook';(records/'v6_7-review-manifest.json').write_text(json.dumps({**manifest,'bundle':str(archive),'bundle_sha256':hashlib.sha256(archive.read_bytes()).hexdigest()},indent=2))
(records/'V6_7_REVIEW_EDITION.md').write_text('''# Rulebook and Steward guides v6.7

Updated 12 September 2026. This is a review edition, not a replacement for the locked v6.6 approval.

- Main Rulebook: 28 pages, 195 × 255 mm.
- Six Steward guides: 20 pages each, A6.
- Release: `output/releases/the-quiet-vale-rules-v6_7/`.
- Bundle: `output/releases/The_Quiet_Vale_Rulebook_and_Steward_Guides_v6_7.zip`.
- Editable source: `output/docx/rulebook-v6_7/The_Quiet_Vale_Main_Rulebook_v6_7_Card_Guide.docx`.
- Reproducible authoring files: `working/rules-v6_7/`. Run `update_suite.py`, `refine.py`, `optimise_aid_art.py`, then the two build scripts in that order. `capture-cards.cjs` captures the current React components from `tmp/rules-v6_7-preview/` on the local Vite server before rebuilding the source.
- Content and layout checks: `working/rules-v6_7/audit_professional_rulebook.py`, `verify_suite.py`; records in `tmp/pdfs/rulebook-v6_7/`, `tmp/pdfs/steward-aids-v6_7-suite/` and `tmp/rules-v6_7-qa/`.

Uses the approved artist tile exports and current numbered Arrival rewards. The ten terrain-placement changes and the Golden scoring reference are included consistently. Existing physical-photo placeholders remain. No rules were rebalanced and no new lore was written. Component counts follow the delivered tile print manifest; the Special figure counts physical hexes, including both Stables pairs in that manifest.
''')
print(archive,round(archive.stat().st_size/1e6,1),'MB')
