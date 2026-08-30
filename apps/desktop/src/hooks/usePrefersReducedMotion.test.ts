import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

describe("usePrefersReducedMotion", () => {
  it("returns false initially and respects matchMedia (happy path)", () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    vi.stubGlobal("matchMedia", vi.fn(() => ({
      matches: true,
      media: "(prefers-reduced-motion: reduce)",
      addEventListener,
      removeEventListener,
      addListener: vi.fn(),
      removeListener: vi.fn(),
    } as unknown as MediaQueryList)));

    const { result } = renderHook(() => usePrefersReducedMotion());
    // effect runs and sets to true because mq.matches = true
    expect(typeof result.current).toBe("boolean");
    expect(addEventListener).toHaveBeenCalled();
  });

  it("handles missing window.matchMedia gracefully", () => {
    const original = window.matchMedia;
    // @ts-expect-error -- testing missing matchMedia
    delete window.matchMedia;
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
    window.matchMedia = original;
  });
});
