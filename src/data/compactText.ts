/**
 * Shorter wording for card and tile faces (Robert, 21 Nov).
 *
 * Gains and additions read as "+", losses and reductions as "−". Resource
 * names, Strain and Supported stay as words here; the face renderers draw them
 * as icons (resource symbols, a black circle for Strain, a bronze shield for
 * Supported). The game data keeps the full wording for logs and help text.
 */

const RES = "Wood|Stone|Food|Metal|Herbs|Goods";
const MINUS = "−";

type Rule = [RegExp, string | ((...groups: string[]) => string)];

const rules: Rule[] = [
  // "You may pay 2 Metal to remove 1 Strain" → "You may pay 2 Metal: −1 Strain".
  [new RegExp(`\\b(pay \\d+ (?:${RES})) to remove\\b`, "g"), "$1: remove"],
  // "remove 1 additional Strain" → "−1 more Strain".
  [/\b[Rr]emove (\d+) additional Strain\b/g, (_m, n) => `${MINUS}${n} more Strain`],
  // "... costs 2 fewer Food and gains Supported" → "... costs −2 Food and +Supported".
  [/ and gains Supported/g, " and +Supported"],
  // Gains: "Gain 3 Wood and 2 Food" → "+3 Wood, +2 Food"; "gain 1 Metal or 1 Goods" → "+1 Metal or +1 Goods".
  [new RegExp(`\\b[Gg]ains? (\\d+) (${RES}|resources?)((?:(?:,| and| or) (?:\\d+) (?:${RES}))*)`, "g"),
    (_m, n, res, rest) => `+${n} ${res}${rest.replace(new RegExp(` and (\\d+) (${RES})`, "g"), ", +$1 $2").replace(new RegExp(` or (\\d+) (${RES})`, "g"), " or +$1 $2")}`],
  // "gain 2 Food or Goods", "gain 3 Food/Goods" are covered above; a bare "gain" before a number with no resource stays.
  // Supported: "it gains Supported", "each gains Supported", "up to 3 Tiles gain Supported".
  [/: (?:it|each) gains Supported/g, ": +Supported"],
  [/\b(It|Each) gains Supported/g, "$1: +Supported"],
  [/ gains? Supported/g, ": +Supported"],
  // Losses: "lose 2 Metal", "Lose 2.", "lose 3".
  [new RegExp(`\\b[Ll]ose (\\d+)( (?:${RES}))?`, "g"), (_m, n, res = "") => `${MINUS}${n}${res}`],
  // Strain removal: "Remove 1 Strain" → "−1 Strain"; "remove up to 2 Strain" → "up to −2 Strain".
  [/\b[Rr]emove (\d+) Strain\b/g, (_m, n) => `${MINUS}${n} Strain`],
  [/\b([Rr])emove up to (\d+) Strain\b/g, (_m, r, n) => `${r === "R" ? "Up" : "up"} to ${MINUS}${n} Strain`],
  // "1 additional Strain" → "+1 Strain"; "1 additional Player Turns phase" → "+1 Player Turns phase".
  [/\b(\d+) additional\b/g, "+$1"],
  [/ once extra\b/g, " +1 time"],
  // Costs: "costs 1 fewer resource", "cost 2 fewer resources each", "pay up to 2 fewer Food".
  [new RegExp(`\\bpay up to (\\d+) fewer (${RES})`, "g"), (_m, n, what) => `up to ${MINUS}${n} ${what}`],
  [new RegExp(`\\b(costs?) (\\d+) fewer (resources?|Requirement resources?|${RES})`, "g"), (_m, verb, n, what) => `${verb} ${MINUS}${n} ${what}`],
  [/\bcosts? (\d+) more resources?/g, (m, n) => m.replace(`${n} more`, `+${n}`)],
  // "reduce its cost by 1 resource" → "its cost −1 resource"; "reduce the resource cost of X by 2" → "X costs −2 resources".
  [/\breduce its cost by (up to )?(\d+) (resources?)/g, (_m, upTo = "", n, what) => `its cost ${upTo}${MINUS}${n} ${what}`],
  [/\breduce the resource cost of (.+?) by (\d+)\b/g, (_m, what, n) => `${what} costs ${MINUS}${n} resources`]
];

export function compactRulesText(text: string): string {
  let out = text;
  for (const [pattern, replacement] of rules) {
    out = out.replace(pattern, replacement as never);
  }
  // A "+" or "−" that now opens a sentence keeps the sentence readable.
  return out.replace(/\s{2,}/g, " ");
}

/** Words a face renderer draws as icons. */
export const faceIconWords = ["Wood", "Stone", "Food", "Metal", "Herbs", "Goods", "Population", "Renown", "Strain", "Supported"] as const;
export type FaceIconWord = (typeof faceIconWords)[number];

/** Split face text into plain runs and icon words ("Overstrained" stays a word). */
export function splitFaceText(text: string): Array<{ text: string } | { icon: FaceIconWord }> {
  const parts: Array<{ text: string } | { icon: FaceIconWord }> = [];
  const pattern = new RegExp(`\\b(${faceIconWords.join("|")})\\b`, "g");
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) parts.push({ text: text.slice(last, index) });
    parts.push({ icon: match[1] as FaceIconWord });
    last = index + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}
