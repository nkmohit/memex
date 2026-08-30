import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSelect = vi.fn();
const mockExecute = vi.fn();
const mockDb = { select: mockSelect, execute: mockExecute };

vi.mock("./connection", () => ({
  getDb: vi.fn(async () => mockDb),
  withDbLock: (fn: () => Promise<unknown>) => fn(),
}));

import { getStats, getSourceStats, getConversations, getMessages, clearAllData, getActivityCountByDay } from "./queries";

describe("queries extra", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockResolvedValue([]);
    mockExecute.mockResolvedValue(undefined);
  });

  it("getStats aggregates counts (happy path)", async () => {
    mockSelect
      .mockResolvedValueOnce([{ count: 5 }]) // conv
      .mockResolvedValueOnce([{ count: 20 }]) // msg
      .mockResolvedValueOnce([{ latest: 12345 }]) // latest
      .mockResolvedValueOnce([{ count: 20 }]) // indexed
      .mockResolvedValueOnce([{ inputTokens: 10, outputTokens: 20 }]); // tokens
    const s = await getStats();
    expect(s.conversationCount).toBe(5);
    expect(s.messageCount).toBe(20);
    expect(s.estimatedTotalTokens).toBe(30);
  });

  it("getSourceStats returns per-source (happy path)", async () => {
    const fake = [{ source: "claude", conversationCount: 1, messageCount: 5, lastActivityTimestamp: 123 }];
    mockSelect.mockResolvedValueOnce(fake);
    const r = await getSourceStats();
    expect(r).toEqual(fake);
  });

  it("getConversations respects limit and source filter", async () => {
    mockSelect.mockResolvedValueOnce([{ id: "c1", source: "claude", title: "T", created_at: 0, last_message_at: 0, message_count: 1 }]);
    const rows = await getConversations(10, "claude");
    expect(rows.length).toBe(1);
    expect(mockSelect).toHaveBeenCalledWith(expect.stringContaining("WHERE c.source"), expect.anything());
  });

  it("getMessages returns empty for invalid id (error path)", async () => {
    const r = await getMessages("");
    expect(r).toEqual([]);
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it("getMessages fetches for valid id", async () => {
    mockSelect.mockResolvedValueOnce([{ id: "m1", sender: "human", content: "hi", created_at: 0 }]);
    const r = await getMessages("c1");
    expect(r.length).toBe(1);
  });

  it("clearAllData handles busy retry (happy path)", async () => {
    mockExecute.mockResolvedValue(undefined);
    mockSelect.mockResolvedValueOnce([{ value: "1" }]); // for bump
    await expect(clearAllData()).resolves.toBeUndefined();
  });

  it("getActivityCountByDay clamps days", async () => {
    mockSelect.mockResolvedValueOnce([]);
    const r = await getActivityCountByDay(400); // clamped 365
    expect(r.length).toBe(365);
  });

  it("getMessages returns empty for too-long id", async () => {
    const long = "a".repeat(201);
    const r = await getMessages(long);
    expect(r).toEqual([]);
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it("getMessages returns empty for non-string id", async () => {
    const r = await getMessages(null as unknown as string);
    expect(r).toEqual([]);
  });

  it("clearAllData retries on SQLITE_BUSY then succeeds", async () => {
    // First attempt fails with busy, second succeeds
    let call = 0;
    mockExecute.mockImplementation(async () => {
      call += 1;
      if (call === 2) throw new Error("database is locked");
      // call 3 is BEGIN IMMEDIATE which will be thrown, then retry succeeds
      return;
    });
    // Make first loop busy on DELETE, second succeeds
    mockExecute.mockReset();
    mockExecute
      .mockResolvedValueOnce(undefined) // PRAGMA busy_timeout
      .mockResolvedValueOnce(undefined) // ROLLBACK
      .mockResolvedValueOnce(undefined) // BEGIN IMMEDIATE
      .mockRejectedValueOnce(new Error("SQLITE_BUSY: database is locked")) // DELETE fails
      .mockResolvedValueOnce(undefined) // ROLLBACK in catch
      .mockResolvedValueOnce(undefined) // PRAGMA busy_timeout retry
      .mockResolvedValueOnce(undefined) // ROLLBACK
      .mockResolvedValueOnce(undefined) // BEGIN IMMEDIATE
      .mockResolvedValueOnce(undefined) // DELETE messages_fts
      .mockResolvedValueOnce(undefined) // DELETE messages
      .mockResolvedValueOnce(undefined) // DELETE conversations
      .mockResolvedValueOnce(undefined) // bumpDataVersion (via database.select? actually execute)
      .mockResolvedValueOnce(undefined); // COMMIT

    // bumpDataVersion calls database.execute via select mock? Actually it does execute+select
    // Mock select for bumpDataVersion
    mockSelect.mockResolvedValueOnce([{ value: "1" }]);
    await expect(clearAllData()).resolves.toBeUndefined();
  });

  it("clearAllData throws on non-busy error immediately", async () => {
    mockExecute.mockReset();
    mockExecute
      .mockResolvedValueOnce(undefined) // PRAGMA
      .mockResolvedValueOnce(undefined) // ROLLBACK
      .mockResolvedValueOnce(undefined) // BEGIN IMMEDIATE
      .mockRejectedValueOnce(new Error("syntax error")); // DELETE fails non-busy
    mockExecute.mockResolvedValueOnce(undefined); // ROLLBACK in catch (second)
    await expect(clearAllData()).rejects.toThrow("syntax error");
  });

  it("clearAllData throws after max retries on persistent busy", async () => {
    mockExecute.mockReset();
    // Make every DELETE fail with busy
    mockExecute.mockImplementation(async () => {
      throw new Error("database is locked");
    });
    await expect(clearAllData()).rejects.toThrow("database is locked");
    // need at least MAX_CLEAR_RETRIES attempts
    expect(mockExecute.mock.calls.length).toBeGreaterThan(5);
  }, 10000);

  it("getAllConversationsForSearch with filters", async () => {
    mockSelect
      .mockResolvedValueOnce([{ total: 1 }]) // count
      .mockResolvedValueOnce([{ conversation_id: "c1", title: "T", source: "claude", created_at: 0, last_message_at: 100, message_count: 1 }]); // rows
    const res = await (await import("./queries")).getAllConversationsForSearch({ source: "claude", dateFrom: 10, dateTo: 200, limit: 10, offset: 0 });
    expect(res.rows.length).toBe(1);
    expect(res.totalMatches).toBe(1);
  });

  it("getConversations without source (branch)", async () => {
    mockSelect.mockResolvedValueOnce([{ id: "c1", source: "claude", title: "T", created_at: 0, last_message_at: 0, message_count: 1 }]);
    const rows = await getConversations(5);
    expect(rows.length).toBe(1);
    expect(mockSelect).toHaveBeenCalledWith(expect.stringContaining("ORDER BY last_message_at"));
  });

  it("getActivityCountByDay with negative days clamps to 1", async () => {
    mockSelect.mockResolvedValueOnce([]);
    const r = await getActivityCountByDay(-5);
    expect(r.length).toBe(1);
  });
});
