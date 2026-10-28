# Polished rulebook v6.8

12 September 2026. User requested visual polish and clearer wording. This revision is for review; it does not change the locked v6.6 release or the v6.7 rulebook/Steward pack.

The final PDF and editable DOCX are in `output/releases/the-quiet-vale-rulebook-v6_8/`; the bundle is `output/releases/The_Quiet_Vale_Polished_Rulebook_v6_8.zip`.

The current editable source in `output/docx/rulebook-v6_8/` is authoritative for further edits. Rebuild the print PDF with `working/rules-v6_8/build_professional_rulebook.py`; its layout helpers are in `polish_reference.py`, and art composites in `assets/`. Early migration scripts record development steps and are not the final regeneration entry point.

Validation: `working/rules-v6_8/check_editorial.py` verifies every unchanged v6.7 source paragraph and the ten declared wording edits; `audit_professional_rulebook.py` checks source content, mechanical requirements, forbidden stale terminology, pagination and fonts. Rendering and visual checks cover all PDF pages and the editable source.

Production requests for genuine component/setup/marker/final-scoring photographs and approved retail credits remain pending future production work, separately from this reader edition. Do not invent those materials. Thematic copy remains exactly as approved in `THEMATIC_TEXT_STYLE_RULE.md`.
