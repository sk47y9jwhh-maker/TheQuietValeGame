export const ledgerCampaignVersion = 1;
const ledgerCampaignKey = "quietVale.stewardsLedger.v1";

export interface LedgerCompletionRecord {
  entryId: string;
  completedOnce: boolean;
  completedPlayerCounts: number[];
  firstCompletedAt?: string;
  firstGameId?: string;
  notes?: string;
}

export interface LedgerGameRecord {
  id: string;
  completedAt: string;
  playerCount: number;
  stewardIds: string[];
  finalScore: number;
  declaredVowId?: string;
  completedStewardObjectiveIds?: string[];
  completedEntryIds: string[];
}

export interface LedgerCampaign {
  version: number;
  completions: Record<string, LedgerCompletionRecord>;
  games: LedgerGameRecord[];
}

export function createEmptyLedgerCampaign(): LedgerCampaign {
  return {
    version: ledgerCampaignVersion,
    completions: {},
    games: []
  };
}

function canUseStorage(): boolean {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function isLedgerCampaign(value: unknown): value is LedgerCampaign {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<LedgerCampaign>;
  return (
    candidate.version === ledgerCampaignVersion &&
    Boolean(candidate.completions) &&
    !Array.isArray(candidate.completions) &&
    Array.isArray(candidate.games)
  );
}

export function readLedgerCampaign(): LedgerCampaign {
  if (!canUseStorage()) return createEmptyLedgerCampaign();

  try {
    const raw = window.localStorage.getItem(ledgerCampaignKey);
    if (!raw) return createEmptyLedgerCampaign();
    const parsed = JSON.parse(raw) as unknown;
    return isLedgerCampaign(parsed) ? parsed : createEmptyLedgerCampaign();
  } catch {
    return createEmptyLedgerCampaign();
  }
}

export function writeLedgerCampaign(campaign: LedgerCampaign) {
  if (!canUseStorage()) return;

  try {
    window.localStorage.setItem(ledgerCampaignKey, JSON.stringify(campaign));
  } catch {
    // Campaign tracking is additive; a storage failure must not interrupt a game.
  }
}

export function clearLedgerCampaign() {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(ledgerCampaignKey);
}

export function countCompletedLedgerEntries(campaign: LedgerCampaign): number {
  return Object.values(campaign.completions).filter(
    (completion) =>
      completion.completedOnce || (completion.completedPlayerCounts?.length ?? 0) > 0
  ).length;
}
