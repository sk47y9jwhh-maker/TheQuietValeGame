import { lazy, Suspense } from "react";
import { ArrowRight, Compass, Map } from "lucide-react";
import { ScenarioLauncher } from "./ScenarioLauncher";
import { getScenario } from "./scenarioCatalog";
import { App } from "./App";
import { experienceClassName, getExperience } from "./experience";
import { BrandMark } from "../components/common/BrandMark";
import mapArtwork from "../assets/quiet_vale_map_v02.webp";

const ScenarioPreview = lazy(() => import("./ScenarioPreview"));

export function ExperienceRoot() {
  const experience = getExperience();
  const scenario = getScenario();
  const query = new URLSearchParams(window.location.search);
  if (query.has("experience") && !experience) return <main className="scenario-error"><h1>This layout is not included.</h1><p>This review contains the Living Table alternative and the original baseline.</p><a href="./">Return to the concept preview</a></main>;
  if (query.has("scenario") && (!scenario || !experience)) return <main className="scenario-error"><h1>This comparison link is incomplete.</h1><p>Choose a situation and a design in the studio to open a separate demo.</p><a href="./#compare-scenarios">Return to the comparison studio</a></main>;
  if (experience && scenario) return <Suspense fallback={<main className="scenario-error" role="status">Preparing the comparison…</main>}><ScenarioPreview experience={experience} scenarioId={scenario} /></Suspense>;
  if (experience) return <div className={`experience-app ${experienceClassName(experience)}`}><App /></div>;

  return <main className="design-studio">
    <header className="studio-header"><BrandMark /><span>The Quiet Vale <small>Alternative layout concept</small></span></header>
    <section className="studio-intro">
      <p className="studio-kicker">The Living Table · playable concept</p>
      <h1>A place to build.<br />Room to play.</h1>
      <p>Explore the recommended layout for The Quiet Vale. Its games and demos keep their own progress in this browser, separate from your original game.</p>
    </section>
    <section className="studio-recommendation" aria-labelledby="recommendation-title">
      <div><p className="studio-kicker">Recommended direction · for review</p><h2 id="recommendation-title">Keep the Vale in view.</h2><p>The board sits beside direct actions on a large screen. On a smaller screen, move between your actions, the board and encounters.</p><details><summary>Why this direction</summary><p>The Living Table balances atmosphere and pace, with clear costs, consequences and the next decision within reach.</p><p>This recommendation comes from implementation and browser play checks. Independent player testing and the continuous full-game acceptance check remain to be completed.</p></details></div>
      <a className="studio-primary" href="?experience=tabletop">Enter the Living Table <ArrowRight size={18} aria-hidden="true" /></a>
    </section>
    <section className="studio-directions" aria-label="Living Table concept">
      <article className="studio-direction studio-tabletop">
        <div className="studio-map-preview"><img src={mapArtwork} alt="The painted landscape of The Quiet Vale" /></div>
        <div className="studio-direction-body"><Map size={24} aria-hidden="true" /><h2>The Living Table</h2><p>A generous board, a calm sense of place and the right tools within reach.</p><ul><li>Map-led play space</li><li>Step-by-step phase guidance</li><li>Actions and encounters in one dock</li></ul></div>
      </article>
    </section>
    <ScenarioLauncher />
    <footer className="studio-footer"><Compass size={18} aria-hidden="true" /><span>Compare with the original experience.</span><a href="?experience=classic">Open the baseline <ArrowRight size={16} aria-hidden="true" /></a></footer>
  </main>;
}
