# The Quiet Vale — handover for Claude Code

Prepared 28 October 2026. Robert requested publication of the current board and
box packs, the approved v6.6 rules, rulebook sources, design/testing evidence,
and **only the recommended Living Table UI as an alternative layout concept**.
He then added the latest rulebook and Steward aids.

## Start here

```sh
git fetch origin
git switch --track origin/codex/claude-code-handoff
npm ci
npm run dev -- --host 127.0.0.1 --port 5184 --strictPort
```

If this branch already exists locally, use `git switch codex/claude-code-handoff`.
Open `http://127.0.0.1:5184/` for the concept preview. The live site is not changed
by this branch. Its production baseline is `main` at `7e59bec` as checked during
this handoff. Pushing to `main` triggers the Pages workflow.

- Recommended alternative: `/?experience=tabletop`.
- Comparable built settlement: `/?experience=tabletop&scenario=settlement`.
- Pending decision: `/?experience=tabletop&scenario=choice`.
- Complex placement: `/?experience=tabletop&scenario=golden-signet`.
- Late game: `/?experience=tabletop&scenario=season-three`.
- Visual baseline: `/?experience=classic`. It shares this branch's engine fixes;
  use `main` when an exact comparison with the production code is required.

Only Living Table and the classic baseline are implemented here. Council Desk
and Pocket Vale code, styles and launch routes were excluded. Their names and
screenshots remain in historical evaluation records so the design rationale
and previous test claims can be interpreted accurately. The original local
22-commit exploration branch was not pushed; this branch starts from `main`
and contains the selected implementation.

## Documents and production files

