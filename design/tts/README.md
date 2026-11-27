# Tabletop Simulator (TTS) Mod — The Quiet Vale (v7.0)

This directory documents the reproducible Tabletop Simulator mod build pipeline for *The Quiet Vale: Seasons of Settlement* (**v7.0** ruleset).

## Quick Start

### 1. Test Locally in Tabletop Simulator (macOS)

Before merging to `main`, you can test immediately with local `file://` URLs:

```bash
npm run tts:build
cp output/tts/The_Quiet_Vale_v7_0_local.json ~/Library/Tabletop\ Simulator/Saves/
```

Open Tabletop Simulator → **Games → Save & Load → The Quiet Vale: Seasons of Settlement (v7.0)**.

### 2. Share / Play via GitHub Pages (after merge to `main`)

Once this branch is merged to `main`, GitHub Pages deploys `public/tts/` to:

- `https://sk47y9jwhh-maker.github.io/TheQuietValeGame/tts/The_Quiet_Vale_v7_0.json`

Anyone can download that single JSON file into their TTS `Saves/` folder and load the complete mod with zero local assets required.

## Rebuilding Assets & Save JSON

```bash
npm run tts:assets   # Re-render boards, v7.0 Target/Encounter/Quest decks, hex tiles, Steward mats, tokens -> public/tts/
npm run tts:build    # Generate public/tts/The_Quiet_Vale_v7_0.json (HTTPS) and output/tts/The_Quiet_Vale_v7_0_local.json (file://)
npm run tts:verify   # Validate counts, bounds, dimensions (<= 4096px), and zero broken asset references
```

## Included v7.0 Components & Enhanced Helper Scripts

- **Boards**: Four charcoal-leather & brass boards (`Map`, `Encounter`, `Logistics & Warehouse`, `Tiles & Quest`) with 126 exact flat-top hex snap points aligned to `src/data/map.ts` and 12 Round Tracker sockets.
- **Decks**:
  - 15-card v7.0 **Target Deck** (Cards 1–12 with 2 rows `Tile` + `Current Strain` + flat-top compass; Open Cards 13–15).
  - 90 v7.0 **Encounter Cards** (30 Boons, 30 Burdens with 3/5/7 resolution, 25 Arrivals with locked Special Tile numbers, 5 Golden Boons).
  - 21 **Quest Cards**.
- **Hex Tiles**: All 21 Core Tile types (double-sided Basic/Upgraded) + Travel Extensions, 26 numbered Special Tiles (`#1–#26`, settlement-wide Shrines & 0-Action placement), and 5 Golden Legacy tiles.
- **Stewards & Rulebook**: 6 Steward Reference Mats + 6 colored meeples, 5 player hand zones (`White`, `Red`, `Blue`, `Green`, `Yellow`), and the embedded 36-page **Rulebook v7.0** (`Custom_PDF`).
- **Enhanced Helper Lua Scripts**:
  - **1P–5P Setup Plaque**: Sets starting Warehouse (`15/10/8/0/0`), builds & shuffles the exact v7.0 Encounter split (`5/3/4`, `8/8/8`, `12/12/12`, `16/16/16`, `26/14/20`), shuffles Target Deck, deals 1 Quest Card, places Round 1 & Player 1 markers, and announces Actions/Turn (`4/4/3/3/2`).
  - **Clickable Warehouse Counters (0–15)**: Left-click `+1`, right-click `-1` (and `-`/`+` buttons with right-click `±5`) on all 6 resource columns.
  - **End Round Button**: Clears all `Cooldown X` tokens from the Map Board, advances the Round Marker (announcing Season II / III / Final Scoring), and rotates the Player 1 marker.
  - **Special Tile `#1–#26` Unlock Plaque**: Step to any Special Tile number and click **Unlock** to pull it directly from the reserve bag onto the Tiles Board.
