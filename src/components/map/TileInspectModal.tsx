import { useEffect } from "react";
import { X } from "lucide-react";
import { mapById, terrainLabels } from "../../data/map";
import { coreTileById, specialTileById } from "../../data/tiles";
import { formatCategory, formatCost } from "../common/gameText";
import { selectTileName } from "../../engine/selectors";
import type { GameState, Terrain, TileSideData } from "../../engine/types";

interface TileInspectModalProps {
  state: GameState;
  placedTileId?: string | null;
  tileId?: string | null;
  onClose: () => void;
}

interface SidePanelProps {
  title: string;
  side: TileSideData;
  current: boolean;
}

function SidePanel({ title, side, current }: SidePanelProps) {
  return (
    <article className={`tile-inspect-side ${current ? "current" : ""}`}>
      <div className="tile-inspect-side-header">
        <strong>{title}</strong>
        {current && <span>Current</span>}
      </div>
      <p>
        Cost {side.alternateCostText ?? formatCost(side.cost)} | Pop {side.population} |
        Renown {side.renown}
      </p>
      <p>{side.effectText}</p>
    </article>
  );
}

export function TileInspectModal({
  state,
  placedTileId,
  tileId,
  onClose
}: TileInspectModalProps) {
  const placedTile = placedTileId
    ? state.map.placedTiles.find((tile) => tile.instanceId === placedTileId)
    : null;
  const inspectedTileId = placedTile?.tileId ?? tileId ?? null;
  const coreTile = inspectedTileId ? coreTileById[inspectedTileId] : null;
  const specialTile = inspectedTileId ? specialTileById[inspectedTileId] : null;
  const tileName =
    placedTile ? selectTileName(placedTile) : coreTile?.basic.name ?? specialTile?.name;
  const isOpen = Boolean(placedTile || coreTile || specialTile);

  useEffect(() => {
    if (!isOpen) return undefined;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !tileName) return null;

  const category = coreTile?.category ?? specialTile?.category;
  const placementText =
    coreTile?.placement?.text ??
    specialTile?.placement?.text ??
    "No placement restriction.";
  const terrainNames = Array.from(
    new Set(
      (placedTile?.hexIds ?? [])
        .map((hexId) => mapById[hexId]?.terrain)
        .filter((terrain): terrain is Terrain => Boolean(terrain))
        .map((terrain) => terrainLabels[terrain])
    )
  );
  const supported = placedTile
    ? placedTile.support.passive || placedTile.support.singleUse
    : false;
  const coreSupply = coreTile ? state.tileSupply.core[coreTile.id] ?? 0 : null;
  const specialSupply = specialTile ? state.tileSupply.special[specialTile.id] ?? 0 : null;

  return (
    <div className="tile-inspect-scrim" onClick={onClose}>
      <section
        aria-labelledby="tile-inspect-title"
        aria-modal="true"
        className="tile-inspect-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <button
          aria-label="Close tile inspection"
          className="tile-inspect-close"
          onClick={onClose}
          type="button"
        >
          <X size={18} />
        </button>
        <div className="tile-inspect-header">
          <p className="eyebrow">Tile Inspector</p>
          <h2 id="tile-inspect-title">{tileName}</h2>
          <span>{category ? formatCategory(category) : "Tile"}</span>
        </div>
        <div className="tile-inspect-meta">
          {placedTile ? (
            <>
              <span>Hex {placedTile.hexIds.join(", ")}</span>
              <span>{terrainNames.join(", ") || "Terrain unknown"}</span>
              <span>Strain {placedTile.strain}/3</span>
              <span>{supported ? "Supported" : "Not Supported"}</span>
            </>
          ) : (
            <>
              <span>{coreTile ? "Core Tile" : "Special Tile"}</span>
              {coreTile && <span>Supply {coreSupply}/{coreTile.count}</span>}
              {specialTile && (
                <span>
                  {specialSupply && specialSupply > 0 ? `${specialSupply} ready` : "Locked"}
                </span>
              )}
              <span>Size {coreTile?.size ?? specialTile?.size ?? 1}</span>
            </>
          )}
        </div>
        <div className="tile-inspect-rule">
          <strong>Placement</strong>
          <p>{placementText}</p>
        </div>
        {coreTile && (
          <div className="tile-inspect-side-list">
            <SidePanel
              current={placedTile?.side === "basic"}
              side={coreTile.basic}
              title={coreTile.basic.name}
            />
            <SidePanel
              current={placedTile?.side === "upgraded"}
              side={coreTile.upgraded}
              title={coreTile.upgraded.name}
            />
          </div>
        )}
        {specialTile && (
          <div className="tile-inspect-side-list">
            <article className="tile-inspect-side current">
              <div className="tile-inspect-side-header">
                <strong>{specialTile.name}</strong>
                <span>Special</span>
              </div>
              <p>
                Unlocked by {specialTile.unlockSource} | Pop {specialTile.population} |
                Renown {specialTile.renown}
              </p>
              <p>{specialTile.effectText}</p>
            </article>
          </div>
        )}
      </section>
    </div>
  );
}
