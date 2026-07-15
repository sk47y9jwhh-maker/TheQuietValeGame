# The Quiet Vale — adversarial playtest and rules-vulnerability report

Date: 14 July 2026<br>
Audited build: `5fa5f6c`<br>
Scope: current online prototype, all four player counts, Ledger unlock tiers 0/5/12/18/25/32<br>
Verification: TypeScript build/lint passed; the complete Vitest suite passed (350 tests)

## Priority 0 remediation — 15 July 2026

The hard-lock intervention package identified by this report has now been implemented and verified against the recorded evidence set:

- Coin Before Craft Season II now degrades each category minimum to the legal targets actually available. Zero targets, Merchant-only, Crafting-only, and a valid adjacent pair all have explicit regression coverage.
- Pending-effect suggestions are revalidated against the current board immediately before display and resolution. A stale target, changed fallback, changed fixed-resource loss, or changed Strain cascade is rebased rather than retained as an impossible hidden requirement.
- A formerly mandatory choice can be acknowledged when its complete legal branch has disappeared. This covers exhausted Arrival/timer alternatives, Arrival expiry with no Strain target, Tools Left to Rust with no remaining target, and the wholly optional Quartermaster exchange.
- Alchemist's Workshop now treats its printed “up to” exchange as optional, closing the empty-Warehouse activation lock found by the new invariant sweep.
- Every registered structured effect is property-checked in boundary and target-rich states with empty and stocked Warehouses. A second deterministic property test drains 1,024 queued effects after randomized board, Warehouse, Arrival, and timer mutations.
- All 113 previously failing deterministic games replay clean: 68/68 from the main sweep, 38/38 from the paired seeding experiment, and 7/7 from the targeted Vow sweep.

The Priority 0 changes deliberately did not alter scoring, production cadence, Vow thresholds, or the Priority 1+ balance recommendations below.

## Priority 1–2 interventions — 15 July 2026

All three selected Priority 1–2 interventions have now been implemented in the prototype:

- **Single-use Carts refresh:** one prepared Carts modifier can refresh at most one chosen already-used Crafting or Merchant passive. All eligible choices remain visible, declining them preserves the modifier, and choosing a different refreshed passive replaces the earlier choice.
- **Diminishing Linked Production:** the first activation in each linked Resource group per round produces from the chosen tile and every immediately adjacent eligible matching producer. Every later activation in an overlapping group that round produces only from the chosen tile. Disconnected groups retain independent first harvests, and the cadence refreshes when the round number advances.
- **Unfulfilled Promise:** every Arrival still active at final scoring costs 5 Renown. It remains distinct from a failed Arrival and adds no Strain.

The Carts choice validator rejects two passive options that share a modifier, while the cost application and passive recorder independently cap a malformed direct selection to one effect. A refreshed Workshop is optional rather than incorrectly mandatory. The implementation records a full linked harvest against every participating tile, preventing a player from bypassing the cadence by selecting another tile in the same group. The record is save-persistent and coexists with existing round/Season activation limits. Final scoring and audit telemetry expose failed Arrivals and Unfulfilled Promises as separate components.

### Post-intervention verification

The exact Carts probe still exposes all four eligible used passives so the player retains agency, but marks none as required. Selecting all four is invalid; both the chosen-one path and the defensive malformed-selection path reduce the 16-resource test cost only to 14, not the exploitable 10, and consume one modifier once. The exact production probe preserves the high point of the engine but removes its repeated group multiplier: three upgraded linked producers yield 15 resources on the first activation and 5 from the chosen producer on a later activation that round. Choosing a different member, adding an overlapping producer, changing Strain, or relocating a stamped producer cannot manufacture another full harvest. A new round restores one full harvest. The exact Round 12 probe now scores a surviving Arrival as a 5-Renown Unfulfilled Promise with zero Strain, reducing the former parking advantage from 10 points to 5.

The Linked Production and Unfulfilled Promise post-intervention sweep ran **1,536 deterministic full-engine games**: the original 1,344-game matrix plus 192 games from the three targeted Vow/exploit arms. All **1,536/1,536 reached `gameEnd` with zero simulation errors**. This includes all 68 main-sweep seeds that the audited build had excluded.

After the final Carts exclusivity fix, the same expanded matrix was started again. At release time, **576/576 completed games had reached `gameEnd` with zero simulation errors**; the remaining long-running shards were stopped at the user's request to publish. This final all-four release sample spans three deterministic shards across all strategy arms and player counts. The exact four-passive Carts probe, 372-test suite, type-check, and production build provide the focused release gate; the 1,536-game figures and paired metrics below quantify the Linked Production and Unfulfilled Promise interventions, not a completed post-Carts matrix.

For the 1,276 seed-identical games that were clean in both builds:

| Metric | Audited build | Post-intervention | Change |
|---|---:|---:|---:|
| Mean final score | 83.6 | 82.6 | -1.0 |
| 90th-percentile score | 177 | 168 | -9 |
| Maximum score | 364 | 326 | -38 |
| Mean resources produced | 153.0 | 152.3 | -0.6 |
| 95th-percentile production | 336 | 327 | -9 |
| Maximum resources produced | 489 | 462 | -27 |
| Mean completed Arrivals | 6.63 | 6.67 | +0.04 |
| Mean Unfulfilled Promise penalty | 0 | 1.7 | +1.7 |

The former 364-point seed fell to **326**, with production falling from **470 to 406**. Threshold hits across paired games fell from 14 to 10. The median paired change was zero for both score and production, Warehouse totals were effectively unchanged, and completed Arrivals did not fall. That is evidence against broad resource starvation: the intervention primarily trims the high-output tail while ordinary simulated games remain close to baseline.

