export const ledgerCampaignVersion = 2;
const ledgerCampaignKey = "quietVale.stewardsLedger.v1";
const ledgerCatalogueVersion = "v4.6" as const;

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

function canUseStorage(): boolean {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function isLedgerCampaignShape(value: unknown): value is LedgerCampaign {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<LedgerCampaign>;
  return (
    typeof candidate.version === "number" &&
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
    if (!isLedgerCampaignShape(parsed)) return createEmptyLedgerCampaign();
    if (
      parsed.version === ledgerCampaignVersion &&
      parsed.catalogueVersion === ledgerCatalogueVersion
    ) return parsed;

    // Entry IDs were reassigned in v4.6, so old ticks cannot be carried safely.
    // Preserve the highest Golden unlock tier already earned, then begin the new
    // catalogue with a clean achievement record.
    const completed = countCompletedLedgerEntries(parsed);
    const currentMilestones = [5, 12, 18, 25, 32];
    const earnedMilestones = currentMilestones.filter(
      (threshold) => completed >= threshold
    ).length;
    const legacyPacingMilestones = parsed.pacingVersion === 2
      ? 0
      : [5, 10, 15, 20, 30].filter((threshold) => completed >= threshold).length;
    const grandfatheredGoldenMilestoneCount = Math.max(
      parsed.grandfatheredGoldenMilestoneCount ?? 0,
      earnedMilestones,
      legacyPacingMilestones
    );
    return {
      ...createEmptyLedgerCampaign(),
      grandfatheredGoldenMilestoneCount
    };
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
