import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { formatTimestamp, formatDate } from "./utils";

describe("formatTimestamp", () => {
  it("returns 'Never' for null", () => {
    expect(formatTimestamp(null)).toBe("Never");
  });

  it("returns 'Never' for 0", () => {
    expect(formatTimestamp(0)).toBe("Never");
  });

  it("returns 'Never' for NaN (falsy)", () => {
    expect(formatTimestamp(NaN)).toBe("Never");
  });

  it("returns 'Unknown' for invalid date (Infinity)", () => {
    expect(formatTimestamp(Infinity)).toBe("Unknown");
  });

  it("formats same-day timestamp as time string containing ':'", () => {
    const now = new Date("2026-05-15T14:30:00Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const ts = new Date("2026-05-15T10:00:00Z").getTime();
    const result = formatTimestamp(ts);
    expect(result).toMatch(/:/);
    vi.useRealTimers();
  });

  it("formats same-year but different day as month and day without year", () => {
    const now = new Date("2026-05-15T14:30:00Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const ts = new Date("2026-02-10T10:00:00Z").getTime();
    const result = formatTimestamp(ts);
    // Should contain month abbreviation, not year 2026
    expect(result).not.toContain("2026");
    expect(result.length).toBeGreaterThan(0);
    vi.useRealTimers();
  });

  it("formats different year as month day year", () => {
    const now = new Date("2026-05-15T14:30:00Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const ts = new Date("2020-01-01T10:00:00Z").getTime();
    const result = formatTimestamp(ts);
    expect(result).toContain("2020");
    vi.useRealTimers();
  });
});

describe("formatDate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'Unknown date' for 0", () => {
    expect(formatDate(0)).toBe("Unknown date");
  });

  it("returns 'Unknown date' for NaN", () => {
    expect(formatDate(NaN)).toBe("Unknown date");
  });

  it("returns 'Unknown date' for Infinity", () => {
    expect(formatDate(Infinity)).toBe("Unknown date");
  });

  it("formats same-year date without year", () => {
    const ts = new Date("2026-03-10T00:00:00Z").getTime();
    const result = formatDate(ts);
    expect(result).not.toContain("2026");
  });

  it("formats different year date with year", () => {
    const ts = new Date("2020-03-10T00:00:00Z").getTime();
    const result = formatDate(ts);
    expect(result).toContain("2020");
  });

  it("returns non-empty string for valid timestamp", () => {
    const ts = Date.now() - 1000 * 60 * 60 * 24 * 5;
    expect(formatDate(ts).length).toBeGreaterThan(0);
  });
});
