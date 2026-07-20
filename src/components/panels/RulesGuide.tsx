import { useState } from "react";

type RulesView = "howTo" | "gameRules";

interface RuleReferenceCard {
  category: string;
  title: string;
  summary?: string;
  bullets: string[];
  note?: string;
}

export interface RulesGuideStatus {
  actionsRemaining: number;
  round: number;
  season: number;
}

interface RulesGuideProps {
  gameStatus?: RulesGuideStatus;
}

const rules: RuleReferenceCard[] = [
  {
    category: "Overview",
    title: "The aim of the game",
    summary:
      "Build one settlement together and finish with the highest shared score you can.",
    bullets: [
      "All players use the same map, the same Warehouse, and one final score.",
      "Play 12 rounds: Season I is rounds 1–4, Season II is 5–8, and Season III is 9–12.",
      "When an Encounter shows different effects or costs by Season, use the line for the current Season.",
      "After round 12 ends, add Population and Renown, then apply bonuses and penalties."
    ]
  },
  {
    category: "Getting started",
    title: "Choose Stewards and place starts",
    bullets: [
      "Choose a different Steward for each player. Each Steward has a Power and an objective worth +15 Renown.",
      "Start with 15 of each resource for 1 player, 10 for 2 players, 5 for 3 players, or 0 for 4 players.",
      "Place each Steward Token on a terrain type listed on that Steward’s card. Two Stewards cannot share a hex.",
      "Each Steward’s first tile must cover their own starting hex."
    ],
    note:
      "Ledger Vows and unlocked Golden options are optional. If any effect takes an action forbidden by your declared Vow, the Vow is broken."
  },
  {
    category: "Round structure",
    title: "Season setup and round flow",
    bullets: [
      "A new Season begins before rounds 1, 5, and 9.",
      "At a Season start, resolve every active Burden’s Season effect before seeding cards.",
      "Each player then chooses three cards from their hidden hand: one for the top, one for the middle, and one for the bottom of the deck.",
      "At the start of each round, reveal 1 standard Encounter per player and resolve every reveal prompt in order.",
      "Starting with Player 1, each player takes one turn with up to 4 actions. A player may end their turn early.",
      "After all turns, remove 1 timer from every active Arrival, resolve any Arrival that expires, and advance the round.",
      "At the end of Seasons I and II, each Housing cluster gains 1 single-use Supported for every 3 non-Overstrained Housing Tiles in that cluster. Place each Supported on a different eligible Tile.",
      "Ignore Overstrained Housing when determining clusters and cluster size. Resolve Neighbourly Support before active Burdens reapply for the new Season."
    ]
  },
  {
    category: "Your turn",
    title: "Actions and free interactions",
    bullets: [
      "Place — Spend 1 action to place an available tile legally. Pay the shown cost for a Core Tile; unlocked Special Tiles cost no resources to place.",
      "Upgrade — Spend 1 action and pay the upgraded cost of a reachable basic Core Tile.",
      "Activate — Spend 1 action to use an eligible, reachable tile’s production or activated effect.",
      "Interact — Spend 1 action and pay the shown cost to complete an Arrival or resolve a Burden.",
      "Linked Production — The first time a linked Resource group is activated each round, the chosen tile and every immediately adjacent, non-Overstrained copy from the same tile stack produce for no extra action. Later activations in that group produce only from the chosen tile.",
      "Face-up Boons, movement through Stables, and Steward Powers cost no actions unless their text says otherwise."
    ],
    note:
      "A 0-action benefit saves the action only. Pay the normal resource cost unless the effect also changes it. Cancelling a payment spends nothing."
  },
  {
    category: "Settlement",
    title: "Placement, reach, and movement",
    bullets: [
      "Your first tile must cover your Steward’s starting hex.",
      "After that, each new tile must sit next to your Steward’s reachable settlement network.",
      "Reach starts at the non-Overstrained tile beneath your Steward and continues through adjacent, non-Overstrained tiles.",
      "Placing, upgrading, or activating a tile moves your Steward to that tile.",
      "Street and Track occupy a straight line of hexes. Stables use two separate legal hexes in one placement.",
      "The map highlights legal choices. A disabled choice explains what is missing."
    ],
    note:
      "Docks can extend reach to placed tiles beside Water. The Ranger Power gives one temporary point of reach for the current turn."
  },
  {
    category: "Settlement",
    title: "Strain, Overstrained, and Supported",
    bullets: [
      "A tile can hold up to 3 Strain. A tile with 3 Strain is Overstrained.",
      "An Overstrained tile cannot activate or upgrade. It also breaks reach and scores no Population, Renown, or passive bonuses.",
      "When a tile has Supported, it prevents the next 1 Strain placed on it that round.",
      "One-use Supported disappears after it blocks Strain. Printed or passive Supported can protect the tile again in a later round.",
      "When an effect places Strain, its text determines the eligible tiles and the Target Deck chooses among them.",
      "Draw one Target Card for each different target. Apply its class, side, adjacency, and current-Strain preferences in order whenever at least one candidate matches, then use its arrow to break a remaining tie.",
      "Shuffle the 24-card Target Deck once during setup. Return each resolved card face down to the bottom; do not discard or reshuffle during play.",
      "Resolve Supported and other prevention after the target is chosen. Prevented Strain is not redirected.",
      "After an effect ends, each tile that became Overstrained spreads 1 Strain to an adjacent eligible tile selected by the Target Deck. Continue until no new tile becomes Overstrained."
    ],
    note:
      "Example: tile A reaches 3 Strain and spreads to tile B. If B reaches 3, B also spreads. A can spread again only after dropping below 3 and later returning to 3."
  },
  {
    category: "Encounters",
    title: "Boons, Arrivals, and Burdens",
    bullets: [
      "Boons help the settlement. Some resolve at once; others stay face-up and show their remaining uses on the Stewards Board.",
      "A Carts Before Sunrise passive refresh applies to at most one chosen eligible Crafting or Merchant passive. If you decline every refreshed passive, the prepared Carts use remains available.",
      "An Arrival enters with 3 timers. Spend 1 action and pay its requirement to complete it and unlock the named Special Tile.",
      "At the end of each round, every active Arrival loses 1 timer.",
      "An Arrival that reaches 0 is discarded, places 1 Strain on an eligible tile, and counts as failed.",
      "An Arrival with at least 1 timer left when the game ends is an Unfulfilled Promise: lose 5 Renown, but place no Strain for it.",
      "A Burden applies its reveal effect, stays active, and applies its Season effect again at the start of each later Season.",
      "Spend 1 action and pay the current Season’s cost to resolve and discard an active Burden."
    ]
  },
  {
    category: "Stewards",
    title: "Powers and objectives",
    bullets: [
      "A Steward Power normally costs no action and can be used once per Season.",
      "Vanguard, Knight, and Sentinel prepare a benefit for the next matching placement or upgrade. Use the Power before starting that action.",
      "Ranger gives temporary reach for the current turn. Quartermaster exchanges shared resources and can help an Arrival.",
      "Warden is offered when a Burden is revealed. Stopping the reveal effect does not remove the Burden.",
      "Each completed Steward objective adds +15 Renown at the end of the game."
    ]
  },
  {
    category: "Payments",
    title: "The shared Warehouse",
    bullets: [
      "All players gain and spend the same six shared resources.",
      "Each resource has a maximum of 15. Any gain above 15 is lost.",
      "If a Boon or tile can change a payment, choose those options before confirming.",
      "Prepared Effects on the Stewards Board show discounts, 0-action benefits, and remaining uses.",
      "Cancelling a payment spends no resources and no actions."
    ]
  },
  {
    category: "Golden Legacy",
    title: "Golden Tiles and Boons",
    bullets: [
      "Ledger milestones unlock Golden Tiles and Golden Boons for later games.",
      "During setup, you may choose one unlocked Golden Tile, one unlocked Golden Boon, both, or neither.",
      "Place the Golden Tile after placing Steward Tokens. This costs no action, but you must follow its placement rule.",
      "The Golden Boon is shuffled into the Encounter Deck and is never dealt to a player’s hand.",
      "When a Golden Boon is drawn, it does not count as the round’s standard Encounter, so another standard Encounter is also revealed.",
      "A placed Golden Tile adds +5 Renown if you meet its scoring condition."
    ]
  },
  {
    category: "Steward’s Ledger",
    title: "Achievements, Vows, and unlocks",
    bullets: [
      "Ledger Entries are achievements saved between games. They are awarded when you record a completed game.",
      "Each named entry advances Golden unlocks only once.",
      "Entries marked by player count also track separate 1P–4P prestige ticks. Extra ticks do not advance Golden milestones.",
      "A locked entry cannot be earned until you complete the number of named entries shown on it.",
      "Declare a Vow before setup. You may attempt only one Vow per game.",
      "Golden Tiles and Golden Boons unlock after 5, 12, 18, 25, and 32 named entries."
    ],
    note: "Open Ledger → Chronicles to read every requirement and see live progress."
  },
  {
    category: "End game",
    title: "Final scoring",
    bullets: [
      "Add Population and Renown from every tile that is not Overstrained, including any passive bonuses.",
      "Add +15 Renown for each Steward objective achieved.",
      "Add +5 Renown for each placed Golden Tile whose condition is achieved.",
      "Lose 5 Renown for each failed Arrival, each active Burden, and every Strain token on the map.",
      "Your final score is Population plus Renown after all bonuses and penalties."
    ],
    note: "The End screen shows the full calculation before you record the game."
  }
];

