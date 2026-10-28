import { evaluateLedgerEntries, getLedgerRun } from "../../engine/ledger";
import type { LedgerCampaign } from "../../engine/ledgerCampaign";
import type { GameState } from "../../engine/types";

/** What the finished game earned in the Steward's Ledger, recorded or not. */
export function summariseLedger(state: GameState, ledgerCampaign: LedgerCampaign | null | undefined) {
  const ledgerRun = getLedgerRun(state);
  const ledgerEvaluations = ledgerCampaign ? evaluateLedgerEntries(state, ledgerCampaign) : [];
  const recordedGame = ledgerCampaign?.games.find((game) => game.id === ledgerRun.gameId);
  const gameRecorded = ledgerRun.recorded || Boolean(recordedGame);
  const recordedEntryIds = new Set(recordedGame?.completedEntryIds ?? []);
  const newRecordEntryIds = new Set(
    recordedGame?.newRecordEntryIds ?? recordedGame?.completedEntryIds ?? []
  );
  const ledgerAchievements = recordedGame
    ? ledgerEvaluations.filter((evaluation) => recordedEntryIds.has(evaluation.entry.id))
    : ledgerEvaluations.filter((evaluation) => evaluation.eligible && evaluation.met);
  const newLedgerAchievements = recordedGame
    ? ledgerEvaluations.filter((evaluation) => newRecordEntryIds.has(evaluation.entry.id))
    : ledgerAchievements.filter((evaluation) => {
        const completion = ledgerCampaign?.completions[evaluation.entry.id];
        return !completion || (
          evaluation.entry.playerCountPrestige &&
          !completion.completedPlayerCounts?.includes(state.playerCount)
        );
      });
  return { ledgerRun, ledgerEvaluations, recordedGame, gameRecorded, ledgerAchievements, newLedgerAchievements };
}

/** The ledger prop for CompletedGameReview. */
export function completedReviewLedger(state: GameState, ledgerCampaign: LedgerCampaign | null | undefined) {
  if (!ledgerCampaign) return undefined;
  const summary = summariseLedger(state, ledgerCampaign);
  return {
    recorded: summary.gameRecorded,
    recordedScore: summary.recordedGame?.finalScore,
    eligibleCount: summary.ledgerAchievements.length,
    newEntries: summary.newLedgerAchievements.map(({ entry }) => ({ id: entry.id, name: entry.name }))
  };
}
