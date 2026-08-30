import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ParsedConversation } from "@memex/core";

const mockExecute = vi.fn();
const mockSelect = vi.fn();
const mockDb = { execute: mockExecute, select: mockSelect };

vi.mock("./db", () => ({
  getDb: vi.fn(async () => mockDb),
  withDbLock: (fn: () => Promise<unknown>) => fn(),
}));

vi.mock("./lib/vector", () => ({
  embed: vi.fn(() => new Array(64).fill(0.1)),
}));

import { insertConversations } from "./dbInsert";

function makeConv(id: string, msgCount = 1): ParsedConversation {
  return {
    id,
    externalId: id,
    source: "claude",
    title: `Title ${id}`,
    createdAt: 1000,
    updatedAt: 1000,
    messageCount: msgCount,
    messages: Array.from({ length: msgCount }, (_, i) => ({
      id: `${id}-m${i}`,
      conversationId: id,
      sender: "human" as const,
      content: `hello world ${id} ${i}`,
      createdAt: 1000 + i,
    })),
  };
}

describe("dbInsert", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecute.mockResolvedValue(undefined);
    mockSelect.mockResolvedValue([]);
  });

  it("inserts single conversation and messages (happy path)", async () => {
    const conv = makeConv("c1", 2);
    const res = await insertConversations([conv]);
    expect(res.conversationCount).toBe(1);
    expect(res.messageCount).toBe(2);
    expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining("INSERT OR REPLACE INTO conversations"), expect.anything());
    expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining("INSERT OR REPLACE INTO messages"), expect.anything());
    expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO messages_fts"), expect.anything());
    expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining("messages_vec"), expect.anything());
  });

  it("handles empty array", async () => {
    const res = await insertConversations([]);
    expect(res.conversationCount).toBe(0);
    expect(res.messageCount).toBe(0);
  });

  it("reports progress via onProgress", async () => {
    const onProgress = vi.fn();
    const convs = [makeConv("c1"), makeConv("c2")];
    await insertConversations(convs, { onProgress, chunkSize: 1 });
    expect(onProgress).toHaveBeenCalledTimes(2);
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ conversationsDone: 1, conversationsTotal: 2 }));
  });

  it("aborts when signal aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(insertConversations([makeConv("c1")], { signal: controller.signal })).rejects.toThrow("Import cancelled");
  });

  it("retries on SQLITE_BUSY then succeeds", async () => {
    let call = 0;
    mockExecute.mockImplementation(async (sql: string) => {
      call += 1;
      // Fail first BEGIN IMMEDIATE with busy
      if (call === 2) throw new Error("SQLITE_BUSY: database is locked");
      return;
    });
    // Need to reset after first failure, second attempt succeeds
    mockExecute.mockReset();
    let first = true;
    mockExecute.mockImplementation(async () => {
      if (first) {
        first = false;
        throw new Error("database is locked");
      }
      return;
    });
    // Make second attempt succeed by resetting mock after throw
    // Use a more deterministic sequence: fail then succeed
    mockExecute.mockReset();
    mockExecute
      .mockResolvedValueOnce(undefined) // PRAGMA
      .mockRejectedValueOnce(new Error("database is locked")) // BEGIN fails
      .mockResolvedValueOnce(undefined) // ROLLBACK in catch? Actually runImportChunkTransaction catches and rethrows, outer retries
      .mockResolvedValueOnce(undefined) // PRAGMA retry
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce(undefined) // conv insert
      .mockResolvedValueOnce(undefined) // delete fts
      .mockResolvedValueOnce(undefined) // messages
      .mockResolvedValueOnce(undefined) // fts
      .mockResolvedValueOnce(undefined) // vec
      .mockResolvedValueOnce(undefined); // COMMIT

    const res = await insertConversations([makeConv("c1")]);
    expect(res.conversationCount).toBe(1);
  }, 10000);

  it("throws on non-busy error immediately", async () => {
    mockExecute.mockRejectedValueOnce(new Error("syntax error"));
    await expect(insertConversations([makeConv("c1")])).rejects.toThrow("syntax error");
  });

  it("ignores messages_vec error (older DB)", async () => {
    // Make vec insert throw, but should still commit
    mockExecute.mockImplementation(async (sql: string) => {
      if (sql.includes("messages_vec")) throw new Error("no such table");
      return;
    });
    const res = await insertConversations([makeConv("c1")]);
    expect(res.conversationCount).toBe(1);
  });

  it("handles chunkSize clamping and conversation with no messages", async () => {
    const convEmpty = { ...makeConv("cEmpty", 0), messages: [] as ParsedConversation["messages"], messageCount: 0 };
    const res = await insertConversations([convEmpty], { chunkSize: 0 });
    expect(res.conversationCount).toBe(1);
    expect(res.messageCount).toBe(0);
  });
});