It is deliberately a conservative fix, not a complete cure for repetitive activation. Mean activation count and maximum single-tile activation count were essentially flat, and the expanded sweep still reached 326 points and 462 produced resources. The linked multiplier can no longer repeat within a round, but repeatedly activating one upgraded producer remains legal and sometimes dominant. Human playtests should now test whether the retained five-resource action is satisfying or still too grind-prone before considering exhaustion or a stronger infrastructure constraint.

Unless a later section explicitly says otherwise, scores and exploit measurements below are historical evidence from the pre-intervention audited build. They explain why these changes were selected; they are not claims about the post-intervention balance.

## Player-count and Vow recalibration — 15 July 2026

The requested player-count and Vow pass is now implemented from the post-intervention distributions. LE-001 retains its working 1p / 2p / 4p targets and corrects the anomalous shared 3p/4p target to **140 / 200 / 280 / 320**. No Roads Raised is rescaled to **90 / 130 / 190 / 240**, reflecting its increasing multiplayer ceiling. No Fine Work is rescaled to **110 / 85 / 75 / 40**, reflecting the severe multiplayer cost of forbidding every Core upgrade. The Small Storehouse is now explicitly **3–4 players only**: it is hidden during 1p/2p setup, invalid saved setup selections are cleared, and the engine defensively rejects a direct invalid declaration.

These are evidence-led playtest targets, not claims of permanent balance. Resource creation and spending remain untouched by design; objective rewards, Golden rewards, and Special Tile parity are intentionally deferred.

## Executive verdict

The current game contains a compelling high-score engine, but the best line is much narrower and more repetitive than the breadth of the tile set suggests. The dominant loop is:

1. place and upgrade zero-cost Resource tiles;
2. cluster identical producers for Linked Production;
3. repeat the same activation many times;
4. convert the resulting resource flood into Housing, Arrival rewards, Special Tiles, and Steward objectives;
5. resolve Burdens early, but stop paying for late Season III Burdens unless another reward makes the resolution worthwhile;
6. keep late Arrivals alive through Round 12 rather than completing them.

That loop produced the highest score in the audit: **364 points** at four players. The game used **95 production activations**, generated **470 resources**, placed **42 tiles**, upgraded **25**, placed **14 Specials**, completed **16 Arrivals**, resolved **16 Burdens**, and earned all four Steward objectives. This was not a malformed state; it reached `gameEnd` with one unused action and no simulation errors.

The audit found two confirmed implementation defects, both remediated in the 15 July intervention package:

- **Coin Before Craft created an unresolvable prompt.** This caused 49 of the 68 failures in the 1,344-game main sweep; legal-target degradation and pending-effect invariants now close it.
- **Carts Before Sunrise refreshed four already-used Crafting/Merchant passives with one use.** Selection exclusivity, defensive application bounds, and interaction regressions now close it.

It also found several repeatable rules/balance vulnerabilities:

- an Arrival kept active through the end of Round 12 avoids both its 5-point failure penalty and the 5-point Strain consequence—a confirmed **10-point shield per Arrival** in the exact probe;
- 107 of 202 clean games in the paired seeding experiment ended with at least one active Arrival, so the shield is not merely theoretical;
- the best coordinated seeding package—Burden top, Boon middle, Arrival bottom—beat the reverse-pressure package by **29.1 points on average** across 33 clean pairs (approximate 95% CI **+11.1 to +47.0**);
- the no-road Vow was beaten in 4 of 7 clean four-player trials, topping out at 259 against a target of 190, without placing a Travel tile;
- the no-upgrade Vow was beaten in all 8 clean solo trials, with a mean of 80.5 against a target of 60;
- the Small Storehouse Vow is already failed at setup in one- and two-player games, because those games begin at 15/10 resources per type while the Vow permits no value above 8;
- three-player LE-001 appears materially harder than four-player LE-001: both target 320, but the best three-player result was 269 while four-player results reached 329 and 364;
- Steward and Golden goal rewards are flat despite extreme observed difficulty differences.

The practical design conclusion is not simply “scores are too high.” Most runs scored far below their threshold. The deeper issue is **variance and dominance**: a small set of economic engines and timing interactions produce very high outcomes, while many thematic or defensive lines spend actions without enough scoring conversion. The game would benefit more from tightening repeat production, endgame commitment rules, and reward parity than from a blanket score reduction.

## Evidence base

### Final experiments used for conclusions

| Experiment | Attempted | Clean, complete | Excluded | Purpose |
|---|---:|---:|---:|---|
| Main adversarial sweep | 1,344 | 1,276 | 68 | 21 strategic arms × 4 player counts × 16 deterministic runs |
| Paired seeding experiment | 240 | 202 | 38 | 5 seeding policies × 4 player counts × 12 paired seeds |
| Targeted Vow exploit sweep | 96 | 89 | 7 | 3 Vow hybrids × 4 player counts × 8 runs |
| **Primary total** | **1,680** | **1,567** | **113** | Quantitative evidence set |
| Exact state probes | 8 | 8 | 0 | Direct rule/engine reproduction |
| Search-sensitivity replays | 3 | 3 | 0 | Determinism and bounded-search sensitivity |

An earlier 1,344-run calibration pass was not merged into the final statistics. It exposed missing bot handling for several manual-choice prompt types. I fixed those audit-harness gaps and reran the complete sweep. This avoids inflating the sample count with duplicate seeds or treating harness failures as game outcomes.

No production game rule under `src/**` was changed during the audit. The added or modified code is confined to simulation and analysis tooling.

