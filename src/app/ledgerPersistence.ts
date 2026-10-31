import {
  createEmptyLedgerCampaign,
  ledgerCampaignVersion,
  type LedgerCampaign,
  type LedgerGameRecord
} from "../engine/ledgerCampaign";
import { questCards } from "../data/questCards";
import { readStoredJsonResult, removeStoredItems, writeStoredJson, type StoredRead } from "./browserStorage";

export {
  countCompletedLedgerEntries,
  createEmptyLedgerCampaign,
  isGoldenMilestoneUnlocked,
  ledgerCampaignVersion,
  nextQuestCard,
  type LedgerCampaign,
  type LedgerGameRecord
} from "../engine/ledgerCampaign";

const ledgerCampaignKey = "quietVale.stewardsLedger.v1";
const cardNumbers = new Set(questCards.map((card) => card.n));

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

const isNumberArray = (value: unknown): value is number[] =>
  Array.isArray(value) && value.every((item) => typeof item === "number");

function isLedgerGameRecord(value: unknown): value is LedgerGameRecord {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.completedAt === "string" &&
    typeof value.playerCount === "number" &&
    Array.isArray(value.stewardIds) &&
    typeof value.finalScore === "number" &&
    typeof value.questCardNumber === "number" &&
    typeof value.questCompleted === "boolean"
  );
}

function isQuestLedger(value: unknown): value is LedgerCampaign {
  if (!isRecord(value) || value.version !== ledgerCampaignVersion) return false;
  if (!isNumberArray(value.deck) || !isNumberArray(value.box) || !Array.isArray(value.games)) return false;
  const all = [...value.deck, ...value.box];
  return all.length === cardNumbers.size && new Set(all).size === all.length &&
    all.every((n) => cardNumbers.has(n)) && value.games.every(isLedgerGameRecord);
}

/**
 * The old 50-entry Ledger kept completions per entry. Its Golden unlocks carry
 * over (by its own thresholds); its entries and history do not.
 */
function isOldLedger(value: unknown): value is { completions: Record<string, { completedOnce?: boolean; completedPlayerCounts?: number[] }>; pacingVersion?: number; grandfatheredGoldenMilestoneCount?: number } {
  return isRecord(value) && isRecord(value.completions) && Array.isArray(value.games);
}

/** Any stored or preview Ledger, in the current shape. */
export function normaliseLedgerCampaign(value: unknown): LedgerCampaign | null {
  if (isQuestLedger(value)) return value;
  if (!isOldLedger(value)) return null;
  const completed = Object.values(value.completions).filter(
    (entry) => entry?.completedOnce || (entry?.completedPlayerCounts?.length ?? 0) > 0
  ).length;
  const earned = [5, 12, 18, 25, 32].filter((threshold) => completed >= threshold).length;
  const legacyEarned = value.pacingVersion === 2 ? 0 : [5, 10, 15, 20, 30].filter((threshold) => completed >= threshold).length;
  const grandfathered = Math.max(value.grandfatheredGoldenMilestoneCount ?? 0, earned, legacyEarned);
  return { ...createEmptyLedgerCampaign(), ...(grandfathered > 0 ? { grandfatheredGoldenMilestoneCount: grandfathered } : {}) };
}

export function readLedgerCampaignResult(): StoredRead<LedgerCampaign> {
  const result = readStoredJsonResult(ledgerCampaignKey);
  if (!result.ok) return result;
  if (result.value === null) return { ok: true, value: null };
  const campaign = normaliseLedgerCampaign(result.value);
  return campaign ? { ok: true, value: campaign } : { ok: false, problem: "unreadable" };
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
