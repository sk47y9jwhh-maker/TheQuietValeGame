# Player experience audit — 27 September 2026

## Evidence and scope

Baseline source: `7e59bec`. Main and the prepared development branch had the same application commit at the first work run. The audit used the local Vite preview and actual browser interaction, not a visual mockup. The baseline was inspected at 1280×900 and 390×844; the first redesign was also checked at 768×1024.

## Highest-impact findings

1. **Board space competes with empty panels.** At laptop size, a permanent action column and permanent encounters column leave the map less than half the viewport width, even before any encounters exist. The Living Table combines those controls in one dock and makes the map the primary surface.
2. **First play starts with administration.** The original setup surfaces warehouse totals, locked Vows, Golden Legacy and encounter-deal counts before establishing what players are doing. The first redesign explains the cooperative premise, asks who is playing, then reveals optional detail progressively.
3. **The phone loses important overview information.** The baseline resource strip shows only some resources without horizontal scrolling; the map starts partly offscreen at a fixed large width. The first redesign shows all six totals and offers fit/zoom plus a bounded pan area. Actual browser review exposed and fixed two inherited overflow/alignment problems.
4. **Progression needs a stable explanation.** The existing action area changes substantially between phases. A persistent current-step guide now explains setup, seeding, reveal, pending decisions, remaining actions and round end. Required effects take priority over ordinary turn advice.
5. **Selection remains too dense.** The existing tile list mixes availability, supply, cost, artwork and controls for many tiles. The new dock preserves correct behaviour but still needs better filtering, stronger selected-tile feedback and explicit action consequences.
6. **Production can spend an action at the warehouse cap.** A browser playthrough activated a Lumber Yard while Wood was already at 15. The action was consumed and Wood remained capped. This is existing engine behaviour, not changed balance. A future UX pass should explain the prospective gain/cap before confirmation rather than silently changing the rule.
7. **Shared-device privacy needs deliberate handoff.** Seeding and hand viewing need a review of private-information transitions. No networked multiplayer or account features should be implied; this is the current local/shared-device game model.

## Reference principles