### Main sweep construction

The 21 broad strategy arms were:

- casual and guided baselines;
- mixed Ledger achievement play;
- raw-score and Population rushes;
- Knight/Housing, Renown, Vanguard crossing, Travel web, and dense civic layouts;
- no-road, no-upgrade, and Small Storehouse Vow attempts;
- spend-everything and resource-hoard extremes;
- Resource Crown, Workshop/upgrade, and Special Tile engines;
- Burden control, Support fortress, and riverbank sprawl.

Every arm ran at one, two, three, and four players. The deterministic run schedule rotated Golden unlock tiers and Steward combinations. Each game used the real 12-round engine, encounter resolution, score calculation, tile supply, costs, placement legality, and Ledger/Vow tracking.

The placement search was bounded to seven candidate cells, eight tile candidates, and two legal placements per tile. This was necessary to complete four-player searches in reasonable time. The highest four-player game still took about 5.2 CPU minutes. The bot is therefore an adversarial heuristic, not an exhaustive solver.

### Evidence labels used below

- **Exact:** a hand-built engine state reproduces the result with no heuristic choices.
- **Repeated:** many clean complete games show the pattern.
- **Paired:** identical seed, player count, Steward lineup, and unlock tier were compared with one policy changed.
- **Association:** score lift was residualised within strategy × player count × unlock tier. This reduces confounding, but it is not causal proof.
- **Rules-economic:** follows directly from printed costs and final scoring, but has not been isolated in a paired engine experiment.

## Score landscape

The threshold hit rate below is deliberately not treated as a global difficulty estimate: many arms pursued non-score Ledger entries. It is useful for identifying player-count asymmetry and the tails of the score distribution.

| Players | LE-001 target | Base paid actions | Max Steward bonus | Clean games | Mean | P90 | Max | Max/target | Hit rate |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 140 | 48 | 15 | 332 | 79.7 | 122.9 | 158 | 113% | 2.1% |
| 2 | 200 | 96 | 30 | 334 | 74.7 | 150.7 | 231 | 116% | 1.5% |
| 3 | 320 | 144 | 45 | 318 | 98.2 | 200.6 | 269 | 84% | 0.0% |
| 4 | 320 | 192 | 60 | 292 | 82.1 | 207.0 | 364 | 114% | 0.7% |

The most revealing comparison is the same Resource Crown arm:

| Players | Clean games | Mean score | P90 | Max | Mean target ratio |
|---:|---:|---:|---:|---:|---:|
| 1 | 16 | 83.1 | 135.0 | 145 | 59% |
| 2 | 16 | 92.8 | 188.5 | 208 | 46% |
| 3 | 16 | 89.6 | 178.5 | 253 | 28% |
| 4 | 16 | 232.7 | 312.5 | 364 | 73% |

That discontinuity is too large to dismiss as a different strategic arm. Four players supply four placement anchors, 48 more paid actions than three players, up to 15 more objective Renown, more seeded cards, and more Arrival rewards, but their LE-001 target does not increase at all.

### Highest clean game at each player count

| Players | Score | Strategy | Score anatomy | Dominant repetition |
|---:|---:|---|---|---|
| 1 | 158 | Population rush | 127 Population, 31 net Renown, no penalties | one Farmstead activated 21 times |
| 2 | 231 | Resource hoard | 161 Population, 80 gross Renown, 10 penalty | one Mine activated 18 times; 229 resources produced |
| 3 | 269 | Travel web | 196 Population, 98 gross Renown, 25 penalty | one Farm activated 42 times; 313 resources produced |
| 4 | 364 | Resource Crown | 212 Population, 157 gross Renown, 5 penalty | four main producers activated 15–29 times; 470 resources produced |

The score ceiling found by the bots is therefore not a single card combo. It is a repeat-production economy that can feed several scoring modules at once.

## Anatomy of the 364-point game

Seed: `adversarial-v1:resource_crown:4p:r13:u0`

Stewards: Sentinel, Ranger, Warden, Quartermaster<br>
Golden unlock tier: 0<br>
Final phase: `gameEnd`

### Score

| Component | Points |
|---|---:|
| Printed Population | 180 |
| Passive Population | 32 |
| Printed Renown | 95 |
| Passive Renown | 2 |
| Four Steward objectives | 60 |
| Golden Renown | 0 |
| Burden penalty | 0 |
| Failed Arrival penalty | 0 |
| Strain penalty | -5 |
| **Final** | **364** |

### Actions and economy

| Metric | Result |
|---|---:|
| Place actions | 42 |
| Upgrade actions | 22 |
| Activate actions | 95 |
| Encounter interaction actions | 32 |
| Paid actions spent | 191/192 |
| Tiles / upgrades / Specials | 42 / 25 / 14 |
| Arrivals completed / Burdens resolved | 16 / 16 |
| Resources produced | 470 |
| Final Warehouse | 48 |
| Strain / active Burdens / failed Arrivals | 1 / 0 / 0 |

The engine used three copies each of Mine Tunnel, Gathering Outpost, Dig Site, Lumber Yard, and Farmstead, almost all upgraded. The most-used individual producer was activated 29 times. No single Golden reward was needed; the build was already online from the core economy.

This matters because it rules out the comforting explanation that 364 was a one-off Golden-card spike. It was a reproducible core-system interaction.

## Unusual high-scoring tactics discovered

### 1. The zero-cost Resource treadmill

Confidence: **Exact + repeated**<br>
Health assessment: **Dominant and grind-prone**

