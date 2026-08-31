import { describe, it, expect, vi, beforeEach } from "vitest";
import { logger, recordSpanLatency, getSpanLatencies, computeP95, clearSpans } from "./logger";

describe("lib/logger", () => {
  beforeEach(() => {
    clearSpans();
    vi.restoreAllMocks();
  });

  it("info/warn/error prefix with memex:level", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    logger.info("hello", 123);
    expect(logSpy).toHaveBeenCalledWith("[memex:info]", "hello", 123);
    logger.warn("w");
    expect(warnSpy).toHaveBeenCalledWith("[memex:warn]", "w");
    logger.error("e");
    expect(errSpy).toHaveBeenCalledWith("[memex:error]", "e");
  });

  it("debug suppressed when not TAURI_DEBUG (default)", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    logger.debug("should not log");
    expect(logSpy).not.toHaveBeenCalled();
  });

  it("startSpan/endSpan logs and records latency", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const span = logger.startSpan("searchMessages", { q: "hello" });
    expect(span.name).toBe("searchMessages");
    expect(typeof span.start).toBe("number");
    expect(logSpy).toHaveBeenCalledWith(
      "[memex:debug]",
      expect.stringContaining("span:start searchMessages"),
      { q: "hello" }
    );
    const dur = logger.endSpan(span, { extra: 1 });
    expect(typeof dur).toBe("number");
    expect(dur).toBeGreaterThanOrEqual(0);
    expect(getSpanLatencies("searchMessages")).toHaveLength(1);
  });

  it("withSpan success records latency and returns value", async () => {
    const res = await logger.withSpan("searchMessages", async () => 42);
    expect(res).toBe(42);
    expect(getSpanLatencies("searchMessages")).toHaveLength(1);
  });

  it("withSpan sync success", async () => {
    const res = await logger.withSpan("op", () => "sync");
    expect(res).toBe("sync");
  });

  it("withSpan error rethrows but records latency", async () => {
    const err = new Error("boom");
    await expect(
      logger.withSpan("failOp", async () => {
        throw err;
      })
    ).rejects.toThrow("boom");
    expect(getSpanLatencies("failOp")).toHaveLength(1);
  });

  it("recordSpanLatency caps at 1000 and computeP95 edge", () => {
    for (let i = 0; i < 1005; i++) recordSpanLatency("cap", i);
    expect(getSpanLatencies("cap")).toHaveLength(1000);
    expect(getSpanLatencies("cap")[0]).toBe(5);
    expect(computeP95([])).toBeNull();
    expect(computeP95([10])).toBe(10);
  });

  it("clearSpans empties", () => {
    recordSpanLatency("a", 10);
    clearSpans();
    expect(getSpanLatencies("a")).toEqual([]);
  });
});
