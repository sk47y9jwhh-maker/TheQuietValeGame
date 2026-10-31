import { Shield, ChevronDown } from "lucide-react";
import { questCardByNumber } from "../../data/questCards";
import { QuestDrawn } from "../cards/QuestDrawn";
import type { SetupPanelProps } from "./SetupPanel";

export function LegacySetupOptions({
  playerCount, completedLedgerCount = 0, questCardNumber,
  selectedGoldenTileId = "", selectedGoldenBoonId = "", availableGoldenTiles = [], availableGoldenBoons = [],
  onGoldenTileChange = () => {}, onGoldenBoonChange = () => {}
}: SetupPanelProps) {
  const questCard = questCardNumber ? questCardByNumber[questCardNumber] : undefined;
  const selectedTile = availableGoldenTiles.find((tile) => tile.id === selectedGoldenTileId);
  const selectedBoon = availableGoldenBoons.find((boon) => boon.id === selectedGoldenBoonId);

  return (
    <>
      {questCard && (
        <details className="welcome-optional welcome-quest" open>
          <summary><Shield size={17} aria-hidden="true" /><span>Quest Card No. {questCard.n}: {questCard.theme}<small>{completedLedgerCount} of 21 Quest Cards in the Steward’s Ledger</small></span><ChevronDown size={16} aria-hidden="true" /></summary>
          <div className="welcome-optional-fields">
            <QuestDrawn card={questCard} playerCount={playerCount} />
          </div>
        </details>
      )}
      <details className="welcome-optional">
        <summary><Shield size={17} aria-hidden="true" /><span>Golden Legacy<small>Optional. {availableGoldenTiles.length + availableGoldenBoons.length} unlocked</small></span><ChevronDown size={16} aria-hidden="true" /></summary>
        <div className="welcome-optional-fields">
          <label>Golden Tile<select value={selectedGoldenTileId} onChange={(event) => onGoldenTileChange(event.target.value)}><option value="">No Golden Tile</option>{availableGoldenTiles.map((tile) => <option key={tile.id} value={tile.id}>{tile.name}</option>)}</select></label>
          {selectedTile && <p>{selectedTile.effectText}</p>}
          <label>Golden Boon<select value={selectedGoldenBoonId} onChange={(event) => onGoldenBoonChange(event.target.value)}><option value="">No Golden Boon</option>{availableGoldenBoons.map((boon) => <option key={boon.id} value={boon.id}>{boon.name}</option>)}</select></label>
          {selectedBoon && <p>{selectedBoon.effectText}</p>}
          {!availableGoldenTiles.length && !availableGoldenBoons.length && <p>Golden pairs unlock at 3, 6, 9, 12 and 15 Quest Cards in your Steward’s Ledger. Your first settlement needs none of them.</p>}
        </div>
      </details>
    </>
  );
}