Large binaries are attached to the repository's
[project handoff release](https://github.com/sk47y9jwhh-maker/TheQuietValeGame/releases/tag/project-handoff-2026-10-28).
[The asset index](handoff/release-assets.json) records every URL, size and SHA-256.

| Material | Status and contents | Restore command |
| --- | --- | --- |
| Printed rules v6.6 | Approved and locked. Original ZIP, main rulebook, six Steward aids, editable DOCX, carried-forward v6.5 Ledger and original checksums. | `python3 tools/fetch-handoff-assets.py --group rules --extract` |
| Main rulebook v6.8 | Latest polished **review** edition: 32-page PDF plus editable DOCX, original unchanged ZIP. | Same `rules` command |
| Steward aids v6.7 | Latest six A6 guides, 20 pages each. The v6.8 manifest confirms compatibility. They remain a **review** edition. | Same `rules` command |
| Four-board pack | Latest local map, Encounter, Logistics and Core Tiles pack; final template exports, upload PNGs and production context. | `python3 tools/fetch-handoff-assets.py --group print --extract` |
| Standard box pack | Final 12.5 × 10.5 × 3-inch upload PDF, proof, later wrap sources and template. Internal-box RFQ brief included. | Same `print` command |
| Authoring inputs | Editable rulebooks, builder artwork, preserved original scripts and supporting source references. | `python3 tools/fetch-handoff-assets.py --group authoring --extract` |

The six archives total approximately **1.15 GB**. Use `--group all --extract`
to obtain everything. Downloads go to `output/handoff-downloads/`. Rules extract
to `output/releases/`, print packs to `production/`, and authoring inputs restore
the `working/` and `output/` paths used by their builders. The helper verifies
each archive before extraction and refuses to overwrite a changed local file.
GitHub Releases assets are not automatically included in a normal Git clone.

**Authority:** Follow the repository's structured data and component workbook for
the online game. v6.6 remains the approved physical rules release. v6.8 and v6.7
are newer working documents; their existence does not silently change approved
rules or approve a rebalance. See [the locked record](design/rulebook/V6_6_RELEASE_LOCK.md),
[v6.8 notes](design/rulebook/V6_8_POLISHED_EDITION.md) and
[v6.7 notes](design/rulebook/V6_7_REVIEW_EDITION.md).

For document editing and rebuilding, read [authoring/README.md](authoring/README.md).
Use the current editable DOCX and version-specific builder. Older migration
scripts are preserved for traceability and can overwrite inputs; they are not
the ordinary rebuild procedure. The original typesetting uses macOS fonts.
Those font files are not included. No layout-equivalent substitute has been
validated on Linux or Windows.

The board/box files were last revised in July. Their original order instructions
include historical booklet/page-count assumptions that predate the later rules.
Use [the board notes](handoff/print-packs/BOARDS.md) and
[box notes](handoff/print-packs/BOX.md) for file selection. Manufacturer dielines,
physical proofs and internal storage fit still need confirmation before ordering;
uploading these files did not perform that production approval.

## Living Table implementation

The branch carries the playable recommended concept and the shared fixes on
which it depends: illustrated setup, private shared-device hands, deliberate
seeding, desktop/mobile board-and-action navigation, tile discovery, outcome
and payment previews, Golden/Steward choices, final scoring, Ledger history,
save-failure recovery, reset protection and keyboard/modal improvements.

Key files:

- `src/app/ExperienceRoot.tsx`, `experience.ts`: concept entry points and isolated saves.
- `src/components/layout/TabletopLayout.tsx`, `PlayerGuide.tsx`, `TurnPriorities.tsx`: layout and current decisions.
- `src/components/setup/TabletopWelcome.tsx`, `src/components/seeding/TableSeeding.tsx`: setup and seeding.
- `src/app/App.tsx`, `src/components/effects/`, `src/components/actions/`: game UI, costs and pending choices.
- `src/app/persistence.ts`, `ledgerPersistence.ts`, `saveSession.ts`: storage and recovery.
- `src/app/scenarioCatalog.ts`, `scenarios.generated.json`: sixteen explicit demonstration fixtures.
- `src/engine/gameActions.ts`, `manualEffects.ts`, `boonModifiers.ts`, `reachability.ts`: included validation fixes for existing rules.
- `src/tests/`: retained engine, baseline and Living Table regressions.

Save keys are scoped by layout and demo. This remains solo or shared-device
local play; there is no remote multiplayer, account system or cloud save.
The engine fixes enforce existing prepared-power ownership, temporary reach,
and unique effect-queue identities. They are not a rules rebalance.

## Verification and remaining work

The curated branch passes **64 test files / 692 tests** and `npm run build`.
The suite includes checks that excluded layout links cannot mount a game or
touch the original save. The earlier full three-layout branch had 733 tests;
that historical count does not describe this selected branch.

Read [the current review](design/holiday-ui-overhaul/REVIEW.md) and
[acceptance record](design/holiday-ui-overhaul/ACCEPTANCE_PLAYTHROUGH.md).
Historical browser coverage includes setup, actual game actions, payments,
private hands, Undo/Redo, save/reload, season changes and separate finale cases.
The uninterrupted acceptance game stopped after rounds 1–4 at Season II/round 5.
That game was stored in the original laptop browser, **not exported into Git**.
Do not claim the exact continuation save is available on another machine.

Recommended next work, after Robert's direction:

1. Review Living Table on desktop and a narrow screen against the baseline.
2. Complete an uninterrupted 12-round game and Ledger recording. Continue the
   original save only if it is actually available; otherwise start a fresh game.
3. Obtain independent player feedback. Spoken screen-reader use, real enlarged
   text/browser zoom, forced colours and physical-device checks remain unverified.
4. If continuing document work, edit the latest source, create a new version,
   run its fidelity/layout checks and obtain approval separately from v6.6.

Pending payment-option drafts reset on reload or Undo into the review; confirmed
game state survives. Save export/import and recovery after closing an unsaved
tab are not promised. The holiday automation is closed; nothing is scheduled.

The selected source and evidence are uploaded for review and continuation.
Merging this concept or replacing the live game is a separate product decision.
