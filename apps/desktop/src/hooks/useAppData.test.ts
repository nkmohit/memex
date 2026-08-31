import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useAppData } from "./useAppData";

const mockGetCached = vi.fn();
const mockGetStats = vi.fn();
const mockGetSourceStats = vi.fn();
const mockGetConversations = vi.fn();

vi.mock("../db", () => ({
  getCachedDashboardSnapshot: (...args: unknown[]) => mockGetCached(...args),
  getStats: (...args: unknown[]) => mockGetStats(...args),
  getSourceStats: (...args: unknown[]) => mockGetSourceStats(...args),
  getConversations: (...args: unknown[]) => mockGetConversations(...args),
}));

vi.mock("../lib/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

describe("useAppData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCached.mockResolvedValue(null);
    mockGetStats.mockResolvedValue({
      conversationCount: 1,
      messageCount: 2,
      indexedMessageCount: 2,
      latestMessageTimestamp: Date.now(),
      estimatedInputTokens: 10,
      estimatedOutputTokens: 10,
      estimatedTotalTokens: 20,
    });
    mockGetSourceStats.mockResolvedValue([
      {
        source: "claude",
        conversationCount: 1,
        messageCount: 2,
        lastActivityTimestamp: Date.now(),
      },
    ]);
    mockGetConversations.mockResolvedValue([
      {
        id: "c1",
        source: "claude",
        title: "Test",
        created_at: 0,
        last_message_at: 0,
        message_count: 2,
      },
    ]);
  });

  it("loads data happy path sets stats and conversations", async () => {
    const pushToast = vi.fn();
    const { result } = renderHook(() => useAppData(pushToast));

    expect(result.current.loading).toBe(true);

    await act(async () => {
      await result.current.loadData(null);
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockGetStats).toHaveBeenCalled();
    expect(mockGetSourceStats).toHaveBeenCalled();
    expect(mockGetConversations).toHaveBeenCalledWith(200, undefined);
    expect(result.current.stats?.conversationCount).toBe(1);
    expect(result.current.conversations).toHaveLength(1);
    expect(result.current.loadError).toBeNull();
    expect(pushToast).not.toHaveBeenCalled();
  });

  it("handles error path sets loadError and pushToast", async () => {
    const pushToast = vi.fn();
    const err = new Error("DB fail");
    mockGetStats.mockRejectedValueOnce(err);

    const { result } = renderHook(() => useAppData(pushToast));

    await act(async () => {
      await result.current.loadData("claude");
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.loadError).toBe("DB fail");
    expect(pushToast).toHaveBeenCalledWith("DB fail", "error");
  });

  it("uses cached snapshot when available and no source", async () => {
    const pushToast = vi.fn();
    const cached = {
      stats: {
        conversationCount: 5,
        messageCount: 10,
        indexedMessageCount: 10,
        latestMessageTimestamp: 123,
        estimatedInputTokens: 1,
        estimatedOutputTokens: 1,
        estimatedTotalTokens: 2,
      },
      sourceStats: [
        { source: "chatgpt", conversationCount: 5, messageCount: 10, lastActivityTimestamp: 123 },
      ],
      recentConversations: [
        {
          id: "c2",
          source: "chatgpt",
          title: "Cached",
          created_at: 0,
          last_message_at: 0,
          message_count: 10,
        },
      ],
      activityTimeline: [],
      dataVersion: 1,
      updatedAt: Date.now(),
    };
    mockGetCached.mockResolvedValueOnce(cached);

    const { result } = renderHook(() => useAppData(pushToast));

    await act(async () => {
      await result.current.loadData(null);
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    // cached should have been applied at least once before fresh
    expect(mockGetCached).toHaveBeenCalled();
  });
});