The four main Resource lineages and Dig Sites cost zero to place and zero to upgrade. Their upgraded faces produce five resources. Linked Production activates every immediately adjacent non-Overstrained producer from the same stack at no additional action.

An exact legal cluster of three upgraded Lumber Yards produced:

- 9 Wood;
- 6 Food;
- **15 total resources for one action**.

With Carts Before Sunrise, the same linked activation cost **zero actions**.

There is no round cadence or exhaustion rule on production. A single Farm was activated 42 times in the best three-player game; another high-scoring four-player arm averaged 389.7 resources produced. Across all 1,276 clean main games, 60.9% of paid actions were activations and the mean game generated 153 resources.

Practical current-rules tactic:

1. Use each Steward start as a separate legal anchor.
2. Place a zero-cost producer immediately.
3. Upgrade it immediately for zero resources when the upgraded output is useful.
4. Add the other two copies adjacent to create a 15-resource activation.
5. Activate only when the Warehouse has room; spend into Housing/Arrival costs between activations.
6. Repeat until the expensive Housing supply and useful Specials are exhausted.

Why it is unhealthy: the decision is often “activate the same tile again” rather than re-evaluating the map. It also makes warehouse caps a pacing inconvenience, not an economic constraint, because the group can spend and refill repeatedly in the same round.

### 2. Four-player No Roads Resource Crown

Confidence: **Targeted repeated**<br>
Health assessment: **Legal but likely under-costed Vow**

The targeted no-road arm completed LE-041 in 4 of 7 clean four-player games. The best scored **259** against the Vow target of **190**, with no Travel category present.

That game used Sentinel, Ranger, Warden, and Quartermaster and achieved:

- 35 placed tiles;
- 23 upgrades;
- 11 Specials;
- 194 Population before Renown;
- 401 resources produced;
- all four Steward objectives for +60;
- 16 completed Arrivals and 15 resolved Burdens.

The unexpected route is to replace roads with:

- four Steward starting anchors;
- terrain-legal, zero-cost Resource tiles;
- Ranger reach;
- Housing-to-Housing adjacency chains;
- freely placeable Arrival reward tiles.

Travel is therefore not actually necessary for a large, connected-scoring settlement at four players. If “No Roads Raised” is meant to force a compressed or locally isolated settlement, its condition does not currently measure that intent.

### 3. Solo No Fine Work is a basic-Housing Vow, not a hardship

Confidence: **Targeted repeated**<br>
Health assessment: **Player-count target too low**

All 8 clean solo trials of the no-upgrade/basic-sprawl arm cleared LE-042. Mean score was **80.5** against the target of **60**; the best score was **96** and still left 16 actions unused.

The best build used:

- Knight;
- four basic Cabins, two basic Steddings, one Cottage;
- a basic Farmstead activated 23 times;
- two Specials;
- no upgraded Core tile.

Knight's objective and the strong base Population on unupgraded Housing are enough. The Vow becomes substantially harder above solo, so this is a target-scaling issue rather than a universally weak restriction.

### 4. Burden-top / Arrival-bottom seeding package

Confidence: **Paired**<br>
Health assessment: **Powerful coordinated tactic; partly enabled by endgame scoring**

The best tested package put a Burden on top, a Boon in the middle, and an Arrival on the bottom. Against the package with Boon top, Arrival middle, and Burden bottom, it achieved:

- +29.1 mean score across 33 complete pairs;
- approximate 95% CI +11.1 to +47.0;
- 66.7% win rate;
- -15.5 mean penalty;
- -1.91 mean Strain;
- -0.73 active Burdens at game end.

The effect grew sharply with player count:

| Players | Clean pairs | Mean score delta | Win rate |
|---:|---:|---:|---:|
| 1 | 11 | -7.0 | 45.5% |
| 2 | 9 | +34.3 | 77.8% |
| 3 | 7 | +41.3 | 71.4% |
| 4 | 6 | +73.0 | 83.3% |

This comparison changes all three positions, so the +29.1 is not a pure estimate of “Burden top.” The likely combined causes are:

- early Burdens cost only 2 resources to resolve and have time to be cleared;
- late Burdens cost 6 resources and can land after the economy is committed;
- bottom Arrivals can remain active at game end without failure;
- coordinated multiplayer seeding makes these timings more reliable.

The companion evidence is consistent: Boon-top/Burden-middle/Arrival-bottom beat default by +20.9 points across 41 pairs, while Arrival-top/Burden-bottom did not show a reliable benefit.

### 5. Round-12 Arrival parking

Confidence: **Exact + repeated**<br>
Health assessment: **High-impact endgame loophole**

An exact Round 12 probe compared the same Arrival at two timers and one timer before end-round resolution:

| State before end of Round 12 | End state | Failed penalty | Strain penalty | Final-score difference |
|---|---|---:|---:|---:|
| 2 timers | remains active with 1 | 0 | 0 | +10 |
| 1 timer | expires | -5 | -5 | baseline |

The scoring test suite explicitly asserts that an active Arrival at game end is not failed, so this is an intended implementation of the current rule, not an accidental calculation bug.

It is common enough to matter: 107 of 202 clean paired-seeding games ended with at least one active Arrival, with as many as seven. The two policies that placed Arrivals at the bottom ended with active Arrivals in about 80% of their clean games.

Practical current-rules tactic: in the final rounds, use an Inn, Quartermaster, or timer Boon to keep an Arrival at two or more timers before the Round 12 decrement. Do not complete it unless its Special Tile or Ledger progress is worth more than the saved action/resources.

### 6. Knight + Brewery of Legends: a zero/zero Housing spike

Confidence: **Exact + association**<br>
Health assessment: **Rare but very efficient legal stack**

