# August Task List — Physical Products

**Last updated:** 24 August 2026

**Working style:** low-admin, intermittent sessions

**Detailed review:** [Physical Product Review](PHYSICAL_PRODUCT_REVIEW_2026-08-12.md)

This is the day-to-day entry point for completing the physical version of *The Quiet Vale*. The detailed review is supporting evidence; this file is the live task and progress tracker.

## Instructions for Codex — read this first

### Trigger phrase

When the user says **“let's work on the task list”**, **“work on the August task list”**, or similar:

1. Read this file. Do not ask the user to restate the project context.
2. Check relevant project files and any changes made since this file was last updated.
3. Offer **five numbered session options** drawn from incomplete, unblocked work below.
4. Put the recommended dependency-clearing option first, but include a useful mix of:
   - a short or contained task;
   - a design/creative decision;
   - a concrete asset-building or verification task.
5. Describe the outcome of each option in one sentence and label its likely session size: **short**, **medium**, or **substantial**.
6. Let the user reply with only the option number. Once selected, start immediately; do not ask them to locate task codes or repeat previous decisions.
7. Work autonomously until a genuine product decision needs approval. When it does, give a clear recommendation and no more than three meaningful choices.
8. At the end of the session, update this file:
   - tick completed tasks;
   - update the decision register;
   - update the next-action menu;
   - add one concise line to the session log.
9. Do not create extra planning or status files unless they are an actual product deliverable.

If the user names a particular product area, go directly to that area instead of making them use the menu.

## Current next-action menu

These are the best starting choices as of the date above. Codex should refresh this menu after meaningful progress.

1. **Generate and QA the Target Card deck** — produce all 30 cards and compare every record against the live data and workbook. **Medium; recommended.** Tasks TC-005 and TC-006.
2. **Resolve the Encounter Card physical format** — decide finished size, stock, sleeves and back treatment. **Short.** Tasks EC-002 and EC-003.
3. **Build the worst-case token count model** — calculate simultaneous resources, timers, Strain, Supported and round counters before choosing final physical forms. **Medium.** Task TK-001.
4. **Lay out the Steward's Ledger** — turn the locked multi-campaign format into the cohesive physical booklet. **Medium.** Task RB-006.
5. **Resolve final Steward marker identities** — lock production colours, silhouettes, materials and map visibility, then complete the cross-product identity link. **Medium.** Tasks ST-003–ST-007.

## Progress key

- `[ ]` not completed
- `[x]` completed and verified
- An unfinished task may still have working files; only tick it once its stated outcome is achieved.
- Product approvals and user decisions belong in the decision register below.

## Workstreams

### 1. Product baseline, BOM and change control

**Goal:** one authoritative definition of everything manufactured and one consistent rules release.

- [ ] **P-001 — Nominate source authority.** Confirm the master component workbook and current structured game data as the content authority; identify superseded sources.
- [ ] **P-002 — Create BOM v1.0.** Record every manufactured object, quantity, size, material, finish, source, revision and approval state.
- [ ] **P-003 — Freeze the physical rules release.** Reconcile the Main Rulebook, Steward Aids, cards, tiles and Steward's Ledger to the five-player v6.6 release.
- [x] **P-004 — Open a decision log.** The live decision register is included below; maintain it during every workstream.
- [ ] **P-005 — Build a cross-component audit.** Check counts, names and IDs across the workbook, structured data, manifests, exports and printed rules.
- [ ] **P-006 — Establish release naming.** Replace ambiguous revision names with product-revision-status filenames and checksummed release manifests.

### 2. Target Cards

**Goal:** an approved, readable 30-card product with audited directions, Open cards and pairings.

