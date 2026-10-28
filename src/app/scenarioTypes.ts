import type { GameState } from "../engine/types";
import type { LedgerCampaign } from "../engine/ledgerCampaign";
import type { SavedSetup } from "./persistence";

export interface PreviewSnapshot {
  setup: Omit<SavedSetup, "version" | "savedAt">;
  state: GameState | null;
  campaign: LedgerCampaign;
}
