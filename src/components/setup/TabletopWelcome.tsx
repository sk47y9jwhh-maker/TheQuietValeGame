import { useEffect, useRef } from "react";
import { ArrowRight, BookOpen, ChevronDown, Compass, Leaf, Users } from "lucide-react";
import { getStartingWarehouseAmount } from "../../engine/setup";
import { terrainLabels } from "../../data/map";
import { stewardById, stewards } from "../../data/stewards";
import { LegacySetupOptions } from "./LegacySetupOptions";
import { supportedPlayerCounts } from "../../engine/types";
import { BrandMark } from "../common/BrandMark";
import { isBoardTableExperience, isHostedDemo } from "../../app/experience";
import { demoGroups, demoHref, demoOrder } from "../../app/demoCatalog";
import { RulesGuide } from "../panels/RulesGuide";
import type { SetupPanelProps } from "./SetupPanel";
import mapArtwork from "../../assets/quiet_vale_map_v02.webp";


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
          <img src={mapArtwork} alt="Woodlands, rivers and ancient ruins waiting to become your settlement" />
          <div className="welcome-landscape-copy">
            <p className="studio-kicker"><Leaf size={16} aria-hidden="true" /> A cooperative game for 1–5 players</p>
            <h1>A new season<br />in the Vale.</h1>
            <p>Lay down roots. Welcome new arrivals.<br />Build a place to call home, together.</p>
            {isBoardTableExperience() && <nav className="welcome-moment-chips" aria-labelledby="welcome-moments-heading">
              <h2 id="welcome-moments-heading">Or watch the game being played</h2>
              <div>
                {demoGroups.filter((group) => group.ids.length > 1).map((group) => <a key={group.title} href={demoHref(group.ids[0])}><strong>{group.title}</strong><small>{group.ids.length} scenes <ArrowRight size={13} aria-hidden="true" /></small></a>)}
                <a className="welcome-all-scenes" href={demoHref(demoOrder[0], "&scenes=open")}><strong>All {demoOrder.length} scenes</strong><small>Browse <ArrowRight size={13} aria-hidden="true" /></small></a>
              </div>
            </nav>}
          </div>
          <span className="welcome-art-credit">Map by Giovanni Spadaro & Daniele Nicotra</span>
        </section>

        <section className="welcome-setup" aria-labelledby="welcome-setup-heading">
          <p className="studio-kicker">{isBoardTableExperience() ? "Playable demo" : "The Living Table"}</p>
          <h2 id="welcome-setup-heading" ref={heading} tabIndex={-1}>Gather your Stewards.</h2>
          <p className="welcome-intro">Play solo or share this device with friends. Everyone helps the same settlement thrive.</p>
          {isBoardTableExperience() && <a className="welcome-guided" href="?experience=table&scenario=guided">
            <span><strong>New to the Vale? Watch a guided first game.</strong><small>About 5 minutes. Press Next and the opening plays itself, explained step by step.</small></span>
            <ArrowRight size={20} aria-hidden="true" />
          </a>}
          <fieldset className="welcome-player-count">
            <legend><Users size={16} aria-hidden="true" />Who’s at the table?</legend>
            <div>{supportedPlayerCounts.map((count) => <button key={count} type="button" aria-label={`${count} player${count === 1 ? "" : "s"}`} aria-pressed={count === playerCount} onClick={() => onPlayerCountChange(count)}>{count === 1 ? "Solo" : count}</button>)}</div>
          </fieldset>

          <div className="welcome-stewards">
            {selectedStewards.map((steward, index) => <article className="welcome-steward" key={index}>
              <div className="welcome-steward-heading">
                <span className="welcome-steward-emblem" aria-hidden="true">{index + 1}</span>
                <label>Player {index + 1} · Steward
                  <select aria-label={`Player ${index + 1} steward`} value={steward.id} onChange={(event) => onStewardChange(index, event.target.value)}>
                    {stewards.map((option) => <option key={option.id} value={option.id} disabled={stewardIds.includes(option.id) && option.id !== steward.id}>{option.name}</option>)}
                  </select>
                </label>
              </div>
              <p className="welcome-steward-role">{stewardRoles[steward.id]}</p>
              <details className="welcome-steward-details"><summary>Power & objective <ChevronDown size={15} aria-hidden="true" /></summary><div><p><strong>Starts on </strong>{steward.startingTerrains.map((terrain) => terrainLabels[terrain]).join(" or ")}.</p><p>{steward.powerText}</p><p>{steward.objectiveText}</p></div></details>
            </article>)}
          </div>

          <LegacySetupOptions {...props} />
          <div className="welcome-start">
            <p><Compass size={17} aria-hidden="true" />{startingResources} of each resource · 3 seasons · 12 rounds</p>
            <button className="studio-primary" type="button" onClick={onStart}>Begin your settlement <ArrowRight size={19} aria-hidden="true" /></button>
            <small>Next: choose a starting place on the map.</small>
          </div>
        </section>
      </div>

      <section className="welcome-beginning" aria-label="The journey ahead">
        <div><span>01</span><h3>Find your place</h3><p>Choose a starting place that suits your Steward.</p></div>
        <div><span>02</span><h3>Shape the season</h3><p>Seed encounters to influence what lies ahead.</p></div>
        <div><span>03</span><h3>Build together</h3><p>Grow the settlement, care for its people and earn Renown.</p></div>
      </section>
      <details className="welcome-rules"><summary><BookOpen size={20} aria-hidden="true" /><span>New to the Vale?<small>Learn the essentials or browse the full rules.</small></span><ChevronDown size={20} aria-hidden="true" /></summary><div><RulesGuide /></div></details>
      <footer className="welcome-footer">The Quiet Vale: Seasons of Settlement · © 2026 Robert Little</footer>
    </main>
  );
}
