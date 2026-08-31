import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useThemeMode } from "./useThemeMode";

describe("useThemeMode", () => {
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
    document.documentElement.className = "";
  });

  it("defaults to system when no stored value", () => {
    const { result } = renderHook(() => useThemeMode());
    expect(result.current.theme).toBe("system");
  });

  it("persists theme change", () => {
    const { result } = renderHook(() => useThemeMode());
    act(() => result.current.setThemeAndPersist("dark"));
    expect(result.current.theme).toBe("dark");
    expect(store["memex-theme"]).toBe("dark");
  });

  it("applies dark class to document", () => {
    const { result } = renderHook(() => useThemeMode());
    act(() => result.current.setThemeAndPersist("dark"));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    act(() => result.current.setThemeAndPersist("light"));
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});
