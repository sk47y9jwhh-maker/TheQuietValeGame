import { Term } from "./Term";
import { readyEnhancers } from "./tableActions";
import { EncounterCard } from "../common/EncounterCard";
import { useEffect, useMemo, useRef, useState } from "react";
import { arrivalRequirementRules, getBurdenResolutionCost } from "../../data/contentRules";
import { encounterById } from "../../data/encounters";
import { resourceLabels, resources } from "../../data/resources";
import { specialTileBackNumbers } from "../../data/specialTileNumbers";
import { stewardById } from "../../data/stewards";
import { specialTileById } from "../../data/tiles";
import {
  canCompleteArrival,
  canResolveBurden,
  canUseStewardPower,
  getUsableFaceUpBoonIds
} from "../../engine/gameActions";
import type { GameState, ResourceCost, Season } from "../../engine/types";
import type { EncounterData } from "../../engine/types";
import { seatColors } from "./boardGeometry";

interface TableRailProps {
  state: GameState;
  newCardIds: ReadonlySet<string>;
  onCompleteArrival: (cardId: string) => void;
  onResolveBurden: (cardId: string) => void;
  onUseBoon: (cardId: string) => void;
  onUseStewardPower: () => void;
  onPlaceSpecial: (tileId: string) => void;
  onEndTurn: () => void;
  onReveal: () => void;
  onEndRound: () => void;
}

const seasonKey = (season: Season) => `season${season}` as const;

function costEntries(cost: ResourceCost) {
  return resources.filter((resource) => cost[resource] > 0).map((resource) => ({ resource, amount: cost[resource] }));
}

function specialNumber(tileId: string): string {
  return (specialTileBackNumbers[tileId] ?? []).join(" & ");
}

