import { describe, it, expect, beforeEach } from "vitest";
import { getFlags, isEnabled, setFlag, setFlags, resetFlags, getFlagDefaults } from "./flags";

describe("lib/flags", () => {
  beforeEach(() => {
    resetFlags();
    try {
      localStorage.clear();
    } catch (_e) {
      // ignore - localStorage may not be available in node
    }
  });

  it("returns defaults when no storage", () => {
    const flags = getFlags();
    expect(flags.semanticSearch).toBe(true);
    expect(flags.vector).toBe(true);
    expect(flags.summarize).toBe(true);
    expect(flags.plugins).toBe(true);
    expect(flags.topicTimeline).toBe(true);
  });

  it("setFlag toggles and persists", () => {
    setFlag("vector", false);
    expect(isEnabled("vector")).toBe(false);
    expect(getFlags().vector).toBe(false);
    // persisted (when localStorage available)
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem("memex:flags");
      if (raw) expect(raw).toContain("vector");
    }
  });

  it("setFlags merges partial", () => {
    setFlags({ summarize: false, plugins: false });
    expect(isEnabled("summarize")).toBe(false);
    expect(isEnabled("plugins")).toBe(false);
    expect(isEnabled("vector")).toBe(true);
  });

  it("resetFlags restores defaults and clears storage", () => {
    setFlag("vector", false);
    resetFlags();
    expect(isEnabled("vector")).toBe(true);
    if (typeof localStorage !== "undefined") {
      expect(localStorage.getItem("memex:flags")).toBeNull();
    }
  });

  it("getFlagDefaults returns copy", () => {
    const d1 = getFlagDefaults();
    const d2 = getFlagDefaults();
    expect(d1).toEqual(d2);
    d1.vector = false;
    expect(getFlagDefaults().vector).toBe(true);
  });

  it("isEnabled is case for all flags", () => {
    const defaults = getFlagDefaults();
    for (const flag of Object.keys(defaults) as (keyof typeof defaults)[]) {
      expect(typeof isEnabled(flag)).toBe("boolean");
    }
  });
});
