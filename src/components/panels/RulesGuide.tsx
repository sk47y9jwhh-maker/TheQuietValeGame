import { useEffect, useRef, useState } from "react";

type RulesView = "howTo" | "gameRules";

interface RuleReferenceCard {
  category: string;
  page: string;
  title: string;
  summary: string;
  sections: Array<{
    title: string;
    bullets: string[];
  }>;
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
    category: "Prepare",
    page: "4",
    title: "Components",
    summary: "One shared map, one Warehouse, and everything needed to build and test the Vale together.",
    sections: [
      {
        title: "Core game",
        bullets: [
          "1 flat-top hex Game Map and 1 Stewards Board with the shared Warehouse and round tracker.",
          "63 double-sided Core Tiles across 21 Tile types, plus 26 Special Tile pieces across 25 designs.",
          "90 Encounter Cards: 30 Boons, 30 Burdens, 25 Arrivals, and 5 Golden Boons.",
          "30 Target Cards, shuffled once during setup, select Tiles for incoming Strain.",
          "6 Steward Aids with 6 matching Steward Tokens, and 1 Steward’s Ledger for campaign records."
        ]
      },
      {
        title: "Shared supplies",
        bullets: [
          "90 resources: 15 each of Wood, Stone, Metal, Food, Herbs, and Goods.",
          "30 black markers and 30 bronze markers. Strain is black. Supported and the Round marker are bronze. Arrival timers may use either colour.",
          "5 Golden Tiles remain out of play until unlocked through the Steward’s Ledger."
        ]
      }
    ],
    note: "Before your first game, leave every Golden Tile and Golden Boon in the box."
  },
  {
    category: "Prepare",
    page: "4–5",
    title: "Setup",
    summary: "Prepare the shared area, choose unique Stewards, build the Encounter pool, and place starting Tokens.",
    sections: [
      {
        title: "Shared area and Stewards",
        bullets: [
          "Lay out the Game Map, Stewards Board, Warehouse, Core Tile supply basic-side up, Special Tiles, and tokens. Put the Round marker on 1.",
          "Shuffle all 30 Target Cards face down. Do not create a discard pile and do not reshuffle during play.",
          "Each player chooses a different Steward. At five players, choose any five of the six Stewards. The unchosen Steward is not used.",
          "Start with 15 / 10 / 5 / 0 / 0 of every resource at 1 / 2 / 3 / 4 / 5 players. The normal Warehouse maximum is 15 of each."
        ]
      },
      {
        title: "Encounter material",
        bullets: [
          "For each player, select 4 Boons, 4 Burdens, and 4 Arrivals. Shuffle them into one 12-card-per-player standard pool.",
          "Deal 9 hidden cards to each player. The remaining 3 selected standard cards per player form the starting Encounter Deck.",
          "At five players, select 20 cards of each standard type, deal 45 cards, and begin with a 15-card Encounter Deck.",
          "Return every unselected standard Encounter to the box as the reserve. Players may not inspect it unless an effect says so."
        ]
      },
      {
        title: "Starting positions",
        bullets: [
          "Place each Steward Token on an empty hex matching its Starting Terrain. Two Tokens cannot share a hex.",
          "On each Steward’s first turn, their first Action must place any legal Tile over their own starting hex."
        ]
      }
    ],
    note: "Hidden hands may discuss strategy, timing, and broad intent, but may not name cards or quote exact unrevealed effects. Open hands are an optional teaching aid."
  },
  {
    category: "Flow",
    page: "6–7",
    title: "Seasons and Encounter seeding",
    summary: "The game has three four-round Seasons: Foundations, Growth, and Maturity.",
    sections: [
      {
        title: "Seed before rounds 1, 5, and 9",
        bullets: [
          "Each player secretly chooses 3 cards from their hand.",
          "Seed one on top of the Encounter Deck, insert one into the middle without counting, and seed one on the bottom.",
          "Once seeded, nobody may count, inspect, reorder, or reveal cards in the deck unless an effect permits it.",
          "At the start of Seasons II and III, unresolved Burdens reapply with the new Season row before players seed."
        ]
      }
    ],
    note: "Seeding controls timing, not certainty: a Boon may help now, while delaying an Arrival can make the final Season more crowded."
  },
  {
    category: "Flow",
    page: "7–8",
    title: "Round sequence",
    summary: "Reveal Encounters, choose player order, take one turn each, then complete upkeep.",
    sections: [
      {
        title: "Every round",
        bullets: [
          "Reveal until the number of standard Encounters revealed equals the player count. Resolve every mandatory reveal effect before turns begin.",
          "The group chooses player order. Every player takes exactly one turn with up to 4 Actions and may end their turn early.",
          "After all turns, remove 1 timer from every active Arrival and resolve each expiry.",
          "Discard effects whose duration ends, refresh round-based effects, and advance the Round marker."
        ]
      }
    ],
    note: "Finish every pending mandatory choice, payment, placement, Strain application, or chain before moving to the next timing step."
  },
  {
    category: "Actions",
    page: "8–10",
    title: "Your turn and four Actions",
    summary: "Spend up to 4 Actions to Place, Upgrade, Activate, or Interact. Repeat any Action while it remains legal.",
    sections: [
      {
        title: "The four Actions",
        bullets: [
          "Place: spend 1 Action, choose an available Tile and legal reachable empty hex, check requirements, pay its cost, then resolve placement effects.",
          "Upgrade: spend 1 Action, pay the upgraded cost, and flip a reachable non-Overstrained basic Core Tile in place.",
          "Activate: spend 1 Action and any printed cost to use a reachable non-Overstrained Tile’s Activated Effect, including Production.",
          "Interact: spend 1 Action to complete an active Arrival or perform an active Burden’s current-Season resolution. Interact does not move the Steward."
        ]
      },
      {
        title: "Movement and free effects",
        bullets: [
          "After the first placement, Place, Upgrade, and Activate move the acting Steward Token onto the chosen Tile.",
          "Face-up Boons, passive Tile effects, and Steward Powers cost no Actions unless their text says otherwise.",
          "A 0-Action benefit waives only the Action. Pay normal resource costs unless the effect also changes them."
        ]
      }
    ],
    note: "Unused Actions are lost when the turn ends. Cancelling before confirmation spends no Action and no resources."
  },
  {
    category: "Actions",
    page: "10–11",
    title: "Production and the Warehouse",
    summary: "All players gain and spend the same six resources, each normally capped at 15.",
    sections: [
      {
        title: "Linked Production",
        bullets: [
          "The first eligible activation in an immediately adjacent group from the same Resource Tile stack makes the chosen Tile and every adjacent non-Overstrained copy produce for one Action.",
          "Linked Production does not continue outward through a chain. Mark every producer as having participated this round.",
          "A later activation involving any Tile that already participated produces only from the chosen Tile. A disconnected matching group may still use its own Linked Production."
        ]
      },
      {
        title: "Payment helpers",
        bullets: [
          "Workshops reduces one adjacent Core upgrade by 1 resource once per round. The Makers Conclave reduces one reachable Core upgrade by up to 2.",
          "Market Stalls may spend 1 Goods as 1 resource of another type once per round. The Seldes may treat it as up to 2 of one type. A printed Goods requirement is never replaced."
        ]
      }
    ]
  },
  {
    category: "Settlement",
    page: "12–13",
    title: "Building the settlement",
    summary: "Placement, adjacency, and reachability are separate checks. Rivers interrupt normal connection.",
    sections: [
      {
        title: "Terrain and placement",
        bullets: [
          "Every placement checks availability, an empty reachable hex, terrain, adjacency, the printed placement rule, and cost.",
          "Any Land means an empty non-Water/River hex unless the Tile says otherwise. Only a specific rule permits placement on Water/River.",
          "When a Tile’s entire footprint lies on Ruins, ignore all Stone in its placement or upgrade cost. Otherwise pay the full cost.",
          "Street and Track occupy a straight line. For Stables, place the connected half first and the second half on any valid remote hex."
        ]
      },
      {
        title: "Connection and reach",
        bullets: [
          "Adjacent means sharing a hex side. All side-adjacent non-Overstrained Tiles form the connected settlement network.",
          "All Stewards may use the shared network. Reach starts from the acting Steward Token and follows non-Overstrained connection.",
          "Rivers block normal connection between banks. A Bridge or another specific rule is required to cross."
        ]
      }
    ],
    note: "The app highlights legal choices and explains disabled ones. Docks and the Ranger Power add the special reach described on those components."
  },
  {
    category: "Encounters",
    page: "14–16",
    title: "Encounter cards",
    summary: "Read every Encounter from top to bottom and use the row matching the current Season.",
    sections: [
      {
        title: "Boons and Burdens",
        bullets: [
          "Boons resolve immediately unless their italic instruction keeps them face up for a duration or number of uses.",
          "A kept Boon costs no Action to use unless it says otherwise. Only one Boon may modify a single Action unless a rule permits more.",
          "A Burden applies its current-Season reveal effect, stays active, and reapplies with the new row at the start of Seasons II and III.",
          "Resolve an active Burden with an Interact Action and its current-Season resolution, or with an effect that explicitly resolves it. Existing Strain remains."
        ]
      },
      {
        title: "Arrivals and Golden Boons",
        bullets: [
          "An Arrival enters with 3 timers. Spend 1 Interact Action and meet its Requirements to unlock the named Special Tile for later 0-resource placement.",
          "At round end, remove 1 timer from every active Arrival. At 0 it fails, is discarded, records one failure, and places 1 Strain through the Target Deck when possible.",
          "An Arrival still active after Round 12 remains active. It does not fail, place Strain, or reduce the final score.",
          "Golden Boons resolve free, never enter player hands or seeding, and do not count toward the standard reveal total."
        ]
      }
    ],
    note: "Specific card text overrides a general rule only for the situation it names. Flavour text is narrative. Italic timing and duration lines are rules text."
  },
  {
    category: "Strain",
    page: "16–17",
    title: "Strain and Supported",
    summary: "Tiles function at 1 or 2 Strain. At 3 they become Overstrained and stop helping the settlement.",
    sections: [
      {
        title: "Strain",
        bullets: [
          "A Tile can hold at most 3 Strain. If a Tile already at 3 is targeted, add nothing.",
          "If the full amount or number of legal targets is unavailable, place as much Strain as possible on as many eligible Tiles as possible.",
          "The triggering effect defines the eligible pool. The Target Deck selects only within that pool."
        ]
      },
      {
        title: "Supported and Overstrained",
        bullets: [
          "Supported prevents 1 Strain before checking for Overstrain. Passive and single-use Supported do not stack.",
          "Passive Supported refreshes each round while its condition remains true. Single-use Supported is spent when it prevents Strain.",
          "At 3 Strain, a Tile cannot activate, upgrade, provide passive effects, connect the network, score, or satisfy positive requirements.",
          "As soon as a Tile falls below 3 Strain it works normally again. Prevented Strain is not redirected."
        ]
      }
    ]
  },
  {
    category: "Strain",
    page: "17–18",
    title: "Overstrain chains",
    summary: "A newly Overstrained Tile spreads after the full effect that caused it has finished.",
    sections: [
      {
        title: "Resolve a chain",
        bullets: [
          "Finish the original effect, including every printed Strain placement and Strain Cascade.",
          "Identify every Tile that crossed from fewer than 3 Strain to 3. If several did, the players choose their spread order.",
          "For each spread, draw a fresh Target Card and apply it only to eligible adjacent placed Tiles below 3 Strain.",
          "Apply 1 Strain, resolve Supported and prevention, and add any newly Overstrained target to the chain.",
          "Continue until no new spread remains."
        ]
      }
    ],
    note: "A Tile already at 3 does not spread again merely because another effect targets it. It can spread again only after dropping below 3 and later returning to 3."
  },
  {
    category: "Strain",
    page: "18–19",
    title: "The Target Deck",
    summary: "Target Cards make impartial choices inside the eligible pool created by the Strain effect.",
    sections: [
      {
        title: "Resolve one Target Card",
        bullets: [
          "Start with only the Tiles made eligible by the effect, including any printed fallback. Draw one card for each different target.",
          "Read preferences in order: Tile Class, Tile Side, Adjacency, then Current Strain.",
          "At each preference, keep the matches if at least one current candidate matches. Otherwise ignore that preference. Never restore a removed Tile.",
          "Any neither narrows nor widens the pool. An Open card lets the players choose any remaining candidate.",
          "If several remain on a structured card, use its arrow, then fixed map-coordinate order only for an exact directional tie.",
          "Return the card face down to the deck bottom, then resolve Supported and prevention."
        ]
      }
    ],
    note: "Shuffle the 30-card Target Deck once during setup. Do not discard or reshuffle cards during play."
  },
  {
    category: "Roles",
    page: "19–20",
    title: "Stewards",
    summary: "Every Steward has Starting Terrain, a once-per-Season Power, and an Objective worth +15 Renown.",
    sections: [
      {
        title: "The six Stewards",
        bullets: [
          "Vanguard places Travel for 0 Actions. Knight places Housing for 0 Actions. Sentinel upgrades a Core Tile for 0 Actions. Normal costs still apply.",
          "Ranger treats one legal empty hex or non-Overstrained Tile as reachable until turn end.",
          "Warden may prevent one revealed Burden effect. The Burden remains active, then Warden removes 1 Strain or grants Supported.",
          "Quartermaster exchanges up to 5 shared resources and may add 1 timer to an Arrival below 3.",
          "Powers cost no Action and refresh at each Season start. Follow each Steward Aid’s exact timing and placement text.",
          "Only non-Overstrained Tiles count toward positive Objectives unless a rule says otherwise. Warden succeeds with fewer active Burdens than the player count."
        ]
      }
    ]
  },
  {
    category: "Season end",
    page: "20–21",
    title: "End of a Season",
    summary: "After Rounds 4 and 8, finish upkeep and complete the six-step Season transition in order.",
    sections: [
      {
        title: "Neighbourly Support",
        bullets: [
          "Each Housing cluster gains 1 single-use Supported for every 3 non-Overstrained Housing Tiles in that cluster.",
          "Place each Supported on a different non-Overstrained Housing Tile in that cluster. Ignore Overstrained Tiles when finding clusters and size."
        ]
      },
      {
        title: "Transition order",
        bullets: [
          "1. Finish every Arrival expiry.",
          "2. Discard unused face-up Boons whose duration ends with the Season.",
          "3. Resolve Neighbourly Support.",
          "4. Reapply every unresolved Burden using the new Season row.",
          "5. Refresh every Steward Power.",
          "6. Seed Encounters for the next Season."
        ]
      }
    ],
    note: "There is no automatic Season-end Strain spread. Overstrain chains resolve immediately after the effect that created them."
  },
  {
    category: "End game",
    page: "21",
    title: "Final scoring",
    summary: "After Round 12 and all pending effects, calculate one shared score. There is no pass/fail threshold or individual winner.",
    sections: [
      {
        title: "Score in order",
        bullets: [
          "Add Population and Renown from eligible non-Overstrained Tiles and passive effects.",
          "Add +15 Renown for each chosen Steward Objective met.",
          "Add +5 Renown for each placed Golden Tile whose scoring condition is met.",
          "Subtract 10 for each active Burden and each Arrival that failed during play.",
          "Subtract 10 for every Strain token on the map. Active Arrivals do not reduce the final score.",
          "Final score = Population + positive Renown − all penalties."
        ]
      }
    ],
    note: "Record the shared final score and every newly completed Entry in the Steward’s Ledger. Unplaced Special Tiles do not score."
  },
  {
    category: "Campaign",
    page: "22",
    title: "Steward’s Ledger",
    summary: "The Ledger records achievements, scores, prestige marks, Vows, and Golden milestones across many games.",
    sections: [
      {
        title: "Recording a group",
        bullets: [
          "Choose a group name and unused Roman numeral I–VI. Use that numeral for every Entry mark and the matching Game Record.",
          "After final scoring, mark NAMED for each newly completed Entry and record the score and new Entries on the group’s Game Record.",
          "Each NAMED mark counts once toward Golden milestones. Separate 1P–5P prestige marks are records only and do not advance milestones.",
          "An AFTER gate is met only if the group begins the game with the shown number of Named Entries."
        ]
      },
      {
        title: "Vows and milestones",
        bullets: [
          "Declare a Vow before setup and attempt no more than one Vow per game.",
          "Golden milestones are reached at 5, 12, 18, 25, and 32 Named Entries. Each unlocks one Golden Tile and one Golden Boon permanently."
        ]
      }
    ],
    note: "Open Ledger → Chronicles in the prototype to read every Entry requirement and see live progress."
  },
  {
    category: "Campaign",
    page: "22–23",
    title: "Golden content",
    summary: "Golden content is optional advanced material unlocked through the Ledger and is not recommended for a first game.",
    sections: [
      {
        title: "Golden setup",
        bullets: [
          "After standard hands are dealt, choose up to 1 unlocked Golden Tile and up to 1 unlocked Golden Boon.",
          "Place the Golden Tile on an eligible empty hex for 0 Actions and 0 resources, following its printed requirement.",
          "Shuffle the Golden Boon into the Encounter Deck. It never enters a hand or player seeding.",
          "When revealed, resolve the Golden Boon for free and continue revealing because it does not count toward the standard total.",
          "Every Golden Tile has a conditional +5 Renown scoring hook."
        ]
      }
    ]
  },
  {
    category: "Teaching",
    page: "23",
    title: "Teaching the first game",
    summary: "Teach the shared goal and one complete round first. Introduce rare interactions only when the table needs them.",
    sections: [
      {
        title: "Teach in layers",
        bullets: [
          "Orient: show the shared score, Warehouse, and four Actions.",
          "Choose Stewards: identify each Token, Starting Terrain, Power, and Objective.",
          "Seed: each player chooses one hidden card for the top, middle, and bottom.",
          "Reveal: show the required standard Encounters and finish every mandatory effect.",
          "Order and play: the group chooses order. Each player takes one turn with up to 4 Actions.",
          "Upkeep: resolve Arrival timers and failures, clean up, refresh, and advance the Round marker."
        ]
      }
    ],
    note: "Leave Golden content in the box. Teach Target Card filters and Overstrain chains only when Strain first makes them relevant."
  },
  {
    category: "Reference",
    page: "23–26",
    title: "Quick reference",
    summary: "The essential round, Action, Strain, Season, and scoring sequences in one place.",
    sections: [
      {
        title: "Round and Actions",
        bullets: [
          "Round: reveal and resolve Encounters → choose player order → each player takes one turn → Arrival upkeep and cleanup.",
          "Actions: Place a legal Tile, Upgrade a basic Core Tile, Activate an Activated Effect, or Interact with an Arrival or Burden.",
          "Steward movement: Place, Upgrade, and Activate move the Token. Interact does not."
        ]
      },
      {
        title: "Strain and Season transition",
        bullets: [
          "Strain: build eligible pool → draw Target Card → resolve Supported and prevention → check for Overstrain → resolve the chain after the original effect.",
          "After Rounds 4 and 8: Arrival expiry → expiring Boons → Neighbourly Support → Burdens → Steward Powers → seed.",
          "Arrival timers start at 3 and cannot exceed 3. Remove 1 from every active Arrival at round end."
        ]
      },
      {
        title: "Limits and penalties",
        bullets: [
          "Warehouse maximum: 15 of each resource. Starting amounts: 15 / 10 / 5 / 0 / 0 for 1–5 players.",
          "Unlocked Special Tiles use a normal Place Action, follow their placement rule, and cost 0 resources.",
          "Each active Burden, failed Arrival, and Strain token costs 10 Renown. Active Arrivals do not reduce the final score."
        ]
      }
    ],
    note: "When a specific card or Tile conflicts with a general rule, its text overrides only the situation it names."
  }
];

