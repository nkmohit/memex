import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePersistedSearchState } from "./usePersistedSearchState";

describe("usePersistedSearchState", () => {
  const store: Record<string, string> = {};
  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
      clear: () => {
        for (const k of Object.keys(store)) delete store[k];
      },
    } as unknown as Storage);
  });

  it("initializes with defaults when no stored state", () => {
    const { result } = renderHook(() => usePersistedSearchState());
    expect(result.current.query).toBe("");
    expect(result.current.snapshot.sort).toBe("last_occurrence_desc");
  });

  it("loads from localStorage", () => {
    store["memex-search-state"] = JSON.stringify({
      query: "hello",
      source: "claude",
      dateFrom: "2026-01-01",
      dateTo: "2026-01-31",
      sort: "relevance",
    });
    const { result } = renderHook(() => usePersistedSearchState());
    expect(result.current.query).toBe("hello");
    expect(result.current.snapshot.source).toBe("claude");
  });

  it("persists query changes to localStorage", () => {
    const { result } = renderHook(() => usePersistedSearchState());
    act(() => result.current.setQuery("world"));
    expect(JSON.parse(store["memex-search-state"]!).query).toBe("world");
  });

  it("clearPersistedState resets", () => {
    const { result } = renderHook(() => usePersistedSearchState());
    act(() => result.current.setQuery("something"));
    act(() => result.current.clearPersistedState());
    expect(result.current.query).toBe("");
    expect(result.current.snapshot.source).toBe("");
    expect(JSON.parse(store["memex-search-state"]!).query).toBe("");
  });

  it("ignores invalid JSON gracefully", () => {
    store["memex-search-state"] = "not-json";
    const { result } = renderHook(() => usePersistedSearchState());
    expect(result.current.query).toBe("");
  });
});
