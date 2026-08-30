import { describe, it, expect, vi, beforeEach } from "vitest";
import { initErrorTracking, reportError, isErrorTrackingInitialized, resetErrorTrackingForTest } from "./errorTracking";

describe("errorTracking", () => {
  beforeEach(() => {
    resetErrorTrackingForTest();
    vi.clearAllMocks();
  });

  it("initializes once", () => {
    expect(isErrorTrackingInitialized()).toBe(false);
    initErrorTracking();
    expect(isErrorTrackingInitialized()).toBe(true);
    initErrorTracking();
    expect(isErrorTrackingInitialized()).toBe(true);
  });

  it("reportError logs via logger.error without throwing", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    reportError(new Error("oops"), { extra: { foo: "bar" } });
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it("reportError handles non-Error input", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    reportError("string error");
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
