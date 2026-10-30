import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, FlaskConical, RotateCcw } from "lucide-react";
import { demoGroups, demoHref, demoNeighbours, demoOrder } from "./demoCatalog";
import { App } from "./App";
import { experienceClassName, type ExperienceId } from "./experience";
import { clearAllSaves } from "./persistence";
import { clearLedgerCampaign } from "./ledgerPersistence";
import { comparisonScenarios, type ScenarioId } from "./scenarioCatalog";
import type { PreviewSnapshot } from "./scenarioTypes";
import snapshots from "./scenarios.generated.json";

const scenarioSnapshots = snapshots as unknown as Record<ScenarioId, PreviewSnapshot>;
const designNames: Record<ExperienceId, string> = { table: "Board-first Table", tabletop: "Living Table", classic: "Baseline" };

export default function ScenarioPreview({ experience, scenarioId }: { experience: ExperienceId; scenarioId: ScenarioId }) {
  const [simulateSaveFailure, setSimulateSaveFailure] = useState(false);
  const [revision, setRevision] = useState(0);
  const [message, setMessage] = useState("");
  const [restartFailed, setRestartFailed] = useState(false);
  const scenario = comparisonScenarios[scenarioId];
  function restart() {
    const board = clearAllSaves();
    const campaign = board.ok ? clearLedgerCampaign() : board;
    if (!campaign.ok) {
      setRestartFailed(true);
      setMessage("This demo could not be restarted. Browser storage is unavailable. Keep this tab open and try again.");
      return;
    }
    setRestartFailed(false);
    setRevision((value) => value + 1);
    setMessage(experience === "table" ? "Back to the start of this moment." : "This demo is back at its starting position.");
  }
  if (experience === "table") {
    // The demo ribbon: home, which scene this is (with the full list), the
    // previous and next scene, a restart and the way into a real game.
    const { index, previous, next } = demoNeighbours(scenarioId);
    // A position that is not one of the walkthrough scenes is a practice
    // table: it plays as a real game, so it says so rather than "Demo".
    const practice = index < 0;
    return <div className={`scenario-preview scenario-preview-table ${practice ? "is-practice" : "is-demo"}`} data-demo={scenarioId}>
      <aside className="scenario-review-bar demo-ribbon" aria-label="Demo controls">
        <a className="demo-home" href="?experience=table" aria-label="Back to the start page"><ArrowLeft size={17} aria-hidden="true" />The Quiet Vale</a>
        <span className="demo-badge">{practice ? "Practice" : "Demo"}</span>
        <ScenePicker current={scenarioId} label={scenario.name} index={index} />
        {practice ? <span className="demo-ribbon-line">A staged position. You play on from here.</span> : <nav className="demo-steps" aria-label="Scenes">
          {previous ? <a href={demoHref(previous)} aria-label={`Previous scene: ${comparisonScenarios[previous].name}`}><ChevronLeft size={18} aria-hidden="true" /></a> : <span className="is-off" aria-hidden="true"><ChevronLeft size={18} /></span>}
          {next ? <a className="demo-next" href={demoHref(next)} aria-label={`Next scene: ${comparisonScenarios[next].name}`}>Next scene<ChevronRight size={18} aria-hidden="true" /></a> : <span className="is-off demo-next" aria-hidden="true">Next scene<ChevronRight size={18} /></span>}
        </nav>}
        <span className="demo-spacer" />
        <button type="button" onClick={restart}><RotateCcw size={16} aria-hidden="true" />Restart</button>
        <a className="demo-play" href="?experience=table">Play a real game</a>
        <span className="demo-build" title="Demo version">v30 Oct · 10</span>
        <span className="scenario-status" role="status">{!restartFailed && message}</span>
      </aside>
      {restartFailed && <p className="scenario-restart-error" role="alert">{message}</p>}
      <div className={`experience-app ${experienceClassName(experience)}`}><App key={revision} initialPreview={scenarioSnapshots[scenarioId]} simulateSaveFailure={false} /></div>
    </div>;
  }
  return <div className="scenario-preview">
    <aside className="scenario-review-bar" aria-label="Comparison controls">
      <a href="./#compare-scenarios" aria-label="Back to comparison studio"><ArrowLeft size={17} aria-hidden="true" />Studio</a>
      <details><summary><FlaskConical size={16} aria-hidden="true" /><span>Demo · {scenario.name}</span></summary><div><strong>Try this in {designNames[experience]}</strong><p>{scenario.description}</p><ol>{scenario.tasks.map((task) => <li key={task}>{task}</li>)}</ol><p>Changes save within this demo only. Each design starts from the same position and keeps its own demo progress.</p><nav aria-label="Switch comparison design">{Object.entries(designNames).map(([id, name]) => <a key={id} aria-current={id === experience ? "page" : undefined} href={`?experience=${id}&scenario=${scenarioId}`}>{name}</a>)}</nav><label className="scenario-save-simulation"><input type="checkbox" checked={simulateSaveFailure} onChange={(event) => setSimulateSaveFailure(event.target.checked)} />Simulate a full save store</label><p className="scenario-simulation-note">Review tool for this demo only. While enabled, changes stay in this tab and save attempts fail. Turn it off to save the current demo progress.</p></div></details>
      <button type="button" onClick={restart}><RotateCcw size={16} aria-hidden="true" />Restart demo</button>
      <span className="scenario-status" role="status">{!restartFailed && message}</span>
    </aside>
    {restartFailed && <p className="scenario-restart-error" role="alert">{message}</p>}
    <div className={`experience-app ${experienceClassName(experience)}`}><App key={revision} initialPreview={scenarioSnapshots[scenarioId]} simulateSaveFailure={simulateSaveFailure} /></div>
  </div>;
}

/** "Scene 3 of 11", opening the full list of scenes, grouped and numbered. */
function ScenePicker({ current, label, index }: { current: ScenarioId; label: string; index: number }) {
  const [open, setOpen] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("scenes") === "open");
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (event: PointerEvent) => { if (!wrap.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, [open]);
  return <div className="demo-picker" ref={wrap}>
    <button type="button" className="demo-picker-button" aria-expanded={open} aria-controls="demo-gallery" onClick={() => setOpen((value) => !value)}>
      {index >= 0 && <small>Scene {index + 1} of {demoOrder.length}</small>}<strong>{label}</strong><ChevronDown size={16} aria-hidden="true" />
    </button>
    {open && <div className="demo-gallery" id="demo-gallery" role="dialog" aria-label="All demo scenes">
      {demoGroups.map((group) => <section key={group.title}>
        <h3>{group.title}</h3>
        <ol>{group.ids.map((id) => <li key={id}><a href={demoHref(id)} aria-current={id === current ? "page" : undefined}>
          <span className="demo-gallery-number">{demoOrder.indexOf(id) + 1}</span>
          <span><strong>{comparisonScenarios[id].name}</strong><small>{comparisonScenarios[id].description}</small></span>
        </a></li>)}</ol>
      </section>)}
    </div>}
  </div>;
}
