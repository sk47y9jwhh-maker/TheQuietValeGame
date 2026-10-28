from __future__ import annotations

import importlib.util
import json
import re
from collections import Counter
from pathlib import Path

import pdfplumber
from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[2]
BUILDER_PATH = ROOT / "working/stewards-ledger-redesign/build_stewards_ledger.py"
PDF_PATH = ROOT / "output/pdf/stewards-ledger-v6_4/The_Quiet_Vale_Stewards_Ledger_v6_4.pdf"
REPORT_PATH = ROOT / "tmp/pdfs/stewards-ledger-v6_4-locked/fidelity-audit.json"
MANIFEST_PATH = ROOT / "tmp/pdfs/stewards-ledger-v6_4-locked/build-manifest.json"


def load_builder():
    spec = importlib.util.spec_from_file_location("quiet_vale_ledger_builder", BUILDER_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("Could not load Ledger builder.")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def compact(text: str) -> str:
    return " ".join(text.split())


def font_is_embedded(font_object) -> bool:
    font = font_object.get_object()
    descriptor = font.get("/FontDescriptor")
    if descriptor is None:
        descendants = font.get("/DescendantFonts") or []
        if descendants:
            descriptor = descendants[0].get_object().get("/FontDescriptor")
    if descriptor is None:
        return False
    descriptor = descriptor.get_object()
    return any(key in descriptor for key in ("/FontFile", "/FontFile2", "/FontFile3"))


def main() -> None:
    builder = load_builder()
    entries, milestones = builder.parse_ledger_source()
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    reader = PdfReader(str(PDF_PATH))
    page_texts = [compact(page.extract_text() or "") for page in reader.pages]
    all_text = compact(" ".join(page_texts))
    lower_text = all_text.lower()
    checks: dict[str, object] = {}
    failures: list[str] = []

    checks["page_count"] = len(reader.pages)
    if len(reader.pages) != 32:
        failures.append(f"Expected 32 pages, found {len(reader.pages)}.")

    sizes_mm = []
    for page_number, page in enumerate(reader.pages, 1):
        width_mm = float(page.mediabox.width) * 25.4 / 72
        height_mm = float(page.mediabox.height) * 25.4 / 72
        sizes_mm.append([round(width_mm, 3), round(height_mm, 3)])
        if abs(width_mm - 195) > 0.05 or abs(height_mm - 255) > 0.05:
            failures.append(f"Page {page_number} trim is {width_mm:.3f} x {height_mm:.3f} mm.")
    checks["unique_page_sizes_mm"] = sorted({tuple(size) for size in sizes_mm})

    missing_requirements = []
    printed_reference_counts = Counter(re.findall(r"#\d+\b", all_text))
    name_counts = {}
    for entry in entries:
        requirement = compact(builder.pdf_text(entry["requirement"]))
        if requirement not in all_text:
            missing_requirements.append(entry["id"])
        printed_reference = builder.entry_reference(entry["id"])
        name_counts[entry["id"]] = all_text.count(compact(builder.pdf_text(entry["name"])))
        if printed_reference_counts[printed_reference] < 1:
            failures.append(f"Printed reference {printed_reference} for {entry['id']} is missing from the catalogue.")
        if name_counts[entry["id"]] < 1:
            failures.append(f"{entry['id']} name is missing from the catalogue.")
    checks["missing_exact_requirements"] = missing_requirements
    if missing_requirements:
        failures.append(f"Exact requirement text missing for {missing_requirements}.")

    expected_printed_references = {builder.entry_reference(entry["id"]) for entry in entries}
    unexpected_printed_references = sorted(set(printed_reference_counts) - expected_printed_references)
    checks["unexpected_printed_references"] = unexpected_printed_references
    if unexpected_printed_references:
        failures.append(f"Unexpected printed Entry references found: {unexpected_printed_references}.")
    checks["printed_reference_occurrence_range"] = [
        min(printed_reference_counts[reference] for reference in expected_printed_references),
        max(printed_reference_counts[reference] for reference in expected_printed_references),
    ]
    visible_source_ids = sorted(set(re.findall(r"\bLE-\d{3}\b", all_text)))
    checks["visible_source_ids"] = visible_source_ids
    if visible_source_ids:
        failures.append(f"Internal LE identifiers remain visible in the PDF: {visible_source_ids}.")
    checks["entry_name_occurrence_range"] = [min(name_counts.values()), max(name_counts.values())]
    checks["source_entry_count"] = len(entries)
    checks["prestige_entry_count"] = sum(bool(entry["playerCountPrestige"]) for entry in entries)
    checks["vow_count"] = sum(bool(entry["declaredVow"]) for entry in entries)
    expected_manifest = {
        "release_status": "LOCKED MASTER",
        "approved_from_proof": "v8",
        "physical_pages": 32,
        "cover_pages": 4,
        "black_cover_pages": 2,
        "parchment_inside_cover_pages": 2,
        "numbered_interior_pages": 28,
        "group_register_rows": 6,
        "catalogue_tracker_pages": 18,
        "integrated_entry_tracking": True,
        "starting_access_label": "AVAILABLE",
        "gated_access_label": "AFTER N",
        "golden_unlock_columns": ["GOLDEN TILE", "GOLDEN BOON CARD"],
        "golden_unlock_colour_coding": False,
        "golden_tile_icon": "flat-top hex",
        "plain_language_pass": True,
        "locked_entry_requirements_edited": False,
        "catalogue_order_label": "AVAILABILITY ORDER",
        "player_count_table_label": "PLAYERS",
        "top_right_running_headers": False,
        "centred_document_running_header": True,
        "display_entry_reference_format": "#number",
        "locked_source_ids_edited": False,
        "group_columns_per_entry": 6,
        "named_completion_marks": 300,
        "prestige_marks": 432,
        "group_game_record_pages": 6,
        "duplicate_group_entry_index_pages": 0,
        "game_rows_per_group": 24,
        "additional_game_rows": 32,
        "entries": 50,
        "prestige_entries": 18,
        "vows": 3,
        "milestones": [5, 12, 18, 25, 32],
        "catalogue_version": "v4.6",
        "source_sha256": "30a15cf1c4971478b6b5af9321a1f0cde2fac433c799bd930069e71080579631",
    }
    checks["manifest_architecture"] = {
        key: manifest.get(key) for key in expected_manifest
    }
    manifest_mismatches = {
        key: {"expected": value, "found": manifest.get(key)}
        for key, value in expected_manifest.items()
        if manifest.get(key) != value
    }
    checks["manifest_architecture_mismatches"] = manifest_mismatches
    if manifest_mismatches:
        failures.append(f"Build manifest does not match the locked integrated architecture: {manifest_mismatches}.")

    ordered_entries = builder.entries_in_access_order(entries)
    unlock_sequence = [entry["unlockAt"] for entry in ordered_entries]
    checks["access_order_unlock_sequence"] = unlock_sequence
    checks["access_order_is_nondecreasing"] = unlock_sequence == sorted(unlock_sequence)
    if not checks["access_order_is_nondecreasing"]:
        failures.append("The computed Entry access order is not nondecreasing.")

    expected_catalogue_pages = builder.catalogue_pages(entries)
    catalogue_page_orders = []
    catalogue_group_matrix_count = 0
    for page_offset, (_, page_entries, first_position, last_position, total_entries) in enumerate(expected_catalogue_pages):
        physical_page_index = 5 + page_offset
        found_references = re.findall(r"#\d+\b", page_texts[physical_page_index])
        expected_references = [builder.entry_reference(entry["id"]) for entry in page_entries]
        matrix_count = page_texts[physical_page_index].count("GROUP MARKS")
        catalogue_group_matrix_count += matrix_count
        catalogue_page_orders.append({
            "physical_page": physical_page_index + 1,
            "positions": [first_position, last_position, total_entries],
            "expected_references": expected_references,
            "found_references": found_references,
            "group_matrices": matrix_count,
        })
        if found_references != expected_references:
            failures.append(
                f"Catalogue page {physical_page_index + 1} is not in access order: expected {expected_references}, found {found_references}."
            )
        if matrix_count != len(page_entries):
            failures.append(
                f"Catalogue page {physical_page_index + 1} has {matrix_count} writable group matrices for {len(page_entries)} Entries."
            )
    checks["catalogue_access_order"] = catalogue_page_orders
    checks["catalogue_group_matrix_count"] = catalogue_group_matrix_count
    checks["reading_sample_group_matrix_count"] = page_texts[4].count("GROUP MARKS")
    if len(expected_catalogue_pages) != 18:
        failures.append(f"Expected 18 integrated catalogue pages, found {len(expected_catalogue_pages)}.")
    if catalogue_group_matrix_count != 50:
        failures.append(f"Expected one writable group matrix for each of 50 Entries, found {catalogue_group_matrix_count}.")
    if checks["reading_sample_group_matrix_count"] != 1:
        failures.append("The Reading an Entry sample does not contain exactly one writable group matrix.")

    access_order_explanation = "Entries appear in the order they become available."
    checks["access_order_explanation_present"] = compact(access_order_explanation) in all_text
    if not checks["access_order_explanation_present"]:
        failures.append("The Reading an Entry page does not explain the access-order presentation.")
    checks["printed_reference_explanation_present"] = "The small number (for example, #11) is for reference only." in all_text
    if not checks["printed_reference_explanation_present"]:
        failures.append("The Reading an Entry page does not explain the compact printed reference number.")
    checks["catalogue_is_tracker_explanation_present"] = "Use the catalogue as both a rule reference and a tracker." in all_text
    if not checks["catalogue_is_tracker_explanation_present"]:
        failures.append("The integrated catalogue/tracker workflow is not stated explicitly.")

    group_register_text = page_texts[1]
    group_register_checks = {
        "title_count": group_register_text.count("GROUP REGISTER"),
        "chosen_name_header": "GROUP NAME" in group_register_text,
        "forgotten_number_prompt": "FIND YOUR GROUP NUMBER" in group_register_text,
        "roman_mappings": {
            roman: (
                f"ENTRY COLUMN {roman}" in group_register_text
                and f"GAME RECORD {roman}" in group_register_text
            )
            for roman in ("I", "II", "III", "IV", "V", "VI")
        },
    }
    checks["group_register"] = group_register_checks
    if group_register_checks["title_count"] != 1:
        failures.append("The inside-front Group Register title does not appear exactly once in the section banner.")
    if not group_register_checks["chosen_name_header"]:
        failures.append("The Group Register is missing its group-name field header.")
    if not group_register_checks["forgotten_number_prompt"]:
        failures.append("The Group Register is missing its numeral-recovery reminder.")
    missing_group_mappings = [roman for roman, present in group_register_checks["roman_mappings"].items() if not present]
    if missing_group_mappings:
        failures.append(f"Group Register mappings are missing for {missing_group_mappings}.")

    checks["legacy_open_label_absent"] = re.search(r"\bOPEN\b", all_text) is None and "OPENING ENTRIES" not in all_text
    if not checks["legacy_open_label_absent"]:
        failures.append("The retired OPEN/OPENING access terminology remains in the PDF.")
    checks["available_access_label_present"] = all_text.count("AVAILABLE") >= 6
    checks["after_access_label_present"] = re.search(r"\bAFTER\s+\d+\b", all_text) is not None
    if not checks["available_access_label_present"]:
        failures.append("The AVAILABLE starting-access label is missing from one or more starting Entries.")
    if not checks["after_access_label_present"]:
        failures.append("The AFTER N gated-access label is missing.")

    golden_page_text = page_texts[3]
    golden_separation_checks = {
        "named_entries_column": golden_page_text.count("NAMED ENTRIES") == 1,
        "golden_tile_column": golden_page_text.count("GOLDEN TILE") == 1,
        "golden_boon_card_column": golden_page_text.count("GOLDEN BOON CARD") == 1,
        "read_across_instruction": "it unlocks both rewards in that row" in golden_page_text,
    }
    checks["golden_tile_card_separation"] = golden_separation_checks
    if not all(golden_separation_checks.values()):
        failures.append(f"The Golden page does not clearly separate Tile and Boon card unlocks: {golden_separation_checks}.")
    with pdfplumber.open(PDF_PATH) as pdf:
        golden_page = pdf.pages[3]
        reward_column_rects = [
            rect
            for rect in golden_page.rects
            if rect["x0"] > 100 and 200 <= rect["width"] <= 203
        ]
        header_colors = {
            tuple(rect.get("non_stroking_color") or ())
            for rect in reward_column_rects
            if 26 <= rect["height"] <= 28
        }
        reward_colors = {
            tuple(rect.get("non_stroking_color") or ())
            for rect in reward_column_rects
            if 68 <= rect["height"] <= 70
        }
    checks["golden_columns_share_colour_system"] = {
        "header_colors": sorted(header_colors),
        "reward_colors": sorted(reward_colors),
        "pass": len(header_colors) == 1 and len(reward_colors) == 1,
    }
    if not checks["golden_columns_share_colour_system"]["pass"]:
        failures.append("Golden Tile and Boon Card columns still use different fill colours.")

    stale_names = [
        "The Hearth Ring",
        "The Quiet Circle",
        "Every Craft Has Its Place",
        "Guests Became Neighbours",
        "Every Door Answered",
        "The Unploughed Season",
        "No One Turned Away",
        "The Last Season Held",
    ]
    found_stale_names = [name for name in stale_names if name.lower() in lower_text]
    checks["found_stale_names"] = found_stale_names
    if found_stale_names:
        failures.append(f"Found stale Ledger names: {found_stale_names}.")

    forbidden_phrases = ["online prototype", "web prototype", "digital prototype", "current prototype"]
    found_forbidden = [phrase for phrase in forbidden_phrases if phrase in lower_text]
    checks["found_forbidden_phrases"] = found_forbidden
    if found_forbidden:
        failures.append(f"Found prohibited prototype references: {found_forbidden}.")

    production_placeholders = {
        "replacement_record_pages": "Add the approved QR code or short URL for printable record pages before retail release.",
    }
    checks["production_placeholders_present"] = {
        key: compact(builder.pdf_text(value)) in all_text for key, value in production_placeholders.items()
    }
    missing_placeholders = [
        key for key, present in checks["production_placeholders_present"].items() if not present
    ]
    if missing_placeholders:
        failures.append(f"Required production placeholders are missing: {missing_placeholders}.")

    retired_inside_cover_copy = ["COVER TREE ARTWORK", "PRODUCTION ART PLACEHOLDER"]
    found_retired_inside_cover_copy = [phrase for phrase in retired_inside_cover_copy if phrase in all_text]
    checks["found_retired_inside_cover_copy"] = found_retired_inside_cover_copy
    if found_retired_inside_cover_copy:
        failures.append(f"Retired black-inside-cover production copy remains: {found_retired_inside_cover_copy}.")

    tree_source_px = list(builder.raster_dimensions(builder.TREE)) if builder.TREE.exists() else None
    checks["cover_tree_artwork"] = {
        "status": "placement only",
        "source_px": tree_source_px,
        "front_rendered_size_mm": [62, 88.9],
        "effective_dpi_approx": [
            round(tree_source_px[0] / (62 / 25.4), 1),
            round(tree_source_px[1] / (88.9 / 25.4), 1),
        ] if tree_source_px else None,
        "minimum_raster_replacement_px_at_300dpi": [733, 1051],
    }

    milestone_thresholds = [milestone["threshold"] for milestone in milestones]
    checks["milestone_thresholds"] = milestone_thresholds
    if milestone_thresholds != [5, 12, 18, 25, 32]:
        failures.append(f"Unexpected milestone thresholds: {milestone_thresholds}.")
    for milestone in milestones:
        for label in (milestone["goldenTile"], milestone["goldenBoon"]):
            if compact(builder.pdf_text(label)) not in all_text:
                failures.append(f"Golden component name missing: {label}.")

    current_vow_phrase = "110 / 85 / 75 / 40"
    old_vow_phrase = "60 / 80 / 110 / 130"
    checks["le_042_current_threshold_present"] = current_vow_phrase in all_text
    checks["le_042_superseded_threshold_absent"] = old_vow_phrase not in all_text
    if current_vow_phrase not in all_text:
        failures.append("Current LE-042 threshold sequence is missing.")
    if old_vow_phrase in all_text:
        failures.append("Superseded LE-042 threshold sequence remains in PDF.")

    group_record_checks = {}
    for roman, physical_page_index in zip(("I", "II", "III", "IV", "V", "VI"), range(23, 29)):
        entry_title = f"GROUP {roman} · ENTRY RECORD"
        game_title = f"GROUP {roman} · GAME RECORD"
        page_text = page_texts[physical_page_index]
        group_record_checks[roman] = {
            "physical_page": physical_page_index + 1,
            "entry_title_count_document": all_text.count(entry_title),
            "game_title_count_page": page_text.count(game_title),
            "new_entries_header": page_text.count("NEW ENTRIES"),
            "named_entry_count_header": page_text.count("NAMED ENTRY COUNT"),
            "players_header": page_text.count("PLAYERS"),
            "milestones_present": all(str(value) in page_text.split() for value in (5, 12, 18, 25, 32)),
        }
        if group_record_checks[roman]["entry_title_count_document"] != 0:
            failures.append(f"The removed Group {roman} Entry Record remains in the document.")
        if group_record_checks[roman]["game_title_count_page"] != 1:
            failures.append(f"Group {roman} Game Record title count is not 1 on physical page {physical_page_index + 1}.")
        if group_record_checks[roman]["new_entries_header"] != 1:
            failures.append(f"Group {roman} Game Record is missing its NEW ENTRIES column.")
        if group_record_checks[roman]["named_entry_count_header"] != 1:
            failures.append(f"Group {roman} Game Record is missing its NAMED ENTRY COUNT field.")
        if group_record_checks[roman]["players_header"] != 1:
            failures.append(f"Group {roman} Game Record is missing its PLAYERS column.")
        if not group_record_checks[roman]["milestones_present"]:
            failures.append(f"Group {roman} Game Record is missing one or more Golden milestone thresholds.")
    checks["group_game_record_pages"] = group_record_checks

    removed_fragmentation_phrases = ["NEW ENTRY IDS", "VOW ID", "PERSISTENT SPREAD"]
    found_fragmentation_phrases = [phrase for phrase in removed_fragmentation_phrases if phrase in all_text]
    checks["found_removed_fragmentation_phrases"] = found_fragmentation_phrases
    if found_fragmentation_phrases:
        failures.append(f"Old fragmented-workflow language remains: {found_fragmentation_phrases}.")
    checks["additional_record_new_entries_header"] = page_texts[29].count("NEW ENTRIES") == 1
    if not checks["additional_record_new_entries_header"]:
        failures.append("The Additional Game Record is missing its NEW ENTRIES column.")
    checks["additional_record_players_header"] = page_texts[29].count("PLAYERS") == 1
    if not checks["additional_record_players_header"]:
        failures.append("The Additional Game Record is missing its PLAYERS column.")

    required_editorial_phrases = [
        "NAME YOUR GROUP",
        "CHECK AVAILABLE ENTRIES",
        "MARK COMPLETED ENTRIES",
        "RECORD THE GAME",
        "AVAILABLE FROM THE FIRST GAME",
        "AVAILABILITY ORDER",
        "NAMED ENTRY COUNT",
        "SCORES · MILESTONES · VOWS",
        "TILE + BOON CARD",
        "PLAYERS",
    ]
    missing_editorial_phrases = [phrase for phrase in required_editorial_phrases if phrase not in all_text]
    checks["missing_required_editorial_phrases"] = missing_editorial_phrases
    if missing_editorial_phrases:
        failures.append(f"Required plain-language labels are missing: {missing_editorial_phrases}.")

    retired_editorial_phrases = [
        "AVAILABLE FROM GAME 1",
        "ACCESS ORDER",
        "CURRENT ENTRY COUNT",
        "SCORES · GOLDENS · VOWS",
        "A locked Entry",
        "The catalogue is also the tracker",
        "FORGOTTEN THE NUMBER?",
        "CHOSEN GROUP NAME",
        "Steward's Ledger Vow",
        "The small LE code",
    ]
    found_retired_editorial_phrases = [phrase for phrase in retired_editorial_phrases if phrase in all_text]
    checks["found_retired_editorial_phrases"] = found_retired_editorial_phrases
    if found_retired_editorial_phrases:
        failures.append(f"Retired or inconsistent teaching copy remains: {found_retired_editorial_phrases}.")

    top_right_running_words = {}
    with pdfplumber.open(PDF_PATH) as pdf:
        for page_number in range(2, 32):
            page = pdf.pages[page_number - 1]
            words = [
                word["text"]
                for word in page.extract_words()
                if float(word["top"]) < 30 and float(word["x0"]) > page.width * 0.72
            ]
            if words:
                top_right_running_words[str(page_number)] = words
    checks["top_right_running_words"] = top_right_running_words
    if top_right_running_words:
        failures.append(f"Top-right running-header text remains: {top_right_running_words}.")
    centred_running_header = "THE QUIET VALE · STEWARD'S LEDGER"
    checks["centred_running_header_pages"] = [
        page_number
        for page_number in range(2, 32)
        if centred_running_header in page_texts[page_number - 1]
    ]
    if checks["centred_running_header_pages"] != list(range(2, 32)):
        failures.append("The centred document identifier is missing from one or more non-cover pages.")

    cover_backgrounds = {}
    with pdfplumber.open(PDF_PATH) as pdf:
        for page_number in (1, 2, 31, 32):
            page = pdf.pages[page_number - 1]
            full_page_rects = [
                rect
                for rect in page.rects
                if rect["width"] >= page.width - 0.5 and rect["height"] >= page.height - 0.5
            ]
            color = full_page_rects[0].get("non_stroking_color") if full_page_rects else None
            cover_backgrounds[str(page_number)] = color
    checks["cover_background_colors"] = cover_backgrounds
    for page_number in (1, 32):
        color = cover_backgrounds[str(page_number)]
        if not isinstance(color, tuple) or sum(color) / len(color) >= 0.12:
            failures.append(f"Outside cover page {page_number} is not using the locked black ground.")
    for page_number in (2, 31):
        color = cover_backgrounds[str(page_number)]
        if not isinstance(color, tuple) or sum(color) / len(color) <= 0.75:
            failures.append(f"Inside cover page {page_number} still uses a dark ground instead of parchment.")

    embedded_fonts = {}
    for page in reader.pages:
        resources = page.get("/Resources")
        if resources is None:
            continue
        fonts = resources.get_object().get("/Font") or {}
        for key, value in fonts.items():
            font = value.get_object()
            base_name = str(font.get("/BaseFont", key))
            embedded_fonts[base_name] = font_is_embedded(value)
    char_bounds_failures = []
    min_font_size = None
    max_font_size = None
    used_font_names: Counter[str] = Counter()
    with pdfplumber.open(PDF_PATH) as pdf:
        for page_number, page in enumerate(pdf.pages, 1):
            for char in page.chars:
                x0 = float(char["x0"])
                x1 = float(char["x1"])
                top = float(char["top"])
                bottom = float(char["bottom"])
                if x0 < -0.1 or x1 > page.width + 0.1 or top < -0.1 or bottom > page.height + 0.1:
                    char_bounds_failures.append({"page": page_number, "text": char.get("text"), "box": [x0, top, x1, bottom]})
                size = float(char.get("size", 0))
                min_font_size = size if min_font_size is None else min(min_font_size, size)
                max_font_size = size if max_font_size is None else max(max_font_size, size)
                used_font_names[str(char.get("fontname", ""))] += 1
    used_unembedded = [
        base_name
        for base_name, embedded in embedded_fonts.items()
        if not embedded and base_name.lstrip("/") in used_font_names
    ]
    checks["font_resources"] = embedded_fonts
    checks["used_fonts"] = dict(used_font_names)
    checks["used_unembedded_fonts"] = used_unembedded
    if not used_font_names or used_unembedded:
        failures.append(f"Used unembedded fonts found: {used_unembedded}.")
    checks["out_of_bounds_characters"] = char_bounds_failures[:20]
    checks["font_size_range_pt"] = [round(min_font_size or 0, 2), round(max_font_size or 0, 2)]
    if char_bounds_failures:
        failures.append(f"Found {len(char_bounds_failures)} out-of-bounds characters.")
    if min_font_size is not None and min_font_size < 5.0:
        failures.append(f"Minimum font size fell below 5 pt: {min_font_size:.2f} pt.")

    checks["logical_folios_present"] = all(str(number) in page_texts[number + 1].split() for number in range(1, 29))
    if not checks["logical_folios_present"]:
        failures.append("One or more logical folios 1-28 are missing from the expected page.")

    checks["text_character_counts"] = dict(Counter(all_text))
    checks["ascii_hyphen_policy"] = all(character not in all_text for character in ("\u2011", "\u2012", "\u2013", "\u2014"))
    if not checks["ascii_hyphen_policy"]:
        failures.append("A prohibited Unicode dash remains in PDF text.")

    report = {
        "pdf": str(PDF_PATH),
        "status": "PASS" if not failures else "FAIL",
        "failures": failures,
        "checks": checks,
    }
    REPORT_PATH.write_text(json.dumps(report, indent=2, default=list), encoding="utf-8")
    print(json.dumps(report, indent=2, default=list))
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
