import { describe, it, expect, beforeEach } from "vitest";
import { recordSearchLatency, getSearchP95, getSearchLatencies, getSearchSummary, resetOtel, exportOtelMetrics, startOtelSpan } from "./otel";
import { clearSpans, recordSpanLatency } from "./logger";

describe("lib/otel p95", () => {
  beforeEach(() => {
    resetOtel();
    clearSpans();
  });

  it("histogram p95 via recordSearchLatency", () => {
    for (let i = 1; i <= 20; i++) recordSearchLatency(i * 10);
    expect(getSearchLatencies()).toHaveLength(20);
    expect(getSearchP95()).toBe(190);
    const summary = getSearchSummary();
    expect(summary.count).toBe(20);
    expect(summary.p95).toBe(190);
    expect(summary.p50).toBe(100);
  });

  it("logger span also records to otel", () => {
    recordSpanLatency("searchMessages", 100);
    recordSpanLatency("searchMessages", 200);
    expect(getSearchP95()).toBe(200);
    expect(getSearchLatencies()).toEqual([100, 200]);
  });

  it("non-search spans not recorded", () => {
    recordSpanLatency("otherSpan", 999);
    expect(getSearchLatencies()).toHaveLength(0);
    expect(getSearchP95()).toBeNull();
  });

  it("exportOtelMetrics contains search latency", () => {
    recordSearchLatency(50);
    recordSearchLatency(150);
    const m = exportOtelMetrics();
    expect(m["search.latency.count"]).toBe(2);
    expect(m["search.latency.p95"]).toBe(150);
  });

  it("startOtelSpan records on end", () => {
    const span = startOtelSpan("searchMessages", { q: "hello" });
    // simulate small delay
    span.end({ resultCount: 3 });
    expect(getSearchLatencies()).toHaveLength(1);
    expect(getSearchP95()).not.toBeNull();
  });

  it("caps at 1000 points", () => {
    for (let i = 0; i < 1100; i++) recordSearchLatency(i);
    expect(getSearchLatencies()).toHaveLength(1000);
    // p95 should be near top
    expect(getSearchP95()).toBeGreaterThan(900);
  });
});
