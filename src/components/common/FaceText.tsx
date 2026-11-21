import type { JSX } from "react";
import { compactRulesText, splitFaceText, type FaceIconWord } from "../../data/compactText";
import { gameIconUrl, type GameIconName } from "./GameIcon";

/**
 * Rules text as printed on a card or tile face: the short wording ("+2 Food",
 * "−1 Strain") with resources drawn as the artist's symbols, Strain as a black
 * circle and Supported as a bronze shield. The word stays available to screen
 * readers through each icon's label.
 */
export function FaceText({ text, compact = true }: { text: string; compact?: boolean }) {
  const parts = splitFaceText(compact ? compactRulesText(text) : text);
  const nodes: JSX.Element[] = [];
  parts.forEach((part, index) => {
    if (!("icon" in part)) {
      nodes.push(<span key={index}>{part.text}</span>);
      return;
    }
    // Keep "+", "−2 " or "up to −2 " on the same line as its icon.
    const previous = nodes.length ? parts[index - 1] : undefined;
    const lead = previous && "text" in previous ? /(?:[+−]?\d*[–-]?\d*\s?|[+−])$/.exec(previous.text)?.[0] ?? "" : "";
    if (lead) {
      nodes[nodes.length - 1] = <span key={index - 1}>{(previous as { text: string }).text.slice(0, -lead.length)}</span>;
    }
    nodes.push(<span className="face-text-unit" key={index}>{lead}<FaceIcon word={part.icon} /></span>);
  });
  return <span className="face-text">{nodes}</span>;
}

export function FaceIcon({ word }: { word: FaceIconWord }) {
  if (word === "Strain") {
    return <span className="face-icon face-icon-strain" role="img" aria-label="Strain" title="Strain" />;
  }
  if (word === "Supported") {
    return (
      <svg className="face-icon face-icon-supported" viewBox="-5 -5.4 10 11" role="img" aria-label="Supported">
        <title>Supported</title>
        <path d="M0 -4.9 L4.3 -3.3 L4.3 0.2 C4.3 2.9 2.3 4.4 0 5.2 C-2.3 4.4 -4.3 2.9 -4.3 0.2 L-4.3 -3.3 Z" />
        <path className="face-icon-supported-shine" d="M-2.6 -3.1 L0 -4 L0 3.2 C-1.6 2.6 -2.9 1.4 -2.9 -0.4 Z" />
      </svg>
    );
  }
  return (
    <img
      className="face-icon face-icon-resource"
      src={gameIconUrl(word.toLowerCase() as GameIconName)}
      alt={word}
      title={word}
      decoding="async"
    />
  );
}
