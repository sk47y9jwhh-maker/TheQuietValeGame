import { useEffect, useRef } from "react";
import { ArrowRight, BookOpen, ChevronDown, Download, Play, Users } from "lucide-react";
import { getStartingWarehouseAmount } from "../../engine/setup";
import { terrainLabels } from "../../data/map";
import { stewardById, stewards } from "../../data/stewards";
import { LegacySetupOptions } from "./LegacySetupOptions";
import { supportedPlayerCounts } from "../../engine/types";
import { BrandMark } from "../common/BrandMark";
import { isBoardTableExperience, isHostedDemo } from "../../app/experience";
import { watchDemoHref } from "../../app/demoCatalog";
import { RulesGuide } from "../panels/RulesGuide";
import type { SetupPanelProps } from "./SetupPanel";
import mapArtwork from "../../assets/quiet_vale_map_v02-1600.webp";
import boardMapArtwork from "../../assets/quiet_vale_map_v02.webp";
import rulebookCover from "../../assets/rulebook-cover.webp";
import { rulebookPdfHref } from "../../app/rulebook";


const stewardRoles: Record<string, string> = {
  vanguard: "Open paths and connect the Vale.",
  knight: "Give the settlement room to grow.",
  sentinel: "Make more of what you have built.",
  ranger: "Find possibilities beyond your borders.",
  warden: "Help the settlement weather hardship.",
  quartermaster: "Keep the shared warehouse working."
};

