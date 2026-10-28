# The Quiet Vale — holiday UI and UX overhaul

Prepared on 23 September 2026 for Robert's authorised unattended work.

## Objective

Overhaul the web game's player experience to a standard that can credibly compete with professional digital board games. Explore several substantial interaction and visual designs, implement three playable alternatives, and polish a recommended version. The result must be enjoyable to learn, readable during complex turns, and comfortable on desktop, tablet and phone.

Robert has authorised autonomous experimentation, implementation and testing within this project while away. Make reasonable product and design decisions and continue useful work without waiting for routine feedback.

## Work window and usage

- Time zone: Europe/London (BST during this work window).
- Start: Sunday 27 September 2026 at 00:05 BST (26 September 23:05 UTC).
- End: Saturday 3 October 2026 at 12:00 BST (11:00 UTC).
- The account reports its preceding weekly reset at 26 September 2026, 12:03:16 BST. The end time leaves a small margin before the expected following reset.
- The intended budget is all available ordinary subscription allowance for that week, directed toward useful project work. Exactly 100% usage cannot be guaranteed; account limits, outages and scheduler behaviour control actual availability.
- Never redeem, consume, click, or otherwise use a banked usage reset. Do not call `consume_usage_reset`. One banked reset was available when this brief was prepared, and it must remain untouched.
- Do not purchase credits, enable paid overages, use an API key as a fallback, or bypass a rate limit.
- Check current time and usage at each wake and periodically during substantial work. A missing usage value means unknown, not zero. Inspect the window duration to distinguish a weekly cap from a shorter limit.
- At a temporary limit, save progress where possible and let the schedule retry after the normal reset. At weekly exhaustion, stop and disable this automation if possible. Never resume work against the next week's allowance.
- At or after the end time, disable this automation and finish with a concise status only. Do not start or continue implementation outside the window.
- Begin final packaging and documentation before the last portion of available allowance; maintain a usable handoff throughout in case the cap stops a run abruptly. Use any remaining allowance on justified improvements, playtesting and fixes, rather than repeating unchanged checks just to consume usage.

## Workspace and continuity

- Main project: `/Users/robertlittle/Documents/The Quiet Vale Game`.
- Prepared development worktree: `/Users/robertlittle/Documents/The Quiet Vale Game/.codex-work/holiday-ui-overhaul`.
- Development branch: `codex/holiday-ui-ux-2026-09`.
- Prepared source baseline: `7e59bec` (`Show matching Special tile back numbers on Arrival rewards`).
- Active automation ID: `quiet-vale-holiday-ui-and-ux-overhaul`. Its saved recurrence starts on 27 September and expires on 3 October, with hourly opportunities to continue in this same task. Installed dependencies have been copied into the worktree and its build verified.
- Use the prepared worktree for application changes. Preserve the main checkout and any unrelated work.
- At the first active run, inspect any newer main-branch application changes and adopt relevant updates safely before diverging where feasible. Never reset, clean, stash or overwrite someone else's work.
- Read this brief and `STATUS.md` in this same directory at each wake. Keep progress, decisions, active paths, exact preview commands, tests, usage observations, limitations and the next concrete action in `STATUS.md` after every meaningful milestone.
- Save evidence and the final comparison/handoff in this directory, with links to the implementation worktree. Make coherent local commits on the development branch where permissions permit. Keep code playable at checkpoints.
- The main checkout contains untracked v6.7/v6.8 rulebook review files. These are unrelated work, not authority to silently change the web game's rules.
- A push to main triggers production deployment. The requested deliverable is reviewable alternative versions: keep experimentation on the development branch and local previews. Do not merge into main or replace the live game during unattended experimentation.

## Existing product and authoritative rules

The application is a React 19 / TypeScript / Vite static web game with a deterministic engine, approved map/card/tile artwork, local save/resume, undo/redo, and the Steward's Ledger. It currently supports 1–5 players in its existing local play model. Do not present invented networking, matchmaking, accounts or server synchronisation as functioning features.

Read the current README, source data, relevant engine code, styles and tests before design changes. Follow the README's source-of-truth order and locked gameplay decisions. Share the existing game engine and state model across alternatives. Fix proven bugs that block good UX, with targeted regression coverage; do not redesign game balance or rewrite the rules to simplify a layout.

Retain the identity of The Quiet Vale and use the approved artwork thoughtfully. Alternative designs must differ in information hierarchy and interaction, not only colour palettes. New decorative assets are optional and must not prevent functional progress if image generation is unavailable.

## Required outcomes

