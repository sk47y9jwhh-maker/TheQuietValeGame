// Every Encounter Card, each Season as the current one, for measure-fit.mjs.
import { renderToStaticMarkup } from "react-dom/server";
import { EncounterCard } from "../../../src/components/common/EncounterCard";
import { boons, burdens, arrivals, goldenBoons } from "../../../src/data/encounters";
import "../../../src/styles/tokens.css";
import "../../../src/styles/app.css";
import "../../../src/styles/board-table.css";
const shots: string[] = [];
for (const card of [...boons, ...burdens] as any[]) {
  for (const season of [1, 2, 3] as const) {
    shots.push(`<div class="shot" id="${card.id}-s${season}">${renderToStaticMarkup(<EncounterCard card={card} outputMode="print" currentSeason={season} />)}</div>`);
  }
}
for (const card of [...arrivals, ...goldenBoons] as any[]) {
  shots.push(`<div class="shot" id="${card.id}">${renderToStaticMarkup(<EncounterCard card={card} outputMode="print" />)}</div>`);
}
(globalThis as any).document.getElementById("root").innerHTML = shots.join("");