The exact probe placed a basic Stedding adjacent to Brewery of Legends while Knight's seasonal power was prepared:

- printed base resource cost: 18;
- actual resources paid: 0;
- actions paid: 0;
- score before placement: 15;
- score after placement: 37;
- **marginal score: +22**.

Brewery of Legends had a +18.67 within-cell residual score lift across the main sweep, second only to The Resting Hall. The stack is limited to once per Season and requires the Brewery/adjacency setup, but it can theoretically accelerate three expensive Housing placements during the game.

### 7. Golden Vial Path lattice

Confidence: **Exact**<br>
Health assessment: **Strong latent engine; underplayed by the bot**

Eight connected Improved Paths score:

- 8 printed Renown;
- 32 connected-group passive Renown;
- **40 total Renown**.

Their upgrades cost 16 Stone and eight upgrade actions. The Golden Vial can place one Path for zero actions each round, allowing all eight placements to be free across eight rounds. Vanguard provides additional free Travel timing, although using either effect breaks the no-road Vow.

The broad bot did not exploit this line consistently; Golden Vial had a negative residual association. The exact calculation therefore matters more than the aggregate result. This is a candidate for a human combo test, especially with Workshop/Sentinel upgrade discounts.

### 8. Selective protection and sacrificial infrastructure

Confidence: **Rules-economic + repeated**<br>
Health assessment: **Interesting tactic; blanket Support is under-rewarded**

Every Strain token costs 5 points. At three Strain, a tile also stops contributing its printed and passive score. An ideal Fine Stedding can contribute 20 printed Population, +7 cluster Population, and +5 Travel Renown. Letting it become Overstrained can therefore swing at least **47 points**: 32 lost tile score plus 15 Strain penalty, before considering a broken Housing cluster.

By contrast, a zero-point producer that has already generated its resources loses little beyond the Strain penalty. The rational defense is therefore:

- protect Fine Housing, valuable Specials, and network-critical Travel;
- allow late Strain to land on exhausted or low-score producers where a choice exists;
- avoid spending actions on blanket Support when the protected tile has little future value.

The broad Support-fortress arm averaged only 44.9, versus 124.5 for Resource Crown. This is not a causal comparison, but it confirms that indiscriminate defensive play has poor score conversion.

### 9. Resolve early Burdens; abandon late ones selectively

Confidence: **Rules-economic + seeding evidence**<br>
Health assessment: **Endgame incentive inversion**

Every standard Burden costs one action plus 2/4/6 of one resource to resolve in Seasons I/II/III. An active Burden costs 5 points at final scoring.

For a late Season III Burden with no future season-start trigger:

- resolving costs an action and 6 resources;
- leaving it costs 5 points.

Pure score maximisation therefore says to leave it active unless resolution also:

- completes Warden's +15 objective;
- completes a Burden Ledger entry;
- triggers The Resting Hall to remove 1 Strain, worth 5 more points;
- enables a Special or other effect;
- prevents a still-future trigger.

This explains why “resolve everything immediately” is not the optimal late-game rule, even though front-loading Burdens and resolving them cheaply is strong.

### 10. Prioritise Arrival rewards by utility, not printed 5/5 score

Confidence: **Residual association**<br>
Health assessment: **Content reward skew**

The strongest within-cell Special Tile associations were:

| Special | Games present | Residual score lift |
|---|---:|---:|
| The Resting Hall | 205 | +23.43 |
| Brewery of Legends | 150 | +18.67 |
| Reliquary | 72 | +16.99 |
| Adventurers' Guild | 127 | +15.18 |
| House of Learning | 343 | +13.96 |

Burden-Bearers, the Arrival that unlocks The Resting Hall, had the strongest Arrival association at +21.09. Strong Foundations, which unlocks House of Learning, was next at +12.88.

These lifts are not causal values, but they point to a coherent mechanism: the strongest Specials provide free Burden resolution, free Strain removal, Support, or a major Housing discount. They convert actions twice—first into their own 10 printed points, then into avoided defensive costs.

## Confirmed implementation defects

### QV-AUD-01 — Coin Before Craft no-target softlock

Severity: **Critical**<br>
Confidence: **Exact + observed 49 times**

Season II requires one Merchant and one Crafting target, each adjacent to the other. In a state with no legal pair:

- `effectHasNoValidChoiceTargets(...)` returns `true`;
- `requiresManualChoice` returns `false`;
- an empty acknowledgement `{}` fails `isTileAdjustmentValid(...)`.

The engine therefore simultaneously says there is no choice and refuses the no-choice resolution. This was the root cause in 49 main-sweep games, 72% of all main-sweep failures.

Likely fix:

1. When the engine reports no valid target, permit an empty resolution for a non-fallback rule; or
2. cap `categoryLimits.min` by the number of legal targets in that category; and
3. add tests for zero targets, only Merchant, only Crafting, and a valid adjacent pair.

### QV-AUD-02 — Carts Before Sunrise refresh fan-out

Severity: **High**<br>
Confidence: **Exact**

One Season II Carts modifier with one remaining use was attached to four passive cost options at once:

- two already-used upgraded Workshops;
- two already-used upgraded Markets.

All four options shared the same `boonModifierId`. Selecting them together reduced a 16-resource cost to 10, then consumed the modifier once. The wording permits **a** Crafting or Merchant Passive to apply one additional time, not every eligible passive in the same transaction.

Remediation implemented 15 July 2026:

