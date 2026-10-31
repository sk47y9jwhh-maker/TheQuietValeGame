import { getLedgerRun } from "../../engine/ledger";
import type { LedgerCampaign } from "../../engine/ledgerCampaign";
import { evaluateQuest, type QuestResult } from "../../engine/quests";
import type { GameState } from "../../engine/types";

export interface LedgerReview {
  recorded: boolean;
  recordedScore?: number;
  /** The game's Quest Card and where each half ended; null for a game without one. */
  quest: QuestResult | null;
  /** The card completes this game and was not already in the Ledger. */
  addsToLedger: boolean;
  /** Quest Cards in the Steward's Ledger once this game is recorded. */
  ledgerCount: number;
}

/** What the finished game means for the Steward's Ledger, recorded or not. */
export function summariseLedger(state: GameState, ledgerCampaign: LedgerCampaign | null | undefined) {
  const ledgerRun = getLedgerRun(state);
  const recordedGame = ledgerCampaign?.games.find((game) => game.id === ledgerRun.gameId);
  const gameRecorded = ledgerRun.recorded || Boolean(recordedGame);
  const quest = evaluateQuest(state);
  const inLedger = Boolean(quest && ledgerCampaign?.box.includes(quest.card.n));
  const addsToLedger = recordedGame
    ? recordedGame.questCompleted && Boolean(quest)
    : Boolean(quest?.complete) && !inLedger;
  const ledgerCount = (ledgerCampaign?.box.length ?? 0) + (!recordedGame && addsToLedger ? 1 : 0);
  return { ledgerRun, recordedGame, gameRecorded, quest, addsToLedger, ledgerCount };
}

/** The ledger prop for CompletedGameReview. */
export function completedReviewLedger(state: GameState, ledgerCampaign: LedgerCampaign | null | undefined): LedgerReview | undefined {
  if (!ledgerCampaign) return undefined;
  const summary = summariseLedger(state, ledgerCampaign);
  return {
    recorded: summary.gameRecorded,
    recordedScore: summary.recordedGame?.finalScore,
    quest: summary.quest,
    addsToLedger: summary.addsToLedger,
    ledgerCount: summary.ledgerCount
  };
}
