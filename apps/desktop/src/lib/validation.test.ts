import { describe, it, expect } from "vitest";
import {
  sanitizeSource,
  clampLimit,
  clampOffset,
  sanitizeSort,
  sanitizeQuery,
  isValidTimestamp,
  sanitizeDateRange,
  isValidSource,
} from "./validation";

describe("sanitizeSource", () => {
  it("returns undefined for empty/undefined", () => {
    expect(sanitizeSource(undefined)).toBeUndefined();
    expect(sanitizeSource("")).toBeUndefined();
    expect(sanitizeSource("   ")).toBeUndefined();
  });
  it("lowercases and trims", () => {
    expect(sanitizeSource("  Claude ")).toBe("claude");
  });
  it("rejects invalid characters", () => {
    expect(sanitizeSource("claude!@#")).toBeUndefined();
    expect(sanitizeSource("a".repeat(31))).toBeUndefined();
  });
  it("accepts valid slugs", () => {
    expect(sanitizeSource("my-source_123")).toBe("my-source_123");
  });
});

describe("clampLimit", () => {
  it("returns default when NaN", () => {
    expect(clampLimit("foo")).toBe(20);
    expect(clampLimit(undefined)).toBe(20);
  });
  it("clamps to max and min", () => {
    expect(clampLimit(500, 20, 100)).toBe(100);
    expect(clampLimit(0, 20, 100)).toBe(1);
    expect(clampLimit(-5)).toBe(1);
  });
  it("floors", () => {
    expect(clampLimit(10.9)).toBe(10);
    expect(clampLimit("42")).toBe(42);
  });
});

describe("clampOffset", () => {
  it("returns 0 for invalid", () => {
    expect(clampOffset(NaN)).toBe(0);
    expect(clampOffset("abc")).toBe(0);
  });
  it("clamps negative to 0 and floors", () => {
    expect(clampOffset(-10)).toBe(0);
    expect(clampOffset(5.7)).toBe(5);
  });
});

describe("sanitizeSort", () => {
  it("accepts valid sorts", () => {
    expect(sanitizeSort("relevance")).toBe("relevance");
    expect(sanitizeSort("title_az")).toBe("title_az");
  });
  it("falls back for invalid", () => {
    expect(sanitizeSort("foo")).toBe("last_occurrence_desc");
    expect(sanitizeSort(null)).toBe("last_occurrence_desc");
  });
});

describe("sanitizeQuery", () => {
  it("trims and returns empty for blank", () => {
    expect(sanitizeQuery("   ")).toBe("");
    expect(sanitizeQuery(" hello ")).toBe("hello");
  });
  it("truncates over 500", () => {
    const long = "a".repeat(600);
    expect(sanitizeQuery(long).length).toBe(500);
  });
});

describe("isValidTimestamp", () => {
  it("validates numbers in range", () => {
    expect(isValidTimestamp(Date.now())).toBe(true);
    expect(isValidTimestamp(0)).toBe(true);
    expect(isValidTimestamp(-1)).toBe(false);
    expect(isValidTimestamp("123")).toBe(false);
    expect(isValidTimestamp(Infinity)).toBe(false);
  });
  it("rejects future beyond 24h", () => {
    expect(isValidTimestamp(Date.now() + 86_400_000 + 1000)).toBe(false);
  });
});

describe("sanitizeDateRange", () => {
  it("returns undefined for invalid", () => {
    expect(sanitizeDateRange("foo", "bar")).toEqual({ from: undefined, to: undefined });
  });
  it("swaps when from > to", () => {
    const from = Date.now();
    const to = from - 1000;
    const r = sanitizeDateRange(from, to);
    expect(r.from).toBe(to);
    expect(r.to).toBe(from);
  });
  it("keeps correct order", () => {
    const from = 1000;
    const to = 2000;
    expect(sanitizeDateRange(from, to)).toEqual({ from, to });
  });
});

describe("isValidSource", () => {
  it("checks valid set or non-empty", () => {
    expect(isValidSource("claude")).toBe(true);
    expect(isValidSource("unknown")).toBe(true);
    expect(isValidSource("")).toBe(false);
  });
});