export function RulesGuide({ gameStatus }: RulesGuideProps) {
  const [rulesView, setRulesView] = useState<RulesView>("howTo");
  const [activeRuleIndex, setActiveRuleIndex] = useState(0);
  const ruleChapterRef = useRef<HTMLElement>(null);
  const ruleChapterButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeRule = rules[activeRuleIndex];

  useEffect(() => {
    if (rulesView === "gameRules" && ruleChapterRef.current) {
      ruleChapterRef.current.scrollTop = 0;
      ruleChapterButtonRefs.current[activeRuleIndex]?.scrollIntoView?.({
        block: "nearest",
        inline: "nearest"
      });
    }
  }, [activeRuleIndex, rulesView]);

  return (
    <div className={`rules-guide ${rulesView === "gameRules" ? "rules-guide-full" : ""}`}>
      <section
        className="rules-quick-start"
        aria-label={gameStatus ? "Current game and quick start" : "Game overview"}
      >
        <div>
          <p className="eyebrow">
            {rulesView === "gameRules"
              ? "Rules Reference"
              : gameStatus
                ? "Playtester Guide"
                : "Learn to Play"}
          </p>
          <strong>
            {rulesView === "gameRules"
              ? "Main Rulebook v6.5 · choose one of 18 chapters."
              : "Build one shared settlement across three Seasons."}
          </strong>
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
              <span>Rules v6.5</span>
            </>
          ) : (
            <>
              <span>1–5 players</span>
              <span>Cooperative</span>
              <span>45–150 minutes</span>
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
              <p className="eyebrow">The shape of the game</p>
              <strong id="first-game-flow-title">Set up once, then play three four-round Seasons</strong>
            </div>
            <ol>
              <li>Set up the shared Vale</li>
              <li>Begin a Season</li>
              <li>Play four rounds</li>
              <li>Score after round 12</li>
            </ol>
          </section>

          <div className="how-to-grid">
            <article className="mini-card how-to-card">
              <span className="how-to-step-number">1</span>
              <div>
                <strong>Set up once</strong>
                <p>
                  Choose unique Stewards, prepare the standard Encounter pool, and place each Token
                  on its allowed terrain. Fill the Warehouse with 15 / 10 / 5 / 0 / 0 of each
                  resource for 1–5 players.
                </p>
              </div>
            </article>

            <article className="mini-card how-to-card">
              <span className="how-to-step-number">2</span>
              <div>
                <strong>Begin a Season</strong>
                <p>
                  Before rounds 1, 5, and 9, begin a Season. In Seasons II and III, unresolved
                  Burdens first reapply using their new Season row. Then each player seeds 3 hidden
                  cards: one on top, one in the middle, and one on the bottom.
                </p>
              </div>
            </article>

            <article className="mini-card how-to-card">
              <span className="how-to-step-number">3</span>
              <div>
                <strong>Start each round</strong>
                <p>
                  Reveal standard Encounters until the number revealed equals the player count.
                  Finish every required revealed effect and choice before selecting player order.
                </p>
              </div>
            </article>

            <article className="mini-card how-to-card">
              <span className="how-to-step-number">4</span>
              <div>
                <strong>Choose order and take turns</strong>
                <p>
                  Choose player order anew each round. In that order, every player takes one turn of
                  up to 4 Actions: Place, Upgrade, Activate, or Interact.
                </p>
              </div>
            </article>

            <article className="mini-card how-to-card">
              <span className="how-to-step-number">5</span>
              <div>
                <strong>End the round</strong>
                <p>
                  After all turns, remove 1 timer from each active Arrival and resolve expiries.
                  Discard ended effects, refresh round-based effects, and advance the Round marker.
                </p>
              </div>
            </article>

            <article className="mini-card how-to-card">
              <span className="how-to-step-number">6</span>
              <div>
                <strong>Continue—or score</strong>
                <p>
                  After rounds 4 and 8, begin the next Season. After round 12, total Population and
                  Renown, then lose 10 Renown for each active Burden, failed Arrival, and Strain
                  token. Active Arrivals do not reduce the final score.
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

        </div>
      )}

      {rulesView === "gameRules" && (
        <div
          aria-labelledby="rules-game-rules-tab"
          className="rules-book-layout"
          id="rules-game-rules-panel"
          role="tabpanel"
        >
          <nav className="rules-contents" aria-label="Full rules contents">
            <div className="rules-contents-heading">
              <div>
                <p className="eyebrow">Contents</p>
                <strong>Rulebook chapters</strong>
              </div>
              <span>{rules.length}</span>
            </div>
            <div className="rules-contents-list">
              {rules.map((rule, index) => (
                <button
                  aria-controls="active-rule-chapter"
                  aria-current={activeRuleIndex === index ? "page" : undefined}
                  aria-label={`${index + 1}. ${rule.title}`}
                  className={`rules-chapter-button ${activeRuleIndex === index ? "selected" : ""}`}
                  key={rule.title}
                  onClick={() => setActiveRuleIndex(index)}
                  ref={(node) => {
                    ruleChapterButtonRefs.current[index] = node;
                  }}
                  type="button"
                >
                  <span className="rules-chapter-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="rules-chapter-label">
                    <small>{rule.category}</small>
                    <strong>{rule.title}</strong>
                  </span>
                </button>
              ))}
            </div>
          </nav>

          <section className="rules-chapter-detail" aria-label="Selected rule chapter">
            <article
              className="rule-reference-card rule-chapter-card"
              id="active-rule-chapter"
              ref={ruleChapterRef}
              tabIndex={0}
            >
              <header className="rule-chapter-header">
                <div className="rule-chapter-meta">
                  <span>
                    Chapter {String(activeRuleIndex + 1).padStart(2, "0")} / {rules.length}
                  </span>
                  <span className="rule-category">{activeRule.category}</span>
                  <span className="rule-page">
                    Rulebook {activeRule.page.includes("–") ? "pp." : "p."} {activeRule.page}
                  </span>
                </div>
                <h3>{activeRule.title}</h3>
                <p className="rule-summary">{activeRule.summary}</p>
              </header>
              <div className="rule-sections">
                {activeRule.sections.map((section) => (
                  <section className="rule-section" key={section.title}>
                    <h4>{section.title}</h4>
                    <ul>
                      {section.bullets.map((bullet) => (
                        <li key={bullet}>{bullet}</li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
              {activeRule.note && <aside className="rule-note">{activeRule.note}</aside>}
            </article>

            <div className="rules-chapter-pager" aria-label="Rule chapter navigation">
              <button
                aria-label={
                  activeRuleIndex > 0
                    ? `Previous rule: ${rules[activeRuleIndex - 1].title}`
                    : "Previous rule"
                }
                disabled={activeRuleIndex === 0}
                onClick={() => setActiveRuleIndex((current) => current - 1)}
                type="button"
              >
                <span aria-hidden="true">←</span>
                Previous
              </button>
              <span>
                {activeRuleIndex + 1} of {rules.length}
              </span>
              <button
                aria-label={
                  activeRuleIndex < rules.length - 1
                    ? `Next rule: ${rules[activeRuleIndex + 1].title}`
                    : "Next rule"
                }
                disabled={activeRuleIndex === rules.length - 1}
                onClick={() => setActiveRuleIndex((current) => current + 1)}
                type="button"
              >
                Next
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
