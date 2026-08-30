import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSearchSession } from "./useSearchSession";

describe("useSearchSession", () => {
  const store: Record<string, string> = {};
  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    } as unknown as Storage);
  });

  it("initializes with defaults", () => {
    const { result } = renderHook(() => useSearchSession("overview"));
    expect(result.current.searchPageQuery).toBe("");
    expect(result.current.searchSelectedConvId).toBeNull();
    expect(result.current.skipSearchOnceRef.current).toBe(false);
  });

  it("sets and clears search selection", () => {
    const { result } = renderHook(() => useSearchSession("search"));
    act(() => result.current.setSearchSelectedConvId("c1"));
    expect(result.current.searchSelectedConvId).toBe("c1");
    act(() => result.current.setOpenedConversationFromSearch(true));
    expect(result.current.openedConversationFromSearch).toBe(true);
  });

  it("sets focus request id", () => {
    const { result } = renderHook(() => useSearchSession("search"));
    act(() => result.current.setSearchFocusRequestId(123));
    expect(result.current.searchFocusRequestId).toBe(123);
  });
});