export function RulesGuide({ gameStatus }: RulesGuideProps) {
  const [rulesView, setRulesView] = useState<RulesView>("howTo");

  return (
    <div className="rules-guide">
      <section
        className="rules-quick-start"
        aria-label={gameStatus ? "Current game and quick start" : "Game overview"}
      >
        <div>
          <p className="eyebrow">{gameStatus ? "Playtester Guide" : "Learn to Play"}</p>
          <strong>Build together. Share resources. Keep Strain under control.</strong>
        </div>
        <div
          className="rules-status-row"
          aria-label={gameStatus ? "Current game status" : "Game facts"}
        >
          {gameStatus ? (
            <>
              <span>Season {gameStatus.season}</span>
              <span>Round {gameStatus.round}/12</span>
              <span>{gameStatus.actionsRemaining} actions left</span>
            </>
          ) : (
            <>
              <span>1–4 players</span>
              <span>Cooperative</span>
              <span>12 rounds</span>
            </>
          )}
        </div>
      </section>

      <nav className="rules-view-tabs" aria-label="Guide sections" role="tablist">
        <button
          aria-controls="rules-how-to-panel"
          aria-selected={rulesView === "howTo"}
          className={rulesView === "howTo" ? "selected" : ""}
          id="rules-how-to-tab"
          onClick={() => setRulesView("howTo")}
          role="tab"
          type="button"
        >
          How to play
        </button>
        <button
          aria-controls="rules-game-rules-panel"
          aria-selected={rulesView === "gameRules"}
          className={rulesView === "gameRules" ? "selected" : ""}
          id="rules-game-rules-tab"
          onClick={() => setRulesView("gameRules")}
          role="tab"
          type="button"
        >
          Full rules
        </button>
      </nav>

      {rulesView === "howTo" && (
        <div
          aria-labelledby="rules-how-to-tab"
          className="how-to-guide"
          id="rules-how-to-panel"
          role="tabpanel"
        >
          <section className="how-to-flow" aria-labelledby="first-game-flow-title">
            <div>
              <p className="eyebrow">The whole game at a glance</p>
              <strong id="first-game-flow-title">Play 12 rounds across three Seasons</strong>
            </div>
            <ol>
              <li>Season start: Burdens, then seed</li>
              <li>Reveal Encounters</li>
              <li>Resolve prompts</li>
              <li>Take 4-action turns</li>
              <li>Tick Arrival timers</li>
            </ol>
          </section>

          <div className="how-to-grid">
            <article className="mini-card how-to-card">
              <span className="how-to-step-number">1</span>
              <div>
                <strong>Set up together</strong>
                <p>
                  Choose a different Steward for each player and place their Tokens on allowed terrain.
                  Everyone uses the same map and Warehouse. Each Steward’s first tile must cover their
                  own starting hex.
                </p>
              </div>
            </article>

            <article className="mini-card how-to-card">
              <span className="how-to-step-number">2</span>
              <div>
                <strong>Seed, then reveal</strong>
                <p>
                  Before rounds 1, 5, and 9, each player seeds one card at the top, middle, and bottom
                  of the deck. Every round reveals one standard Encounter per player. Resolve all
                  prompts before turns begin.
                </p>
              </div>
            </article>

            <article className="mini-card how-to-card">
              <span className="how-to-step-number">3</span>
              <div>
                <strong>Spend up to 4 actions</strong>
                <p>
                  On your turn, Place, Upgrade, Activate, or Interact. Choose an action, follow the
                  highlighted legal choices, check the cost, and confirm. Steward Powers and some
                  effects cost no actions.
                </p>
              </div>
            </article>

            <article className="mini-card how-to-card">
              <span className="how-to-step-number">4</span>
              <div>
                <strong>Follow your Steward</strong>
                <p>
                  After the first tile, place new tiles next to that Steward’s reachable network.
                  Placing, upgrading, or activating moves the Steward to the chosen tile and changes
                  where they can reach next.
                </p>
              </div>
            </article>

            <article className="mini-card how-to-card">
              <span className="how-to-step-number">5</span>
              <div>
                <strong>Manage Encounters and Strain</strong>
                <p>
                  Use Boons, complete timed Arrivals, and resolve active Burdens. Keep each tile below
                  3 Strain: an Overstrained tile stops working and scoring, and can break your reach.
                </p>
              </div>
            </article>

            <article className="mini-card how-to-card">
              <span className="how-to-step-number">6</span>
              <div>
                <strong>Score after round 12</strong>
                <p>
                  Add Population and Renown, including Steward objective and Golden Tile bonuses.
                  Failed Arrivals, Unfulfilled Promises, active Burdens, and every Strain token reduce the shared score.
                </p>
              </div>
            </article>
          </div>

          <section className="first-turn-example" aria-labelledby="first-turn-example-title">
            <div>
              <p className="eyebrow">Example first turn</p>
              <strong id="first-turn-example-title">Start your reachable network</strong>
            </div>
            <ol>
              <li>Place a legal tile over your Steward’s starting hex. Pay its cost.</li>
              <li>Your Steward moves onto that tile, which starts their reachable network.</li>
              <li>Use later actions to build beside it, activate production, upgrade, or answer an Encounter.</li>
              <li>Check the shared Warehouse before paying, and end your turn early if you wish.</li>
            </ol>
          </section>

          <aside className="how-to-help-note">
            <strong>Using the app:</strong>
            <span>
              Resolve any open prompt before continuing. Disabled choices explain what is missing.
              Street and Track need a starting hex and direction; Stables need two legal hexes. On
              desktop, right-click a hex for quick actions. On touch screens, press and hold a hex or
              use the action buttons. During play, progress saves automatically in this browser and
              the top-right buttons undo or redo recent steps.
            </span>
          </aside>
        </div>
      )}

      {rulesView === "gameRules" && (
        <div
          aria-labelledby="rules-game-rules-tab"
          className="rules-grid"
          id="rules-game-rules-panel"
          role="tabpanel"
        >
          {rules.map((rule) => (
            <article className="mini-card rule-reference-card" key={rule.title}>
              <span className="rule-category">{rule.category}</span>
              <strong>{rule.title}</strong>
              {rule.summary && <p className="rule-summary">{rule.summary}</p>}
              <ul>
                {rule.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
              {rule.note && <small className="rule-note">{rule.note}</small>}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
