import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useToast } from "./useToast";

describe("useToast", () => {
  it("pushes and dismisses toasts (happy path)", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useToast());
    act(() => result.current.pushToast("hello", "info"));
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]!.message).toBe("hello");
    act(() => result.current.pushToast("world", "success"));
    expect(result.current.toasts).toHaveLength(2);
    act(() => result.current.dismissToast(result.current.toasts[0]!.id));
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]!.message).toBe("world");
    vi.useRealTimers();
  });

  it("auto-dismisses after 3s (timer path)", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useToast());
    act(() => result.current.pushToast("auto", "info"));
    expect(result.current.toasts).toHaveLength(1);
    act(() => vi.advanceTimersByTime(3100));
    expect(result.current.toasts).toHaveLength(0);
    vi.useRealTimers();
  });
});
