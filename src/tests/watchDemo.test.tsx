import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import data from "../app/watch/watchDemo.generated.json";
import recording from "../../tools/watch-demo.recording.json";
import { buildFrames, displayState, frameDuration, highlightDuration } from "../app/watch/watchFrames";
import type { WatchDemoData } from "../app/watch/watchTypes";
import { calculateFinalScore } from "../engine/scoring";

const demo = data as unknown as WatchDemoData;

beforeEach(() => { window.localStorage.clear(); window.history.replaceState(null, "", "/?demo=watch"); });
afterEach(() => { vi.useRealTimers(); window.history.replaceState(null, "", "/"); });

describe("the recorded demo game", () => {
  it("replays every recorded move through the rules engine to the recorded final score", () => {
    const frames = buildFrames(demo);
    const final = frames[frames.length - 1].state;
    expect(final.phase).toBe("gameEnd");
    expect(final.round).toBe(12);
    expect(final.players.map((player) => player.stewardId)).toEqual(["vanguard", "knight"]);
    expect(calculateFinalScore(final).finalScore).toBe(demo.finalScore);
  });

  it("plays the moves of the checked-in recording, in order", () => {
    const fromRecording = (recording as { beats: { moves: unknown[] }[] }).beats.flatMap((beat) => beat.moves);
    expect(demo.beats.flatMap((beat) => beat.moves)).toEqual(fromRecording);
  });

  it("marks its points of interest: an introduction first and the final scoring last", () => {
    const pauses = demo.beats.filter((beat) => beat.pause);
    expect(demo.beats[0].pause?.title).toBe("Two Stewards, one settlement");
    expect(demo.beats[demo.beats.length - 1].pause?.kind).toBe("finale");
    expect(pauses.length).toBeGreaterThanOrEqual(8);
    expect(pauses.length).toBeLessThanOrEqual(18);
    // Most steps simply play on.
    expect(demo.beats.length).toBeGreaterThan(pauses.length * 6);
    // Every decision names the choice that was made.
    for (const beat of pauses.filter((candidate) => candidate.pause!.kind === "decision")) expect(beat.pause!.options?.some((option) => option.chosen)).toBe(true);
    const breakdown = demo.beats[demo.beats.length - 1].pause!.breakdown!;
    expect(breakdown[breakdown.length - 1]).toMatchObject({ label: "Final score", value: String(demo.finalScore) });
  });

  it("gives each Season's seeding a close-up, and a card or tile to most actions", () => {
    const frames = buildFrames(demo);
    expect(frames.flatMap((frame) => frame.spotlight?.kind === "seed" ? [frame.spotlight.season] : [])).toEqual([1, 1, 2, 2, 3, 3]);
    const actions = frames.filter((frame) => /builds|upgrades|activates|welcomes|resolves/.test(frame.caption) && !frame.pause);
    expect(actions.every((frame) => frame.spotlight)).toBe(true);
  });

  it("shows every step as a read-only turn or the finished game, never a pending choice", () => {
    for (const frame of buildFrames(demo)) {
      const shown = displayState(frame.state);
      expect(["turns", "gameEnd"]).toContain(shown.phase);
      expect(shown.pendingEffects).toHaveLength(0);
      expect(shown.pendingCostChoice).toBeNull();
      expect(frame.caption.length).toBeGreaterThan(10);
      expect(frameDuration(frame)).toBeGreaterThanOrEqual(1800);
      expect(frameDuration(frame)).toBeLessThanOrEqual(5200);
      if (frame.pause) expect(highlightDuration(frame)).toBeGreaterThanOrEqual(8000);
      if (frame.pause) expect(highlightDuration(frame)).toBeLessThanOrEqual(20000);
    }
  });
});

