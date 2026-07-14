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
      "Work together to build one settlement, then turn its Population and Renown into the highest shared score you can.",
    bullets: [
      "All Stewards build on the same map and use the same Warehouse; there are no individual scores or private resources.",
      "Play 12 rounds: Season I is rounds 1–4, Season II is 5–8, and Season III is 9–12.",
      "Encounter effects and Burden resolution costs use the line for the current Season.",
      "Final scoring happens after every Steward has taken their turn in round 12."
    ]
  },
  {
    category: "Getting started",
    title: "Choose Stewards and place starts",
    bullets: [
      "Choose one unique Steward per player. Their Power gives a once-per-Season advantage and their objective can score +15 Renown.",
      "The Warehouse begins with 15 of each resource at 1P, 10 at 2P, 5 at 3P, or 0 at 4P; each resource is capped at 15.",
      "Place each Steward Token on one of the terrain types shown on their card. Players cannot share a starting hex.",
      "Your first placed tile must cover your own Steward Token’s starting hex; after that, build outward from your reachable network."
    ],
    note:
      "A Steward’s Ledger Vow and unlocked Golden options are optional. A declared Vow can be broken by any effect that performs its forbidden action."
  },
  {
    category: "Round structure",
    title: "Season setup and round flow",
    bullets: [
      "At the start of each Season, first resolve the prompts from every active Burden.",
      "Then each player secretly seeds one Encounter at the top, one in the middle, and one at the bottom of the deck from their hidden hand.",
      "At the start of every round, reveal 1 standard Encounter per player and resolve all reveal prompts in order.",
      "Starting with Player 1, every Steward takes one turn with up to 4 actions. A player may end their turn early.",
      "After all turns, reduce every active Arrival timer by 1, resolve any expiry, then advance the round."
    ],
    note: "Season seeding happens before rounds 1, 5, and 9."
  },
  {
    category: "Your turn",
    title: "Actions and free interactions",
    bullets: [
      "Place: normally spend 1 action to place an available tile legally. Core Tiles also cost the resources shown; unlocked Special Tiles have no resource cost.",
      "Upgrade: spend 1 action and pay the upgraded cost of a reachable, basic Core Tile.",
      "Activate: spend 1 action to use a reachable tile’s production or activated effect, provided it is eligible and not Overstrained.",
      "Interact: spend 1 action to complete an Arrival or resolve a Burden, then pay the displayed requirement.",
      "Linked Production: activating a Resource producer also activates every immediately adjacent, non-Overstrained producer from the same tile stack for no extra action, up to all three copies.",
      "Using a face-up Boon, moving through Stables, and using a Steward Power cost 0 actions unless their text says otherwise."
    ],
    note:
      "Prepared effects can reduce an action or resource cost. Review the confirmation before paying—the game does not spend anything if you cancel."
  },
  {
    category: "Settlement",
    title: "Placement, reach, and movement",
    bullets: [
      "A legal placement needs an empty footprint, the tile’s required terrain and adjacency, enough supply and resources, and a connection to the current Steward’s reachable network.",
      "Your reachable network starts at the non-Overstrained tile beneath your Steward and continues through adjacent, non-Overstrained tiles.",
      "Placing a tile moves your Steward onto it. Upgrading or activating a tile moves your Steward to that tile.",
      "Street and Track use one straight multi-hex footprint. Stables place two separate legal hexes as one tile action.",
      "The map highlights legal choices; a disabled choice states which requirement is missing."
    ],
    note:
      "Docks can connect a reachable network to other tiles beside Water. The Ranger Power can provide a temporary point of reach for the current turn."
  },
  {
    category: "Settlement",
    title: "Strain, Overstrained, and Supported",
    bullets: [
      "A tile can hold up to 3 Strain. At 3 Strain it is Overstrained.",
      "An Overstrained tile cannot be activated or upgraded, breaks reachable connections, and contributes no Population, Renown, or passive scoring.",
      "Supported prevents the first Strain that would be placed on that tile during the round.",
      "Single-use Supported is then spent. Printed or passive Supported can protect the tile again in a later round.",
      "After an effect finishes, each tile that became Overstrained spreads 1 Strain to one adjacent placed tile below 3 Strain, if possible.",
      "Players choose each spread target. If that target becomes Overstrained, it spreads next; continue until no newly Overstrained tile can spread."
    ],
    note:
      "Apply prevention before checking for a new Overstrained tile. A tile that was already Overstrained spreads again only if it first drops below 3, then later reaches 3 again."
  },
  {
    category: "Encounters",
    title: "Boons, Arrivals, and Burdens",
    bullets: [
      "Boons help the settlement. Some resolve immediately; others remain face-up with their remaining uses shown on the Stewards Board.",
      "Arrivals enter with 3 timer tokens. Spend 1 action and pay the requirement to complete one and unlock its named Special Tile reward.",
      "At each round end, every active Arrival loses 1 timer. An Arrival that reaches 0 is discarded, adds 1 Strain to an eligible tile, and counts as failed.",
      "An Arrival still showing at least 1 timer when the game ends does not count as failed.",
      "Burdens apply their reveal effect, remain active, and apply their Season-start effect again at the start of each later Season.",
      "Spend 1 action and pay the current Season’s resolution cost to remove an active Burden."
    ]
  },
  {
    category: "Stewards",
    title: "Powers and objectives",
    bullets: [
      "Each Steward Power is normally available once per Season and costs 0 actions.",
      "Vanguard, Knight, and Sentinel prepare a benefit for the next matching placement or upgrade; prepare it before choosing that action.",
      "Ranger creates temporary reach for the current turn. Quartermaster exchanges shared resources and may aid an Arrival.",
      "Warden is offered automatically when a Burden is revealed. Preventing its reveal effect does not remove the Burden.",
      "At game end, every achieved Steward objective adds +15 Renown to the shared score."
    ]
  },
  {
    category: "Payments",
    title: "The shared Warehouse",
    bullets: [
      "All players gain resources into and spend resources from the same six Warehouse pools.",
      "No resource can exceed 15; gains above the cap are lost.",
      "When a Boon or tile passive can modify a payment, choose any optional modifiers before confirming it.",
      "Prepared Effects on the Stewards Board show discounts, zero-action benefits, and remaining uses.",
      "A cancelled payment spends neither resources nor actions."
    ]
  },
  {
    category: "Golden Legacy",
    title: "Golden Tiles and Boons",
    bullets: [
      "Ledger milestones unlock Golden Tiles and Golden Boons for future games.",
      "During setup, choose up to one unlocked Golden Tile and one unlocked Golden Boon independently.",
      "Place the Golden Tile after Steward starts for 0 actions, following its printed setup restriction.",
      "The Golden Boon is shuffled into the Encounter Deck, is never dealt to a hand, and grants a bonus reveal when drawn.",
      "A placed Golden Tile adds +5 Renown if its scoring condition is achieved."
    ]
  },
  {
    category: "Steward’s Ledger",
    title: "Achievements, Vows, and unlocks",
    bullets: [
      "Ledger Entries are persistent achievements awarded when a completed game is recorded; each named entry advances Golden unlocks only once.",
      "Entries marked by player count also keep separate 1P–4P prestige ticks, but those extra ticks do not advance milestones again.",
      "Some entries are locked until the shown number of named entries is complete and cannot be earned early.",
      "A Vow must be declared before setup, and only one may be attempted in a game.",
      "Golden Tiles and Golden Boons unlock at 5, 12, 18, 25, and 32 completed named entries."
    ],
    note: "Open Ledger → Chronicles to read every requirement and see live progress."
  },
  {
    category: "End game",
    title: "Final scoring",
    bullets: [
      "Add Population and Renown from every non-Overstrained tile, including eligible passive bonuses.",
      "Add +15 Renown for each Steward objective achieved.",
      "Add +5 Renown for each placed Golden Tile whose scoring condition is achieved.",
      "Lose 5 Renown for each failed Arrival, each active Burden, and every Strain token on the map.",
      "Final score = Population + Renown after all bonuses and penalties."
    ],
    note: "The End screen shows every part of the calculation before you record the game."
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
              <strong id="first-game-flow-title">Repeat the round loop for three Seasons</strong>
            </div>
            <ol>
              <li>Seed at Season start</li>
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
                <strong>Prepare one shared settlement</strong>
                <p>
                  Choose unique Stewards and place their starting Tokens on allowed terrain. Everyone
                  builds on the same map and uses the same Warehouse. Your first tile must cover your
                  own starting hex.
                </p>
              </div>
            </article>

            <article className="mini-card how-to-card">
              <span className="how-to-step-number">2</span>
              <div>
                <strong>Shape each Season’s Encounters</strong>
                <p>
                  Each player puts one hidden card at the top, middle, and bottom of the deck. Every
                  round then reveals one standard Encounter per player. Finish every reveal prompt
                  before normal turns begin.
                </p>
              </div>
            </article>

            <article className="mini-card how-to-card">
              <span className="how-to-step-number">3</span>
              <div>
                <strong>Spend up to 4 actions</strong>
                <p>
                  Place, Upgrade, Activate, or Interact. Select an action in the left panel, follow the
                  legal highlights, review the cost, and confirm. Steward Powers and some prepared
                  effects can make an action free.
                </p>
              </div>
            </article>

            <article className="mini-card how-to-card">
              <span className="how-to-step-number">4</span>
              <div>
                <strong>Build outward from your Steward</strong>
                <p>
                  Later placements must connect to that Steward’s reachable tiles. Placing, upgrading,
                  or activating moves the Steward to the chosen tile, changing where their next action
                  can reach.
                </p>
              </div>
            </article>

            <article className="mini-card how-to-card">
              <span className="how-to-step-number">5</span>
              <div>
                <strong>Answer danger before it compounds</strong>
                <p>
                  Complete timed Arrivals to unlock Special Tiles, resolve ongoing Burdens, and prevent
                  Strain from reaching 3. Overstrained tiles stop working, stop scoring, and can break
                  your network.
                </p>
              </div>
            </article>

            <article className="mini-card how-to-card">
              <span className="how-to-step-number">6</span>
              <div>
                <strong>Score after round 12</strong>
                <p>
                  Grow Population and Renown, meet each Steward objective, and pursue any Golden Tile
                  condition. Failed Arrivals, active Burdens, and every Strain token reduce the final
                  shared score.
                </p>
              </div>
            </article>
          </div>

          <section className="first-turn-example" aria-labelledby="first-turn-example-title">
            <div>
              <p className="eyebrow">Example first turn</p>
              <strong id="first-turn-example-title">Get connected, then make the Vale productive</strong>
            </div>
            <ol>
              <li>Place a legal, affordable tile over your Steward’s starting hex.</li>
              <li>Activate it if useful, or place a second tile beside your new reachable network.</li>
              <li>Use the remaining actions for another tile, an upgrade, or an urgent Encounter.</li>
              <li>End early if spending another shared resource would hurt the next Steward’s plan.</li>
            </ol>
          </section>

          <aside className="how-to-help-note">
            <strong>Using the app:</strong>
            <span>
              Resolve focused prompts before continuing. Disabled choices explain what is missing.
              Street and Track need a direction; Stables need two legal hexes. Right-click a map hex
              for quick actions, or use the action buttons on touch devices. Progress saves
              automatically in this browser, and the top-right controls undo or redo recent steps.
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
