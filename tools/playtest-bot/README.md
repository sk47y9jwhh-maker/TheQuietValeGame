# Quiet Vale playtest bot

The bot completes full games through the same setup, seeding, reveal, turn,
encounter, tile, Golden-content, scoring, and Steward's Ledger engine used by
the prototype. Runs are deterministic for a fixed seed.

## Run a campaign

```sh
npm run bot -- --players 1 --profile human --games 8 --seed pacing-check
```

The default report is written to `outputs/playtest-bot/latest.json`. Use
`--output <path>` to choose another location.

## Profiles

- `human` (default): reads the available Encounter hand, seeds around readiness
  and risk, creates a shared Season Plan, and values economy, engine setup,
  protection, card lifecycle, Housing conversion, and short follow-up sequences.
  It deliberately pursues one Ledger target so the simulated settlement remains
  comparable to a thoughtful player game.
- `casual`: plays for a viable settlement without selecting Ledger targets.
- `guided`: pursues up to two compatible Ledger goals while preserving general
  settlement quality.
- `chaser`: pursues up to three compatible goals, including available Vows,
  and accepts larger score trade-offs.

## Decision model

The bot:

- creates a deterministic Season thesis from cards it can actually see and
  treats seeded positions as forecast windows rather than perfect deck knowledge;
- reserves Burdens across Seasons for Burden-dependent Ledger plans instead of
  spending the whole available Burden set in Season I;
- forecasts resource demand and decides whether Travel, Crafting, Merchant,
  support, and Housing infrastructure will repay itself;
- selects only currently eligible Ledger goals;
- rejects mutually incompatible goals and multiple Vows;
- rotates required Stewards and uses their powers;
- scores legal placements by production, cost, population, Renown, category
  deficits, Housing/Travel connectivity, district adjacency, ring potential,
  river objectives, and Golden adjacency;
- completes Arrivals and resolves Burdens according to its active goals;
- uses Boons, passive cost reductions, upgrades, production, Special Tiles,
  Golden Tiles, and Golden Boons;
- enters the same Workshop/Market cost-choice flow as a player, including
  choosing discounts against the resource that is actually short;
- resolves current manual effect, timer, resource exchange, Supported, Strain,
  movement, Burden, deck reorder, and cost-choice prompts;
- records the completed game through the live Ledger evaluator.

The human profile also compares the best current actions across placement,
upgrade, activation, Arrival, Burden, Boon, and Steward power choices. It adds
a small synergy lookahead (for example Resource → activation or support →
Housing) without the battery cost of a broad game-tree search.

The JSON report includes Season Plans, action reasons and rejected alternatives,
engine timing/use metrics, action counts, score components, per-tile final-board
contributions and activations, Encounter exposure/outcomes, board condition,
targets attempted and achieved, newly completed entries, Golden/Vow choices,
and any simulation errors.

Each human-profile Season Plan records the hidden-hand summary, the explicit
top/middle/bottom seed for every player, expected threats and opportunities,
resource needs and their drivers, intended tile foundation, opening-line
rationale, and seven concise readable log lines. Resource actions name a
specific planned upgrade, seeded Arrival, Burden payment, Housing cluster, or
final-score tile; `RESOURCE_FLOATING_NO_SPEND_TARGET` marks production that has
no concrete use and is especially penalised late in the game.

Rounds 10–12 widen through a value-ranked fallback set before ending: affordable
score placement, scoring upgrade, Burden clearance, Strain relief/prevention,
Arrival completion, unlocked Special placement, then production for a named
finishable spend. Reports count no-action rounds from actions actually spent
(free Boons and powers do not mask an idle round) and include engine timing,
produced and unspent resources, seeded-card exploitation, and unlocked Special
placement.

## Analyse a strength study

```sh
node_modules/.bin/vite-node tools/playtest-bot/analyse-strength.ts \
  outputs/playtest-bot/human-study \
  outputs/playtest-bot/human-strength-analysis
```

The analyser matches comparisons by player count and campaign game number,
reports record hit rates, and separates a tile's direct end-board contribution
from its wider association with reaching each record threshold.

## Boundaries

This is a deterministic heuristic player, not a solver. It scores a broad set
of legal alternatives each action but does not search the complete game tree.
It is suitable for regression, rules coverage, balance screening, and campaign
pacing. Human playtests remain the authority for enjoyment and usability.