- [x] **TC-001 — Approve product format.** 63 × 88 mm poker-size, portrait orientation, selected for the physical deck.
- [x] **TC-002 — Agree face design.** 63 × 88 mm portrait face with `TARGET`/card number header, four centred preference rows in fixed top-to-bottom order, and a final tie-direction/Open section; see `design/target-cards/TARGET_CARD_FACE_SPEC.md`.
- [x] **TC-003 — Agree back design.** Target Cards use the shared Encounter Card back; it remains symmetrical, non-directional and free of profile/card-number tells. Physical back artwork and proof stay with EC-003/EC-007.
- [x] **TC-004 — Agree visual grammar.** Full text is authoritative, icons/colour are supplementary, the Vale Blue + Rose palette is locked, and structured directions use a six-hex ring plus compass abbreviation; see `design/target-cards/TARGET_CARD_FACE_SPEC.md`.
- [ ] **TC-005 — Generate all 30 cards.** Build from structured data, with cards 13–24 matching paired preferences and six cards 25–30 showing Any for every preference with no arrow.
- [ ] **TC-006 — Run rules/data QA.** Compare every card with `src/data/targetCards.ts` and the workbook Target Cards sheet.
- [ ] **TC-007 — Table-test the deck.** Test draw/read/return workflow, orientation, tie direction, glare and arm's-length reading.
- [ ] **TC-008 — Vendor preflight and proof.** Verify stock, corner radius, bleed, safe zone, back registration and shuffle durability.

### 3. Steward products and markers

**Goal:** six roles with one coherent identity across rules material and physical markers.

- [x] **ST-001 — Freeze the role-product architecture.** Use six 16-page A6 booklets based on the approved V3 Quartermaster master.
- [x] **ST-002 — Update selected Steward products to v6.4.** Completed all six 16-page A6 editions from live locked Steward and Core Tile data.
- [ ] **ST-003 — Agree six role colours.** Assign robust colours and validate colour-blind distinction and map visibility.
- [ ] **ST-004 — Agree six marker designs.** Define role icon/initial, silhouette, size, material, height and finish.
- [ ] **ST-005 — Correct the pawn order specification.** Replace eight generic pawns with six role-linked markers; list spares separately if wanted.
- [ ] **ST-006 — Cross-link every identity.** Match role name, icon and colour on marker, booklet/card and setup material.
- [ ] **ST-007 — Run physical handling proof.** Confirm fit beside a tile within a map hex, visibility and comfortable pickup.
- [ ] **ST-008 — Proof the chosen Steward print product.** Verify trim, page count, binding, type, margins and colour.

### 4. Encounter Cards

**Goal:** 90 approved fronts and the agreed back set in editable, archival and vendor-ready form.

- [ ] **EC-001 — Freeze all 90 records.** Approve names, flavour, seasonal effects/lifecycles, requirements, rewards and Golden effects.
- [ ] **EC-002 — Choose finished size and stock.** Reconcile the 3 × 5 inch masters with the proposed 70 × 120 mm product; define stock, finish, radius and sleeves.
- [ ] **EC-003 — Agree card backs.** Select shared or type-specific backs while preserving hidden information.
- [ ] **EC-004 — Add Arrival unlock numbers 1–26.** Match the locked Special Tile numbering on both product families.
- [ ] **EC-005 — Populate all fronts.** Duplicate locked masters, preserve layered sources and use deterministic IDs/filenames.
- [ ] **EC-006 — Visually proof amber fields.** Check line breaks, orphan words, numerals and italic lifecycle/resolution text at final size.
- [ ] **EC-007 — Preflight every front and back.** Verify fonts, colour, bleed, safe zone, black treatment and vendor cut template.
- [ ] **EC-008 — Produce archival singles and vendor uploads.** Keep layered masters, flattened singles and imposed sheets distinct.
- [ ] **EC-009 — Order a representative deck proof.** Include longest/amber copy and every colour family before printing all 90.
- [ ] **EC-010 — Run full-deck collation QA.** Confirm 30 Boons, 30 Burdens, 25 Arrivals, 5 Golden Boons, backs and unlock pairings.

