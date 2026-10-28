import { stewardById } from "../../data/stewards";
import { hasPreparedVial } from "./GoldenVialNotice";
import { encounterById } from "../../data/encounters";
import type { GameState, Season } from "../../engine/types";
import { getSeasonText } from "../common/gameText";

/** Explains public consequences without applying or simulating a game step. */
export function RoundEndPreview({ state }: { state: GameState }) {
  const nextSeason: Season | null = state.round === 4 ? 2 : state.round === 8 ? 3 : null;
  const nextLabel = nextSeason === 2 ? "II" : "III";
  const expiring = state.encounters.activeArrivals.filter((arrival) => arrival.timerTokens <= 1);
  const continuing = state.encounters.activeArrivals.filter((arrival) => arrival.timerTokens > 1);
  const leavingBoons = state.encounters.faceUpBoons.filter((boon) => (nextSeason && encounterById[boon.cardId]?.type !== "goldenBoon") || (boon.expiresAfterRound !== undefined && boon.expiresAfterRound <= state.round));
  const unusedPowers = state.boonModifiers.filter((modifier) => modifier.sourceType === "steward" && modifier.remainingUses > 0);
  return <section className="round-end-preview" aria-label="What happens at round end">
    <p className="round-end-next">{state.round === 12 ? "Next · Final scoring" : nextSeason ? `Next · Season ${nextLabel}, Round ${state.round + 1}` : `Next · Round ${state.round + 1}`}</p>
    {unusedPowers.length > 0 && (nextSeason || state.round === 12) && <div><h3>Unused Steward preparations end</h3><p>{unusedPowers.map((modifier) => stewardById[modifier.sourceCardId]?.name ?? modifier.name).join(", ")}: {state.round === 12 ? "the game ends after this round. No further tile actions follow." : "unused preparations expire with this Season. New Season powers become available after the transition."}</p></div>}
    {hasPreparedVial(state) && <div><h3>Unused Golden Vial preparation</h3><p>This prepared Travel placement ends with the round. {state.round === 12 ? "The game ends after these consequences." : "The Vial card stays in play for the next round."}</p></div>}
    {expiring.length > 0 && <div><h3>{expiring.length} Arrival{expiring.length === 1 ? " expires" : "s expire"} unresolved</h3><ul>{expiring.map((arrival) => <li key={arrival.cardId}>{encounterById[arrival.cardId]?.name ?? arrival.cardId}</li>)}</ul><p>Each expiry uses the Target Deck to add 1 Strain if a valid tile is available.</p></div>}
    {continuing.length > 0 && <div><h3>Arrival timers after this round</h3><ul>{continuing.map((arrival) => <li key={arrival.cardId}>{encounterById[arrival.cardId]?.name ?? arrival.cardId}<strong>{arrival.timerTokens - 1} remaining</strong></li>)}</ul></div>}
    {leavingBoons.length > 0 && <div><h3>Boons leaving play</h3><ul>{leavingBoons.map((boon) => <li key={boon.cardId}>{encounterById[boon.cardId]?.name ?? boon.cardId}</li>)}</ul></div>}
    {nextSeason && <div className="round-end-season"><h3>A new season begins</h3><p>Resolve any season-boundary effects, then each Steward seeds three cards from their remaining hand. Season-limited Steward powers become available again.</p>{state.encounters.activeBurdens.length > 0 && <details><summary>Season {nextLabel} Burden effects ({state.encounters.activeBurdens.length})</summary><p>Active Burdens stay in play. Resolve their new seasonal effects before seeding.</p><ul>{state.encounters.activeBurdens.map((cardId) => { const card = encounterById[cardId]; return card?.type === "burden" ? <li key={card.id}><strong>{card.name}</strong><span>{getSeasonText(card.effects, nextSeason)}</span></li> : null; })}</ul></details>}</div>}
    {state.round === 12 && <p>Resolve any pending consequences, then review the final score and record the settlement in your Ledger.</p>}
  </section>;
}
