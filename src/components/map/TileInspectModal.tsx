import { TileArtwork } from "../common/TileArtwork";
import { isolateModalBackground } from "../common/modalIsolation";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { mapById, terrainLabels } from "../../data/map";
import { coreTileById, goldenTileById, specialTileById } from "../../data/tiles";
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
  tileId: string;
  face: "basic" | "upgraded";
  side: TileSideData;
  current: boolean;
}

function SidePanel({ title, side, current, tileId, face }: SidePanelProps) {
  return (
    <article className={`tile-inspect-side ${current ? "current" : ""}`}>
      <div className="tile-inspect-side-header">
        <strong>{title}</strong>
        {current && <span>Current</span>}
      </div>
      <TileArtwork tileId={tileId} side={face} name={title} />
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
  const goldenTile = inspectedTileId ? goldenTileById[inspectedTileId] : null;
  const tileName =
    placedTile ? selectTileName(placedTile) : coreTile?.basic.name ?? specialTile?.name;
  const isOpen = Boolean(placedTile || coreTile || specialTile);

  const scrimRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!isOpen) return undefined;
    const opener = document.activeElement;
    const controls = () => Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ) ?? []);
    (controls()[0] ?? dialogRef.current)?.focus({ preventScroll: true });
    const restoreBackground = isolateModalBackground(scrimRef.current);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
      }
      if (event.key !== "Tab") return;
      const items = controls();
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) { event.preventDefault(); dialogRef.current?.focus(); return; }
      if (!dialogRef.current?.contains(document.activeElement) ||
          (event.shiftKey && document.activeElement === first) ||
          (!event.shiftKey && document.activeElement === last)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      restoreBackground();
      if ((opener instanceof HTMLElement || opener instanceof SVGElement) && opener.isConnected) opener.focus({ preventScroll: true });
    };
  }, [isOpen]);

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
    <div ref={scrimRef} className="tile-inspect-scrim" onClick={onClose}>
      <section
        aria-labelledby="tile-inspect-title"
        aria-modal="true"
        className="tile-inspect-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        ref={dialogRef}
        tabIndex={-1}
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
              <span>{coreTile ? "Core Tile" : goldenTile ? "Golden Tile" : "Special Tile"}</span>
              {coreTile && <span>Supply {coreSupply}/{coreTile.count}</span>}
              {specialTile && !goldenTile && (
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
              tileId={coreTile.id}
              face="basic"
              current={placedTile?.side === "basic"}
              side={coreTile.basic}
              title={coreTile.basic.name}
            />
            <SidePanel
              tileId={coreTile.id}
              face="upgraded"
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
                <span>{goldenTile ? "Golden" : "Special"}</span>
              </div>
              <TileArtwork tileId={specialTile.id} name={specialTile.name} />
              <p>
                Unlocked by {specialTile.unlockSource} | Pop {specialTile.population} |
                Renown {specialTile.renown}
              </p>
              <p>{specialTile.effectText}</p>
              {goldenTile && <p><strong>Scoring:</strong> {goldenTile.scoringText}</p>}
            </article>
          </div>
        )}
      </section>
    </div>
  );
}
