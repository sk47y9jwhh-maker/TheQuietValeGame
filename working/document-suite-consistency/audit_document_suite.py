from __future__ import annotations

import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[2]
REPORT_PATH = ROOT / "tmp/pdfs/document-suite-consistency-v1/suite-language-audit.json"

RULEBOOK = ROOT / "output/pdf/rulebook-v6_4/The_Quiet_Vale_Main_Rulebook_v6_4_Encounter_Led_Design_Proof_v19.pdf"
LEDGER = ROOT / "output/pdf/stewards-ledger-v6_4/The_Quiet_Vale_Stewards_Ledger_v6_4.pdf"
LEDGER_MANIFEST = ROOT / "tmp/pdfs/stewards-ledger-v6_4-locked/build-manifest.json"
AID_SUITE_MANIFEST = ROOT / "tmp/pdfs/steward-aids-v6_4-approved-suite/suite-manifest.json"

ROLES = ("Vanguard", "Knight", "Sentinel", "Ranger", "Warden", "Quartermaster")
AIDS = {
    role: ROOT / f"output/pdf/steward-aids-v6_4/The_Quiet_Vale_A6_{role}_Steward_Aid_v6_4.pdf"
    for role in ROLES
}

LOCKED_LEDGER_SOURCE_SHA256 = "30a15cf1c4971478b6b5af9321a1f0cde2fac433c799bd930069e71080579631"


def normalize(text: str) -> str:
    return " ".join(
        text.replace("\u2018", "'")
        .replace("\u2019", "'")
        .replace("\u201c", '"')
        .replace("\u201d", '"')
        .replace("\u2013", "-")
        .replace("\u2014", "-")
        .split()
    )


def extract_pdf(path: Path) -> tuple[PdfReader, list[str], str]:
    reader = PdfReader(str(path))
    pages = [normalize(page.extract_text() or "") for page in reader.pages]
    return reader, pages, normalize(" ".join(pages))


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def trim_sizes_mm(reader: PdfReader) -> list[list[float]]:
    sizes: set[tuple[float, float]] = set()
    for page in reader.pages:
        width = round(float(page.mediabox.width) * 25.4 / 72, 3)
        height = round(float(page.mediabox.height) * 25.4 / 72, 3)
        sizes.add((width, height))
    return [list(size) for size in sorted(sizes)]


def phrase_check(
    label: str,
    text: str,
    phrases: list[str],
    checks: dict[str, object],
    failures: list[str],
) -> None:
    normalized_phrases = [normalize(phrase) for phrase in phrases]
    missing = [phrase for phrase in normalized_phrases if phrase not in text]
    checks[label] = {
        "required": normalized_phrases,
        "missing": missing,
    }
    if missing:
        failures.append(f"{label} is missing required suite wording: {missing}")


