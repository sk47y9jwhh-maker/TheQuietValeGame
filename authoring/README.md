# Rulebook authoring

The editable DOCX is the source for the main rulebook. Python/reportlab builds
the print PDF; the Steward aids are authored in Python with TypeScript data
export. Only source files are tracked under `working/`; large inputs are in the
GitHub release archive indexed by `handoff/release-assets.json`.

## Restore and prepare

```sh
python3 tools/fetch-handoff-assets.py --group authoring --extract
python3 tools/fetch-handoff-assets.py --group rules --extract
python3 -m venv .venv-rulebook
. .venv-rulebook/bin/activate
pip install -r authoring/requirements.txt
npm ci
```

Use Python 3.10 or later. Run commands from the repository root. Existing
builders require macOS `GillSans.ttc` and `Charter.ttc` under
`/System/Library/Fonts/Supplemental/`; some historical illustration builders
also use Georgia and Arial. These fonts are not redistributed. A different
font stack requires a new visual/layout review.

## Current entry points

| Version | Editable source / builder | Status |
| --- | --- | --- |
| v6.8 main rulebook | `output/docx/rulebook-v6_8/The_Quiet_Vale_Main_Rulebook_v6_8.docx`; `working/rules-v6_8/build_professional_rulebook.py` | Latest polished review |
| v6.7 Steward aids | `working/rules-v6_7/build_steward_aid.py`, `suite_reference_pages.py`, included assets, and `working/steward-aids-redesign/export_steward_content.ts` | Latest guides; compatible with v6.8 |
| v6.7 main rulebook | `output/docx/rulebook-v6_7/The_Quiet_Vale_Main_Rulebook_v6_7_Card_Guide.docx`; `working/rules-v6_7/build_professional_rulebook.py` | Earlier review, retained for fidelity comparison |
| v6.6 main rulebook | `output/docx/rulebook-v6_6/The_Quiet_Vale_Main_Rulebook_v6_6_Card_Guide.docx`; `working/rulebook-professional-redesign/build_professional_rulebook.py` | Approved locked reference |
| v6.6 Steward aids | `working/steward-aids-redesign/build_steward_aid.py` | Approved locked reference |
| Carried-forward v6.5 Ledger | `working/stewards-ledger-redesign/build_stewards_ledger.py` | Included in approved v6.6 package |

For an ordinary v6.8 print rebuild from the saved source:

```sh
python3 working/rules-v6_8/build_professional_rulebook.py
python3 working/rules-v6_8/audit_professional_rulebook.py
python3 working/rules-v6_8/check_editorial.py
```

The editorial check also reads the preserved DOCX-rendered PDF restored with
the inputs. After editing a DOCX, regenerate that render before treating its
page report as current. A pass against the old render is not new visual QA.

For the latest Steward guides:

```sh
python3 working/rules-v6_7/build_steward_aid.py --help
```

That command lists the actual role/suite options. Render and inspect outputs
after changing content. The guide sources import current structured data;
later data changes can change a rebuild even when the builder is unchanged.

Do not rerun `update_suite.py`, `refine.py`, `optimise_aid_art.py`,
`polish_rulebook.py`, `final_layout.py` or `refine_layout.py` as setup steps.
They are historical migration scripts, may overwrite finished DOCX/builders,
and some retain assumptions about their earlier working environment.
The legacy Ledger audit still targets a v6.4 output; adapt/version it before
using it for a new Ledger validation.

## Provenance and preservation

Original scripts are included byte-for-byte under `authoring/original-scripts/`
inside the inputs archive. The tracked copies replace hard-coded project roots
with the checkout location. The optional card capture uses an installed
`playwright` package and `authoring/card-preview/` instead of a private runtime.
See `source-provenance.json` for original/published SHA-256 values and
`input-manifest.json` for every archived input.

The locked v6.6 ZIP is uploaded unchanged. Rebuild outputs are not automatically
the locked artifacts: compare the release hashes when exact identity matters.
Use a new version for changes and preserve the approved ZIP and lock record.

Optional browser card recapture needs `playwright` plus its Chromium install
and a local Vite server on port 8790. Existing captured art is already supplied;
recapture is not required to reproduce the current PDF from its saved source.
