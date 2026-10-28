import { Shield, ChevronDown } from "lucide-react";
import { isVowAvailableForPlayerCount } from "../../data/ledger";
import type { SetupPanelProps } from "./SetupPanel";

export function LegacySetupOptions({
  playerCount, stewardIds, completedLedgerCount = 0, declaredVowId = "", availableVows = [], lockedVows = [],
  selectedGoldenTileId = "", selectedGoldenBoonId = "", availableGoldenTiles = [], availableGoldenBoons = [],
  onDeclaredVowChange = () => {}, onGoldenTileChange = () => {}, onGoldenBoonChange = () => {}
}: SetupPanelProps) {
  const selectedVow = availableVows.find((vow) => vow.id === declaredVowId);
  const selectedTile = availableGoldenTiles.find((tile) => tile.id === selectedGoldenTileId);
  const selectedBoon = availableGoldenBoons.find((boon) => boon.id === selectedGoldenBoonId);
  const vowWarning = declaredVowId === "LE-041" && (stewardIds.includes("vanguard") || selectedGoldenBoonId === "golden_boon_the_golden_vial")
    ? "Vanguard’s Power and The Golden Vial can place Travel Tiles. Using either would break No Roads Raised."
    : declaredVowId === "LE-042" && stewardIds.includes("sentinel")
      ? "Sentinel’s Power upgrades a Core Tile. Using it would break No Fine Work."
      : null;

  return (
    <details className="welcome-optional">
            <summary><Shield size={17} aria-hidden="true" /><span>Ledger & Golden Legacy<small>Optional · {completedLedgerCount}/50 Ledger entries</small></span><ChevronDown size={16} aria-hidden="true" /></summary>
            <div className="welcome-optional-fields">
              <label>Steward’s Ledger Vow
                <select value={declaredVowId} onChange={(event) => onDeclaredVowChange(event.target.value)} aria-label="Steward's Ledger Vow">
                  <option value="">No Vow this game</option>
                  {availableVows.map((vow) => <option key={vow.id} value={vow.id}>{vow.name}</option>)}
                  {lockedVows.map((vow) => <option key={vow.id} value={vow.id} disabled>{vow.name} — {completedLedgerCount < vow.unlockAt ? `unlocks at ${vow.unlockAt} entries` : ""}{!isVowAvailableForPlayerCount(vow.id, playerCount) ? " · 3–5 players only" : ""}</option>)}
                </select>
              </label>
              <p>{selectedVow?.requirement ?? "Vows unlock as you complete entries in your Steward’s Ledger."}</p>
              {vowWarning && <p className="setup-vow-warning" role="status">{vowWarning}</p>}
              <label>Golden Tile<select value={selectedGoldenTileId} onChange={(event) => onGoldenTileChange(event.target.value)}><option value="">No Golden Tile</option>{availableGoldenTiles.map((tile) => <option key={tile.id} value={tile.id}>{tile.name}</option>)}</select></label>
              {selectedTile && <p>{selectedTile.effectText}</p>}
              <label>Golden Boon<select value={selectedGoldenBoonId} onChange={(event) => onGoldenBoonChange(event.target.value)}><option value="">No Golden Boon</option>{availableGoldenBoons.map((boon) => <option key={boon.id} value={boon.id}>{boon.name}</option>)}</select></label>
              {selectedBoon && <p>{selectedBoon.effectText}</p>}
              {!availableGoldenTiles.length && !availableGoldenBoons.length && <p>Golden content unlocks through your Ledger. Your first settlement needs none of it.</p>}
            </div>
          </details>
  );
}
