import { describe, it, expect } from "vitest";
import { getAvailableSources, sourceLabel } from "./sources";
import type { SourceStats } from "../db";

describe("sources", () => {
  it("sourceLabel re-export works", () => {
    expect(sourceLabel("claude")).toBe("Claude");
    expect(sourceLabel("unknown_xyz")).toBe("Unknown_xyz");
  });

  it("getAvailableSources merges db and available importers", () => {
    const stats: SourceStats[] = [
      { source: "claude", conversationCount: 1, messageCount: 1, lastActivityTimestamp: 0 },
      { source: "custom", conversationCount: 2, messageCount: 5, lastActivityTimestamp: 0 },
    ];
    const avail = getAvailableSources(stats);
    expect(avail).toContain("claude");
    expect(avail).toContain("chatgpt");
    expect(avail).toContain("custom");
  });

  it("returns available importers when stats empty", () => {
    const avail = getAvailableSources([]);
    expect(avail).toContain("claude");
    expect(avail).toContain("chatgpt");
  });
});
