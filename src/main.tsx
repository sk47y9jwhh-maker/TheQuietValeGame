import React from "react";
import ReactDOM from "react-dom/client";
import { ExperienceRoot } from "./app/ExperienceRoot";
import "./styles/tokens.css";
import "./styles/app.css";
import "./styles/experiences.css";
import "./styles/scenarios.css";
import "./styles/tile-discovery.css";
import "./styles/game-bookends.css";
import "./styles/table-seeding.css";
import "./styles/save-status.css";
import "./styles/signet.css";
import "./styles/golden-opportunities.css";
import "./styles/steward-choices.css";
import "./styles/turn-priorities.css";
import "./styles/effect-alternatives.css";
import "./styles/payment-review.css";
import "./styles/resolution-review.css";
import "./styles/accessibility-review.css";
import "./styles/board-table.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ExperienceRoot />
  </React.StrictMode>
);

