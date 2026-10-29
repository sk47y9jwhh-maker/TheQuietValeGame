import { useState } from "react";
import { ArrowLeft, FlaskConical, RotateCcw } from "lucide-react";
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
    // The playable demo: a way home, what this moment is, and a restart.
    return <div className="scenario-preview scenario-preview-table">
      <aside className="scenario-review-bar" aria-label="Demo controls">
        <a href="?experience=table" aria-label="Back to the start page"><ArrowLeft size={17} aria-hidden="true" />The Quiet Vale</a>
        <details><summary><span>{scenario.name}</span></summary><div><p>{scenario.description}</p><strong>Things to try</strong><ol>{scenario.tasks.map((task) => <li key={task}>{task}</li>)}</ol><p>Your moves here are saved for this moment only. Restart to begin it again.</p></div></details>
        <button type="button" onClick={restart}><RotateCcw size={16} aria-hidden="true" />Restart</button>
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
