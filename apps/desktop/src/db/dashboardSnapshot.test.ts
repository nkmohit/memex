import { describe, it, expect, vi } from "vitest";
import { buildDashboardSnapshot } from "./dashboardSnapshot";

describe("dashboardSnapshot", () => {
  it("builds snapshot with stats and recent (happy path)", async () => {
    const mockSelect = vi.fn();
    // conv, msg, latest, indexed, tokens, sourceStats, recent, activity
    mockSelect
      .mockResolvedValueOnce([{ count: 3 }])
      .mockResolvedValueOnce([{ count: 30 }])
      .mockResolvedValueOnce([{ latest: 123456 }])
      .mockResolvedValueOnce([{ count: 30 }])
      .mockResolvedValueOnce([{ inputTokens: 10, outputTokens: 20 }])
      .mockResolvedValueOnce([
        { source: "claude", conversationCount: 2, messageCount: 20, lastActivityTimestamp: 123 },
      ])
      .mockResolvedValueOnce([
        {
          id: "c1",
          source: "claude",
          title: "t1",
          created_at: 0,
          last_message_at: 100,
          message_count: 5,
        },
      ])
      .mockResolvedValueOnce([
        {
          day: "2024-01-01",
          totalCount: 5,
          chatgptCount: 0,
          claudeCount: 5,
          geminiCount: 0,
          grokCount: 0,
          otherCount: 0,
        },
      ]);

    const db = { select: mockSelect } as unknown as import("@tauri-apps/plugin-sql").default;
    const snap = await buildDashboardSnapshot(db, 7);
    expect(snap.stats.conversationCount).toBe(3);
    expect(snap.stats.messageCount).toBe(30);
    expect(snap.stats.estimatedTotalTokens).toBe(30);
    expect(snap.sourceStats[0].source).toBe("claude");
    expect(snap.recentConversations[0].id).toBe("c1");
    expect(snap.activityTimeline[0].day).toBe("2024-01-01");
    expect(snap.dataVersion).toBe(7);
  });

  it("handles empty db (zero counts)", async () => {
    const mockSelect = vi.fn();
    mockSelect
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([{ latest: null }])
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([{ inputTokens: 0, outputTokens: 0 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const db = { select: mockSelect } as unknown as import("@tauri-apps/plugin-sql").default;
    const snap = await buildDashboardSnapshot(db, 0);
    expect(snap.stats.conversationCount).toBe(0);
    expect(snap.stats.latestMessageTimestamp).toBeNull();
    expect(snap.dataVersion).toBe(0);
  });
});
