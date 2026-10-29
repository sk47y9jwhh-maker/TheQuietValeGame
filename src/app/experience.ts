import { getScenario, scenarioStorageVersion } from "./scenarioCatalog";

export const experienceIds = ["table", "tabletop", "classic"] as const;
export type ExperienceId = (typeof experienceIds)[number];

/** Optional build-time default, used by hosted previews that cannot carry a query string. */
const defaultExperience = (import.meta.env?.VITE_DEFAULT_EXPERIENCE ?? "") as string;

/** The published site: one layout, without the review studio's comparison links. */
export const isHostedDemo = Boolean(defaultExperience);

export function getExperience(search = typeof window === "undefined" ? "" : window.location.search): ExperienceId | null {
  const params = new URLSearchParams(search);
  const value = params.get("experience") ?? (params.has("scenario") ? null : defaultExperience || null);
  return experienceIds.includes(value as ExperienceId) ? value as ExperienceId : null;
}

export function isTabletopExperience(): boolean {
  return getExperience() === "tabletop";
}

/** The board-first table: the map fills the screen and actions start on the board. */
export function isBoardTableExperience(): boolean {
  return getExperience() === "table";
}

/** Wrapper classes: the board-first table reuses the Living Table's styles for shared screens. */
export function experienceClassName(experience: ExperienceId): string {
  return experience === "table" ? "experience-table experience-tabletop" : `experience-${experience}`;
}

/** Player-facing layouts share the guided setup, seeding, payment and resolution screens. */
export function isPlayerExperience(): boolean {
  const experience = getExperience();
  return experience === "tabletop" || experience === "table";
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
