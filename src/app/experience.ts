import { getScenario, scenarioStorageVersion } from "./scenarioCatalog";

export const experienceIds = ["tabletop", "classic"] as const;
export type ExperienceId = (typeof experienceIds)[number];

export function getExperience(search = typeof window === "undefined" ? "" : window.location.search): ExperienceId | null {
  const value = new URLSearchParams(search).get("experience");
  return experienceIds.includes(value as ExperienceId) ? value as ExperienceId : null;
}

export function isTabletopExperience(): boolean {
  return getExperience() === "tabletop";
}

export function isPlayerExperience(): boolean {
  return getExperience() === "tabletop";
}

// Every comparison table, including the baseline, gets its own save space.
// Existing unscoped saves are never read, overwritten or removed by a preview.
export function getStorageKey(key: string, experience = getExperience()): string {
  if (!experience) return key;
  const scenario = getScenario();
  return scenario
    ? `quietVale.preview.${experience}.scenario.v${scenarioStorageVersion}.${scenario}.${key}`
    : `quietVale.preview.${experience}.${key}`;
}
