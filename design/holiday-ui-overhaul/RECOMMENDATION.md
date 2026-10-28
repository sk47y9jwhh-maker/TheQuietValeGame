# Recommended direction — The Living Table

Packaged for Robert’s review on 2 October 2026. The holiday automation has been deleted. Start with [the short review guide](REVIEW.md). This is an implementation review, not a usability study with independent players or a finished release.

## Decision

Polish **The Living Table** as the main player experience. Keep **Council Desk** and **Pocket Vale** playable as alternatives. Living Table gives the approved landscape room to establish the game's identity and keeps direct actions alongside it on desktop. Its revised phone/tablet layout gives actions, board and encounters a full-width view, retaining choices between them. A complete board choice returns to the action preview without spending an action.

The comparison studio marks the recommendation and explains its tradeoffs. Open `http://127.0.0.1:5174/`, or go directly to `http://127.0.0.1:5174/?experience=tabletop`.

## Comparative judgement

| Criterion | Living Table | Council Desk | Pocket Vale |
| --- | --- | --- | --- |
| Learning the first game | Clear setup, deliberate seeding, current-season summaries and review | Clear facts, but the most information to interpret | Strongest guided setup and deliberate seeding |
| Board reading on desktop | Largest persistent board beside decisions | Board shares space with score, priorities and roster | Large board available through a separate view |
| Speed of familiar actions | Direct action controls and a single dock | Direct controls plus persistent planning information | Each committed step returns to an intention menu |
| Phone / portrait tablet | Now uses full-width views without an extra intention menu | Most document scrolling | Calmest guided view, with more view changes |
| Strategic context | Collapsed round plan shows deadlines, readiness and the current objective, with direct card review | Strongest live score, deadlines and objective overview | Context is deliberately separated from the current choice |
| Identity and atmosphere | Best use of the original landscape as the main play surface | Restrained dashboard, useful for experienced planners | Warmer cream/plum interpretation, especially suitable for learning |
| Recovery and accessibility | Visible save recovery, undo, safe reset dialogs, previews, keyboard map and inspector | Same shared capabilities | Same shared capabilities; deliberate guided focus |

These are qualitative product judgements based on the actual implementations and recorded browser journeys. There is no fabricated score, participant count, completion-time claim or claim of WCAG certification.

## Evidence behind the decision

- Equivalent six-tile round-two snapshots were inspected in Living Table and Council at 1280×900, with prior checks across all three directions. The revised Living Table was played at 390×844 and its full-width board checked at 768×1024. Changing a view preserves the draft, and explicit space selection returns to the appropriate action.
- Actual Living Table play placed Lumber Yard at I1, produced Wood 8→10, completed No Soul Goes Unserved (Goods/Herbs 10→8), and handed from Vanguard to Knight. Knight produced Food 2→4→6 and prepared its Housing power. The Cabin preview at A8 showed zero action cost, Wood 10→8, Food 6→1 and Supported. The committed board matched those consequences and retained two actions.
- Council's initial focus used to scroll the tall decision column toward its bottom, losing the top context. Scrolling its short header now leaves the 1280×900 entry at document scroll 0 with resources, phase and overview visible.
- At 844×390, Pocket's fixed frame previously left only 53.36 px for play. Short windows now use document scrolling, making its actions, board and inspector reachable. Landscape checks are viewport emulation, not physical-device measurements.
- Starting-map review covered Ranger's Heaths choices and Warden's Ruins choices at 768×1024 and 1280×900. It also found that a 601 px map was clipped inside its 540 px whole-board frame. The fitted map now measures 540/540 px, while zoom permits 1080 px of vertical and 1508 px of horizontal content for panning.
- A source review and four failing regressions found that welcome demos replaced their advertised common deal with a fresh seed. Demo starts now retain the fixed comparison seed. Existing demo saves are preserved, so use Restart demo to compare the original deal. Ordinary new games remain randomised.

- Ninth-run refinement now brings deliberate seeding to Living Table: explicit choices, full-card reading, a final review, swaps without duplicates and private handoffs that survive undo and reload. Desktop, phone and tablet rendering were inspected. The public round-end preview was validated in actual rounds two to five, including expiring cards, changed Season II effects, private reseeding and renewed Knight power. This closes the first seeding/season gap identified in the initial recommendation.

- Tenth-run recovery refinement replaces native reset prompts with shared in-page confirmations and repairs stale recording flags after a deliberate Ledger reset. Actual browser checks covered cancellation, preserved seeding drafts, clear/reload/re-record, retained settlement history and focus on returning to setup. Dialogs were inspected at desktop, tablet, phone, narrow and short landscape sizes.

- Eleventh-run Golden refinement adds deliberate placement, private Scroll exchanges and clear Bell confirmation, with two engine-generated comparison cases. The shared review keeps hidden card names private. Actual browser play verified zero-cost Charter/Bell placement, card replacement, queue continuation, Undo/Redo and reload. Tablet resolutions now use the full page, while wide Golden panels remain scrollable. Narrow-screen focus reaches the owner and the first card, with no horizontal overflow at 320 px.

- Twelfth-run persistence refinement makes failed saves visible across every design, preserves the in-memory game and private drafts, and retries the latest confirmed state. Actual Living Table play verified two activations, Undo, retry, recovery and reload. Council anchors and compact navigation clear the warning; dismissing recovery returns focus to a visible control. Seventeen new regressions include quota/access failures, unreadable-save preservation, ordered Ledger writes and partial-write recovery. All **623 tests in 56 files**, the build and whitespace check pass.

