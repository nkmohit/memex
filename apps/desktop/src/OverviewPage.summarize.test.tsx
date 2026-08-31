import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { DashboardSnapshot } from "./db";
import * as flags from "./lib/flags";

const mockGetCached = vi.fn();
const mockGetDashboard = vi.fn();
const mockSummarize = vi.fn(async () => ["Insight 1", "Insight 2", "Insight 3"]);

vi.mock("./db", () => ({
  // @ts-ignore mock signature
  getCachedDashboardSnapshot: (...args: unknown[]) => mockGetCached(...args),
  // @ts-ignore mock signature
  getDashboardSnapshot: (...args: unknown[]) => mockGetDashboard(...args),
}));

vi.mock("./components/OverviewMemoryPulse", () => ({
  default: () => <div data-testid="memory-pulse" />,
}));

vi.mock("./lib/summarize", () => ({
  // @ts-ignore mock signature
  summarizeText: (...args: unknown[]) => mockSummarize(...args),
}));

function makeSnapshot(): DashboardSnapshot {
  return {
    stats: {
      conversationCount: 2,
      messageCount: 10,
      indexedMessageCount: 10,
      latestMessageTimestamp: Date.now(),
      estimatedInputTokens: 100,
      estimatedOutputTokens: 200,
      estimatedTotalTokens: 300,
    },
    sourceStats: [
      { source: "claude", conversationCount: 1, messageCount: 6, lastActivityTimestamp: Date.now() },
    ],
    recentConversations: [
      {
        id: "c1",
        source: "claude",
        title: "Hello",
        created_at: Date.now(),
        last_message_at: Date.now(),
        message_count: 5,
      },
    ],
    activityTimeline: [],
    dataVersion: 1,
    updatedAt: Date.now(),
  };
}

describe("OverviewPage summarize gating", () => {
  beforeEach(() => {
    flags.resetFlags();
    try {
      localStorage.clear();
    } catch {}
    vi.clearAllMocks();
    mockSummarize.mockClear();
    const snap = makeSnapshot();
    mockGetCached.mockResolvedValue(snap);
    mockGetDashboard.mockResolvedValue(snap);
  });

  it("shows Insights bullets when summarize enabled", async () => {
    vi.spyOn(flags, "isEnabled").mockImplementation(() => true);
    const { default: OverviewPage } = await import("./OverviewPage");
    render(<OverviewPage onOpenImport={vi.fn()} onOpenSearch={vi.fn()} onSelectConversation={vi.fn()} onRebuildIndex={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Insight 1")).toBeInTheDocument());
    expect(mockSummarize).toHaveBeenCalled();
  });

  it("shows fallback and does not call summarize when flag disabled", async () => {
    vi.spyOn(flags, "isEnabled").mockImplementation((name) => name !== "summarize");
    const { default: OverviewPage } = await import("./OverviewPage");
    render(<OverviewPage onOpenImport={vi.fn()} onOpenSearch={vi.fn()} onSelectConversation={vi.fn()} onRebuildIndex={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/AI insight cards will surface/)).toBeInTheDocument());
    await new Promise((r) => setTimeout(r, 150));
    expect(mockSummarize).not.toHaveBeenCalled();
  });
});