1. **Experience audit and design rationale.** Play the existing prototype; record the most important friction in setup, learning, board reading, turn progression, effect resolution, saved games and narrow screens. Inspect current professional board-game experiences through accessible first-party material and extract useful interaction principles without copying their branding or assets. Prioritise problems by player impact.
2. **Three playable design directions.** Explore a map-led immersive tabletop, a clear strategy dashboard, and a touch-led guided experience as starting hypotheses. Refine or replace these directions if research suggests better alternatives. Give each a coherent visual language and genuinely distinct approach to playing. Reuse game rules; support a representative complete game loop in each.
3. **A polished recommended experience.** Select the strongest approach using explicit criteria, then improve it beyond the prototypes. Make the current player, phase, remaining actions, available actions, selected object, resource changes and next step consistently understandable.
4. **A comparison entry point.** Provide an easy way for Robert to launch each alternative against comparable scenarios and inspect the recommendation. Keep experimental controls separate from normal player flows. Isolate demo/save data so comparing alternatives cannot erase an existing game or ledger progress.
5. **Tested handoff.** Include screenshots at representative desktop/tablet/phone sizes, a concise comparison with tradeoffs, exact run commands and entry points, validation results, known limitations and a recommended next step. Label prototypes, finished functionality and unverified claims accurately.

## Player journeys to improve

- First visit, returning player and continuing a saved game.
- Player count, Steward selection, optional content and game start.
- Guided learning and contextual rules without an overwhelming tutorial wall.
- Private hand/seeding interaction within the actual supported play model.
- Encounter reveals, Arrivals, Burdens, Boons and their remaining uses/timers.
- Selecting, inspecting, placing, rotating, upgrading and activating tiles.
- Map navigation, legal placement feedback, reachability and multi-hex footprints.
- Clear costs, previews, disabled-action explanations and action confirmation.
- Pending choices, chained effects and recovery from mistaken interactions.
- Steward powers, turn/round/season transitions and progress through a session.
- Save/resume, undo/redo and protected reset interactions.
- Final scoring, understandable breakdowns and Ledger progression.

## Quality bar

- The board is a primary interactive surface, with readable labels and deliberate control placement. Avoid nested scrolling and panels that hide required actions.
- Use hierarchy, typography, spacing, contrast and consistent icon meaning to reduce cognitive load. Do not depend on colour or hover alone.
- Support keyboard operation, visible focus, appropriate names/labels, modal focus management, readable text, reduced motion and touch targets. Aim for relevant WCAG 2.2 AA criteria and document what was actually checked.
- Check approximately 390 px phone, 768 px tablet, 1280 px laptop and wide desktop layouts; include portrait/landscape and large text where practical. Prevent clipped dialogs, blocked map gestures and inaccessible fixed controls.
- Animate meaningful changes with restraint. Preserve responsiveness and avoid gratuitous effects that obscure game state.
- Loading, empty, disabled, error and recovery states should be deliberate. Use truthful, friendly player-facing language.
- Keep saves and Ledger data compatible or provide a tested migration. Preserve hidden information where the actual play model requires it.
- Use real browser interaction and inspect rendered screenshots. Automated DOM tests alone do not establish visual quality.
- Compare performance and asset loading before/after meaningful changes, especially the large encounter artwork. Measure before claiming improvement.

## Suggested sequence

The dates are priorities, not reasons to wait idly. Continue to the next useful item when one is complete.

- **27 September:** Baseline playthrough, audit, reference research, design directions and first working redesign.
- **28–29 September:** Three playable alternatives and a shared comparison path; simplify the major game flows.
- **30 September–1 October:** Pick and polish the strongest experience, including onboarding, mobile/touch, accessibility and motion.
- **2 October:** Broader playthroughs and regression fixes, performance review, save/resume and edge states; produce the review package.
- **3 October before 12:00 BST:** Finish the most valuable remaining fixes and verify the final handoff, within the remaining ordinary allowance.

## Validation and execution

Preparation checks on 23 September 2026 at baseline `7e59bec`:

- `npm run test`: 41 test files and 495 tests passed.
- `npm run build`: passed.
- Existing tooling includes Vitest and React Testing Library; browser end-to-end tests are not yet installed in this repository.

Run checks appropriate to each change. Add focused interaction/regression tests for changed behaviour; do not duplicate implementation in tests. Run the full test suite and production build at integration milestones and before handoff. Fix failures introduced by the redesign and record any pre-existing failures separately.

Use available browser tools for actual gameplay and visual checks. If a tool, permission or dependency is unavailable, record the specific blocker and continue independent useful work. Do not misrepresent an unexecuted check as passed. Keep one coherent implementation effort in this worktree so scheduled runs cannot compete over the same files.

The computer must remain powered, connected to the internet, and running the desktop app. The AC power profile was checked and currently has system sleep disabled. A shutdown, closed-lid sleep, disconnection or quit app can prevent the schedule from running.
