import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../db/queries", () => ({
  getStats: vi.fn(),
  getSourceStats: vi.fn(),
}));

import { getStats, getSourceStats } from "../db/queries";
import {
  computeIndexHealth,
  getDiagnostics,
  isSearchIndexHealthy,
  APP_VERSION,
} from "./diagnostics";
import type { DbStats, SourceStats } from "../db/types";

const mockedGetStats = vi.mocked(getStats);
const mockedGetSourceStats = vi.mocked(getSourceStats);

function makeStats(overrides: Partial<DbStats> = {}): DbStats {
  return {
    conversationCount: 10,
    messageCount: 100,
    indexedMessageCount: 100,
    latestMessageTimestamp: Date.now(),
    estimatedInputTokens: 500,
    estimatedOutputTokens: 500,
    estimatedTotalTokens: 1000,
    ...overrides,
  };
}

function makeSourceStats(): SourceStats[] {
  return [
    { source: "claude", conversationCount: 5, messageCount: 50, lastActivityTimestamp: Date.now() },
    {
      source: "chatgpt",
      conversationCount: 5,
      messageCount: 50,
      lastActivityTimestamp: Date.now(),
    },
  ];
}

describe("computeIndexHealth", () => {
  it("returns 100% when no messages", () => {
    const h = computeIndexHealth(makeStats({ messageCount: 0, indexedMessageCount: 0 }));
    expect(h.indexedPct).toBe(100);
    expect(h.missing).toBe(false);
  });

  it("returns missing=true when messages exist but none indexed", () => {
    const h = computeIndexHealth(makeStats({ messageCount: 50, indexedMessageCount: 0 }));
    expect(h.missing).toBe(true);
    expect(h.indexedPct).toBe(0);
  });

  it("computes pct correctly", () => {
    const h = computeIndexHealth(makeStats({ messageCount: 200, indexedMessageCount: 150 }));
    expect(h.indexedPct).toBe(75);
    expect(h.missing).toBe(false);
  });

  it("returns 100% when fully indexed", () => {
    const h = computeIndexHealth(makeStats({ messageCount: 10, indexedMessageCount: 10 }));
    expect(h.indexedPct).toBe(100);
    expect(h.missing).toBe(false);
  });
});

describe("isSearchIndexHealthy", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns true when indexed", async () => {
    mockedGetStats.mockResolvedValue(makeStats({ messageCount: 10, indexedMessageCount: 10 }));
    expect(await isSearchIndexHealthy()).toBe(true);
  });

  it("returns false when missing", async () => {
    mockedGetStats.mockResolvedValue(makeStats({ messageCount: 10, indexedMessageCount: 0 }));
    expect(await isSearchIndexHealthy()).toBe(false);
  });

  it("returns true when empty db", async () => {
    mockedGetStats.mockResolvedValue(makeStats({ messageCount: 0, indexedMessageCount: 0 }));
    expect(await isSearchIndexHealthy()).toBe(true);
  });
});

describe("getDiagnostics", () => {
  beforeEach(() => vi.clearAllMocks());

  it("collects db + sourceStats + health + version", async () => {
    const stats = makeStats({ messageCount: 20, indexedMessageCount: 10 });
    const sources = makeSourceStats();
    mockedGetStats.mockResolvedValue(stats);
    mockedGetSourceStats.mockResolvedValue(sources);

    const d = await getDiagnostics();
    expect(d.db).toEqual(stats);
    expect(d.sourceStats).toEqual(sources);
    expect(d.version).toBe(APP_VERSION);
    expect(d.indexHealth.indexedPct).toBe(50);
    expect(d.indexHealth.missing).toBe(false);
    expect(d.generatedAt).toBeGreaterThan(0);
  });

  it("marks missing when index empty", async () => {
    mockedGetStats.mockResolvedValue(makeStats({ messageCount: 5, indexedMessageCount: 0 }));
    mockedGetSourceStats.mockResolvedValue([]);
    const d = await getDiagnostics();
    expect(d.indexHealth.missing).toBe(true);
  });
});
