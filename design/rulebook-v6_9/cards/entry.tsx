import { renderToStaticMarkup } from "react-dom/server";
import { EncounterCard } from "../../../src/components/common/EncounterCard";
import { boons, burdens, arrivals, goldenBoons } from "../../../src/data/encounters";
import "../../../src/styles/tokens.css";
import "../../../src/styles/app.css";
import "../../../src/styles/board-table.css";
const all: any[] = [...boons, ...burdens, ...arrivals, ...goldenBoons];
const want = (globalThis as any).WANT as { name: string; season?: 1|2|3; timers?: number; key: string }[];
const out = want.map((w) => {
  const card = all.find((c) => c.name === w.name);
  if (!card) return `<div class="missing">${w.name}</div>`;
  return `<div class="shot" id="${w.key}">${renderToStaticMarkup(<EncounterCard card={card} outputMode="print" currentSeason={w.season} timers={w.timers} />)}</div>`;
}).join("");
(globalThis as any).document.getElementById("root").innerHTML = out;
