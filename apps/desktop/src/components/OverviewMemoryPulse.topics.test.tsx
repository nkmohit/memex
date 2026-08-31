import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import OverviewMemoryPulse from "./OverviewMemoryPulse";
import * as flags from "../lib/flags";
import type { ActivityHeatmapPoint } from "../db";

function makePoint(day: string): ActivityHeatmapPoint {
  return {
    day,
    totalCount: 1,
    chatgptCount: 0,
    claudeCount: 1,
    geminiCount: 0,
    grokCount: 0,
    otherCount: 0,
  };
}

describe("OverviewMemoryPulse topics (flag gated)", () => {
  beforeEach(() => {
    flags.resetFlags();
    try {
      localStorage.clear();
    } catch (_e) {
      void _e;
    }
    vi.restoreAllMocks();
  });

  it("shows Top topics pill when topicTexts present and flag enabled", () => {
    vi.spyOn(flags, "isEnabled").mockImplementation(() => true);
    render(
      <OverviewMemoryPulse
        activityTimeline={[makePoint("2026-08-10")]}
        sourceStats={[]}
        topicTexts={[
          "React and Rust are great for frontend",
          "Rust Tauri desktop app",
          "React hooks",
        ]}
        topicDates={[Date.now(), Date.now(), Date.now()]}
      />
    );
    expect(screen.getByText(/Top topics:/)).toBeInTheDocument();
  });

  it("hides Top topics when flag disabled", () => {
    vi.spyOn(flags, "isEnabled").mockImplementation((n) => n !== "topicTimeline");
    render(
      <OverviewMemoryPulse
        activityTimeline={[makePoint("2026-08-10")]}
        sourceStats={[]}
        topicTexts={["React and Rust", "React hooks"]}
        topicDates={[Date.now(), Date.now()]}
      />
    );
    expect(screen.queryByText(/Top topics:/)).not.toBeInTheDocument();
  });

  it("shows topic timeline when data present", () => {
    vi.spyOn(flags, "isEnabled").mockImplementation(() => true);
    const now = new Date("2026-08-15").getTime();
    render(
      <OverviewMemoryPulse
        activityTimeline={[makePoint("2026-08-10")]}
        sourceStats={[]}
        topicTexts={["React frontend", "Rust cargo", "React hooks"]}
        topicDates={[now, now, now]}
      />
    );
    // timeline should appear when topics present
    expect(screen.getByText(/Top topics:/)).toBeInTheDocument();
    // timeline months rendered
    const timeline = document.querySelector(".overview-topic-timeline");
    expect(timeline).toBeInTheDocument();
  });
});