- options sharing a Carts `boonModifierId` are mutually exclusive and validation rejects a selected count above one;
- direct cost application and passive recording independently ignore fan-out after the first selected option, so bypassing the UI cannot multiply the effect;
- already-used Workshops refreshed by Carts are optional, while genuinely unused Workshop passives remain mandatory;
- the payment UI switches the selected Carts passive when another is chosen and explains the one-passive limit;
- exact regression coverage uses two used Workshops and two used Markets, plus a decline-all case that confirms the modifier remains available.

### QV-AUD-03 — Additional invalid pending-effect states

Severity: **High to triage**<br>
Confidence: **Observed, not yet minimised**

After separating Coin Before Craft, the main sweep still found:

| Failure class | Games |
|---|---:|
| Other invalid suggested tile adjustment | 7 |
| Invalid/stale Strain cascade suggestion | 5 |
| Quartermaster with no legal manual choice | 4 |
| Arrival expiry prompt | 1 |
| Promises Overstretched manual choice | 1 |
| Tools Left to Rust manual choice | 1 |

Some may be audit-bot selection gaps rather than engine defects. They should be reduced to unit states before changing production rules. Their value in this report is as a queue for defensive testing: suggested adjustments appear capable of becoming stale after earlier pending effects change the board.

## Balance and rules vulnerability register

| ID | Severity | Finding | Evidence | Main risk |
|---|---|---|---|---|
| QV-BAL-01 | High | Unlimited zero-cost Linked Production treadmill | Exact + 1,276-game sweep | Repetitive dominant economy and runaway conversion |
| QV-BAL-02 | High | Active Arrivals are safe at game end | Exact + 202-game paired set | 10-point shield per parked Arrival |
| QV-BAL-03 | High | Three- versus four-player score scaling | Repeated | 3p max 269 vs 4p max 364 at same 320 target |
| QV-BAL-04 | High | Vow scaling is inverted by player count | 89 targeted games | No Fine Work trivial solo; No Roads much easier at 4p |
| QV-RULE-01 | High | Small Storehouse impossible at 1p/2p setup | Exact | Vow fails before any player decision |
| QV-BAL-05 | Medium-high | Steward objective parity | 1,276 games | Equal +15 reward for 11–84% overall hit rates |
| QV-BAL-06 | Medium-high | Golden goal parity | 1,043 Golden-tile games | 0–83% observed goal rates for equal +5 |
| QV-BAL-07 | Medium | Season III Burden resolution inversion | Printed economy + paired timing | Correct score play conflicts with “resolve the threat” theme |
| QV-BAL-08 | Medium | Arrival/Special utility concentration | Residual association + exact combo | A few rewards dominate the Arrival market |
| QV-BAL-09 | Medium | Knight + Brewery zero/zero placement | Exact | +22 immediate score without action/resources |
| QV-BAL-10 | Medium | Golden Vial Path lattice | Exact | 40 Renown from free placements + 8 upgrades |

## Player-count and reward parity

### Steward objectives

All objectives award +15, but observed hit rates were:

| Steward | Appearances | Overall hit rate | Notable player-count effect |
|---|---:|---:|---|
| Knight | 565 | 84.4% | 100% solo; 90.9% at 4p |
| Ranger | 449 | 83.7% | 0% solo; 97.3% at 4p |
| Sentinel | 541 | 80.8% | 61.4% solo; 82–85% above solo |
| Quartermaster | 560 | 33.2% | 54.2% solo; 27.6% at 4p |
| Warden | 484 | 12.4% | 30.2% solo; 7.9–16.2% otherwise |
| Vanguard | 523 | 11.1% | 15.5% solo; 9.0% at 4p |

The Quartermaster's final objective is already numerically satisfied at setup in one-, two-, and three-player games because each starts with at least 5 of all six resource types. It can still be lost through spending, so it is not free Renown, but its gameplay is “preserve an opening condition” at those counts and “build the condition” at four players.

Ranger is the reverse: the solo bot never met the three-terrain objective, while nearly every four-player Ranger lineup did. These should not have identical target text and reward at every count without a deliberate reason.

### Golden Tile goals

Observed Golden Renown rates by selected Golden Tile were:

| Golden Tile | Games | Goal hits | Hit rate |
|---|---:|---:|---:|
| Golden Cairn | 41 | 34 | 82.9% |
| Golden Garden | 40 | 26 | 65.0% |
| Golden River Gate | 154 | 10 | 6.5% |
| Golden Charter | 685 | 7 | 1.0% |
| Golden Hearth | 123 | 0 | 0.0% |

The bot may underplay some bespoke geometry, so these are not human completion probabilities. A spread from 0% to 83%, however, is large enough to justify a targeted manual review. The flat +5 reward makes the easy goals nearly automatic value and the hard goals strategically irrelevant.

## Vow findings

### No Roads Raised

The broad no-road arm succeeded in 15.5% of 58 complete games. The focused Resource Crown hybrid succeeded in 4 of 30 overall—all four at four players, or 4 of 7 clean four-player trials.

Recommendation: either raise the four-player target, or make the restriction measure the intended logistics. Examples:

- require all non-Overstrained tiles to be in at most one/two connected settlement components;
- prohibit temporary reach from founding disconnected districts while this Vow is active;
- require Resource Linked Production to be connected to Travel for full output;
- score the Vow from compactness or maximum distance rather than the mere absence of a category.

### No Fine Work

The focused basic-sprawl hybrid succeeded in all 8 solo games and none of its 22 clean multiplayer games. This is the clearest Vow scaling inversion in the audit.

Recommendation: raise the solo threshold from 60, reduce multiplayer thresholds, or add a second restriction such as “no upgraded Core tiles and at most N Specials.” The correct value needs human data, but the current target curve is directionally wrong for the tested bot.

