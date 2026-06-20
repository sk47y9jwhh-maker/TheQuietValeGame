import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../app/App";

describe("app smoke flow", () => {
  it("defaults new games to solo play", () => {
    render(<App />);

    expect(screen.getAllByText("1 Player").length).toBeGreaterThan(0);
  });

  it("starts a seeded game and asks for Steward placement first", () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText("Encounter Seed"), {
      target: { value: "QV-SMOKE" }
    });
    fireEvent.click(screen.getByRole("button", { name: /start season i/i }));

    expect(screen.getByText("Setup")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Vanguard" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /confirm vanguard start/i })).toBeEnabled();
  });

  it("confirms the solo Steward start and shows the seeding screen", () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText("Encounter Seed"), {
      target: { value: "QV-SMOKE" }
    });
    fireEvent.click(screen.getByRole("button", { name: /start season i/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm vanguard start/i }));

    expect(screen.getByText("Season 1 Seeding")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Vanguard" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /confirm seeding/i })).toBeEnabled();
  });

  it("advances from solo seeding to reveal", () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText("Encounter Seed"), {
      target: { value: "QV-SMOKE" }
    });
    fireEvent.click(screen.getByRole("button", { name: /start season i/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm vanguard start/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm seeding/i }));

    expect(screen.getByRole("heading", { name: /reveal encounters/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reveal encounters/i })).toBeEnabled();
  });
});
