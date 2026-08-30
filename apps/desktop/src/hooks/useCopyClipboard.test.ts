import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCopyClipboard } from "./useCopyClipboard";

describe("useCopyClipboard", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn(async () => {}) },
      writable: true,
      configurable: true,
    });
    vi.useFakeTimers();
  });

  it("showCopyToast sets and clears after 2s", () => {
    const { result } = renderHook(() => useCopyClipboard());
    act(() => result.current.showCopyToast("Copied"));
    expect(result.current.copyToast).toBe("Copied");
    act(() => vi.advanceTimersByTime(2100));
    expect(result.current.copyToast).toBeNull();
  });

  it("copyMessageToClipboard formats and copies", async () => {
    const { result } = renderHook(() => useCopyClipboard());
    const msg = { id: "m1", sender: "human" as const, content: "hi", created_at: Date.now() };
    act(() => result.current.copyMessageToClipboard(msg, "Claude"));
    await act(async () => await Promise.resolve());
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
  });

  it("copyConversationToClipboard joins messages", async () => {
    const { result } = renderHook(() => useCopyClipboard());
    const msgs = [
      { id: "m1", sender: "human" as const, content: "a", created_at: Date.now() },
      { id: "m2", sender: "assistant" as const, content: "b", created_at: Date.now() },
    ];
    act(() => result.current.copyConversationToClipboard(msgs, "Claude"));
    await act(async () => await Promise.resolve());
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
  });

  it("copyToClipboard returns false when no clipboard", async () => {
    // @ts-expect-error - navigator.clipboard optional
    delete navigator.clipboard;
    const { result } = renderHook(() => useCopyClipboard());
    const ok = await result.current.copyToClipboard("test");
    expect(ok).toBe(false);
  });
});
