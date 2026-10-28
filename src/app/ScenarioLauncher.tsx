import { useState } from "react";
import { ArrowRight, FlaskConical } from "lucide-react";
import { comparisonScenarios, scenarioIds, type ScenarioId } from "./scenarioCatalog";

export function ScenarioLauncher() {
  const [selected, setSelected] = useState<ScenarioId>("settlement");
  const scenario = comparisonScenarios[selected];
  return <section className="scenario-launcher" id="compare-scenarios" aria-label="Compare the same situation">
    <div><p className="studio-kicker"><FlaskConical size={17} aria-hidden="true" />Comparison playground</p><h2>Try the same situation.</h2><p>Start each design from an identical position. Demo games and Ledger progress are saved separately from your own tables.</p></div>
    <div className="scenario-launcher-body">
      <label htmlFor="comparison-situation">Choose a situation</label>
      <select id="comparison-situation" value={selected} onChange={(event) => setSelected(event.target.value as ScenarioId)}>{scenarioIds.map((id) => <option key={id} value={id}>{comparisonScenarios[id].name}</option>)}</select>
      <p>{scenario.description}</p>
      <ol>{scenario.tasks.map((task) => <li key={task}>{task}</li>)}</ol>
      <nav aria-label="Open this comparison"><a href={`?experience=tabletop&scenario=${selected}`}>Compare Living Table<ArrowRight size={16} aria-hidden="true" /></a><a href={`?experience=classic&scenario=${selected}`}>Compare baseline<ArrowRight size={16} aria-hidden="true" /></a></nav>
    </div>
  </section>;
}
