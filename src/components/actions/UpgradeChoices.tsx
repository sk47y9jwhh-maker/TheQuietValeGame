import { useEffect, useRef } from "react";
import { canStartUpgradeTile } from "../../engine/gameActions";
import type { GameState } from "../../engine/types";
import { getActionPreparationIds } from "./preparedActions";
import { TileActionList } from "./TileActionList";

export function UpgradeChoices({ state, selectedHexIds, onUpgrade, onInspect }: {
  state: GameState; selectedHexIds: string[]; onUpgrade: (id: string) => void; onInspect: (id: string) => void;
}) {
  const regionRef = useRef<HTMLElement>(null);
  const prepared = getActionPreparationIds(state, "upgrade").join("|");
  useEffect(() => {
    if (!prepared) return;
    const frame = requestAnimationFrame(() => {
      const target = regionRef.current;
      if (!target || target.closest("[hidden]")) return;
      target.focus({ preventScroll: true });
      target.querySelector("h4")?.scrollIntoView?.({ block: "nearest" });
    });
    return () => cancelAnimationFrame(frame);
  }, [prepared]);
  const basic = state.map.placedTiles.filter((tile) => tile.kind === "core" && tile.side === "basic");
  const available = basic.filter((tile) => canStartUpgradeTile(state, state.currentPlayerId, tile.instanceId).ok).map((tile) => tile.instanceId);
  const blocked = basic.filter((tile) => !available.includes(tile.instanceId)).map((tile) => tile.instanceId);
  return <section ref={regionRef} tabIndex={-1} aria-label="Core upgrades" className="upgrade-choices">
    <h4>{available.length ? `${available.length} ${available.length === 1 ? "upgrade" : "upgrades"} available` : "No upgrade available now"}</h4>
    {basic.length === 0 ? <p>Build a basic Core Tile first. Special Tiles and tiles already on their upgraded side cannot upgrade.</p>
      : available.length === 0 && <p>{prepared ? "Reach, Strain and resources still apply to a 0-action upgrade. " : ""}Review the tiles below for their current reach, Strain, action and resource requirements.</p>}
    <TileActionList state={state} ids={available} mode="upgrade" selectedHexIds={selectedHexIds} onAction={onUpgrade} onInspect={onInspect} />
    {blocked.length > 0 && <details className="blocked-upgrades"><summary>Unavailable upgrades ({blocked.length})</summary>
      <TileActionList state={state} ids={blocked} mode="upgrade" selectedHexIds={selectedHexIds} onAction={onUpgrade} onInspect={onInspect} />
    </details>}
  </section>;
}