### 5. Tiles

**Goal:** all 93 physical components have final artwork and verified manufacturing files.

- [ ] **TL-001 — Freeze the 51-design art brief.** Define crops, extension treatment, palette, lighting, legibility and delivery rights.
- [ ] **TL-002 — Commission and approve final artwork.** Cover Core, Special and Golden families and Basic/Upgraded relationships.
- [ ] **TL-003 — Insert artwork into all 74 front masters.** Preserve locked clip paths and remove every placeholder.
- [ ] **TL-004 — Run content and visual validation.** Check names, costs, icons, placement, effects, scores, type and Special numbering.
- [ ] **TL-005 — Regenerate A4 proofs from v1.13.** Replace the stale July print pack with output matching the current manifest.
- [ ] **TL-006 — Select tile construction.** Define thickness, substrate, finish, production method, tolerance and duplex registration.
- [ ] **TL-007 — Engineer compound pieces.** Resolve Street, Track and detached Stables cut paths, assembly and orientation.
- [ ] **TL-008 — Create vendor imposition and dielines.** Convert face masters into production sheets.
- [ ] **TL-009 — Run a physical tile proof.** Check cut, duplex orientation, sharpness, rules copy, warping, stacking and map fit.
- [ ] **TL-010 — Final count/collation QA.** Verify 93 components, 109 physical hexes and 213 printed hex faces.

### 6. Main Rulebook, Steward Aids and Steward's Ledger

**Goal:** a coherent five-player document suite in manufacturable formats, with every document serving a distinct job.

- [x] **RB-001 — Decide the in-box document suite.** Include the Main Rulebook, six individual Steward Aids and the Steward's Ledger; omit a separate Rules Reference and Quickstart.
- [x] **RB-002 — Choose trim and binding.** Use the current 195 × 255 mm, 28-page saddle-stitched Main Rulebook format.
- [x] **RB-003 — Reconcile the five-player rules documents.** The Main Rulebook and all six Steward Aids are released as v6.6; the unchanged Steward's Ledger remains v6.5. Final artwork and physical print proofing remain separate production tasks.
- [ ] **RB-004 — Correct the Components section.** Use exact counts and names from BOM v1.0.
- [x] **RB-005 — Decide the Quickstart.** No separate Quickstart and no facilitator teaching sequence in the Main Rulebook; retain only player-facing rules, the Game at a Glance and the quick reference.
- [x] **RB-006 — Design the physical Steward's Ledger.** The approved V8 architecture is now the locked 32-page v6.5 five-player master.
- [ ] **RB-007 — Run an accessibility pass.** Verify structure, type size, contrast, colour-independent instructions and digital accessibility.
- [ ] **RB-008 — Run a blind rules test.** Give a fresh group the box without a teacher and log lookup/component failures.
- [ ] **RB-009 — Printer preflight.** Check bleed, margins, creep, fonts, DPI, black treatment, order and physical proof.

### 7. Shared boards and outer box

**Goal:** approve the modular play-surface architecture and outer box through physical proofs.

- [ ] **B-001 — Approve the four-board architecture.** Confirm Map, Encounter, Logistics and Core Tiles board; mark older candidates superseded.
- [ ] **B-002 — Verify board labels against v6.6.** Check terminology and final component flow.
- [ ] **B-003 — Verify dimensions and folds.** Confirm exact finished sizes and hinge orientation with the chosen vendor.
- [ ] **B-004 — Test functional fit at 100%.** Place real final-size cards, tiles and tokens on printed proofs.
- [ ] **B-005 — Order board proofs.** Obtain one six-fold, one bi-fold and one flat-board construction proof.
- [ ] **B-006 — Pass physical colour and legibility.** Check leather shadow, brass text, stitches, map alignment, hinges and glare.
- [ ] **B-007 — Lock approved board release.** Reissue checksums for the exact proof-linked files.
- [ ] **PK-001 — Approve outer-box text/legal panel.** Add required player/age/time, contents, warnings, origin, publisher, barcode and compliance data.
- [ ] **PK-002 — Proof the outer box.** Approve title readability, dark colour reproduction, finish and template registration.

