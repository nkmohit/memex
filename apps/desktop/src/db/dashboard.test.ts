import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSelect = vi.fn();
const mockExecute = vi.fn();
const mockDb = { select: mockSelect, execute: mockExecute };

vi.mock("./connection", () => ({
  getDb: vi.fn(async () => mockDb),
  withDbLock: (fn: () => Promise<unknown>) => fn(),
}));

import {
  getDataVersion,
  markDataChanged,
  getCachedDashboardSnapshot,
  getDashboardSnapshot,
  readDataVersion,
} from "./dashboard";

describe("dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockResolvedValue([]);
    mockExecute.mockResolvedValue(undefined);
  });

  it("getDataVersion reads app_meta (happy path)", async () => {
    mockSelect.mockResolvedValueOnce([{ value: "42" }]);
    const v = await getDataVersion();
    expect(v).toBe(42);
    expect(mockSelect).toHaveBeenCalledWith(expect.stringContaining("app_meta"));
  });

  it("readDataVersion returns 0 when empty", async () => {
    mockSelect.mockResolvedValueOnce([]);
    const v = await readDataVersion(mockDb as unknown as import("@tauri-apps/plugin-sql").default);
    expect(v).toBe(0);
  });

  it("markDataChanged bumps version (happy path)", async () => {
    mockSelect.mockResolvedValueOnce([{ value: "5" }]);
    mockExecute.mockResolvedValueOnce(undefined);
    const v = await markDataChanged();
    expect(v).toBe(6);
    expect(mockExecute).toHaveBeenCalled();
  });

  it("getCachedDashboardSnapshot returns null when cache miss", async () => {
    mockSelect.mockResolvedValueOnce([{ value: "1" }]); // data version
    mockSelect.mockResolvedValueOnce([]); // cache miss
    const res = await getCachedDashboardSnapshot();
    expect(res).toBeNull();
  });

  it("getCachedDashboardSnapshot returns cached when version matches", async () => {
    const fakeSnap = {
      stats: { conversationCount: 1 },
      sourceStats: [],
      recentConversations: [],
      activityTimeline: [],
      dataVersion: 10,
      updatedAt: Date.now(),
    };
    mockSelect.mockResolvedValueOnce([{ value: "10" }]); // data version
    mockSelect.mockResolvedValueOnce([{ payload: JSON.stringify(fakeSnap), data_version: 10 }]);
    const res = await getCachedDashboardSnapshot();
    expect(res?.dataVersion).toBe(10);
  });

  it("getDashboardSnapshot builds and caches when miss (happy path)", async () => {
    // readDataVersion
    mockSelect.mockResolvedValueOnce([{ value: "1" }]);
    // getCached -> miss
    mockSelect.mockResolvedValueOnce([]);
    // buildDashboardSnapshot needs many selects: conv, msg, latest, indexed, tokens, sourceStats, recent, activity
    mockSelect
      .mockResolvedValueOnce([{ count: 2 }]) // conv
      .mockResolvedValueOnce([{ count: 10 }]) // msg
      .mockResolvedValueOnce([{ latest: Date.now() }]) // latest
      .mockResolvedValueOnce([{ count: 10 }]) // indexed
      .mockResolvedValueOnce([{ inputTokens: 5, outputTokens: 5 }]) // tokens
      .mockResolvedValueOnce([]) // sourceStats
      .mockResolvedValueOnce([]) // recent
      .mockResolvedValueOnce([]); // activity
    mockExecute.mockResolvedValue(undefined);
    const snap = await getDashboardSnapshot();
    expect(snap.stats.conversationCount).toBe(2);
    expect(snap.stats.messageCount).toBe(10);
  });
});
