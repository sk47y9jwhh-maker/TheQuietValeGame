/**
 * The rules engine explains a refusal in its own terms ("Cannot complete
 * Arrival: missing 2 food."). Shown to players, a reason drops its
 * "Cannot ...:" prefix, starts with a capital, ends with a full stop, and a
 * shortfall reads as the table says it: "Need 2 more Food."
 */
export function readableReason(reason: string): string {
  const text = reason.trim().replace(/^Cannot [^:]{1,40}:\s*/i, "");
  const missing = /^(?:missing|insufficient) (\d+) ([a-z]+)\.?$/i.exec(text);
  if (missing) return `Need ${missing[1]} more ${missing[2][0].toUpperCase()}${missing[2].slice(1).toLowerCase()}.`;
  const sentence = text.charAt(0).toUpperCase() + text.slice(1);
  return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`;
}

export function readableReasons(reasons: string[]): string {
  return reasons.map(readableReason).join(" ");
}