### 8. Tokens, resources and status markers

**Goal:** tested quantities and instantly distinguishable physical states.

- [ ] **TK-001 — Build the worst-case count model.** Calculate simultaneous resources, Arrival timers, Supported, Strain, round and other counters at 1–5 players.
- [ ] **TK-002 — Agree functional families.** Separate resource, harmful, protective, timer and round functions using multiple visual/tactile cues.
- [ ] **TK-003 — Agree six resource representations.** Prefer colours/shapes matching the locked game palette; otherwise prove shared white discs are usable.
- [ ] **TK-004 — Set final quantities and spares.** Document allocation and contingency rather than only a grand total.
- [ ] **TK-005 — Test stack height and board wells.** Verify capacity, access, visibility and stability.
- [ ] **TK-006 — Test state recognition.** Make Strain, Supported and timers identifiable across the table without relying on location.
- [ ] **TK-007 — Finalise token bag or tray.** Size it from real pieces and test setup/sort time.

### 9. Internal boxes, insert and packing

**Goal:** a complete packed game that fits, protects components and supports quick setup.

- [ ] **PK-003 — Freeze every packed dimension.** Cards/sleeves, tiles, compound pieces, tokens, boards and books.
- [ ] **PK-004 — Send RFQ and obtain manufacturer dielines.** Confirm internal dimensions, materials, dividers and tray clearance.
- [ ] **PK-005 — Redesign card wells.** Base them on the approved physical card/sleeve sizes, not the current assumption.
- [ ] **PK-006 — Build a white-box prototype.** Test access, migration, lid lift, shake/drop and repeated setup/pack-down.
- [ ] **PK-007 — Recalculate box depth.** Prove all layers fit inside the box with manufacturing tolerance.
- [ ] **PK-008 — Create internal-box artwork after dielines.** Preflight and proof only the manufacturer-confirmed templates.
- [ ] **PK-009 — Produce packing and factory collation sheets.** Specify exact count and placement per cavity.

### 10. Manufacturing, compliance and final QA

**Goal:** one fully tested production release, approved golden sample and controlled archive.

- [ ] **M-001 — Select vendors and obtain written specifications.** Cover boards, cards, tiles, books, wood, box/insert and fulfilment.
- [ ] **M-002 — Confirm colour management.** Agree profiles, ink limits, proof standard and tolerance.
- [ ] **M-003 — Confirm materials and compliance.** Determine applicable safety, warning, sourcing, chemical, age-grade and traceability requirements.
- [ ] **M-004 — Create the golden-sample inspection checklist.** Include dimensions, counts, colour, finish, folds, cuts, collation, text and packing.
- [ ] **M-005 — Order one complete prototype copy.** Evaluate the product as a whole, not only isolated components.
- [ ] **M-006 — Run usability and endurance tests.** Test setup, full play, shuffling, wear, hinges and cleanup.
- [ ] **M-007 — Correct and issue Release Candidate 1.** Reproof changed products and rerun the cross-component audit.
- [ ] **M-008 — Approve the golden sample.** Photograph and retain it with signed proofs and checksums.
- [ ] **M-009 — Run pilot production and inspection.** Complete count/collation sampling before full quantity.
- [ ] **M-010 — Archive the production release.** Store masters, uploads, proofs, approvals, licences, BOM and checksums.

## Decision register

Codex should update the status and outcome here as decisions are made. Keep reasoning in the relevant deliverable; keep this table concise.

