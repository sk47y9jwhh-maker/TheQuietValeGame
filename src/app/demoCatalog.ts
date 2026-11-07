/**
 * The site has one demo: a recorded two-player game that plays itself, with
 * commentary at the moments that matter. The older staged positions still
 * open from a direct link, but nothing lists them any more.
 */
export const watchDemoHref = "?demo=watch";

export function isWatchDemo(search = typeof window === "undefined" ? "" : window.location.search): boolean {
  return new URLSearchParams(search).get("demo") === "watch";
}
