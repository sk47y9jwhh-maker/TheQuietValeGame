export function validateGameLogRules(gameLog) {
  const errors = [];
  const expectedStandardReveals = gameLog.player_count * 12;
  const standardReveals = gameLog.encounters.standard_reveals;
  const goldenReveals = gameLog.encounters.golden_bonus_reveals ?? 0;
  const handCards = Object.values(gameLog.encounters.player_hands ?? {}).flat();

  if (standardReveals !== expectedStandardReveals) {
    errors.push(
      `Expected ${expectedStandardReveals} standard Encounter reveals, received ${standardReveals}.`,
    );
  }
  if (handCards.some((cardId) => String(cardId).startsWith("golden_"))) {
    errors.push("Golden Boons must never enter player hands.");
  }
  if ((gameLog.declared_vows ?? []).length > 1) {
    errors.push("Only one Steward's Ledger Vow may be declared per game.");
  }
  if (goldenReveals > 0 && gameLog.encounters.total_reveals !== standardReveals + goldenReveals) {
    errors.push("Golden Boons must be bonus reveals and cannot replace standard Encounter reveals.");
  }

  return errors;
}
