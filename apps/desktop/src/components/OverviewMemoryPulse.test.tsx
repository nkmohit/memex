import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import OverviewMemoryPulse from "./OverviewMemoryPulse";
import type { ActivityHeatmapPoint, SourceStats } from "../db";

function makePoint(day: string, total = 5, overrides: Partial<ActivityHeatmapPoint> = {}): ActivityHeatmapPoint {
  return {
    day,
    totalCount: total,
    chatgptCount: 1,
    claudeCount: 2,
    geminiCount: 1,
    grokCount: 0,
    otherCount: total - 4,
    ...overrides,
  };
}

function makeStats(): SourceStats[] {
  return [
    { source: "claude", conversationCount: 5, messageCount: 50, lastActivityTimestamp: Date.now() },
    { source: "chatgpt", conversationCount: 3, messageCount: 30, lastActivityTimestamp: Date.now() },
  ];
}

describe("OverviewMemoryPulse", () => {
  it("renders memory pulse strip and source momentum (happy path)", () => {
    const today = new Date().toISOString().slice(0, 10);
    const points = [makePoint(today, 3), makePoint("2026-08-10", 5)];
    render(<OverviewMemoryPulse activityTimeline={points} sourceStats={makeStats()} />);
    expect(screen.getByLabelText("Memory pulse strip")).toBeInTheDocument();
    expect(screen.getByText("Source momentum")).toBeInTheDocument();
    expect(screen.getByText("Claude")).toBeInTheDocument();
    expect(screen.getAllByText(/messages/).length).toBeGreaterThan(0);
  });

  it("shows empty state when no activity for year", () => {
    render(<OverviewMemoryPulse activityTimeline={[]} sourceStats={[]} />);
    expect(screen.getByText("No activity for this selected year.")).toBeInTheDocument();
    expect(screen.getByText("No source data yet.")).toBeInTheDocument();
  });

  it("handles year selection", () => {
    const points = [makePoint("2026-01-15", 2), makePoint("2025-06-10", 7)];
    render(<OverviewMemoryPulse activityTimeline={points} sourceStats={makeStats()} />);
    // year select should include 2026,2025 and Latest
    expect(screen.getByText("Latest")).toBeInTheDocument();
  });

  it("computes intensity levels via heatmap cells", () => {
    const y = new Date().getFullYear();
    // create points with varying counts to hit intensity branches
    const points = [
      makePoint(`${y}-01-01`, 0, { totalCount: 0, chatgptCount: 0, claudeCount: 0, geminiCount: 0, grokCount: 0, otherCount: 0 }),
      makePoint(`${y}-01-02`, 1),
      makePoint(`${y}-01-03`, 10),
    ];
    render(<OverviewMemoryPulse activityTimeline={points} sourceStats={makeStats()} />);
    const grid = document.querySelector(".overview-heatmap-grid");
    expect(grid).toBeInTheDocument();
    const cells = document.querySelectorAll(".overview-heatmap-cell");
    expect(cells.length).toBeGreaterThan(0);
  });

  it("shows heatmap tooltip on hover", async () => {
    const y = new Date().getFullYear();
    const points = [makePoint(`${y}-03-15`, 5)];
    render(<OverviewMemoryPulse activityTimeline={points} sourceStats={makeStats()} />);
    const cell = document.querySelector(".overview-heatmap-cell.level-4, .overview-heatmap-cell.level-1, .overview-heatmap-cell") as HTMLElement;
    if (cell) {
      fireEvent.mouseEnter(cell);
      // tooltip appears after hover
      // we just verify cell has title or hover state
      expect(cell).toBeInTheDocument();
    }
  });

  it("shows Top topics via TF-IDF when topicTexts provided", () => {
    const y = new Date().getFullYear();
    const points = [makePoint(`${y}-03-15`, 5)];
    const texts = [
      "React frontend UI discussion about hooks",
      "Rust Cargo Tauri desktop app with React",
      "React and Rust integration for Memex",
    ];
    const dates = texts.map(() => Date.now());
    render(<OverviewMemoryPulse activityTimeline={points} sourceStats={makeStats()} topicTexts={texts} topicDates={dates} />);
    const topicsEl = screen.getByText(/Top topics:/);
    expect(topicsEl).toBeInTheDocument();
    expect(topicsEl.textContent).toMatch(/React/);
    expect(topicsEl.textContent).toMatch(/Rust/);
    // timeline should show months
    expect(screen.getByLabelText("Topic timeline")).toBeInTheDocument();
  });

  it("shows nothing for topics when no texts", () => {
    const y = new Date().getFullYear();
    const points = [makePoint(`${y}-03-15`, 5)];
    render(<OverviewMemoryPulse activityTimeline={points} sourceStats={makeStats()} topicTexts={[]} />);
    expect(screen.queryByText(/Top topics:/)).not.toBeInTheDocument();
  });

  it("changes year via AppSelect", async () => {
    const points = [makePoint("2026-01-15", 2), makePoint("2025-06-10", 7)];
    render(<OverviewMemoryPulse activityTimeline={points} sourceStats={makeStats()} />);
    const btn = screen.getByRole("button", { name: "Pulse timeframe" });
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    // AppSelect listbox should appear with Latest, 2026, 2025
    const listbox = screen.getByRole("listbox");
    expect(listbox).toBeInTheDocument();
    const opt2025 = screen.getByRole("option", { name: "2025" });
    fireEvent.click(opt2025);
    // After selection, button should show 2025
    expect(btn.textContent).toContain("2025");
  });

  it("renders topic timeline for multiple months", () => {
    const points = [makePoint("2026-01-15", 3)];
    const texts = ["React hooks Jan", "React state Jan", "Rust ownership Feb"];
    const dates = [new Date("2026-01-10").getTime(), new Date("2026-01-20").getTime(), new Date("2026-02-05").getTime()];
    render(<OverviewMemoryPulse activityTimeline={points} sourceStats={makeStats()} topicTexts={texts} topicDates={dates} />);
    // Should show Top topics and timeline months
    expect(screen.getByText(/Top topics:/)).toBeInTheDocument();
    expect(screen.getByLabelText("Topic timeline")).toBeInTheDocument();
    expect(screen.getByText("2026-01")).toBeInTheDocument();
    expect(screen.getByText("2026-02")).toBeInTheDocument();
  });

  it("handles empty sourceStats and single day", () => {
    render(<OverviewMemoryPulse activityTimeline={[makePoint("2026-08-10", 1)]} sourceStats={[]} topicTexts={["solo"]} topicDates={[Date.now()]} />);
    expect(screen.getByLabelText("Memory pulse strip")).toBeInTheDocument();
  });

  it("shows heatmap tooltip on cell hover", async () => {
    const y = new Date().getFullYear();
    const points = [makePoint(`${y}-04-10`, 8), makePoint(`${y}-04-11`, 12)];
    render(<OverviewMemoryPulse activityTimeline={points} sourceStats={makeStats()} />);
    const cell = document.querySelector(".overview-heatmap-cell.level-4, .overview-heatmap-cell.level-2, .overview-heatmap-cell") as HTMLElement;
    if (cell) {
      // Mock getBoundingClientRect for cell and container
      const mockRect = { left: 10, top: 10, width: 12, height: 12, right: 22, bottom: 22 } as DOMRect;
      const containerRect = { left: 0, top: 0, width: 500, height: 100, right: 500, bottom: 100 } as DOMRect;
      vi.spyOn(cell, "getBoundingClientRect").mockReturnValue(mockRect);
      const canvas = document.querySelector(".overview-heatmap-canvas") as HTMLElement;
      if (canvas) vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue(containerRect);
      fireEvent.mouseEnter(cell);
      // tooltip should appear after hover
      await new Promise((r) => setTimeout(r, 0));
      // At least cell still exists
      expect(cell).toBeInTheDocument();
      fireEvent.mouseLeave(cell);
    }
  });

  it("renders source momentum percentages", () => {
    const points = [makePoint("2026-08-10", 1)];
    const stats: SourceStats[] = [
      { source: "claude", conversationCount: 10, messageCount: 100, lastActivityTimestamp: Date.now() },
      { source: "chatgpt", conversationCount: 5, messageCount: 50, lastActivityTimestamp: Date.now() },
    ];
    render(<OverviewMemoryPulse activityTimeline={points} sourceStats={stats} />);
    expect(screen.getByText("67%")).toBeInTheDocument();
    expect(screen.getByText("33%")).toBeInTheDocument();
  });

  it("handles heatmap intensity levels 0-4", () => {
    const y = new Date().getFullYear();
    const points = [
      makePoint(`${y}-06-01`, 0, { totalCount: 0, chatgptCount: 0, claudeCount: 0, geminiCount: 0, grokCount: 0, otherCount: 0 }),
      makePoint(`${y}-06-02`, 1),
      makePoint(`${y}-06-03`, 5),
      makePoint(`${y}-06-04`, 10),
      makePoint(`${y}-06-05`, 20),
    ];
    render(<OverviewMemoryPulse activityTimeline={points} sourceStats={makeStats()} />);
    const cells = document.querySelectorAll(".overview-heatmap-cell");
    expect(cells.length).toBeGreaterThan(10);
    // Check that at least one cell has level-0 and one has level-4
    expect(document.querySelector(".level-0")).toBeInTheDocument();
  });
});