export function TableRail(props: TableRailProps) {
  const [openCard, setOpenCard] = useState<string | null>(null);
  const [powerOpen, setPowerOpen] = useState(false);
  const { state } = props;
  // Boons and powers that the action cards offer directly ("with …").
  const foldable = useMemo(() => new Set(readyEnhancers(state).map((enhancer) => enhancer.kind === "power" ? "power" : enhancer.id)), [state]);
  const playerIndex = state.players.findIndex((player) => player.id === state.currentPlayerId);
  const player = state.players[playerIndex];
  const steward = player ? stewardById[player.stewardId] : undefined;
  const nextPlayer = state.players.find((candidate) => candidate.id !== player?.id && !state.playersActedThisRound.includes(candidate.id));
  const power = player ? canUseStewardPower(state, player.id) : { ok: false, reasons: [] };
  const powerUsed = player ? (player.stewardPowerUsesBySeason[state.season] ?? 0) >= 1 : true;
  const usableBoons = new Set(getUsableFaceUpBoonIds(state));
  const readySpecials = Object.entries(state.tileSupply.special).filter(([, count]) => count > 0).map(([tileId]) => tileId).filter((tileId) => specialTileById[tileId]);
  const urgent = urgentLine(state);
  const encounterCount = state.encounters.activeArrivals.length + state.encounters.activeBurdens.length + state.encounters.faceUpBoons.length;

  return <aside className="table-rail" aria-label="Turn and encounters">
    {state.phase === "turns" && player && <section className="rail-turn" aria-label="Current turn">
      <div className="rail-turn-head">
        <span className="rail-avatar" style={{ background: seatColors[playerIndex % seatColors.length] }} aria-hidden="true">{steward?.name.slice(0, 1)}</span>
        <div>
          <h2>{state.players.length > 1 ? `${steward?.name ?? player.name}’s turn` : "Your turn"}{state.bonusTurnsActive ? " (bonus turn)" : ""}</h2>
          <p className="rail-actions" aria-label={`${state.actionsRemaining} of 4 actions left`}>
            {[0, 1, 2, 3].map((index) => <span key={index} className={index < state.actionsRemaining ? "is-left" : ""} />)}
            <span>{state.actionsRemaining} {state.actionsRemaining === 1 ? "action" : "actions"} left</span>
          </p>
        </div>
        {nextPlayer && <p className="rail-next">Next<br /><strong>{stewardById[nextPlayer.stewardId]?.name ?? nextPlayer.name}</strong></p>}
      </div>
      {state.actionsRemaining > 0 && <p className="rail-how">{player && !player.hasPlacedFirstTile ? `Start by building on your Steward’s space at ${player.stewardHexId}.` : "Tap a tile on the board to use it, or an empty space to build."}</p>}
      {steward && <div className={`rail-power${power.ok ? " is-ready" : ""}`}>
        <div>
          <strong>{steward.name} <Term id="stewardPower">power</Term>{powerUsed ? ", used this Season" : power.ok ? ", ready" : ""}</strong>
          <p className={powerOpen ? "" : "is-clamped"} id="rail-power-text">{steward.powerText}</p>
          {power.ok && foldable.has("power") && <p className="rail-folded">Offered on matching actions. Tap a tile or a space and choose “with {steward.name}’s power”.</p>}
          <button type="button" className="rail-power-more" aria-expanded={powerOpen} aria-controls="rail-power-text" onClick={() => setPowerOpen((open) => !open)}>{powerOpen ? "Show less" : "Read the full power"}</button>
        </div>
        {power.ok && !foldable.has("power") && <button type="button" aria-label="Use Steward Power" onClick={props.onUseStewardPower}>Use</button>}
      </div>}
      {state.boonModifiers.length > 0 && <ul className="rail-prepared" aria-label="Prepared effects">
        {state.boonModifiers.map((modifier) => <li key={modifier.id}><strong>{modifier.name}</strong> {modifier.effectText}</li>)}
      </ul>}
    </section>}

    {state.phase === "reveal" && <section className="rail-phase">
      <h2>Round {state.round}</h2>
      <p>Revealing this round’s encounters…</p>
      <button type="button" className="rail-primary" onClick={props.onReveal}>Reveal encounters</button>
    </section>}
    {state.phase === "endRound" && <section className="rail-phase">
      <h2>End of round {state.round}</h2>
      <p>Arrivals lose a timer and round effects refresh.</p>
      <button type="button" className="rail-primary" onClick={props.onEndRound}>Continue</button>
    </section>}

    {urgent && <p className={`rail-urgent rail-urgent-${urgent.tone}`} role="status">{urgent.text}</p>}

    <div className="rail-heading"><h2>On the table</h2><span>{encounterCount === 0 ? "No encounters" : `${encounterCount} encounter${encounterCount === 1 ? "" : "s"}`}</span></div>
    <div className="rail-cards">
      {state.encounters.activeArrivals.map((arrival) => {
        const card = encounterById[arrival.cardId];
        if (!card || card.type !== "arrival") return null;
        const validation = canCompleteArrival(state, arrival.cardId);
        const cost = arrivalRequirementRules[arrival.cardId]?.cost;
        const rewards = card.rewardSpecialTileIds.map((tileId) => specialTileById[tileId]?.name).filter(Boolean);
        const uniqueRewards = [...new Set(rewards)];
        return <article key={arrival.cardId} className={`rail-card rail-arrival${arrival.timerTokens === 1 ? " is-urgent" : ""}${props.newCardIds.has(arrival.cardId) ? " is-new" : ""}`}>
          <CardFace card={card} timers={arrival.timerTokens} season={state.season} onOpen={setOpenCard} />
          <div className="rail-card-body">
            <p className="rail-card-kind"><span><Term id="arrival" />{props.newCardIds.has(arrival.cardId) && <em className="rail-new">new</em>}</span><Timers count={arrival.timerTokens} /></p>
            <h3>{card.name}</h3>
            {cost && <ul className="rail-needs" aria-label="Requirement">
              {costEntries(cost).map(({ resource, amount }) => {
                const have = state.warehouse[resource];
                return <li key={resource} className={have >= amount ? "is-met" : "is-short"}>{amount} {resourceLabels[resource]}{have >= amount ? " ✓" : `, have ${have}`}</li>;
              })}
            </ul>}
            {validation.ok && cost && costEntries(cost).some(({ resource, amount }) => state.warehouse[resource] < amount) && <p className="rail-card-help">A payment effect, such as a Merchant exchange, covers the shortfall. You choose it on the next step.</p>}
            <p className="rail-card-note">Unlocks {uniqueRewards.join(" & ")}{card.rewardSpecialTileIds.length ? ` (tile ${specialNumber(card.rewardSpecialTileIds[0])})` : ""}</p>
            {state.phase === "turns" && <button type="button" disabled={!validation.ok} onClick={() => props.onCompleteArrival(arrival.cardId)} title={validation.ok ? undefined : validation.reasons.join(" ")}>
              {validation.ok ? "Complete for 1 action" : arrival.timerTokens === 1 ? "Leaves at round end" : "Not yet"}
            </button>}
          </div>
        </article>;
      })}
      {state.encounters.activeBurdens.map((cardId) => {
        const card = encounterById[cardId];
        if (!card || card.type !== "burden") return null;
        const validation = canResolveBurden(state, cardId);
        const cost = getBurdenResolutionCost(cardId, state.season);
        const resolution = card.resolutions?.[seasonKey(state.season)] ?? card.resolutionText ?? "";
        return <article key={cardId} className={`rail-card rail-burden${props.newCardIds.has(cardId) ? " is-new" : ""}`}>
          <CardFace card={card} season={state.season} onOpen={setOpenCard} />
          <div className="rail-card-body">
            <p className="rail-card-kind"><span><Term id="burden" />, Season {["", "I", "II", "III"][state.season]}{props.newCardIds.has(cardId) && <em className="rail-new">new</em>}</span><span>{state.ignoredBurdenIdsThisRound.includes(cardId) ? "Ignored this round" : state.season < 3 ? "Returns next Season" : "Active"}</span></p>
            <h3>{card.name}</h3>
            <p className="rail-card-text">{card.effects[seasonKey(state.season)]}</p>
            <p className="rail-card-note">To resolve: {resolution.replace(/,? discard\.?$/i, "")}{cost ? "" : ""}</p>
            {state.phase === "turns" && <button type="button" disabled={!validation.ok} onClick={() => props.onResolveBurden(cardId)} title={validation.ok ? undefined : validation.reasons.join(" ")}>
              {validation.ok ? "Resolve for 1 action" : "Can’t resolve yet"}
            </button>}
          </div>
        </article>;
      })}
      {state.encounters.faceUpBoons.map((boon) => {
        const card = encounterById[boon.cardId];
        if (!card || (card.type !== "boon" && card.type !== "goldenBoon")) return null;
        const text = card.type === "boon" ? card.effects[seasonKey(state.season)] : card.effectText;
        const usable = usableBoons.has(boon.cardId);
        return <article key={boon.cardId} className={`rail-card rail-boon${usable ? "" : " is-muted"}${props.newCardIds.has(boon.cardId) ? " is-new" : ""}`}>
          <CardFace card={card} season={state.season} onOpen={setOpenCard} />
          <div className="rail-card-body">
            <p className="rail-card-kind"><span>{card.type === "goldenBoon" ? "Golden Boon" : <Term id="boon" />}{props.newCardIds.has(boon.cardId) && <em className="rail-new">new</em>}</span><span>{card.type === "goldenBoon" ? (boon.lastUsedRound === state.round ? "Used this round" : "Once per round") : `${boon.remainingUses} use${boon.remainingUses === 1 ? "" : "s"} left`}</span></p>
            <h3>{card.name}</h3>
            <p className="rail-card-text">{text}</p>
            {state.phase === "turns" && usable && foldable.has(boon.cardId) && <p className="rail-folded">Offered on matching actions as you play.</p>}
            {state.phase === "turns" && usable && !foldable.has(boon.cardId) && <button type="button" onClick={() => props.onUseBoon(boon.cardId)}>Use · free</button>}
          </div>
        </article>;
      })}
    </div>

    {readySpecials.length > 0 && <section className="rail-ready" aria-label="Unlocked Special Tiles">
      {readySpecials.map((tileId) => <div key={tileId} className="rail-ready-item">
        <div><span>Ready to build</span><strong>{specialTileById[tileId].name} · {specialNumber(tileId)}</strong><small>1 action, no resources</small></div>
        {state.phase === "turns" && <button type="button" onClick={() => props.onPlaceSpecial(tileId)}>Place</button>}
      </div>)}
    </section>}

    {state.phase === "turns" && <EndTurn state={state} onEndTurn={props.onEndTurn} />}
    {openCard && <CardReader cardId={openCard} state={state} onClose={() => setOpenCard(null)} />}
  </aside>;
}