def main() -> None:
    deliverables = {"Main Rulebook": RULEBOOK, **{f"{role} Steward Aid": path for role, path in AIDS.items()}, "Steward's Ledger": LEDGER}
    failures: list[str] = []
    checks: dict[str, object] = {}

    missing_files = [str(path) for path in deliverables.values() if not path.is_file()]
    checks["missing_files"] = missing_files
    if missing_files:
        failures.append(f"Missing deliverables: {missing_files}")
        REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
        REPORT_PATH.write_text(json.dumps({"status": "FAIL", "failures": failures, "checks": checks}, indent=2) + "\n", encoding="utf-8")
        raise SystemExit(1)

    extracted: dict[str, tuple[PdfReader, list[str], str]] = {
        label: extract_pdf(path) for label, path in deliverables.items()
    }

    expected_geometry = {
        "Main Rulebook": (28, [195.0, 255.0]),
        **{f"{role} Steward Aid": (16, [105.0, 148.0]) for role in ROLES},
        "Steward's Ledger": (32, [195.0, 255.0]),
    }
    geometry: dict[str, object] = {}
    for label, (reader, _, _) in extracted.items():
        page_count = len(reader.pages)
        sizes = trim_sizes_mm(reader)
        expected_pages, expected_size = expected_geometry[label]
        geometry[label] = {
            "pages": page_count,
            "expected_pages": expected_pages,
            "unique_trim_sizes_mm": sizes,
            "expected_trim_mm": expected_size,
        }
        if page_count != expected_pages:
            failures.append(f"{label} has {page_count} pages; expected {expected_pages}.")
        if len(sizes) != 1 or any(abs(sizes[0][axis] - expected_size[axis]) > 0.05 for axis in (0, 1)):
            failures.append(f"{label} trim is {sizes}; expected {expected_size} mm.")
    checks["geometry"] = geometry

    rulebook_text = extracted["Main Rulebook"][2]
    ledger_text = extracted["Steward's Ledger"][2]
    aid_texts = {role: extracted[f"{role} Steward Aid"][2] for role in ROLES}

    phrase_check(
        "rulebook_language",
        rulebook_text,
        [
            "1 Main Rulebook, 6 Steward Aids and 6 matching Steward Tokens.",
            "The group chooses player order.",
            "Remove 1 timer from every active Arrival and resolve each expiry.",
            "When placing or upgrading a Tile whose entire footprint lies on Ruins, ignore all Stone in that placement or upgrade cost.",
            "If any part of the footprint lies outside Ruins, pay the full printed cost.",
            "Record the shared final score and any newly completed Entries in the Steward's Ledger.",
            "choose a name and an unused Roman numeral (I-VI) in the Group Register",
            "mark NAMED for each newly completed Entry",
            "An AFTER gate is met only if the group begins the game with the shown number of Named Entries.",
            "Declare a Vow before setup. A group may attempt only one Vow per game.",
        ],
        checks,
        failures,
    )

    aid_requirements = [
        "The group chooses player order. Each player takes one turn with up to 4 Actions.",
        "Remove 1 timer from every active Arrival; resolve expiry, end durations, refresh round effects and advance the Round marker.",
        "When placing or upgrading a Tile whose entire footprint lies on Ruins, ignore all Stone in that placement or upgrade cost.",
        "If any part of the footprint lies outside Ruins, pay the full printed cost.",
        "Record the shared final score and any newly completed Entries in the Steward's Ledger.",
        "Water/River",
    ]
    for role, text in aid_texts.items():
        phrase_check(f"{role.lower()}_aid_language", text, aid_requirements, checks, failures)

    phrase_check(
        "ledger_language",
        ledger_text,
        [
            "choose a name and one unused Roman numeral (I-VI)",
            "Group Register",
            "mark NAMED under the group's numeral for each Entry it completed",
            "shared final score, newly completed Entries and any declared Vow",
            "An AFTER gate is met only if the group begins the game with the shown number of Named Entries.",
            "Declare a Vow before setup. A group may attempt only one Vow per game.",
            "When a group reaches 5, 12, 18, 25 or 32 Named Entries, it unlocks both rewards in that row",
        ],
        checks,
        failures,
    )

    non_locked_texts = {"Main Rulebook": rulebook_text, **{f"{role} Steward Aid": text for role, text in aid_texts.items()}}
    forbidden_patterns = {
        "retired_spread_architecture": r"\b(?:one|persistent)\s+spread\b",
        "retired_component_name": r"\b(?:Steward\s+)?Player Aid(?:s)?\b",
        "retired_scorepad": r"\b(?:final|approved)\s+scorepad\b",
        "retired_timer_name": r"\bRound Timer\b",
        "prototype_reference": r"\bonline prototype\b",
        "retired_score_wording": r"\bfinal total and (?:any )?completed Entries\b",
        "noncanonical_terrain_order": r"\bRiver/Water\b",
    }
    forbidden_hits: dict[str, dict[str, list[str]]] = {}
    for label, text in non_locked_texts.items():
        label_hits: dict[str, list[str]] = {}
        for pattern_label, pattern in forbidden_patterns.items():
            hits = re.findall(pattern, text, flags=re.IGNORECASE)
            if hits:
                label_hits[pattern_label] = [str(hit) for hit in hits]
                failures.append(f"{label} contains forbidden {pattern_label} wording: {hits}")
        forbidden_hits[label] = label_hits
    checks["forbidden_legacy_language"] = forbidden_hits

    canonical_counts = {
        "rulebook_Water_River": rulebook_text.count("Water/River"),
        **{f"{role}_aid_Water_River": text.count("Water/River") for role, text in aid_texts.items()},
    }
    checks["canonical_Water_River_counts"] = canonical_counts
    if canonical_counts["rulebook_Water_River"] < 1:
        failures.append("Main Rulebook does not use the canonical map term Water/River.")

    locked_exception_count = ledger_text.count("River/Water")
    checks["intentional_locked_source_exception"] = {
        "term": "River/Water",
        "ledger_occurrences": locked_exception_count,
        "expected_occurrences": 5,
        "reason": "Exact locked Ledger Entry requirements retain their source wording; rulebook and Steward Aids use the map term Water/River.",
    }
    if locked_exception_count != 5:
        failures.append(f"Locked Ledger River/Water exception count is {locked_exception_count}; expected 5.")

    ledger_manifest = json.loads(LEDGER_MANIFEST.read_text(encoding="utf-8"))
    aid_manifest = json.loads(AID_SUITE_MANIFEST.read_text(encoding="utf-8"))
    manifest_checks = {
        "ledger_release_status": ledger_manifest.get("release_status"),
        "ledger_approved_from_proof": ledger_manifest.get("approved_from_proof"),
        "ledger_source_sha256": ledger_manifest.get("source_sha256"),
        "ledger_locked_entry_requirements_edited": ledger_manifest.get("locked_entry_requirements_edited"),
        "aid_suite_language_revision": aid_manifest.get("suite_language_revision"),
        "aid_locked_role_and_tile_content_edited": aid_manifest.get("locked_role_and_tile_content_edited"),
    }
    checks["lock_manifests"] = manifest_checks
    expected_manifest_values = {
        "ledger_release_status": "LOCKED MASTER",
        "ledger_approved_from_proof": "v8",
        "ledger_source_sha256": LOCKED_LEDGER_SOURCE_SHA256,
        "ledger_locked_entry_requirements_edited": False,
        "aid_suite_language_revision": "v1",
        "aid_locked_role_and_tile_content_edited": False,
    }
    for key, expected in expected_manifest_values.items():
        if manifest_checks[key] != expected:
            failures.append(f"Manifest check {key} is {manifest_checks[key]!r}; expected {expected!r}.")

    aid_build_manifests: dict[str, object] = {}
    expected_aid_manifest = {
        "pages": 16,
        "trim_mm": [105, 148],
        "tile_types": 21,
        "tile_faces": 42,
        "final_art_placeholders": 42,
        "locked_content_checks": 230,
        "suite_language_revision": "v1",
        "terrain_display_term": "Water/River",
        "score_record_term": "shared final score and any newly completed Entries",
    }
    for role, output_path in AIDS.items():
        manifest_path = ROOT / f"tmp/pdfs/steward-aids-v6_4-approved-suite/{role.lower()}-manifest.json"
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        mismatches = {
            key: {"expected": expected, "found": manifest.get(key)}
            for key, expected in expected_aid_manifest.items()
            if manifest.get(key) != expected
        }
        if manifest.get("output") != str(output_path):
            mismatches["output"] = {"expected": str(output_path), "found": manifest.get("output")}
        aid_build_manifests[role] = {
            "path": str(manifest_path),
            "mismatches": mismatches,
        }
        if mismatches:
            failures.append(f"{role} Steward Aid build manifest mismatches: {mismatches}")
    checks["aid_build_manifests"] = aid_build_manifests

    checks["deliverable_sha256"] = {label: sha256(path) for label, path in deliverables.items()}

    component_name_counts = {
        label: {
            "Steward Aid": len(re.findall(r"\bSteward Aid(?:s)?\b", text)),
            "Steward Player Aid": len(re.findall(r"\bSteward Player Aid(?:s)?\b", text)),
            "Player Aid": len(re.findall(r"\bPlayer Aid(?:s)?\b", text)),
        }
        for label, text in non_locked_texts.items()
    }
    checks["component_name_counts"] = component_name_counts

    product_audit_commands = [
        [sys.executable, str(ROOT / "working/rulebook-professional-redesign/audit_professional_rulebook.py")],
        [sys.executable, str(ROOT / "working/stewards-ledger-redesign/audit_stewards_ledger.py")],
    ]
    product_audits = []
    for command in product_audit_commands:
        result = subprocess.run(command, cwd=ROOT, text=True, capture_output=True)
        product_audits.append({
            "command": command,
            "returncode": result.returncode,
            "stdout": result.stdout.strip(),
            "stderr": result.stderr.strip(),
        })
        if result.returncode != 0:
            failures.append(f"Product audit failed: {' '.join(command)}")
    checks["product_audits"] = product_audits

    report = {
        "status": "PASS" if not failures else "FAIL",
        "suite": "Main Rulebook V19 + six Steward Aids v6.4 + locked Steward's Ledger v6.4",
        "deliverables": {label: str(path) for label, path in deliverables.items()},
        "failures": failures,
        "checks": checks,
    }
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": report["status"], "failure_count": len(failures), "report": str(REPORT_PATH)}, indent=2))
    if failures:
        for failure in failures:
            print(f"FAIL: {failure}", file=sys.stderr)
        raise SystemExit(1)


if __name__ == "__main__":
    main()
