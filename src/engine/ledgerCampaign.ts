export const ledgerCampaignVersion = 2;
export const ledgerCatalogueVersion = "v4.6" as const;

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
  newRecordEntryIds?: string[];
}

export interface LedgerCampaign {
  version: number;
  catalogueVersion?: typeof ledgerCatalogueVersion;
  pacingVersion?: 2;
  grandfatheredGoldenMilestoneCount?: number;
  completions: Record<string, LedgerCompletionRecord>;
  games: LedgerGameRecord[];
}

export function createEmptyLedgerCampaign(): LedgerCampaign {
  return {
    version: ledgerCampaignVersion,
    catalogueVersion: ledgerCatalogueVersion,
    pacingVersion: 2,
    completions: {},
    games: []
  };
}

export function countCompletedLedgerEntries(campaign: LedgerCampaign): number {
  return Object.values(campaign.completions).filter(
    (completion) =>
      completion.completedOnce || (completion.completedPlayerCounts?.length ?? 0) > 0
  ).length;
}

export function isGoldenMilestoneUnlocked(
  campaign: LedgerCampaign,
  milestoneIndex: number,
  threshold: number
): boolean {
  return (
    countCompletedLedgerEntries(campaign) >= threshold ||
    (campaign.grandfatheredGoldenMilestoneCount ?? 0) > milestoneIndex
  );
}
