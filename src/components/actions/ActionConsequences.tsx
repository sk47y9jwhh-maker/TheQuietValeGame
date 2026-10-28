import type { ActionForecast } from "./actionForecast";

export function ActionConsequences({ forecast }: { forecast: ActionForecast }) {
  return <div className="action-consequences" aria-label="Action preview">
    {forecast.available && <p className="action-cost-label"><strong>{forecast.actionCost === 0 ? "No action spent" : `${forecast.actionCost} action${forecast.actionCost === 1 ? "" : "s"}`}</strong>{forecast.paymentChoice && <span>Payment choice next</span>}</p>}
    {forecast.resources.length > 0 && <ul className="resource-forecast">{forecast.resources.map((change) => <li key={change.resource} className={change.delta > 0 ? "resource-gain" : change.delta < 0 ? "resource-spend" : "resource-unchanged"}><span>{change.label}</span><strong>{change.before} → {change.after}</strong><small>{change.delta > 0 ? `+${change.delta}` : change.delta < 0 ? change.delta : "No gain"}{change.atCapacity ? " · Full" : ""}</small></li>)}</ul>}
    {forecast.available && !forecast.paymentChoice && forecast.resources.length === 0 && <p className="action-forecast-note">No immediate resource change.</p>}
    {forecast.warning && <p className="action-forecast-warning">{forecast.warning}</p>}
    {forecast.notes.map((note) => <p className="action-forecast-note" key={note}>{note}</p>)}
  </div>;
}