- Board Game Arena makes tutorials discoverable from the game page's learning section. The useful principle here is an obvious learning entry point with guidance in the context of play. This is an inference for Quiet Vale, not a claim of equivalent tutorial functionality. [BGA tutorial overview](https://en.boardgamearena.com/news?id=572)
- Tabletopia documents object-specific controls, camera navigation and private hand areas. The useful principles are predictable inspection/manipulation and visible control over the view. The Living Table uses explicit fit/zoom controls and keeps its legend available without occupying the whole top of the board. [Tabletopia object and camera controls](https://help.tabletopia.com/knowledge-base/actions-with-game-objects/)
- Tabletopia distinguishes active-turn interaction from other players' observation. Quiet Vale's guide should make the acting Steward and current obligation clear while preserving its actual shared-device model. [Tabletopia turn modes](https://help.tabletopia.com/knowledge-base/turn-based-mode/)

## Three hypotheses to compare

| Direction | Main idea | Key tradeoff | Status |
| --- | --- | --- | --- |
| Living Table | Board first, calm tools and a single contextual dock | Fewer simultaneous side panels; switching is sometimes needed | First playable prototype |
| Council Desk | Persistent strategic overview with compact controls | More simultaneous information and longer phone scrolling | Playable prototype |
| Pocket Vale | Guided decisions with touch-friendly navigation | More deliberate steps and less simultaneous context | Playable prototype |

The recommendation remains open until the three interfaces can be tested against equivalent scenarios. Score them on learning, turn clarity, board readability, speed of common actions, recovery, small-screen comfort and accessibility.

## Remaining verification

The first two milestones verified one solo round in Living Table and one two-player round in Council Desk, with targeted interactions; they do not establish complete twelve-round or five-player coverage. No formal WCAG audit or performance improvement claim is made. Screenshots were captured and inspected in the task; the final standalone screenshot comparison package is still to be assembled. The existing large encounter artwork is a future performance investigation.

## Council Desk findings — second implementation run

- The live engine score, objective conditions and Arrival timers are now visible in the strategic overview. These are provisional facts, not invented goals or recommendations about optimal play.
- Seeding and Hand-tray privacy now require an explicit owner reveal. Regression coverage includes undo to an earlier owner, season changes, hiding the hand and reopening the tray. Hidden content is unmounted rather than merely covered by a visual overlay.
- A real two-player browser round completed an Arrival, unlocked its Special Tile and reduced the remaining Arrival's timer at round end.
- The original mobile card rule used a viewport width even inside a padded container. Active and completed Arrival cards overflowed by approximately 35 px inside their section. Container constraints and zero-minimum grid columns fixed both cases; document width is now 390 px at a 390 px viewport.
- Council Desk's phone flow still requires more scrolling than the Living Table. Phase changes can preserve an awkward prior document scroll position; revisit focus/scroll handoff during the shared interaction polish. Its main tile selector remains dense. These are prototype limitations, not a completed professional-quality claim.

## Pocket Vale findings — third implementation run

- The new design makes table setup a short sequence, seeding a deliberate top/middle/bottom choice, and each turn action a named intention. The board and encounters remain available through a persistent navigation row.
- Every committed step returns to the action menu. This makes the updated action count visible and reduces accidental repeat spending. Repeated selection of the same board hex is handled as an explicit choice; detached Stables placement keeps the board open until both spaces are selected.
- A 390 px browser round exercised the real engine, including an Arrival payment/unlock, keyboard activation, undo/redo and saved-game recovery. Desktop, tablet and 320 px layouts were also inspected.
- Found/fixed mobile setup controls shrinking underneath the map, a missing word space when the welcome line break disappears, undersized header controls, and the same-hex return edge case. Focus follows pending-effect changes in all enhanced directions.
- The initial starting-position map still uses the baseline scrollable map on phones. The tile list still needs better discovery and consequence previews. Pocket's isolated views are calmer, but require more switching than Council Desk. No final winner is claimed yet.
- All 513 tests pass; the production build passes. Browser evidence is inspected inline in the task; standalone screenshot files are still required for the review package.

## Shared-situation findings — fourth implementation run

- Seven engine-generated or explicitly illustrative comparison cases now make repeated evaluation possible without overwriting ongoing games. The desktop/phone composition checks confirm the expected tradeoffs: more board space in Living Table, more strategy visible in Council, and more focused decisions in Pocket.
- A zero-actions-left case exposed a UI effect that continuously selected End Turn and prevented access to legal free actions. Four layout regressions and a browser Path placement confirm the corrected navigation.
- A real pending Quartermaster case exposed controls disappearing after a partial exchange. Optional resource/timer controls now remain editable; the engine still rejects unbalanced trades. Browser completion changed Wood 13→11 and Food 10→12.
- Final scoring and isolated Ledger recording work for a scripted twelve-round fixture. However, Council's game-end view still contains Ready turn labels, In progress objective labels and future-facing Arrival advice. End-state language and hierarchy need refinement. The fixture's -285 reflects deliberate passive coverage play and is not a typical-result claim.
- The returning-player case displays five example Ledger completions and correctly exposes the first Golden Tile and Boon. The ordinary Pocket save remains at round two after all demo tests.
- Latest verification: 533 tests / 45 files, production build and whitespace checks pass. Browser evidence at 1280, 768 and 390 px. One live-edit React refresh warning was followed by a reload and no further runtime errors. Standalone screenshot export and measured asset-loading improvements remain outstanding.

## Tile-discovery review — fifth milestone

The catalogue now separates discovery from the chosen tile's commitment controls. Name/effect/terrain search, category and supply filters retain the selection; keyboard browsing and an explicit review focus step keep the final Place button predictable. A compact rules disclosure avoids repeating every rule above the controls. The placement footprint and consequences come from the engine, including actual action cost, prepared modifiers, resource caps and pending payment choices.

Phone play confirmed that an announced Workshops cost of 2 Wood/1 Metal and Sustainable Lumber production of 3 Wood/2 Food exactly matched committed results. Undo/redo worked across the production step. A second Lumber activation at Wood 15 now explains the zero resource gain before commitment. This corrects the original audit's cap-surprise finding without changing legal actions.

The same browser work found a comparison-only overlay error: the demo bar intercepted the inspector close button. Lowering that bar below the existing modal fixed the actual click; focus now enters the dialog, cycles there with Tab, and returns on Escape/close. The close target measured 44×44 px at a 320 px viewport. Council catalogue width matched both 320 and 768 px. These are specific checks, not an accessibility certification.

All 543 tests in 46 files and the production build pass. Inline screenshots show the new selection, full-store warning and narrow inspector. A standalone screenshot export remains to be completed. Larger questions remain: phase/scroll continuity, first-map interaction, end-state language, full season/Golden play, loading cost and a final comparative recommendation.

## Beginnings and endings — sixth milestone

Phone starting choices now have a large legal-space list and explicit coordinates alongside the illustrated map, replacing dependence on tiny hex targets. The real two-player flow selected Vanguard B8 and Knight A7 and reached private seeding at 390 px without page overflow. Keyboard map navigation and zoom/fit were exercised.

Final scoring is a complete review page with the actual engine equation, final objective results, Ledger state and optional board review. The former Council Ready/In progress and future Arrival advice are absent from the completed-game route. A regression exposed a real mismatch between the campaign's recorded game and an older restored board flag; the UI now treats the campaign record as evidence and distinguishes changed-board scores from recorded history.

The native restart confirmation stalled browser control. An in-page ending confirmation replaces that path and has tested cancellation, focus, record recognition and Ledger preservation, but the live browser journey still needs verification after recovery. Native control of the host app is tool-restricted and was not bypassed. Final automated verification is 551 tests across 47 files plus a passing build. Only the starting flow and static desktop/phone end-state renderings were fully inspected during this milestone. Standalone screenshots and the final design recommendation remain outstanding.

## Recommendation and responsive review — eighth milestone

The Living Table is selected as the recommended foundation, based on its desktop board presence and direct action flow. Council's strategic context and Pocket's deliberate learning remain useful alternatives. `RECOMMENDATION.md` records the qualitative comparison and limits; this is not independent user research.

The recommended direction now gives phones and portrait tablets full-width action/board/encounter views without resetting drafts. Actual play verified repeated board choice, placement, production, Arrival resolution, player handoff and Knight's zero-action Supported Housing placement. Short-window review found and fixed a 53 px Pocket play area and hidden-content scroll targeting. Council no longer loses its top context to initial panel focus. Starting-map review fixed a falsely fitted map that clipped its bottom rows. Four failing tests also exposed demo welcome seeds being randomised, now corrected without rewriting existing saves.

Final integration is 575 tests across 51 files and a passing production build. Screenshots were inspected inline at phone, tablet, laptop and landscape sizes. Large-text, broader season/Golden journeys and standalone image packaging remain outstanding.

## Ninth-run refinement — seeding and season continuity

Living Table no longer assumes the first three dealt cards are intentional choices. Its new overview shows current-season rules in readable HTML, retains full approved artwork on demand, requires explicit assignments and provides a final review. Hide/Reveal preserves the draft but unmounts hidden content; owner/season changes and undo handoffs re-hide it. The public round-end preview now makes expiring Arrivals, departing Boons and new-season effects visible before resolution.

Real browser play from rounds two to five confirmed expiry/Strain, escalating seasonal effects, reseeding from six remaining cards, reload during a private handoff, a four-resource Season II Boon and renewed Knight power. Seven added regressions pass with the full 582-test suite and build. Phone, tablet and desktop screenshots were inspected inline. This improves the recommended design; it does not establish independent usability findings or certify accessibility. Remaining issues include native reset prompts, Golden/other Steward journeys, compact strategic context and large-text checks.