describe("watching the demo", () => {
  async function openDemo() {
    const { default: WatchDemo } = await import("../app/watch/WatchDemo");
    render(<WatchDemo />);
    return await screen.findByRole("complementary", { name: "Demo commentary" }, { timeout: 8000 });
  }

  it("waits on the introduction, then plays straight through its highlights without stopping", async () => {
    const card = await openDemo();
    expect(within(card).getByRole("heading", { name: "Two Stewards, one settlement" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Play a real game" })).toHaveAttribute("href", "?experience=table");
    vi.useFakeTimers();
    // Nothing moves until the viewer presses Play.
    await act(async () => { vi.advanceTimersByTime(30000); });
    expect(within(card).getByRole("heading", { name: "Two Stewards, one settlement" })).toBeInTheDocument();
    fireEvent.click(within(card).getByRole("button", { name: "Play the demo" }));
    expect(within(card).getByRole("heading", { name: "Seeding the Season" })).toBeInTheDocument();
    expect(within(card).getByRole("list", { name: "The options" })).toHaveTextContent("Chosen");
    expect(within(card).getByRole("button", { name: "Pause" })).toBeInTheDocument();
    // The highlight is held, then the game moves on by itself, through the next highlight too.
    for (let step = 0; step < 40 && !within(card).queryByRole("heading", { name: "The first action" }); step++) await act(async () => { vi.advanceTimersByTime(2500); });
    expect(within(card).getByRole("heading", { name: "The first action" })).toBeInTheDocument();
    for (let step = 0; step < 20 && within(card).queryByRole("heading", { name: "The first action" }); step++) await act(async () => { vi.advanceTimersByTime(2500); });
    expect(within(card).queryByRole("heading", { name: "The first action" })).not.toBeInTheDocument();
    expect(card).toHaveTextContent("Vanguard builds a Lumber Yard");
  });

  it("shows the seeding as cards, and a readable close-up of what each step is about", async () => {
    const card = await openDemo();
    fireEvent.click(within(card).getByRole("button", { name: "Play the demo" }));
    const seeding = screen.getByRole("region", { name: "Seeding the Encounter Deck" });
    expect(seeding).toHaveTextContent("Top");
    expect(seeding).toHaveTextContent("Middle");
    expect(seeding).toHaveTextContent("Bottom");
    fireEvent.click(within(card).getByRole("button", { name: "Skip to the next highlight" }));
    expect(within(card).getByRole("heading", { name: "The first action" })).toBeInTheDocument();
    const closeUp = screen.getByRole("figure", { name: "To build: Lumber Yard" });
    expect(closeUp).toHaveTextContent("Cost");
    expect(closeUp).toHaveTextContent("Activate: Gain 2 Wood.");
    fireEvent.click(within(card).getByRole("button", { name: "Next step" }));
    expect(screen.getByRole("figure", { name: "Built: Lumber Yard" })).toBeInTheDocument();
  });

  it("pauses, steps back and forward, skips between highlights and reaches the final scoring", async () => {
    const card = await openDemo();
    fireEvent.click(within(card).getByRole("button", { name: "Play the demo" }));
    fireEvent.click(within(card).getByRole("button", { name: "Pause" }));
    expect(within(card).getByRole("button", { name: "Play" })).toBeInTheDocument();
    fireEvent.click(within(card).getByRole("button", { name: "Next step" }));
    expect(card).toHaveTextContent("seeds three cards into the Encounter Deck");
    fireEvent.click(within(card).getByRole("button", { name: "Back one step" }));
    expect(within(card).getByRole("heading", { name: "Seeding the Season" })).toBeInTheDocument();
    fireEvent.click(within(card).getByRole("button", { name: "Skip to the next highlight" }));
    expect(within(card).getByRole("heading", { name: "The first action" })).toBeInTheDocument();
    for (let guard = 0; guard < 30 && within(card).queryByRole("button", { name: /^Skip/ }); guard++) fireEvent.click(within(card).getByRole("button", { name: /^Skip/ }));
    expect(within(card).getByText("Final score")).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: "Play a real game" })).toHaveAttribute("href", "?experience=table");
    fireEvent.click(within(card).getByRole("button", { name: "Watch again" }));
    expect(within(card).getByRole("heading", { name: "Two Stewards, one settlement" })).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Play the demo" })).toBeInTheDocument();
  });

  it("changes speed between normal, fast and slow, and remembers it", async () => {
    const card = await openDemo();
    const speed = within(card).getByRole("button", { name: /^Speed: Normal/ });
    fireEvent.click(speed);
    expect(within(card).getByRole("button", { name: /^Speed: Fast/ })).toBeInTheDocument();
    fireEvent.click(within(card).getByRole("button", { name: /^Speed: Fast/ }));
    expect(within(card).getByRole("button", { name: /^Speed: Slow/ })).toBeInTheDocument();
    expect(window.localStorage.getItem("quietVale.watchSpeed.v1")).toBe("slow");
  });

  it("leaves the table read-only and saves nothing", async () => {
    await openDemo();
    expect(screen.queryByRole("button", { name: "End turn" })).not.toBeInTheDocument();
    expect(Object.keys(window.localStorage).filter((key) => /activeGame|stewardsLedger/.test(key))).toEqual([]);
  });
});

describe("the way in", () => {
  it("offers one demo on the start page", async () => {
    window.history.replaceState(null, "", "/?experience=table");
    const { App } = await import("../app/App");
    render(<App />);
    const links = screen.getAllByRole("link").filter((link) => /demo|scene|guided/i.test(link.textContent ?? ""));
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "?demo=watch");
    expect(links[0]).toHaveTextContent("Watch a demo");
  });

  it("opens the demo from its link", async () => {
    const { ExperienceRoot } = await import("../app/ExperienceRoot");
    render(<ExperienceRoot />);
    await waitFor(() => expect(screen.getByRole("complementary", { name: "Demo commentary" })).toBeInTheDocument(), { timeout: 8000 });
  });
});