/** The printed card, small, as it would sit on the table. Tap to read it full size. */
function CardFace({ card, timers, season, onOpen }: { card: EncounterData; timers?: number; season: Season; onOpen: (cardId: string) => void }) {
  return <button type="button" className="rail-card-face" aria-label={`Read the full card: ${card.name}`} onClick={() => onOpen(card.id)}>
    <EncounterCard card={card} currentSeason={season} size="mini" timers={timers} aria-hidden="true" />
  </button>;
}

/** The full-size printed card, over the table. */
function CardReader({ cardId, state, onClose }: { cardId: string; state: GameState; onClose: () => void }) {
  const card = encounterById[cardId];
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => { close.current?.focus(); }, []);
  if (!card) return null;
  const timers = state.encounters.activeArrivals.find((arrival) => arrival.cardId === cardId)?.timerTokens;
  return <div className="card-reader" role="dialog" aria-modal="true" aria-label={card.name} onClick={onClose} onKeyDown={(event) => { if (event.key === "Escape") onClose(); }}>
    <div className="card-reader-body" onClick={(event) => event.stopPropagation()}>
      <EncounterCard card={card} currentSeason={state.season} timers={timers} />
      <button type="button" ref={close} className="card-reader-close" onClick={onClose}>Back to the table</button>
    </div>
  </div>;
}

