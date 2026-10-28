import {
  countCompletedLedgerEntries,
  createEmptyLedgerCampaign,
  ledgerCampaignVersion,
  ledgerCatalogueVersion,
  type LedgerCampaign,
  type LedgerCompletionRecord,
  type LedgerGameRecord
} from "../engine/ledgerCampaign";
import { readStoredJsonResult, removeStoredItems, writeStoredJson, type StoredRead } from "./browserStorage";

export {
  countCompletedLedgerEntries,
  createEmptyLedgerCampaign,
  isGoldenMilestoneUnlocked,
  ledgerCampaignVersion,
  type LedgerCampaign,
  type LedgerCompletionRecord,
  type LedgerGameRecord
} from "../engine/ledgerCampaign";

const ledgerCampaignKey = "quietVale.stewardsLedger.v1";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isLedgerCompletionRecord(value: unknown): value is LedgerCompletionRecord {
  return (
    isRecord(value) &&
    typeof value.entryId === "string" &&
    typeof value.completedOnce === "boolean" &&
    Array.isArray(value.completedPlayerCounts) &&
    value.completedPlayerCounts.every((count) => typeof count === "number")
  );
}

function isLedgerGameRecord(value: unknown): value is LedgerGameRecord {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.completedAt === "string" &&
    typeof value.playerCount === "number" &&
    isStringArray(value.stewardIds) &&
    typeof value.finalScore === "number" &&
    isStringArray(value.completedEntryIds) &&
    (value.completedStewardObjectiveIds === undefined ||
      isStringArray(value.completedStewardObjectiveIds)) &&
    (value.newRecordEntryIds === undefined || isStringArray(value.newRecordEntryIds))
  );
}

function isLedgerCampaignShape(value: unknown): value is LedgerCampaign {
  if (!isRecord(value) || !isRecord(value.completions) || !Array.isArray(value.games)) {
    return false;
  }
  return (
    typeof value.version === "number" &&
    Object.values(value.completions).every(isLedgerCompletionRecord) &&
    value.games.every(isLedgerGameRecord)
  );
}

export function readLedgerCampaignResult(): StoredRead<LedgerCampaign> {
  const result = readStoredJsonResult(ledgerCampaignKey);
  if (!result.ok) return result;
  if (result.value === null) return { ok: true, value: null };
  const parsed = result.value;
  if (!isLedgerCampaignShape(parsed)) return { ok: false, problem: "unreadable" };
  if (
    parsed.version === ledgerCampaignVersion &&
    parsed.catalogueVersion === ledgerCatalogueVersion
  ) return { ok: true, value: parsed };

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
    ok: true,
    value: { ...createEmptyLedgerCampaign(), grandfatheredGoldenMilestoneCount }
  };
}

export function readLedgerCampaign(fallback?: LedgerCampaign): LedgerCampaign {
  const result = readLedgerCampaignResult();
  return result.ok ? result.value ?? fallback ?? createEmptyLedgerCampaign() : fallback ?? createEmptyLedgerCampaign();
}

export function writeLedgerCampaign(campaign: LedgerCampaign) {
  return writeStoredJson(ledgerCampaignKey, campaign);
}

export function clearLedgerCampaign() {
  return removeStoredItems(ledgerCampaignKey);
}
