# The Quiet Vale: Seasons of Settlement

Fresh responsive web prototype for **The Quiet Vale**, a cooperative tile-laying settlement game for 1-4 players.

## Current Status

This repository is a greenfield rebuild. The current implementation establishes the app shell, typed data model, rules-engine foundations, responsive Command Table layout, and focused unit tests. The old prototype is a last-resort reference only.

Implemented playable loop:

- 1-4 player setup with unique Stewards.
- Automatic fresh Encounter shuffle whenever a new game starts.
- Hidden-hand seasonal seeding with Top, Middle, and Bottom slots.
- Encounter reveal into active Arrivals, active Burdens, face-up Boons, and discard.
- Face-up Boons with visible remaining-use tracking and Use buttons.
- Prepared Boon effects for reduced costs and 0 Action placement/upgrade benefits.
- Carts Before Sunrise refreshes at most one chosen used Crafting/Merchant passive per prepared modifier; declining every eligible passive preserves that modifier.
- Cost-choice support for Brewery of Legends, House of Learning, Labourers' Yard, the Tamers' Respite, the Waystation, Workshops/Makers Conclave, and Market Stalls/The Seldes.
- Deck-peek effects with a seeding-style reorder panel and arrow movement controls.
- Steward Power flow with seasonal use tracking, shared effect prompts, prepared placement/upgrade benefits, Ranger movement, Warden Burden reveal cancellation/round-ignore markers, and Quartermaster resource exchange.
- Guided tile placement with legal hex highlighting and failure reasons.
- Zoomable map with zoom-aware labels, reachable-tile highlighting, Steward markers, and always-visible Strain/Supported markers.
- Inspector and reference panels that show tile costs, placement rules, stats, effects, card effects, requirements, rewards, and resolution text.
- Responsive stacked play layout that keeps the map, controls, and inspector available on narrow screens.
- Straight multi-hex Street/Track footprints with six orientations.
- Stables placement as two separate single-hex Special Tiles selected together, with the first connected to the acting Steward's settlement network and the second on any valid hex.
- A persistent Stables network link that joins the non-Overstrained tiles connected to either Stables without moving a Steward Token.
- Core and unlocked Special Tile placement.
- Upgrade and Activate flows for reachable eligible tiles.
- Three-copy supply for every Core Resource Tile, with the first Linked Production in each adjacent group each round activating all non-Overstrained matching producers; repeats produce only from the chosen tile.
- Activated Special Tile effects that resolve an active Burden with a player choice prompt.
- Docks reach that joins every non-Water shoreline hex and its non-Overstrained tiles to the Docks settlement network, including across Water/River terrain.
- Once-per-season/round activation limits for tile effects that declare them.
- Arrival completion that unlocks named Special Tiles.
- Burden resolution with season-scaled resource costs.
- The Resting Hall passive trigger once per round after Burden resolution.
- Automatic fixed-resource Shrine and Respite production passives after adjacent matching Resource Tile activation, with once-per-round tracking and no separate passive-tile activation.
- Common Land/The Pleasance automatically maintains Supported on eligible adjacent Housing Tiles.
- Lantern Roadhouse prevention of 1 Strain on a connected Travel Tile once per round.
- Once-per-round triggered passives for Reavers, Root Weavers, Tamers, Theatre, and the Waystation.
- Arrival expiry Strain consequence and player-chosen chain reactions whenever a tile becomes Overstrained.
- Pending effect prompts for revealed cards, placed/upgraded/activated tiles, Arrival rewards, Burden resolution, and expired Arrivals.
- Full-stage pending effect prompts so card, tile, and Steward choices remain visible across screen sizes.
- App smoke tests for setup, seeded start, seeding, and reveal flow.
- Manual effect controls for resource changes, Arrival timers, Strain changes, and Supported.
- Deterministic production, single-target timer, Strain, Supported, and Resting Hall effects resolve immediately; genuine multi-target choices still open focused controls.
- No-effect card prompts can be acknowledged when their valid target type is absent.
- Intrinsic printed self-Supported effects, such as Stone Bridge, apply automatically.
- Season-end cleanup for unused face-up Boons and prepared Boon effects.
- Final scoring basics, including passive Population/Renown bonuses, `+15` Steward Objectives, and the Encounter penalties below.

## Source Of Truth

Current source priority:

1. Structured repository data in this repository; this is the current online prototype authority.
2. `design/component-list/The_Quiet_Vale_Master_Component_List.xlsx`, the physical component and production-text authority.
3. The current v6.4 Rulebook output, used for full-game reference and physical handoff.
4. Greenfield handoff and supplemental authority pack.
5. Old prototype behavior only as a last resort.

Locked decisions for this build:

- Encounter setup uses `4 Boons + 4 Burdens + 4 Arrivals` per player.
- All selected standard Encounter Cards are used: `9` hidden cards per player plus `3` standard Encounter Deck cards per player. Hands are intentionally not required to be `3/3/3` by type.
- Steward objectives are worth `+15 Renown`.
- Warden scores if active Burdens are fewer than player count.
- Final penalties are `-5 Renown` per failed Arrival, Unfulfilled Promise (an Arrival still active at game end), active Burden, and Strain token. Unfulfilled Promises do not add Strain.
- Final scoring shows raw final score only, with no success bands/ratings for now.
- Steward’s Ledger milestones unlock five Golden Tiles and five Golden Boons for optional online setup.
- Council Variant is not supported in the online prototype.

## Local Setup

```bash
npm install
npm run dev
```

## Useful Commands

```bash
npm run test
npm run build
npm run preview
npm run loc
```

## Architecture

```text
src/
  app/               App composition
  components/        Command Table UI modules
  data/              Typed map, steward, tile, and encounter data
  engine/            Deterministic rules and selectors
  styles/            Design tokens and responsive layout
  tests/             Unit tests for setup and rules logic
```

The engine returns validation reasons for illegal actions so the UI can explain why a move is blocked instead of silently disabling controls.

`npm run loc` reports application, content data, rules, styles, tests, and research tooling separately. Generated playtest output and local analysis archives are intentionally ignored and are not part of the maintained source count.

## Deployment

The app is static and Vite-compatible. The repository deploys to GitHub Pages through `.github/workflows/pages.yml`: tests run, `dist/` is built, and the artifact is published by GitHub Actions.

The live custom-domain targets to verify after deployment are:

- `https://thequietvalegame.com`
- `https://www.thequietvalegame.com`

The Vite build uses `base: "./"` so the same artifact works on the custom domain and remains tolerant of project-path previews. GitHub Pages should stay configured to deploy from GitHub Actions, with the custom domain and HTTPS configured in the repository Pages settings and DNS provider.

Post-deploy checks should include a fresh browser session, a mobile-sized viewport or real phone, and a cellular/incognito check to catch DNS or cached-service-worker issues. The app currently has no nested routes; if routed pages are introduced later, add static fallback/reload handling for GitHub Pages before deployment.

## Known Limitations

- Card and tile effect automation is partial; ambiguous choices still use the manual pending-effect prompt.
- Named adjacency requirements are enforced for imported Special Tiles, but some complex text-only placement rules still need structured rule tags.
- Golden Legacy content is optional and only appears in setup after its Ledger threshold is reached.
- Council Variant and Artist Mode are not implemented.
- Browser e2e smoke tests are not installed yet.
