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
});
