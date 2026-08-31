import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSelect = vi.fn();
const mockExecute = vi.fn();
const mockDb = { select: mockSelect, execute: mockExecute };

vi.mock("./connection", () => ({
  getDb: vi.fn(async () => mockDb),
  withDbLock: (fn: () => Promise<unknown>) => fn(),
}));

import { readDataVersion, bumpDataVersion, setDashboardMemoryCache } from "./dashboardCache";

describe("dashboardCache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockResolvedValue([]);
    mockExecute.mockResolvedValue(undefined);
    setDashboardMemoryCache(null);
  });

  it("readDataVersion parses value", async () => {
    mockSelect.mockResolvedValueOnce([{ value: "7" }]);
    const v = await readDataVersion(mockDb as unknown as import("@tauri-apps/plugin-sql").default);
    expect(v).toBe(7);
  });

  it("readDataVersion returns 0 on NaN", async () => {
    mockSelect.mockResolvedValueOnce([{ value: "not-a-number" }]);
    const v = await readDataVersion(mockDb as unknown as import("@tauri-apps/plugin-sql").default);
    expect(v).toBe(0);
  });

  it("bumpDataVersion increments and clears cache", async () => {
    mockSelect.mockResolvedValueOnce([{ value: "3" }]);
    mockExecute.mockResolvedValueOnce(undefined);
    const v = await bumpDataVersion(mockDb as unknown as import("@tauri-apps/plugin-sql").default);
    expect(v).toBe(4);
    expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining("app_meta"), ["4"]);
  });
});
