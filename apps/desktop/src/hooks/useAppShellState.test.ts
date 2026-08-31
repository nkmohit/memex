import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useAppShellState } from "./useAppShellState";

describe("useAppShellState", () => {
  it("returns overview layout for overview view", () => {
    const { result } = renderHook(() =>
      useAppShellState({
        activeView: "overview",
        searchSelectedConvId: null,
        loading: false,
        stats: { conversationCount: 1 },
        loadError: null,
        clearingData: false,
        importing: false,
      })
    );
    expect(result.current.shellLayoutClass).toBe("overview-layout");
    expect(result.current.appDataState).toBe("ready-has-data");
  });

  it("returns search-layout closed when search with no selected", () => {
    const { result } = renderHook(() =>
      useAppShellState({
        activeView: "search",
        searchSelectedConvId: null,
        loading: false,
        stats: { conversationCount: 1 },
        loadError: null,
        clearingData: false,
        importing: false,
      })
    );
    expect(result.current.shellLayoutClass).toBe("search-layout search-panel-closed");
  });

  it("returns search-layout when search with selected", () => {
    const { result } = renderHook(() =>
      useAppShellState({
        activeView: "search",
        searchSelectedConvId: "c1",
        loading: false,
        stats: { conversationCount: 1 },
        loadError: null,
        clearingData: false,
        importing: false,
      })
    );
    expect(result.current.shellLayoutClass).toBe("search-layout");
  });

  it("returns settings/import/conversations layouts", () => {
    const { result: r1 } = renderHook(() =>
      useAppShellState({
        activeView: "settings",
        searchSelectedConvId: null,
        loading: false,
        stats: null,
        loadError: null,
        clearingData: false,
        importing: false,
      })
    );
    expect(r1.current.shellLayoutClass).toBe("settings-layout");
    const { result: r2 } = renderHook(() =>
      useAppShellState({
        activeView: "import",
        searchSelectedConvId: null,
        loading: false,
        stats: null,
        loadError: null,
        clearingData: false,
        importing: false,
      })
    );
    expect(r2.current.shellLayoutClass).toBe("import-layout");
    const { result: r3 } = renderHook(() =>
      useAppShellState({
        activeView: "conversations",
        searchSelectedConvId: null,
        loading: false,
        stats: null,
        loadError: null,
        clearingData: false,
        importing: false,
      })
    );
    expect(r3.current.shellLayoutClass).toBe("conversations-layout");
  });

  it("computes appDataState bootstrapping/importing/clearing/error/empty", () => {
    const { result: r1 } = renderHook(() =>
      useAppShellState({
        activeView: "overview",
        searchSelectedConvId: null,
        loading: true,
        stats: null,
        loadError: null,
        clearingData: false,
        importing: false,
      })
    );
    expect(r1.current.appDataState).toBe("bootstrapping");
    const { result: r2 } = renderHook(() =>
      useAppShellState({
        activeView: "overview",
        searchSelectedConvId: null,
        loading: false,
        stats: { conversationCount: 0 },
        loadError: null,
        clearingData: false,
        importing: true,
      })
    );
    expect(r2.current.appDataState).toBe("importing");
    const { result: r3 } = renderHook(() =>
      useAppShellState({
        activeView: "overview",
        searchSelectedConvId: null,
        loading: false,
        stats: { conversationCount: 0 },
        loadError: null,
        clearingData: true,
        importing: false,
      })
    );
    expect(r3.current.appDataState).toBe("clearing");
    const { result: r4 } = renderHook(() =>
      useAppShellState({
        activeView: "overview",
        searchSelectedConvId: null,
        loading: false,
        stats: null,
        loadError: "err",
        clearingData: false,
        importing: false,
      })
    );
    expect(r4.current.appDataState).toBe("error");
    const { result: r5 } = renderHook(() =>
      useAppShellState({
        activeView: "overview",
        searchSelectedConvId: null,
        loading: false,
        stats: { conversationCount: 0 },
        loadError: null,
        clearingData: false,
        importing: false,
      })
    );
    expect(r5.current.appDataState).toBe("ready-empty");
  });

  it("isEmpty true when no conversations and not loading", () => {
    const { result } = renderHook(() =>
      useAppShellState({
        activeView: "overview",
        searchSelectedConvId: null,
        loading: false,
        stats: { conversationCount: 0 },
        loadError: null,
        clearingData: false,
        importing: false,
      })
    );
    expect(result.current.isEmpty).toBe(true);
  });
});
