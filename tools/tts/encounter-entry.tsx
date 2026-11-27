import { renderToStaticMarkup } from "react-dom/server";
import { EncounterCard } from "../../src/components/common/EncounterCard";
import { arrivals, boons, burdens, goldenBoons } from "../../src/data/encounters";
import "../../src/styles/tokens.css";
import "../../src/styles/app.css";
import "../../src/styles/board-table.css";

const all = [...boons, ...burdens, ...arrivals, ...goldenBoons];
const want = (globalThis as unknown as { WANT: { id: string; key: string }[] }).WANT;

const html = want
  .map((w) => {
    const card = all.find((c) => c.id === w.id);
    if (!card) return `<div class="missing">${w.id}</div>`;
    return `<div class="shot" id="${w.key}">${renderToStaticMarkup(
      <EncounterCard card={card} outputMode="web" />
    )}</div>`;
  })
  .join("");

const root = document.getElementById("root");
if (root) root.innerHTML = html;