| ID | Decision | Status | Outcome |
|---|---|---|---|
| D-01 | Authoritative physical-product sources | Deferred | Hold P-001/P-002 and the wider visual baseline until the artist’s tile design template is available; use it as the visual anchor and revisit cross-product treatments after review. |
| D-02 | Modular four-board architecture | Open | — |
| D-03 | Encounter Card finished size, stock and sleeves | Open | — |
| D-04 | Encounter Card back system | Open | — |
| D-05 | Target Card physical format and design | Locked | 63 × 88 mm poker-size, portrait. Option C “Vale Blue + Rose” is the locked palette, using the Golden Boon compass. Preference rows are unnumbered and each states “Unless specified”; six Open cards use Any, omit the direction ring, and retain the trigger-defined eligible pool. Structured cards show tie direction with a six-hex neighbour ring and the relevant outer hex in pink, plus the compass abbreviation. Target Cards use the shared Encounter Card back; see `design/target-cards/TARGET_CARD_FACE_SPEC.md`. |
| D-06 | Steward Aid architecture and suite | Locked | Use six individual 16-page A6 Steward Aids. The complete Vanguard, Knight, Sentinel, Ranger, Warden and Quartermaster v6.6 suite is approved and locked to the Quartermaster V3 master for structure, hierarchy, typography, panel geometry, ornament treatment, Tile-reference layout, official role copy and restrained role accents. Suite language revision v2 names Shelter in the Ruins and aligns the revised final-scoring penalties with the Main Rulebook. Changes now require an explicit rules correction, final artwork insertion or a documented physical-print issue under ST-008. |
| D-07 | Six Steward marker identities | Partially locked | Prototype identity mapping: Vanguard green meeple, Knight yellow, Sentinel blue, Ranger purple, Warden orange and Quartermaster natural wood. Printed aid accents use restrained thematic versions of those hues; exact production colour values, material, dimensions and finish remain open. |
| D-08 | Main Rulebook trim, binding and document suite | Locked | Use a 195 × 255 mm, 28-page saddle-stitched Main Rulebook. The printed suite is the Main Rulebook, six individual Steward Aids and the Steward's Ledger; omit separate Rules Reference and Quickstart products. |
| D-09 | Quickstart retained or removed | Locked | No separate Quickstart and no facilitator teaching sequence. The Main Rulebook retains its player-facing Game at a Glance and quick reference. |
| D-10 | Token/resource families and quantities | Provisional | Six colour-coded resource types use 15 pieces each (90 total): Wood green, Stone bronze, Metal silver, Food yellow, Herbs purple and Goods orange. Include 30 black pieces and 30 bronze pieces. Strain is black; Supported and the Round marker are bronze; Arrival timers may use either colour. Treat black/bronze quantities and exact production hues as working values until physical playtesting and map colour proofing support final lock. |
| D-11 | Steward's Ledger physical format | Locked | Approved V8 is the stable v6.5 five-player master: a premium 195 × 255 mm, 32-page saddle-stitched booklet with black/brass outside covers, parchment inside covers and 28 numbered interior pages. The inside front cover holds a six-line Group Register: each group chooses a name, claims I-VI and uses that mapping for its Entry column and Game Record. The live v4.6 catalogue plus five-player thresholds is also the tracker: all 50 exact Entry requirements appear in ascending availability order, each with six shared group columns, a Named row and, on the 18 prestige Entries, 1P-5P rows. Starting Entries are labelled AVAILABLE and gates are labelled AFTER N; compact #number references are printed for readers while the LE identifiers remain unchanged in the locked source. Golden milestones present separate Golden Tile and Golden Boon Card unlock columns. Six one-page Group Game Records each hold the group name, Named Entry count, five Golden milestones and 24 game rows; one 32-row continuation page follows. Completed Entries remain with that group and never reset or become spent; printable replacement record pages will be supported once an official distribution location is approved. |
| D-12 | Tile manufacturing construction | Open | — |
| D-13 | Sleeve policy for each deck | Open | — |
| D-14 | Vendors and compliance markets | Open | — |
| D-15 | Limited passive Supported beneficiary timing | Locked | The group selects the eligible adjacent Housing beneficiaries when Common Land or The Pleasance becomes active. Assignments persist until eligibility changes or the source becomes Overstrained; they cannot move in response to incoming Strain. |
| D-16 | Rulebook thematic text treatment | Locked | Thematic/flavour copy uses its own pale-flax, aged-brass cut-corner frame and italic Charter typography. Use it sparingly and only with verbatim officially locked copy; source reused card text by type and title. |
| D-17 | Rulebook thematic copy selection | Locked | Use four plaques: the approved opening, bespoke Building and Strain passages, and the approved historical-overview passage at Final Scoring. Label every plaque `THE QUIET VALE`; do not use Encounter Card quotations as standalone rulebook plaques. |
| D-18 | Final-score recording product | Locked | Record the shared final score and any newly completed Entries directly in the Steward's Ledger. Do not add a separate scorepad to the product. |
| D-19 | Encounter deck composition | Locked | The retail Encounter deck contains exactly 90 cards: 30 Boons, 30 Burdens, 25 Arrivals and 5 Golden Boons. Older 84-card and 27/27 references are superseded. |
| D-20 | Core Tile stock quantities | Locked | Every Core Tile type previously stocked at 3 is now stocked at 4: Lumber Yard, Mine Tunnel, Gathering Outpost, Farmstead, Cottage, Bridge and Salvage Camp. The Vaults is stocked at 2. All other Core Tile stock quantities are unchanged. |

