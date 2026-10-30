import { useEffect, useRef, useState } from "react";
import { ConfirmationDialog } from "../common/ConfirmationDialog";
import { BookMarked, Flag, Trophy } from "lucide-react";
import { calculateFinalScore, evaluateStewardObjectives } from "../../engine/scoring";
import type { GameState } from "../../engine/types";

interface Props {
  state: GameState;
  ledger?: { recorded: boolean; recordedScore?: number; eligibleCount: number; newEntries: { id: string; name: string }[] };
  onRecord?: () => void;
  onNewGame?: () => void;
}

function ScoreRow({ label, value, detail }: { label: string; value: number; detail: string }) {
  return <div className={value < 0 ? "score-loss" : "score-gain"}>
    <dt>{label}<small>{detail}</small></dt>
    <dd>{value < 0 ? `−${Math.abs(value)}` : value > 0 ? `+${value}` : "0"}</dd>
  </div>;
}

export function CompletedGameReview({ state, ledger, onRecord, onNewGame }: Props) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [confirmNewGame, setConfirmNewGame] = useState(false);
  useEffect(() => { heading.current?.focus(); }, []);
  const score = calculateFinalScore(state);
  const objectives = evaluateStewardObjectives(state);
  const renown = score.printedRenown + score.passiveRenown + score.stewardObjectiveRenown + score.goldenRenown;
  const penalties = score.burdenPenalty + score.failedArrivalPenalty + score.strainPenalty;
  const strain = state.map.placedTiles.reduce((total, tile) => total + tile.strain, 0);
  const overstrained = state.map.placedTiles.filter((tile) => tile.strain >= 3).length;
  return <article className="completed-game-review" aria-label="Completed settlement review">
    <header className="finale-heading">
      <div><p className="eyebrow">The story of your settlement</p><h1 ref={heading} tabIndex={-1}>Final scoring</h1><p>{state.round} rounds, {state.playerCount} Steward{state.playerCount === 1 ? "" : "s"}, one shared Vale</p></div>
      <div className="final-score-total"><Trophy size={26} aria-hidden="true" /><span>Final score</span><strong>{score.finalScore}</strong></div>
    </header>
    <p className="final-score-equation">{score.population} Population + {renown} Renown − {penalties} penalties = <strong>{score.finalScore}</strong></p>
    <div className="finale-columns">
      <section className="finale-score-card" aria-labelledby="final-score-breakdown">
        <h2 id="final-score-breakdown">How your score adds up</h2>
        <dl>
          <ScoreRow label="Population" value={score.population} detail={`${score.printedPopulation} printed + ${score.passivePopulation} from passive bonuses`} />
          <ScoreRow label="Printed Renown" value={score.printedRenown} detail="From eligible tiles in your settlement" />
          <ScoreRow label="Passive Renown" value={score.passiveRenown} detail="From tile arrangements and passive effects" />
          <ScoreRow label="Steward objectives" value={score.stewardObjectiveRenown} detail={`${objectives.filter((objective) => objective.met).length} of ${objectives.length} met at the end`} />
          <ScoreRow label="Golden Tile Renown" value={score.goldenRenown} detail="From completed Golden Tile conditions" />
          <ScoreRow label="Active Burdens" value={-score.burdenPenalty} detail={`${state.encounters.activeBurdens.length} remaining at the end`} />
          <ScoreRow label="Failed Arrivals" value={-score.failedArrivalPenalty} detail={`${score.failedArrivals} expired during the game`} />
          <ScoreRow label="Strain" value={-score.strainPenalty} detail={`${strain} Strain token${strain === 1 ? "" : "s"} on the board`} />
        </dl>
        <p className="finale-scoring-note">{overstrained} Overstrained tile{overstrained === 1 ? " contributes" : "s contribute"} no Population or Renown. Their Strain still counts toward the penalty.</p>
        <p className="finale-scoring-note">{state.encounters.activeArrivals.length} Arrival{state.encounters.activeArrivals.length === 1 ? " was" : "s were"} still active at the end. Active Arrivals add no final penalty.</p>
      </section>
      <div className="finale-record-column">
        <section className="finale-ledger" aria-label="Completed game Ledger review">
          <BookMarked size={24} aria-hidden="true" /><h2>Steward’s Ledger</h2>
          {ledger ? <>
            <p className="finale-ledger-status" role="status">{ledger.recorded ? "Game recorded" : "Ready to record this game"}</p>
            {ledger.recordedScore !== undefined && ledger.recordedScore !== score.finalScore && <p className="recorded-score-note">The Ledger keeps the recorded score of {ledger.recordedScore}. This board has changed since recording. It does not replace that result.</p>}
            <p>{ledger.eligibleCount} eligible {ledger.eligibleCount === 1 ? "entry" : "entries"} completed, {ledger.newEntries.length} new {ledger.newEntries.length === 1 ? "record" : "records"}</p>
            {ledger.newEntries.length > 0 && <ul>{ledger.newEntries.map((entry) => <li key={entry.id}><span>{entry.id}</span><strong>{entry.name}</strong></li>)}</ul>}
            <button className="primary-action" type="button" disabled={ledger.recorded} onClick={onRecord}>{ledger.recorded ? "Recorded in Ledger" : "Record this game"}</button>
            <p className="finale-scoring-note">{ledger.recorded ? "Your result and earned entries are recorded. Open the Ledger tab below to review your progress." : "Record your result before starting another settlement. Ledger progress is stored in this browser."}</p>
          </> : <p>The final score is ready to review.</p>}
          {onNewGame && <button className="finale-new-game" type="button" onClick={(event) => { event.currentTarget.focus({ preventScroll: true }); setConfirmNewGame(true); }}>Start another settlement</button>}
        </section>
        <section className="finale-objectives" aria-labelledby="final-objectives-title">
          <h2 id="final-objectives-title"><Flag size={20} aria-hidden="true" />Steward objectives</h2>
          {objectives.map((objective) => <article key={objective.playerId}>
            <header><div><strong>{objective.stewardName}</strong><small>{objective.playerName}</small></div><span>{objective.met ? `Met, +${objective.reward}` : "Not met"}</span></header>
            <p>{objective.objectiveText}</p>
          </article>)}
        </section>
      </div>
    </div>
    {confirmNewGame && onNewGame && <ConfirmationDialog title="Begin another settlement?" cancelLabel="Keep reviewing" confirmLabel="Begin new settlement" onCancel={() => setConfirmNewGame(false)} onConfirm={() => { setConfirmNewGame(false); onNewGame(); }}>
      {!ledger?.recorded && <p><strong>This completed game has not been recorded in the Ledger.</strong> Keep reviewing to record it first.</p>}
      <p>The current saved board and recent Undo/Redo history will be cleared. Recorded Ledger progress is kept.</p>
    </ConfirmationDialog>}
  </article>;
}
