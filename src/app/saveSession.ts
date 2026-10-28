import type { StorageResult } from "./browserStorage";
import { writeLedgerCampaign } from "./ledgerPersistence";
import { clearSavedGame, writeSavedGame, writeSavedSetup } from "./persistence";
import type { PreviewSnapshot } from "./scenarioTypes";

/** Save the current session, never a stale failed action. Campaign goes first so
 * a board cannot claim a new recorded result before that result is stored. */
export function saveSession(snapshot: PreviewSnapshot, simulateFullStore = false): StorageResult {
  if (simulateFullStore) return { ok: false, problem: "full" };
  const campaign = writeLedgerCampaign(snapshot.campaign);
  if (!campaign.ok) return campaign;
  if (snapshot.state) return writeSavedGame({ ...snapshot.setup, state: snapshot.state });
  const setup = writeSavedSetup(snapshot.setup);
  if (!setup.ok) return setup;
  // A failed removal matters: otherwise reloading would resurrect the old game.
  return clearSavedGame();
}