## Dependency rules

- Workstream 1 is the baseline and should be progressed early, but it does not block creative exploration.
- Target and Encounter card sizes, Steward architecture, tile construction, tokens and the document suite must be fixed before final insert engineering.
- Final printed-rule reconciliation depends on BOM v1.0 and the selected physical products.
- Board functional-fit approval depends on final component sizes, although colour/fold proofing can begin sooner.
- Manufacturing release work begins only after component proofs and a complete packed prototype pass.

## Session log

Keep this to one line per working session. Record the outcome, not a transcript.

- **13 August 2026 — Task system:** created this low-admin dashboard and opened the decision register; no physical-product decision was changed.
- **21 August 2026 — Target Cards:** approved poker size and the 30-card expansion with six Open cards; structured data and digital targeting flow updated, with face/back design still open.
- **21 August 2026 — Target Card visual retry:** locked colour option C “Vale Blue + Rose” for the front-only 63 × 88 mm design using the Golden Boon compass, centred unnumbered preference rows with “Unless specified”, and a six-hex neighbour ring with the relevant outer hex in pink; the Encounter back remains shared.
- **22 August 2026 — Target Card face system:** approved and documented the final front hierarchy, text-first visual grammar, structured/Open direction treatment, and shared Encounter back; TC-002–TC-004 closed. All-card generation and production QA remain open.
- **22 August 2026 — Target Card casing correction:** aligned the physical generator, proof, SVG study, and face specification with the live-game capitalization, including `3+ Neighbours` and `Choose Any Eligible Tile`.
- **22 August 2026 — Task list refresh:** closed Target Card design work and moved the next action to generating and auditing the 30-card deck.
- **22 August 2026 — Baseline timing:** deferred P-001/P-002 until the artist’s tile design template arrives; future cross-product visual decisions may be adjusted after the tile review.
- **22 August 2026 — Rules architecture review:** inventoried the 18-page v6.4 Main Rulebook, 21-page Twin Settlements variant, six 12-page A6 Steward booklets, stale v6.3 aids, and the absent Quickstart/physical Ledger; suite recommendation is under review.
- **24 August 2026 — Rulebook Supported timing:** locked persistent group-selected beneficiaries for Common Land and The Pleasance; assignments change only when eligibility changes or the source is disabled and later recovers.
- **24 August 2026 — Steward's Ledger format (superseded architecture):** initially selected a persistent per-group record; V3 later replaced it with the integrated catalogue/tracker and consolidated Game Records now locked in V8.
- **24 August 2026 — Token architecture:** locked 15 pieces in each of six colour-coded resource types and provisionally set 30 black plus 30 bronze; Strain is black, Supported/Round are bronze, and Arrival timers may use either colour.
- **24 August 2026 — Printed rules suite:** selected the Main Rulebook, six individual Steward Aids and the Steward's Ledger; removed separate Quickstart/Rules Reference products and deferred the cohesive Steward Aid redesign until the rulebook is locked.
- **24 August 2026 — Main Rulebook format:** locked the current 195 × 255 mm, 28-page saddle-stitched format.
- **24 August 2026 — Main Rulebook V15:** produced and fully audited the single consolidated 28-page review candidate with exact working component counts, flexible Arrival-timer colour and the locked per-group Ledger model; Steward-aid redesign remains deferred until rulebook approval.
- **24 August 2026 — Thematic text rule:** locked a distinct framed italic treatment and a no-new-lore source policy; V16 uses the approved opening plus three verbatim Boon flavour passages distributed across the rules arc.
- **24 August 2026 — Thematic copy selection:** replaced the three card-derived plaques for the next consolidated proof with exact user-approved section narration and one approved historical-overview passage; all four plaques use `THE QUIET VALE`.
- **24 August 2026 — Encounter divider flourish:** replaced the generic sideways-eight rulebook knot with the exact central line flourish extracted from the approved Encounter Card design.
- **24 August 2026 — Retail rules decisions:** locked direct-to-Ledger score recording and confirmed the 90-card Encounter composition of 30 Boons, 30 Burdens, 25 Arrivals and 5 Golden Boons.
- **24 August 2026 — Steward prototype identity:** recorded the six meeple/resource colour mappings from the physical prototype, with restrained production hue tuning deferred until map proofing.
- **24 August 2026 — Steward-aid master V1:** produced and audited a complete 12-page A6 Quartermaster design proof using live v6.4 Steward/Tile data, the Main Rulebook visual system and explicit final-tile-art placeholders; the other five await master approval.
- **24 August 2026 — Steward-aid master V2:** rebuilt the Quartermaster proof as a 16-page A6 signature after visual QA. Removed interior cut-corner cards, side colour bars and the role-icon placeholder; simplified the cover; increased rule and Tile text; and retained all 21 Core Tile types, 42 faces and explicit final-art spaces. The other five still await master approval.
- **24 August 2026 — Steward-aid master V3:** removed the redundant 0-Actions note, added the Ruins Stone discount, contained the Steward Token reminder, matched every flourished brass divider stroke, and synchronized the newly locked Core Tile stocks with live data. The 16-page Quartermaster proof passed visual, content and application QA; the other five still await master approval.
- **24 August 2026 — Steward-aid master locked:** approved Quartermaster V3 as the production design master and froze the six-booklet, 16-page A6 architecture. Future role editions must preserve its visual and information system while substituting only locked role-specific content and accent colour; physical print proofing remains outstanding.
- **24 August 2026 — Full Steward-aid suite:** generated Vanguard, Knight, Sentinel, Ranger, Warden and Quartermaster as six approved-master 16-page A6 PDFs. The 96-page suite passed role-content, stock, font, bounds and visual-consistency audits; final Tile artwork and physical print proofing remain outstanding.
- **24 August 2026 — Full Steward-aid suite locked:** approved all six v6.4 PDFs as the authoritative Steward-aid suite. Their design and official copy are frozen; only explicit rules corrections, final artwork insertion and documented physical-proof fixes may reopen them.
- **24 August 2026 — Steward's Ledger design proof V1:** built the locked 195 x 255 mm, 32-page architecture from the live v4.6 catalogue and completed content, layout, font, bounds and print preflight audits. The brass-tree image is retained only as a placement preview and has an explicit vector/300 dpi replacement requirement; final user approval and physical print proofing remain open.
- **24 August 2026 — Steward's Ledger design proof V2:** reordered the catalogue and all six group trackers by ascending Entry availability while retaining every LE number as a stable recording ID. Rebalanced the fixed 12-page catalogue to protect threshold and Vow text, added explicit scan guidance, and retained Chronicle labels as Entry metadata.
- **24 August 2026 — Steward's Ledger design proof V3:** replaced the fragmented catalogue-plus-six-index system with an 18-page integrated catalogue/tracker. Every Entry now carries six group columns beside its exact rule; each group finishes on one consolidated Game Record page. The 32-page proof passed source-fidelity, access-order, page-geometry, font-embedding, bounds and full-book visual audits.
- **24 August 2026 — Steward's Ledger design proof V4:** replaced the dark inside covers with parchment utility pages, added the six-line Group Register, changed starting access from OPEN to AVAILABLE and gates to AFTER N, and rebuilt Golden Legacy as clearly separated Golden Tile and Golden Boon Card columns. The updated proof passed exact-content, terminology, cover-ground, font, bounds and full-book visual audits.
- **24 August 2026 — Steward's Ledger design proof V5:** removed the red colour coding from the Golden Boon Card column. Golden Tile and Golden Boon Card now share the same restrained fill and typography; column divisions, labels and outline icons provide the distinction. Automated checks confirm identical column colour systems and unchanged locked content.
- **24 August 2026 — Steward's Ledger design proof V6:** replaced the generic square Golden Tile descriptor with a flat-top hex outline matching the physical map-tile geometry. The Golden page was re-rendered at print resolution and the complete PDF audit remained clean.
- **24 August 2026 — Steward's Ledger design proof V7:** completed a full plain-language teaching pass modelled on the approved rulebook voice: action-led setup and recording steps, consistent Vow and availability wording, clearer Group Register and Game Record labels, and consumer-facing proof copy. All 50 locked Entry requirements remained verbatim; the 32-page PDF passed source, terminology, order, font, bounds and full-book visual audits.
- **24 August 2026 — Steward's Ledger design proof V8:** removed the top-right running labels from every non-cover page and simplified printed Entry references from LE-### to #number while preserving all internal source identifiers. The complete proof passed exact-content, reference-order, header-removal, font, bounds and full-book visual audits.
- **24 August 2026 — Steward's Ledger locked master:** promoted the approved V8 proof to the stable v6.4 master without changing any of the 50 exact Entry requirements.
- **24 August 2026 — Printed document consistency pass:** reconciled Main Rulebook V19, all six Steward Aids and the locked Steward's Ledger around Steward Aid naming, player order, Arrival upkeep, the full Ruins discount, Water/River display terminology, shared final-score recording and the integrated Ledger workflow. Product, source-fidelity, geometry, font, bounds and full-suite terminology audits passed; official role, Tile, Encounter and Ledger Entry content was not changed.
- **26 August 2026 — Five-player document release:** promoted the 28-page Main Rulebook and 32-page Steward's Ledger to v6.5. Setup now covers 1–5 players, five players choose any five of the six Stewards, select 20 Boons/20 Burdens/20 Arrivals, receive 45 cards and begin with a 15-card Encounter Deck and 0 Warehouse resources. The Target Deck remains 30 cards.
- **26 August 2026 — Five-player Ledger release:** added a fifth prestige threshold to every player-count Entry, expanded The Small Storehouse to 3–5 players, synchronized all 50 entries with the canonical workbook and retained the existing component quantities.
- **27 August 2026 — Rules release v6.6:** removed the Unfulfilled Promise penalty, set active Burden, failed Arrival and each-Strain penalties to -10, named Shelter in the Ruins, removed facilitator teaching material, and synchronized the Main Rulebook, six Steward Aids and online prototype without changing the Ledger or playtest bot.