function Timers({ count }: { count: number }) {
  return <span className="rail-timers" role="img" aria-label={`${count} timer${count === 1 ? "" : "s"} left`}>
    {[0, 1, 2].map((index) => <span key={index} className={index < count ? count === 1 ? "is-last" : "is-on" : ""} />)}
  </span>;
}

function urgentLine(state: GameState): { text: string; tone: "warn" | "good" } | null {
  if (state.phase !== "turns") return null;
  for (const arrival of state.encounters.activeArrivals) {
    if (arrival.timerTokens !== 1) continue;
    const card = encounterById[arrival.cardId];
    if (!card) continue;
    const validation = canCompleteArrival(state, arrival.cardId);
    if (validation.ok) return { tone: "good", text: `${card.name} leaves at the end of this round. You can welcome them now.` };
    const shortfall = Object.entries(validation.missingResources ?? {}).filter(([, amount]) => amount).map(([resource, amount]) => `${amount} ${resourceLabels[resource as keyof typeof resourceLabels]}`);
    return { tone: "warn", text: `${card.name} leaves at the end of this round${shortfall.length ? `. You need ${shortfall.join(" and ")} more.` : "."}` };
  }
  const ready = state.encounters.activeArrivals.find((arrival) => canCompleteArrival(state, arrival.cardId).ok);
  if (ready) return { tone: "good", text: `You can complete ${encounterById[ready.cardId]?.name ?? "an Arrival"} now.` };
  return null;
}

function EndTurn({ state, onEndTurn }: { state: GameState; onEndTurn: () => void }) {
  const [confirming, setConfirming] = useState(false);
  useEffect(() => setConfirming(false), [state.currentPlayerId, state.round, state.actionsRemaining]);
  const lastTurn = state.players.every((player) => player.id === state.currentPlayerId || state.playersActedThisRound.includes(player.id));
  const failing = lastTurn ? state.encounters.activeArrivals.filter((arrival) => arrival.timerTokens === 1).map((arrival) => encounterById[arrival.cardId]?.name).filter(Boolean) : [];
  const consequence = lastTurn
    ? failing.length
      ? `Ends round ${state.round}. ${failing.join(" and ")} will leave unwelcomed and add Strain.`
      : `Ends round ${state.round}.${state.round === 12 ? " Final scoring follows." : state.round % 4 === 0 ? " The Season changes." : ""}`
    : undefined;
  if (confirming) return <div className="rail-end is-confirming" role="group" aria-label="Confirm end of turn">
    <p>End the turn with {state.actionsRemaining} {state.actionsRemaining === 1 ? "action" : "actions"} unused?{consequence ? ` ${consequence}` : ""}</p>
    <div><button type="button" className="rail-primary" onClick={onEndTurn}>End turn</button><button type="button" onClick={() => setConfirming(false)}>Keep playing</button></div>
  </div>;
  return <div className="rail-end">
    {consequence && <p>{consequence}</p>}
    <button type="button" className={state.actionsRemaining === 0 ? "rail-primary" : "rail-secondary"} onClick={() => state.actionsRemaining > 0 ? setConfirming(true) : onEndTurn()}>
      {state.actionsRemaining === 0 ? "End turn" : `End turn with ${state.actionsRemaining} action${state.actionsRemaining === 1 ? "" : "s"} unused`}
    </button>
  </div>;
}
