# Quest Cards — prototype 1 (31 October 2026)

The Quest Cards (completed cards make up the Steward’s Ledger), for the first live-play
print run. Design doc: https://claude.ai/artifact/3SBA7V5j9kWNV7gtnXKy1t

| File | What it is |
| --- | --- |
| `src/data/questCards.json` | The 21 cards (shared with the online game): theme, both halves, check type and player-count strips. The source of truth for the print. |
| `quest-front-background-600dpi.png` | Front background: the Golden Boon master re-laid to poker, text removed, gold glow bands and the master's own dividers redrawn for this layout. |
| `render-quest.mjs` | Renders every front from `src/data/questCards.json` onto the background in the game's fonts (Almendra, Alegreya, Alegreya Sans). |
| `print/quest-NN.png` | Print fronts, 1630 × 2220 px at 600 dpi: 63 × 88 mm trim with 3 mm bleed each side, sRGB. |

Back: `design/encounter-card-templates/card-back/print/card-back-poker-gold-printerstudio-600dpi.png`.

Regenerate from the repo root (Chrome at `/usr/bin/google-chrome`, puppeteer):

```bash
node design/quest-cards/render-quest.mjs design/quest-cards/quest-front-background-600dpi.png design/quest-cards/print
```

The renderer reports a scale per half. A half that overflows shrinks (never
below 70%); in prototype 1 only card 5's bottom half shrinks, to 94%.

## Rules on the card

- Draw one card per game. Both halves are live; completing either one pays
  +20 Renown once and puts the card in the Steward’s Ledger. A failed card goes to
  the bottom of the deck.
- Golden pairs unlock at 3, 6, 9, 12 and 15 completed cards.
- Strips give targets for 1, 2, 3, 4 and 5 players.
- Vows (simplified 31 October): each is a rule that must hold all game, then
  "End with ..." and one strip whose label matches that sentence, checked at
  final scoring. The Overstrain Vows allow one Overstrained tile at a time at
  4 to 5 players, printed as a clause, not a strip. The Unbroken Vale has no
  end target: its strip is the cap on tiles holding 2+ Strain.
- Targets were retuned by player count on 31 October. They are untested by
  people: prototype 1 is for live play-testing.

## Type sizes at print size

Body text 7.2 pt, quest names 8.6 pt, theme 12.5 pt, strip labels 5.8 pt,
strip numbers 6.7 pt, footer 5.5 pt.