- Thirteenth-run Signet refinement makes a complex group move reviewable before commitment. It separates choosing tiles, arranging destinations and reviewing the whole settlement, while retaining the original engine. The wide map, legal markers and optional encounter reference keep the board central. Browser play verified a simultaneous Cabin/Path swap, carried Steward, preview inspection, Undo/Redo/reload and the following queue. Phone overflow and weak map markers were corrected. All **636 tests in 57 files**, the build and whitespace check pass.

- Fourteenth-run opportunity refinement gives the Vial an honest zero-action preparation flow and the Traveller an explicit bonus-turn sequence. Actual play verified paid Common Land placement, support, Undo/Redo/reload and the complete two-player bonus cycle. Legal spaces are visible above map artwork. Pocket’s keyboard focus was corrected under the same React StrictMode used in the browser. All **650 tests in 58 files**, the build and whitespace check pass. Twelve isolated cases support comparison.

- Fifteenth-run Steward refinement adds map-led Ranger reach and named Warden relief decisions, with two actual game scenarios. Browser play verified disconnected tile access, expiry, prevention, support consumption in the next encounter and save/Undo/Redo. New StrictMode regressions exposed duplicate Undo entries in the shared commit path. Each decision now records once. Invalid and stale Ranger targets are also rejected by the engine. All **668 tests in 59 files** pass, with fourteen isolated cases for review.

- Sixteenth-run preparation refinement gives Sentinel, Vanguard and Knight direct, cost-aware tile reviews and preserves those routes through Undo/Redo and Pocket reload. Blocked upgrades disclose actual reasons. Engine matching now prevents other Stewards from consuming a prepared power, while preserving shared Boons and existing Season timing. Real browser play verified Sentinel's paid Supported upgrade and Knight's paid zero-action Cabin. All **687 tests in 60 files**, build and whitespace checks pass. Fifteen cases support sixty isolated comparisons.

- Seventeenth-run refinement adds Living Table's compact round plan and explicit payment replacement controls shared by all three designs. Exact-card review preserves game state and drafts, while pending effects remain the first priority. Browser play verified Arrival completion, disappearance from the plan and restoration through Undo. A focused regression exposed and fixed stale suggested timer loss being merged back into an explicit payment. Empty outcomes explain why no choice is needed. All **706 tests in 62 files**, the final build and whitespace checks pass. Narrow-screen measurement also caught and corrected a 4 px resolution overflow.

- Eighteenth-run refinement makes Arrival and Burden payments explicit before commitment. Resource/action previews use the existing engine and separate an unlocked tile from its later construction. One Food/Goods mix control replaces repeated substitution switches. A real Season III case now covers a mixed reveal, Overstrain, private seeding, production, Burden payment and last-action Arrival completion in the browser. Focused regressions found and fixed capped-log effect-ID collisions, including the just-resolved chain head. All **720 tests in 64 files**, build and whitespace checks pass. Sixteen cases provide sixty-four isolated comparisons.

- Nineteenth-milestone refinement makes required effects readable before their references: current rule, choices, actual outcome preview, then the compact Target Card explanation. Native disclosures preserve drafts and reset for the next effect; conditional prevention and Open targeting remain explicit. Browser play verified payment, queue focus, Undo/Redo and unchanged source artwork. All **727 tests in 65 files**, the resumed build and whitespace check pass. [Six actual screenshots](SCREENSHOTS.md) now cover all three designs and the revised choice flow.

- Twentieth-milestone accessibility review isolates nested inspectors, identifies repeated tile controls by coordinate and repairs Signet back-navigation focus. Narrow resources, dark-guide focus and Pocket's selected count now have clearer separation and contrast. Actual keyboard/native-tree checks, sampled colour measurements and two updated phone captures accompany **733 passing tests in65files** and a passing build. [Read the exact evidence and limits](ACCESSIBILITY.md).

## Remaining acceptance work after handoff

1. The bounded keyboard/contrast/reflow review is complete. Actual enlarged text/browser zoom, operating-system reduced motion, spoken screen-reader output, forced colours and physical devices remain unverified; the review documents the tool limitations rather than claiming certification.
2. The continuous browser journey completed rounds1–4 with all ordinary actions used and stopped at Robert’s request at SeasonII/round5’s private Ranger handoff. Completing rounds5–12 and Ledger recording remains future acceptance work; existing separate season/late-game/finale checks remain valid. See [the saved journey](ACCEPTANCE_PLAYTHROUGH.md).
3. The final comparison handoff is packaged in REVIEW.md with eight real screenshots, run commands and known limits. Independent player feedback remains the next design validation step.

Pending payment reviews preserve confirmed game state through reload. Their unconfirmed option drafts reset to defaults on reload or Undo into the review, and players must review the new total before confirming. This is a current limitation, not lost paid resources.

## Scope and run instructions

All work remains local on `codex/holiday-ui-ux-2026-09`. The production checkout, approved source artwork and original saved games have not been replaced. The established rules engine is shared, with focused validation fixes enforcing the existing printed powers. The game remains solo/shared-device local play; remote matchmaking or account synchronisation is not implemented.

```sh
cd "/Users/robertlittle/Documents/The Quiet Vale Game/.codex-work/holiday-ui-overhaul"
npm run dev -- --host 127.0.0.1 --port 5174 --strictPort
```

Reuse the existing server on 5174 while it is running. `HOLIDAY_PREVIEW.md` in the worktree lists every route and scenario. `STATUS.md` in the main project's `design/holiday-ui-overhaul/` directory records the latest tests, browser state and remaining work. The scheduled work stopped at Robert’s request on2October and the automation was deleted. Both banked resets remain untouched. No further work is scheduled.