### The Small Storehouse

The throughput loophole hypothesis was falsified. Once the audit harness preserved the engine's actual peak tracking, all 29 complete micro-batch attempts were correctly marked as violations. Spend-then-produce timing does not bypass the Vow.

The real issue is setup legality:

| Players | Starting amount per type | Vow cap | State before first action |
|---:|---:|---:|---|
| 1 | 15 | 8 | already violated |
| 2 | 10 | 8 | already violated |
| 3 | 5 | 8 | legal |
| 4 | 0 | 8 | legal |

Recommendation: explicitly label the Vow “3–4 players only,” or change setup when it is declared so each type begins at `min(normal start, 8)`. The first option is cleaner if the Vow is intentionally a once-per-campaign challenge rather than a by-player-count achievement.

## Design interventions, in priority order

### Priority 0 — eliminate hard locks

1. Fix Coin Before Craft's no-target acknowledgement.
2. Add property tests asserting every queued effect has at least one resolvable legal outcome.
3. Add a test that repeatedly drains randomly generated pending-effect queues after board mutations.
4. Reduce the remaining 19 non-Coin failures to minimal engine states before the next balance pass.

Balance tests are much easier to trust after every legal game can finish.

### Priority 1 — close the two clearest action-economy leaks

1. Restrict one Carts passive refresh to one passive. **Implemented and exact-regression tested.**
2. Add a production cadence.

Three production variants worth prototyping:

- **Exhaustion:** every producer that produces becomes exhausted until next round. Cleanest rule, strongest cap.
- **Diminishing linked output (selected and implemented):** the first linked activation each round produces the whole group; later activations produce only the chosen tile.
- **Infrastructure requirement:** Linked Production only chains through a connected Travel/logistics network. This also repairs the no-road Vow's thematic weakness.

Do not select a production nerf from theory alone. Rerun the same 1,344 seeds after each variant and compare resource production, unused actions, Housing completion, and penalty load. The current game may depend on abundant production to pay Encounter costs; a hard once-per-round cap could overcorrect.

### Priority 2 — make endgame commitments score consistently

Choose one Arrival rule:

- count every active Arrival at game end as failed and apply the normal penalty/Strain;
- **apply a separate “unfulfilled promise” penalty of 5 without Strain (selected and implemented);**
- expire all active Arrivals after Round 12 before final scoring;
- award partial credit only if a visible final requirement was met.

The first option is the most internally consistent. The second is gentler and avoids a final cascade of Strain prompts.

For Burdens, align the final penalty with the Season III resolution price. Possible approaches:

- change resolution costs from 2/4/6 to 2/3/4;
- scale active-Burden penalty by reveal Season, e.g. 3/5/7;
- grant +2 Renown or another benefit for resolving a Burden in the same round;
- make every active Season III Burden trigger once at final scoring before its penalty.

### Priority 3 — retune player-count curves

The first candidates for human validation are:

- lower three-player LE-001 or raise four-player LE-001;
- raise solo No Fine Work;
- raise four-player No Roads or strengthen its logistical restriction;
- mark Small Storehouse as 3–4 player only;
- scale Steward objectives by count.

A provisional—not final—test band would be LE-001 around 270–290 for three players or 360–380 for four players. Those numbers are anchored to the observed maxima, not a recommendation to publish without human playtests.

### Priority 4 — normalise reward difficulty

For Steward objectives and Golden goals, either:

- target a common completion band and retain flat rewards; or
- preserve different difficulty tiers and pay 5/10/15 or similar rewards.

For Special Tiles, review utility plus printed score together. The Resting Hall, Brewery, Reliquary, Adventurers' Guild, and House of Learning all provide their own 10 printed points and can also erase substantial action/penalty costs. A small placement cost, lower printed score, or more limited cadence may be appropriate for the strongest rewards.

## New mechanics and content ideas suggested by the audit

### Harvest rhythm

Give Resource groups a satisfying build-and-release cycle instead of unlimited repetition:

- place an “abundance” marker after a full Linked Production;
- the group cannot link again until the marker is cleared at round end;
- specific Boons, Merchants, or Seasons can clear it early.

This preserves the joy of a 15-resource harvest while removing the 42-click treadmill.

### Promise debt

Every active Arrival at game end could add a “Promise” mark to the Chronicle or cost 5 Renown. Completing one on exactly one timer could remove a prior Promise mark. This turns the current exploit into a campaign story rather than a silent escape.

### Burden foresight

Reward revealing and resolving a Burden early:

- resolve it in its reveal round to gain one Hope;
- spend Hope on Support, timer extension, or Golden goals;
- unresolved Season III Burdens consume Hope or escalate at final scoring.

This reinforces the paired result without making “seed every Burden first” an automatic score line.

### Logistics-dependent production

Full Linked Production could require one of:

- adjacency to Travel;
- connection to a Merchant;
- a Steward occupying the district;
- a once-per-round Logistics action.

This makes roads economically meaningful and gives No Roads Raised a real cost.

### Vale Projects as resource sinks

The high-score engine produces hundreds of resources but mostly converts them into the same Housing supply. Add escalating shared projects—for example a bridge restoration, hospital, archive, or festival—that consume mixed sets and create strategic forks. This makes surplus composition matter and reduces repeated producer-to-Housing conversion.

### Golden challenge tiers

Let each Golden Tile offer Bronze/Silver/Gold conditions worth 2/5/8 Renown. Easy goals such as Cairn can have a demanding Gold tier; difficult geometry such as Hearth can still pay partial credit. This reduces the observed 0% versus 83% all-or-nothing spread.

