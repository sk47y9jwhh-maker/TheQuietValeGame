import type { JSX } from "react";
import { compactRulesText, splitFaceText, type FaceIconWord } from "../../data/compactText";
import { gameIconUrl, type GameIconName } from "./GameIcon";

/**
 * Rules text as printed on a card or tile face: the short wording ("+2 Food",
 * "−1 Strain") with resources drawn as the artist's symbols, Strain as a black
 * circle (an inked token) and Supported as a bronze shield. A hidden copy in words is what
 * screen readers read.
 */
export function FaceText({ text, compact = true }: { text: string; compact?: boolean }) {
  const shown = compact ? compactRulesText(text) : text;
  const parts = splitFaceText(shown);
  if (!parts.some((part) => "icon" in part)) return <span className="face-text">{shown}</span>;
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
  // Screen readers (and text searches) get the words; the icon version is for the eye.
  return (
    <span className="face-text">
      <span className="face-text-words">{shown}</span>
      <span aria-hidden="true">{nodes}</span>
    </span>
  );
}

const tileTypeIcons: Partial<Record<FaceIconWord, GameIconName>> = {
  Housing: "type-housing", Social: "type-social", Wellbeing: "type-wellbeing", Crafting: "type-crafting",
  Merchant: "type-merchant", Travel: "type-travel", Resource: "type-resource"
};

export function FaceIcon({ word }: { word: FaceIconWord }) {
  if (word === "Strain") {
    // The same scribbled ink token as the printed tiles (make-strain-icon.py).
    return <img className="face-icon face-icon-strain" src={gameIconUrl("strain")} alt="Strain" title="Strain" decoding="async" />;
  }
  if (word === "Supported") {
    // The same ink-and-bronze shield as the printed tiles (make-supported-icon.py).
    return <img className="face-icon face-icon-supported" src={gameIconUrl("supported")} alt="Supported" title="Supported" decoding="async" />;
  }
  const type = tileTypeIcons[word];
  if (type) {
    return <img className="face-icon face-icon-type" src={gameIconUrl(type)} alt={`${word} Tile`} title={`${word} Tile`} decoding="async" />;
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
