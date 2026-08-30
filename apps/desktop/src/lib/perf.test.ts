import { describe, it, expect, beforeEach } from "vitest";
// @ts-ignore - node types may not be installed in desktop
import { readFile } from "node:fs/promises";
import { computeP95, clearSpans, recordSpanLatency, getSpanLatencies } from "./logger";
import { getPerfStats } from "./diagnostics";

describe("perf budgets", () => {
  it("budgets.json exists and enforces 300kB", async () => {
    const raw = await readFile("../../perf/budgets.json");
    const data = JSON.parse(raw.toString());
    expect(data.budgets[0].maxSizeKB).toBe(300);
    expect(data.budgets[0].path).toContain("dist");
  });
});

describe("lib/logger OTEL span", () => {
  beforeEach(() => clearSpans());

  it("recordSpanLatency and computeP95", () => {
    recordSpanLatency("searchMessages", 10);
    recordSpanLatency("searchMessages", 20);
    recordSpanLatency("searchMessages", 30);
    recordSpanLatency("searchMessages", 40);
    recordSpanLatency("searchMessages", 50);
    const lat = getSpanLatencies("searchMessages");
    expect(lat).toHaveLength(5);
    expect(computeP95(lat)).toBe(50); // 95th percentile of 5 is max
    expect(computeP95([])).toBeNull();
  });

  it("p95 for 20 samples", () => {
    clearSpans();
    for (let i = 1; i <= 20; i++) recordSpanLatency("searchMessages", i * 10);
    expect(computeP95(getSpanLatencies("searchMessages"))).toBe(190); // ceil(0.95*20)=19 => 190
  });

  it("diagnostics getPerfStats reflects span latencies", async () => {
    clearSpans();
    recordSpanLatency("searchMessages", 100);
    recordSpanLatency("searchMessages", 200);
    const perf = getPerfStats();
    expect(perf.searchCount).toBe(2);
    expect(perf.searchP95Ms).toBe(200);
    expect(perf.searchLatencies).toEqual([100, 200]);
  });
});
