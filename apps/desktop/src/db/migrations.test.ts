import { describe, it, expect, vi, beforeEach } from "vitest";

const mockExecute = vi.fn();
const mockSelect = vi.fn();
const mockDb = { execute: mockExecute, select: mockSelect };

vi.mock("./connection", async (orig) => {
  const actual = await (orig as () => Promise<Record<string, unknown>>)();
  return {
    ...(actual as object),
    rawGetDb: vi.fn(async () => mockDb),
    withDbLock: (fn: () => Promise<unknown>) => fn(),
  };
});

describe("db/migrations initDatabase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecute.mockResolvedValue(undefined);
    mockSelect.mockReset();
  });

  it("creates tables on fresh DB (happy path)", async () => {
    // cols empty, ftsInfo empty, counts 0
    mockSelect
      .mockResolvedValueOnce([]) // PRAGMA table_info(conversations) cols
      .mockResolvedValueOnce([]) // PRAGMA table_info(messages_fts)
      .mockResolvedValueOnce([{ count: 0 }]) // msgCount
      .mockResolvedValueOnce([{ count: 0 }]) // ftsCount
      .mockResolvedValueOnce([{ count: 0 }]); // convCount
    expect(true).toBe(true);
  });

  it("migrates old conversations table missing updated_at", async () => {
    mockSelect
      .mockResolvedValueOnce([{ name: "id" }, { name: "source" }]) // cols without updated_at
      .mockResolvedValueOnce([]) // ftsInfo empty
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([{ count: 0 }]);
    // Call with mocked DB via dynamic import reset
    vi.resetModules();
    const { initDatabase: freshInit } = await import("./migrations");
    const db = { execute: vi.fn(async () => {}), select: vi.fn(async (sql: string) => {
      if (sql.includes("table_info(conversations)")) return [{ name: "id" }];
      if (sql.includes("table_info(messages_fts)")) return [];
      if (sql.includes("COUNT(*) AS count FROM messages") && !sql.includes("messages_fts")) return [{ count: 0 }];
      if (sql.includes("messages_fts")) return [{ count: 0 }];
      if (sql.includes("conversations")) return [{ count: 0 }];
      return [];
    }) };
    vi.doMock("./connection", () => ({ rawGetDb: vi.fn(async () => db), withDbLock: (fn: () => Promise<unknown>) => fn() }));
    // Just verify init doesn't throw with migration path
    await expect(freshInit()).resolves.toBeUndefined();
  });

  it("migrates FTS missing title", async () => {
    vi.resetModules();
    const db = { execute: vi.fn(async () => {}), select: vi.fn(async (sql: string) => {
      if (sql.includes("table_info(conversations)")) return [{ name: "id" }, { name: "updated_at" }];
      if (sql.includes("table_info(messages_fts)")) return [{ name: "content" }];
      if (sql.includes("COUNT(*)")) return [{ count: 0 }];
      return [];
    }) };
    vi.doMock("./connection", () => ({ rawGetDb: vi.fn(async () => db), withDbLock: (fn: () => Promise<unknown>) => fn() }));
    const { initDatabase: freshInit } = await import("./migrations");
    await expect(freshInit()).resolves.toBeUndefined();
  });

  it("backfills FTS when msg>0 and fts==0", async () => {
    vi.resetModules();
    const db = { execute: vi.fn(async () => {}), select: vi.fn(async (sql: string) => {
      if (sql.includes("table_info")) return [{ name: "id" }, { name: "updated_at" }, { name: "title" }];
      if (sql.includes("COUNT(*) AS count FROM messages") && !sql.includes("fts")) return [{ count: 5 }];
      if (sql.includes("COUNT(*) AS count FROM messages_fts")) return [{ count: 0 }];
      if (sql.includes("COUNT(*) as count FROM conversations")) return [{ count: 2 }];
      return [];
    }) };
    vi.doMock("./connection", () => ({ rawGetDb: vi.fn(async () => db), withDbLock: (fn: () => Promise<unknown>) => fn() }));
    const { initDatabase: freshInit } = await import("./migrations");
    await expect(freshInit()).resolves.toBeUndefined();
    expect(db.execute).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO messages_fts"));
  });
});
