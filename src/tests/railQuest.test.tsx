import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RailQuest } from "../components/table/RailQuest";
import snapshots from "../app/scenarios.generated.json";
import type { PreviewSnapshot } from "../app/scenarioTypes";
import { createNewGame } from "../engine/setup";

const late = (snapshots as unknown as Record<string, PreviewSnapshot>)["showcase-late"];

describe("Quest Card in the table's side panel", () => {
  it("shows both halves with a live reading and the full card on request", () => {
    render(<RailQuest state={late.state!} />);
    const panel = screen.getByRole("region", { name: "Quest Card 7: The Workings" });
    expect(within(panel).getByText("The Mine Road")).toBeInTheDocument();
    expect(within(panel).getByText("On track")).toBeInTheDocument();
    expect(within(panel).getByText("Not yet")).toBeInTheDocument();
    expect(within(panel).queryByText(/Mine Tunnels, each beside a Travel tile/)).not.toBeInTheDocument();
    fireEvent.click(within(panel).getByRole("button", { name: "Read the card" }));
    expect(within(panel).getByText(/Mine Tunnels, each beside a Travel tile/)).toBeInTheDocument();
  });

  it("stays out of the way in a game without a Quest Card", () => {
    const { container } = render(<RailQuest state={createNewGame(1, ["vanguard"])} />);
    expect(container).toBeEmptyDOMElement();
  });
});
