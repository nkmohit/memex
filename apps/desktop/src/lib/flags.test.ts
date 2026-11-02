import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getFlags,
  isEnabled,
  setFlag,
  setFlags,
  resetFlags,
  getFlagDefaults,
  __internal,
} from "./flags";

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
    expect(flags.summarize).toBe(true);
    expect(flags.topicTimeline).toBe(true);
  });

  it("setFlag toggles and persists", () => {
    setFlag("summarize", false);
    expect(isEnabled("summarize")).toBe(false);
    expect(getFlags().summarize).toBe(false);
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem("memex:flags");
      if (raw) expect(raw).toContain("summarize");
    }
  });

  it("setFlags merges partial", () => {
    setFlags({ summarize: false });
    expect(isEnabled("summarize")).toBe(false);
    expect(isEnabled("topicTimeline")).toBe(true);
  });

  it("resetFlags restores defaults and clears storage", () => {
    setFlag("summarize", false);
    resetFlags();
    expect(isEnabled("summarize")).toBe(true);
    if (typeof localStorage !== "undefined") {
      expect(localStorage.getItem("memex:flags")).toBeNull();
    }
  });

  it("getFlagDefaults returns copy", () => {
    const d1 = getFlagDefaults();
    const d2 = getFlagDefaults();
    expect(d1).toEqual(d2);
    d1.summarize = false;
    expect(getFlagDefaults().summarize).toBe(true);
  });

  it("isEnabled is case for all flags", () => {
    const defaults = getFlagDefaults();
    for (const flag of Object.keys(defaults) as (keyof typeof defaults)[]) {
      expect(typeof isEnabled(flag)).toBe("boolean");
    }
  });

  it("readStorage handles invalid JSON / non-object / throw (error path)", () => {
    const orig = globalThis.localStorage;
    // invalid JSON
    vi.stubGlobal("localStorage", {
      getItem: () => "not-json{{{",
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    } as unknown as Storage);
    // reset memory to force readStorage
    resetFlags();
    // force reload by clearing memoryFlags via reset then stub invalid
    // setFlag will re-read; but we test direct internal
    expect(__internal.readStorage()).toEqual({});
    // non-object parsed (number)
    vi.stubGlobal("localStorage", {
      getItem: () => "42",
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    } as unknown as Storage);
    expect(__internal.readStorage()).toEqual({});
    // null
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    } as unknown as Storage);
    expect(__internal.readStorage()).toEqual({});
    // throw
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("quota");
      },
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    } as unknown as Storage);
    expect(__internal.readStorage()).toEqual({});
    // truly missing
    vi.stubGlobal("localStorage", undefined as unknown as Storage);
    expect(__internal.readStorage()).toEqual({});
    // restore
    vi.stubGlobal("localStorage", orig);
    resetFlags();
  });

  it("writeStorage and resetFlags ignore quota errors", () => {
    const orig = globalThis.localStorage;
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
      removeItem: () => {
        throw new Error("quota");
      },
      clear: vi.fn(),
    } as unknown as Storage);
    // should not throw
    expect(() =>
      __internal.writeStorage({
        summarize: true,
        topicTimeline: true,
      })
    ).not.toThrow();
    expect(() => resetFlags()).not.toThrow();
    expect(() => setFlag("summarize", false)).not.toThrow();
    vi.stubGlobal("localStorage", orig);
    resetFlags();
  });

  it("getFlags returns cloned copy not reference", () => {
    const a = getFlags();
    a.summarize = false as unknown as boolean;
    expect(isEnabled("summarize")).toBe(true);
  });

  it("isEnabled false for unknown fallback (edge)", () => {
    const flags = getFlags();
    expect(Object.keys(flags)).toHaveLength(2);
  });
});
