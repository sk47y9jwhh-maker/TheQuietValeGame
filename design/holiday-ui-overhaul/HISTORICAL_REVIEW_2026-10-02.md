# The Quiet Vale — ready for Robert’s review

Packaged 2 October 2026 at Robert’s request to wrap up. The holiday automation has been deleted. All implementation is local on `codex/holiday-ui-ux-2026-09`; nothing has been pushed, merged or deployed. The last tested implementation checkpoint is `55199d4`.

## Start here

Open the **[comparison studio](http://127.0.0.1:5174/)**. The preview is running locally on this laptop. My recommendation is **The Living Table**.

| Playable approach | What it emphasises | Main tradeoff |
| --- | --- | --- |
| [The Living Table](http://127.0.0.1:5174/?experience=tabletop) | The illustrated board beside direct actions; full-width phone/tablet views | Strategic details are in a collapsible round plan |
| [Council Desk](http://127.0.0.1:5174/?experience=council) | Score, objectives, deadlines and decisions together | Denser presentation and more scrolling on phones |
| [Pocket Vale](http://127.0.0.1:5174/?experience=guided) | Guided learning and one intention at a time | More view changes during familiar actions |

Each shares the established engine and approved artwork. Original saves are preserved; each alternative and demo has a separate local save. The product remains solo/shared-device play. Remote multiplayer, matchmaking, accounts and cloud saves are not implemented.

## A short review route

1. Compare the three designs using **A settlement in motion** in the studio. Start with [Living Table’s settlement](http://127.0.0.1:5174/?experience=tabletop&scenario=settlement). Inspect a tile, select an action and read its cost/outcome before confirming. Try Undo afterward.
2. Open the [Council late-game choice](http://127.0.0.1:5174/?experience=council&scenario=season-three) to see the revised required-choice and payment flow. Full printed cards and Target Card explanations expand without losing the draft.
3. Try [Pocket’s private handoff](http://127.0.0.1:5174/?experience=guided&scenario=handoff), preferably in a narrow window.
4. Use the studio’s Golden Signet or finale cases for complex placement and final-score/Ledger review. These are explicitly labelled demonstration fixtures; the finale passes many actions and is not a typical score.

Demos retain prior review progress. **Restart demo** restores only that design/scenario’s starting fixture if a like-for-like comparison is wanted. It does not reset another game.

## What changed

- Three distinct playable layouts and a studio with sixteen situations across sixty-four isolated comparisons.
- Illustrated setup, private seeding, contextual next-action guidance, searchable tiles, keyboard/touch map inspection and legal-space feedback.
- Cost and outcome previews before placement, upgrades, production and encounter payments. Arrival rewards are clearly distinguished from later construction.
- Clearer pending effects, Golden items, Steward powers, round/season handoffs, final scoring and Ledger history.
- Save-failure recovery, protected reset dialogs, reliable Undo/Redo boundaries and focused fixes for existing prepared-power ownership and queued-effect collisions.
- Responsive artwork loading, narrower-screen layout repairs, modal isolation, coordinate-specific control labels and measured contrast improvements.

Read the [design tradeoffs](RECOMMENDATION.md), [eight real screenshots](SCREENSHOTS.md), [accessibility evidence](ACCESSIBILITY.md) and [performance notes](PERFORMANCE.md). The extensive route and feature guide is [HOLIDAY_PREVIEW.md](../../.codex-work/holiday-ui-overhaul/HOLIDAY_PREVIEW.md) in the prepared worktree.

## Verification and remaining limits

**65 test files / 733 tests passed; production build and whitespace checks passed.** The baseline was 495 tests. Actual browser review covered all three layouts, desktop/tablet/phone sizes, keyboard navigation, game actions, payments, private hands, Undo/Redo, save/reload, season transitions and separate finale/Ledger cases. This is recorded implementation testing, not independent player research or accessibility certification.

The final continuous journey completed rounds1–4 using every ordinary action and stopped, at Robert’s request, at **Season II / round5’s private Ranger handoff**. Its thirteen-tile state is saved in [Living Table’s welcome demo](http://127.0.0.1:5174/?experience=tabletop&scenario=welcome). [The acceptance record](ACCEPTANCE_PLAYTHROUGH.md) gives the exact continuation. A single uninterrupted twelve-round browser playthrough remains unfinished; separate late-game and finale checks are documented.

Unverified: physical devices, spoken screen-reader output, actual enlarged-text/browser zoom, forced colours and operating-system reduced-motion behaviour. Pending payment option drafts reset on reload, although confirmed game state and the unpaid review remain. Saves are local; export/import and recovery after closing an unsaved tab are not promised.

## Run again

Reuse the server on port5174 while it is running. Otherwise, from Terminal:

```sh
export PATH="/Users/robertlittle/.nvm/versions/node/v24.18.0/bin:$PATH"
cd "/Users/robertlittle/Documents/The Quiet Vale Game/.codex-work/holiday-ui-overhaul"
npm run dev -- --host 127.0.0.1 --port 5174 --strictPort
```

Dependencies are already installed. Validation commands, from the same directory:

```sh
npm test
npm run build
git diff --check
```

## Schedule and allowance

The holiday automation was deleted on2October when Robert returned and requested the review package. Neither banked reset was redeemed; no credits, purchases or paid API fallback were used by this task. The last account-wide weekly meter reported **26% used**, so the target of using the whole weekly allowance was **not met**. A native screenshot-export tool call stalled from27September until2October, interrupting unattended progress. Saved code survived; the final image package was produced later through a local browser-only method. The detailed timeline remains in the main project’s `STATUS.md`.

Next decision: review the three versions and choose the direction to take forward. I recommend Living Table, followed by the unfinished continuous-game acceptance check and independent player feedback before a production release. No further work is scheduled.
