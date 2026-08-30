import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useViewerSearch } from "./useViewerSearch";
import type { MessageRow } from "../db";

function makeMessages(): MessageRow[] {
  return [
    { id: "m1", sender: "human", content: "hello world hello", created_at: Date.now() },
    { id: "m2", sender: "assistant", content: "Hello again", created_at: Date.now() },
  ];
}

describe("useViewerSearch", () => {
  it("computes occurrences for query (happy path)", () => {
    const { result } = renderHook(() => useViewerSearch(makeMessages(), false, { current: {} }));
    act(() => result.current.setMessageSearchQuery("hello"));
    expect(result.current.matchCount).toBe(3);
    expect(result.current.messageMatchCount).toBe(2);
    expect(result.current.occurrences).toHaveLength(3);
  });

  it("handles empty query", () => {
    const { result } = renderHook(() => useViewerSearch(makeMessages(), false, { current: {} }));
    act(() => result.current.setMessageSearchQuery("   "));
    expect(result.current.matchCount).toBe(0);
    expect(result.current.occurrences).toHaveLength(0);
  });

  it("highlightText wraps matches with mark (happy path)", () => {
    const { result } = renderHook(() => useViewerSearch(makeMessages(), false, { current: {} }));
    const out = result.current.highlightText("hello world", "hello");
    // out is array of strings/marks
    expect(Array.isArray(out)).toBe(true);
    const hasMark = (out as unknown[]).some((el: unknown) => typeof el === "object" && el !== null && (el as { props?: { children?: string } }).props?.children === "hello");
    expect(hasMark).toBe(true);
  });

  it("navigates matches with goToNext/Prev", () => {
    const { result } = renderHook(() => useViewerSearch(makeMessages(), false, { current: {} }));
    act(() => result.current.setMessageSearchQuery("hello"));
    expect(result.current.currentMatchIndex).toBe(0);
    act(() => result.current.goToNextMatch());
    expect(result.current.currentMatchIndex).toBe(1);
    act(() => result.current.goToNextMatch());
    act(() => result.current.goToNextMatch());
    // wraps around
    expect(result.current.currentMatchIndex).toBe(0);
    act(() => result.current.goToPrevMatch());
    expect(result.current.currentMatchIndex).toBe(2);
  });

  it("toggles viewerSearchOpen", () => {
    const { result } = renderHook(() => useViewerSearch(makeMessages(), false, { current: {} }));
    expect(result.current.viewerSearchOpen).toBe(false);
    act(() => result.current.setViewerSearchOpen(true));
    expect(result.current.viewerSearchOpen).toBe(true);
  });

  it("escapes regex special characters", () => {
    const { result } = renderHook(() => useViewerSearch([{ id: "m1", sender: "human", content: "a+b*c", created_at: 0 }], false, { current: {} }));
    act(() => result.current.setMessageSearchQuery("a+b*"));
    expect(result.current.matchCount).toBe(1);
  });
});
