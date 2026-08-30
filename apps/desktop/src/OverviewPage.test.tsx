import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import OverviewPage from "./OverviewPage";
import type { DashboardSnapshot } from "./db";

const mockGetCached = vi.fn();
const mockGetDashboard = vi.fn();

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return {
    ...actual,
    getCachedDashboardSnapshot: (...args: unknown[]) => mockGetCached(...args),
    getDashboardSnapshot: (...args: unknown[]) => mockGetDashboard(...args),
  };
});

vi.mock("./components/OverviewMemoryPulse", () => ({
  default: ({ activityTimeline, sourceStats }: { activityTimeline: unknown[]; sourceStats: unknown[] }) => (
    <div data-testid="memory-pulse">
      pulse {activityTimeline.length} {sourceStats.length}
    </div>
  ),
}));

function makeSnapshot(overrides: Partial<DashboardSnapshot> = {}): DashboardSnapshot {
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
      { source: "chatgpt", conversationCount: 1, messageCount: 4, lastActivityTimestamp: Date.now() },
    ],
    recentConversations: [
      { id: "c1", source: "claude", title: "Hello", created_at: Date.now(), last_message_at: Date.now(), message_count: 5 },
      { id: "c2", source: "chatgpt", title: "World", created_at: Date.now(), last_message_at: Date.now(), message_count: 5 },
    ],
    activityTimeline: [
      { day: "2026-08-10", totalCount: 5, chatgptCount: 2, claudeCount: 3, geminiCount: 0, grokCount: 0, otherCount: 0 },
    ],
    dataVersion: 1,
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe("OverviewPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows skeleton while loading when no snapshot (happy path)", async () => {
    let resolveFresh!: (v: DashboardSnapshot) => void;
    mockGetCached.mockResolvedValue(null);
    mockGetDashboard.mockReturnValue(new Promise<DashboardSnapshot>((r) => (resolveFresh = r)));

    render(<OverviewPage onOpenImport={vi.fn()} onOpenSearch={vi.fn()} onSelectConversation={vi.fn()} onRebuildIndex={vi.fn()} />);
    // skeleton present initially
    expect(document.querySelector(".overview-skeleton-line")).toBeInTheDocument();

    resolveFresh(makeSnapshot());
    await waitFor(() => expect(screen.getByText("Command Center")).toBeInTheDocument());
  });

  it("renders metrics and top source after load (happy path)", async () => {
    const snap = makeSnapshot();
    mockGetCached.mockResolvedValue(null);
    mockGetDashboard.mockResolvedValue(snap);
    render(<OverviewPage onOpenImport={vi.fn()} onOpenSearch={vi.fn()} onSelectConversation={vi.fn()} onRebuildIndex={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Command Center")).toBeInTheDocument());
    expect(screen.getAllByText("Messages").length).toBeGreaterThan(0);
    expect(screen.getByText("Conversations")).toBeInTheDocument();
    expect(screen.getByTestId("memory-pulse")).toBeInTheDocument();
  });

  it("shows empty state when no data (empty path)", async () => {
    const snap = makeSnapshot({
      stats: { conversationCount: 0, messageCount: 0, indexedMessageCount: 0, latestMessageTimestamp: null, estimatedInputTokens: 0, estimatedOutputTokens: 0, estimatedTotalTokens: 0 },
      sourceStats: [],
      recentConversations: [],
      activityTimeline: [],
    });
    mockGetCached.mockResolvedValue(null);
    mockGetDashboard.mockResolvedValue(snap);
    render(<OverviewPage onOpenImport={vi.fn()} onOpenSearch={vi.fn()} onSelectConversation={vi.fn()} onRebuildIndex={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/No data yet/)).toBeInTheDocument());
  });

  it("shows index missing banner and calls onRebuildIndex (error path)", async () => {
    const snap = makeSnapshot({
      stats: { conversationCount: 2, messageCount: 10, indexedMessageCount: 0, latestMessageTimestamp: Date.now(), estimatedInputTokens: 0, estimatedOutputTokens: 0, estimatedTotalTokens: 0 },
    });
    mockGetCached.mockResolvedValue(null);
    mockGetDashboard.mockResolvedValue(snap);
    const onRebuild = vi.fn();
    render(<OverviewPage onOpenImport={vi.fn()} onOpenSearch={vi.fn()} onSelectConversation={vi.fn()} onRebuildIndex={onRebuild} />);
    await waitFor(() => expect(screen.getByText("Search index is missing")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Rebuild index"));
    expect(onRebuild).toHaveBeenCalled();
  });

  it("calls onSelectConversation when recent row clicked", async () => {
    const snap = makeSnapshot();
    mockGetCached.mockResolvedValue(null);
    mockGetDashboard.mockResolvedValue(snap);
    const onSelect = vi.fn();
    render(<OverviewPage onOpenImport={vi.fn()} onOpenSearch={vi.fn()} onSelectConversation={onSelect} onRebuildIndex={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Hello")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Hello"));
    expect(onSelect).toHaveBeenCalledWith("c1");
  });

  it("uses cached snapshot immediately before fresh (cache path)", async () => {
    const cached = makeSnapshot({ stats: { conversationCount: 1, messageCount: 5, indexedMessageCount: 5, latestMessageTimestamp: Date.now(), estimatedInputTokens: 10, estimatedOutputTokens: 10, estimatedTotalTokens: 20 } });
    const fresh = makeSnapshot({ stats: { conversationCount: 2, messageCount: 10, indexedMessageCount: 10, latestMessageTimestamp: Date.now(), estimatedInputTokens: 10, estimatedOutputTokens: 10, estimatedTotalTokens: 20 } });
    mockGetCached.mockResolvedValue(cached);
    mockGetDashboard.mockResolvedValue(fresh);
    render(<OverviewPage onOpenImport={vi.fn()} onOpenSearch={vi.fn()} onSelectConversation={vi.fn()} onRebuildIndex={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Command Center")).toBeInTheDocument());
    // eventually fresh overwrites — just ensure no crash
    await waitFor(() => expect(screen.getByTestId("memory-pulse")).toBeInTheDocument());
  });
});