### District resilience rather than blanket Support

Reward Supported variety or connected protected districts, while limiting how many low-value producer tiles can be sacrificial sinks. Examples:

- one Renown per protected category;
- a district bonus if Housing, Wellbeing, and production are all Supported;
- Strain spreads from an Overstrained producer unless a nearby Wellbeing tile contains it.

## Recommended next simulation matrix

After fixes, rerun the same deterministic seeds so changes are paired. Suggested order:

1. Coin/Carts hotfix regression: all 1,344 broad seeds. **Coin and the selected production/scoring changes passed the expanded 1,536-game sweep; the final Carts release replay reached 576/576 clean completed games before publication.**
2. Arrival-finalisation A/B: current rule versus active-as-failed.
3. Production A/B/C: current, exhaustion, diminishing linked output, logistics requirement.
4. Score thresholds: current versus candidate 3p/4p values.
5. Objective/Golden pass: target an observed 30–60% completion band for goal-focused bots.
6. Human-like pass: near-best choices, imperfect memory, and no central coordination.
7. Two expert manual games for each exact combo: Carts fan-out replacement, Knight/Brewery, Golden Vial Paths, and no-road four-anchor expansion.

Primary metrics to compare:

- final score and score variance;
- actions by type;
- maximum activations of one tile;
- resources produced and left unused;
- time/decision count per round;
- active Arrivals/Burdens at game end;
- objective and Golden goal completion;
- number of distinct scoring modules used by the top decile.

The key health target should be: **top scores can remain exciting, but the top decile should reach them through several distinct engines rather than one repeated activation loop.**

## Findings that were tested and rejected or qualified

- **Small Storehouse micro-batching does not bypass peak tracking.** All 29 complete focused attempts violated the Vow. The setup incompatibility is the real issue.
- **The double Stables reward is not a duplication bug.** The Arrival lists two Stables rewards and supply supports two instances.
- **The 364 result is not an upper bound.** The bot is greedy and bounded. A wider solo replay changed the score from 158 to 136 because expanding the candidate set changed the heuristic choice path; wider search is not monotonic without minimax/beam retention.
- **The production pattern is robust even when the record score is not.** The narrow replay of the 364 seed scored 245, but still spent 112 actions activating producers and generated 368 resources. The engine persists under changed search limits.
- **Golden Vial's aggregate association is not proof it is weak.** The exact eight-Path calculation shows a latent 40-Renown line that the bot did not reliably pursue.
- **Tile and card lifts are associations.** They were residualised within strategy, player count, and unlock tier, but presence can still proxy for a successful prior Arrival or a larger settlement.

## Limitations

1. The agents are deterministic heuristic players, not optimal solvers and not substitutes for expert human play.
2. The broad placement search is bounded. High-scoring records are lower bounds on discoverable play, not mathematical maxima.
3. The paired seeding comparison changes the full three-card order. Its score delta belongs to the whole package, not solely the top card.
4. Only pairs where both games completed were analysed. Coin Before Craft failures may not be missing at random.
5. The Golden Signet/deck-reorder behavior is underplayed by the current bot, so its aggregate value is likely understated.
6. Strategy-arm averages should not be read as causal treatment effects. Arms intentionally pursue different Ledger goals.
7. Four-player simulations are computationally expensive, which constrained the wider-search replay count.
8. This report audits the current online prototype rules and implementation, not physical-table execution friction or social negotiation.

## Reproduction artifacts

Human-readable summaries:

- `outputs/adversarial-audit/analysis.md`
- `outputs/adversarial-audit/priority-1-2/analysis.md`
- `outputs/adversarial-audit/seeding/analysis.md`
- `outputs/adversarial-audit/hybrids-v2/analysis.md`

Machine-readable evidence:

- `outputs/adversarial-audit/analysis.json`
- `outputs/adversarial-audit/priority-1-2/analysis.json`
- `outputs/adversarial-audit/priority-1-2/combined.json`
- `outputs/adversarial-audit/priority-all-four/shard-3.json`, `shard-4.json`, and `shard-7.json`
- `outputs/adversarial-audit/seeding/analysis.json`
- `outputs/adversarial-audit/hybrids-v2/analysis.json`
- `outputs/adversarial-audit/focused-rules-probes.json`
- `outputs/adversarial-audit/replays/top1-baseline.json`
- `outputs/adversarial-audit/replays/top1-wide.json`
- `outputs/adversarial-audit/replays/top4-narrow.json`

Audit programs:

- `tools/playtest-bot/adversarial-audit.ts`
- `tools/playtest-bot/analyse-adversarial-audit.ts`
- `tools/playtest-bot/seeding-timing-audit.ts`
- `tools/playtest-bot/analyse-seeding-timing.ts`
- `tools/playtest-bot/focused-rules-probes.ts`

## Final prioritised recommendation

All four recommended changes are now implemented and verified in the working release:

1. Coin Before Craft degrades mandatory category targets to the legal board state so every legal game can resolve;
2. Carts allows one modifier to refresh exactly one chosen passive;
3. active Arrivals score as 5-Renown Unfulfilled Promises without Strain;
4. Diminishing Linked Production gives the whole eligible group its first linked activation each round and only the chosen tile thereafter; the paired seed set and expanded 1,536-game adversarial matrix were rerun, followed by 576 clean final-release games including the Carts fix.

These changes close the confirmed hard lock and Carts implementation exploit, halve the largest endgame score shield, and remove repeated linked-group multiplication. Player-count thresholds, Vows, Steward objectives, Golden goals, Special Tile parity, and the still-legal single-producer grind are the next balance layer.
