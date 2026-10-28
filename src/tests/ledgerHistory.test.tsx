import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BottomDrawer } from "../components/panels/BottomDrawer";
import { LedgerHistory } from "../components/panels/LedgerHistory";
import { createEmptyLedgerCampaign } from "../engine/ledgerCampaign";
import { createNewGame } from "../engine/setup";
import { recordLedgerGame } from "../engine/ledger";
import { readLedgerCampaign, writeLedgerCampaign } from "../app/ledgerPersistence";
import snapshots from "../app/scenarios.generated.json";
import type { PreviewSnapshot } from "../app/scenarioTypes";

const finale = snapshots.finale as unknown as PreviewSnapshot;
afterEach(() => { localStorage.clear(); window.history.replaceState(null, "", "/"); });

describe("recorded settlement history", () => {
  it("shows a stored completed score from a new game and supports roving Ledger navigation", () => {
    window.history.replaceState(null, "", "/?experience=tabletop");
    const recorded = recordLedgerGame(finale.state!, finale.campaign);
    writeLedgerCampaign(recorded.campaign);
    const fresh = createNewGame(1, ["vanguard"]);
    render(<BottomDrawer state={fresh} ledgerCampaign={readLedgerCampaign()} onTileInspect={() => {}} />);
    fireEvent.click(screen.getByRole("tab", { name: /^Ledger/ }));
    const tabs = screen.getByRole("tablist", { name: "Ledger sections" });
    fireEvent.keyDown(within(tabs).getByRole("tab", { name: "This Game" }), { key: "ArrowRight" });
    expect(within(tabs).getByRole("tab", { name: "Settlements" })).toHaveFocus();
    expect(screen.getByRole("tabpanel", { name: "Settlements" })).toHaveTextContent("1 recorded settlement");
    expect(screen.getByLabelText("Final score -285")).toBeVisible();
    expect(screen.getByRole("region", { name: "Past settlements" })).toHaveTextContent("Vanguard · Knight");
    expect(within(tabs).getAllByRole("tab").filter((tab) => tab.tabIndex === 0)).toHaveLength(1);
    fireEvent.keyDown(within(tabs).getByRole("tab", { name: "Settlements" }), { key: "End" });
    expect(within(tabs).getByRole("tab", { name: "Game Log" })).toHaveFocus();
    expect(screen.getByRole("tabpanel", { name: "Game Log" })).toHaveTextContent("Game created");
  });

  it("presents chronological immutable records and admits missing legacy detail", () => {
    const campaign = createEmptyLedgerCampaign();
    campaign.games = [
      { id: "older", completedAt: "2026-09-01T12:00:00Z", playerCount: 1, stewardIds: ["vanguard"], finalScore: 0, completedEntryIds: [] },
      { id: "newer", completedAt: "2026-09-20T12:00:00Z", playerCount: 2, stewardIds: ["knight", "warden"], finalScore: -10, completedEntryIds: ["unknown-legacy-entry"], newRecordEntryIds: ["unknown-legacy-entry"], completedStewardObjectiveIds: ["knight"] }
    ];
    Object.freeze(campaign.games);
    render(<LedgerHistory campaign={campaign} />);
    const records = screen.getAllByRole("article");
    expect(records[0]).toHaveTextContent("20 September 2026");
    expect(records[0]).toHaveTextContent("1 entry achieved · 1 new record");
    expect(records[0]).toHaveTextContent("unknown-legacy-entry · New record");
    expect(records[1]).toHaveTextContent("New-record details unavailable");
    expect(records[1]).toHaveTextContent("Objective details were not recorded");
    expect(campaign.games[0].id).toBe("older");
  });

  it("provides an honest empty state and pages a longer saved history", () => {
    const campaign = createEmptyLedgerCampaign();
    const view = render(<LedgerHistory campaign={campaign} />);
    expect(screen.getByText(/No completed settlements yet/)).toBeVisible();
    campaign.games = Array.from({ length: 12 }, (_, index) => ({ id: String(index), completedAt: "invalid old date", playerCount: 1, stewardIds: [], finalScore: index, completedEntryIds: [] }));
    view.rerender(<LedgerHistory campaign={campaign} />);
    expect(screen.getAllByRole("article")).toHaveLength(10);
    expect(screen.getAllByText("Date unavailable")).toHaveLength(10);
    fireEvent.click(screen.getByRole("button", { name: "Show 2 more settlements" }));
    expect(screen.getAllByRole("article")).toHaveLength(12);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
