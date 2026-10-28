import { useEffect, useRef, useState, type ReactNode } from "react";
import { Eye, EyeOff, Hand } from "lucide-react";
import { isPlayerExperience } from "../../app/experience";
import { stewardById } from "../../data/stewards";
import { selectCurrentPlayer } from "../../engine/selectors";
import type { GameState } from "../../engine/types";

/** An explicit shared-device handoff; hidden cards are absent from the DOM. */
export function PrivateHandGate({ state, children, playerId }: { state: GameState; children: ReactNode; playerId?: string }) {
  const player = state.players.find((candidate) => candidate.id === playerId) ?? selectCurrentPlayer(state);
  const handKey = `${state.season}:${player.id}`;
  if (!isPlayerExperience() || state.players.length <= 1) return <>{children}</>;
  return <PrivateHandView key={handKey} player={player}>{children}</PrivateHandView>;
}

function PrivateHandView({ player, children }: { player: GameState["players"][number]; children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    (visible ? contentRef.current : headingRef.current)?.focus();
  }, [visible]);
  const steward = stewardById[player.stewardId];
  if (!visible) return (
    <section className="private-hand-gate" aria-label="Private hand handoff">
      <Hand size={32} aria-hidden="true" />
      <p className="eyebrow">Shared device · private hand</p>
      <h2 ref={headingRef} tabIndex={-1}>Pass to {player.name}.</h2>
      <p>Only <strong>{steward.name}</strong> should look at these cards. Let the other Stewards look away, then reveal your hand.</p>
      <button type="button" className="primary-action" onClick={() => setVisible(true)}><Eye size={18} aria-hidden="true" />Reveal {steward.name}’s hand</button>
      <small>Your cards stay hidden until you are ready.</small>
    </section>
  );
  return (
    <div className="private-hand-content">
      <div className="private-hand-bar" ref={contentRef} tabIndex={-1} role="group" aria-label={`${steward.name}’s private hand`}><span><Eye size={16} aria-hidden="true" />{player.name} · {steward.name}’s private hand</span><button type="button" onClick={() => setVisible(false)}><EyeOff size={17} aria-hidden="true" />Hide hand</button></div>
      {children}
    </div>
  );
}
