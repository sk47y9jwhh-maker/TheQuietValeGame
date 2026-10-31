import { useState } from "react";
import { questCardByNumber } from "../../data/questCards";
import { stewardById } from "../../data/stewards";
import type { LedgerCampaign } from "../../engine/ledgerCampaign";

const dateFormatter = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" });
const pageSize = 10;

export function LedgerHistory({ campaign }: { campaign: LedgerCampaign }) {
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const games = [...campaign.games].sort((a, b) => (Date.parse(b.completedAt) || 0) - (Date.parse(a.completedAt) || 0));
  return (
    <section className="settlement-history" aria-label="Past settlements">
      <header>
        <p className="eyebrow">Your Vale, remembered</p>
        <h3>Past settlements</h3>
        <p>{games.length} recorded {games.length === 1 ? "settlement" : "settlements"}. Results stay here when you begin a new game in this browser. Past boards are not saved.</p>
      </header>
      {games.length === 0 ? <p className="settlement-history-empty">No completed settlements yet. Finish a game, then record it from final scoring.</p> : <ol className="settlement-history-list">
        {games.slice(0, visibleCount).map((game) => {
          const timestamp = Date.parse(game.completedAt);
          const date = Number.isFinite(timestamp) ? dateFormatter.format(timestamp) : "Date unavailable";
          return <li key={game.id}>
            <article aria-label={`Settlement recorded ${date}`}>
              <header>
                <div>
                  <time dateTime={Number.isFinite(timestamp) ? game.completedAt : undefined}>{date}</time>
                  <h4>{game.stewardIds.map((id) => stewardById[id]?.name ?? id).join(" · ") || "Stewards not recorded"}</h4>
                  <span>{game.playerCount} {game.playerCount === 1 ? "player" : "players"}</span>
                </div>
                <div className="settlement-record-score"><span>Final score</span><strong aria-label={`Final score ${game.finalScore}`}>{game.finalScore}</strong></div>
              </header>
              <p>{questCardByNumber[game.questCardNumber]
                ? `Quest Card No. ${game.questCardNumber}, ${questCardByNumber[game.questCardNumber].theme}: ${game.questCompleted ? "completed" : "not completed"}`
                : "Played without a Quest Card"}</p>
            </article>
          </li>;
        })}
      </ol>}
      {games.length > visibleCount && <button type="button" onClick={() => setVisibleCount((count) => count + pageSize)}>Show {Math.min(pageSize, games.length - visibleCount)} more settlements</button>}
    </section>
  );
}