export function TabletopWelcome(props: SetupPanelProps) {
  const { playerCount, stewardIds, onPlayerCountChange, onStewardChange, onStart } = props;
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (props.focusOnMount) heading.current?.focus(); }, [props.focusOnMount]);
  // The home page shows a lighter copy of the map. The board's full-size map is
  // fetched quietly once the page has settled, so the first board appears at once.
  useEffect(() => {
    const timer = window.setTimeout(() => { const image = new Image(); image.decoding = "async"; image.src = boardMapArtwork; }, 1200);
    return () => window.clearTimeout(timer);
  }, []);
  const startingResources = getStartingWarehouseAmount(playerCount);
  const selectedStewards = stewardIds.slice(0, playerCount).map((id) => stewardById[id]);

  return (
    <main className="vale-welcome">
      <header className="welcome-header">
        <a href={isHostedDemo ? "./" : "?"} className="welcome-brand" aria-label={isHostedDemo ? "The Quiet Vale" : "The Quiet Vale experience studio"}><BrandMark /><span>The Quiet Vale<small>Seasons of Settlement</small></span></a>
        {!isHostedDemo && <a className="welcome-studio-link" href="?">Compare experiences <ArrowRight size={16} aria-hidden="true" /></a>}
      </header>
      <div className="welcome-layout">
        <section className="welcome-landscape">
          <img src={mapArtwork} width={1600} height={1222} decoding="async" alt="Woodlands, rivers and ancient ruins waiting to become your settlement" />
          <div className="welcome-landscape-copy">
            <p className="studio-kicker">A cooperative board game for 1 to 5 players</p>
            <h1>A new season<br />in the Vale.</h1>
            <p>Build one settlement together across three Seasons. Welcome the people who arrive, carry the Burdens that follow, and keep the land from breaking under the Strain.</p>
            {isBoardTableExperience() && <a className="welcome-watch" href={watchDemoHref}>
              <span className="welcome-watch-icon" aria-hidden="true"><Play size={18} /></span>
              <span><strong>Watch a demo</strong><small>A two-player game plays itself, with commentary on the decisions. About 10 minutes, or 5 at Fast speed.</small></span>
            </a>}
          </div>
          <span className="welcome-art-credit">Map by Giovanni Spadaro & Daniele Nicotra</span>
        </section>

        <section className="welcome-setup" aria-labelledby="welcome-setup-heading">
          {!isBoardTableExperience() && <p className="studio-kicker">The Living Table</p>}
          <h2 id="welcome-setup-heading" ref={heading} tabIndex={-1}>Gather your Stewards.</h2>
          <p className="welcome-intro">Play solo or share this device with friends. Everyone helps the same settlement thrive.</p>
          <fieldset className="welcome-player-count">
            <legend><Users size={16} aria-hidden="true" />Who’s at the table?</legend>
            <div>{supportedPlayerCounts.map((count) => <button key={count} type="button" aria-label={`${count} player${count === 1 ? "" : "s"}`} aria-pressed={count === playerCount} onClick={() => onPlayerCountChange(count)}>{count === 1 ? "Solo" : count}</button>)}</div>
          </fieldset>

          <div className="welcome-stewards">
            {selectedStewards.map((steward, index) => <article className="welcome-steward" key={index}>
              <div className="welcome-steward-heading">
                <span className="welcome-steward-emblem" aria-hidden="true">{index + 1}</span>
                <label>Player {index + 1}’s Steward
                  <select aria-label={`Player ${index + 1} steward`} value={steward.id} onChange={(event) => onStewardChange(index, event.target.value)}>
                    {stewards.map((option) => <option key={option.id} value={option.id} disabled={stewardIds.includes(option.id) && option.id !== steward.id}>{option.name}</option>)}
                  </select>
                </label>
              </div>
              <p className="welcome-steward-role">{stewardRoles[steward.id]}</p>
              <details className="welcome-steward-details"><summary>Power and objective <ChevronDown size={15} aria-hidden="true" /></summary><div><p><strong>Starts on </strong>{steward.startingTerrains.map((terrain) => terrainLabels[terrain]).join(" or ")}.</p><p>{steward.powerText}</p><p>{steward.objectiveText}</p></div></details>
            </article>)}
          </div>

          <LegacySetupOptions {...props} />
          <div className="welcome-start">
            <p>The Warehouse starts with {startingResources} of each resource. A game is 12 rounds over 3 Seasons.</p>
            <button className="studio-primary" type="button" onClick={onStart}>Begin your settlement</button>
            <small>Next: choose a starting place on the map.</small>
          </div>
        </section>
      </div>

      <section className="welcome-beginning" aria-label="The journey ahead">
        <div><h3>Find your place</h3><p>Choose a starting place that suits your Steward.</p></div>
        <div><h3>Shape the season</h3><p>Seed encounters to influence what lies ahead.</p></div>
        <div><h3>Build together</h3><p>Grow the settlement, care for its people and earn Renown.</p></div>
      </section>
      <section className="welcome-rulebook" aria-labelledby="welcome-rulebook-heading">
        <a className="welcome-rulebook-cover" href={rulebookPdfHref} target="_blank" rel="noopener"><img src={rulebookCover} alt="The Quiet Vale rulebook cover" /></a>
        <div>
          <p className="studio-kicker">The rulebook</p>
          <h2 id="welcome-rulebook-heading">Read the printed rules</h2>
          <p>The full rulebook from the box: setup, a guided first round, every rule with worked examples, and the Twin Settlements mode. 36 pages.</p>
          <div className="welcome-rulebook-actions">
            <a className="studio-primary" href={rulebookPdfHref} target="_blank" rel="noopener"><BookOpen size={18} aria-hidden="true" />Open the rulebook</a>
            <a className="welcome-rulebook-download" href={rulebookPdfHref} download="The Quiet Vale Rulebook.pdf"><Download size={16} aria-hidden="true" />Download PDF (10 MB)</a>
          </div>
        </div>
      </section>
      <details className="welcome-rules"><summary><BookOpen size={20} aria-hidden="true" /><span>New to the Vale?<small>Learn the essentials or browse the full rules.</small></span><ChevronDown size={20} aria-hidden="true" /></summary><div><RulesGuide /></div></details>
      <footer className="welcome-footer">The Quiet Vale: Seasons of Settlement. © 2026 Robert Little</footer>
    </main>
  );
}
