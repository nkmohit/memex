import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useImportState } from "./useImportState";

vi.mock("../importer", () => ({
  importConversations: vi.fn(),
}));
vi.mock("../db", () => ({
  markDataChanged: vi.fn(async () => {}),
}));

import { importConversations } from "../importer";

describe("useImportState", () => {
  beforeEach(() => vi.clearAllMocks());

  it("handles successful import (happy path)", async () => {
    vi.mocked(importConversations).mockResolvedValue({
      conversationCount: 2,
      messageCount: 10,
    } as never);
    const pushToast = vi.fn();
    const loadData = vi.fn(async () => {});
    const { result } = renderHook(() =>
      useImportState({
        pushToast,
        loadData,
        activeSource: null,
        sourceLabel: (s) => s.toUpperCase(),
        clearingData: false,
      })
    );
    await act(async () => {
      await result.current.handleImportSource("claude");
    });
    expect(importConversations).toHaveBeenCalled();
    expect(pushToast).toHaveBeenCalledWith(expect.stringContaining("2 conversations"), "success");
    expect(loadData).toHaveBeenCalled();
    expect(result.current.importResult).toContain("2 conversations");
    expect(result.current.importing).toBe(false);
  });

  it("does not start when clearingData", async () => {
    const pushToast = vi.fn();
    const { result } = renderHook(() =>
      useImportState({
        pushToast,
        loadData: vi.fn(async () => {}),
        activeSource: null,
        sourceLabel: (s) => s,
        clearingData: true,
      })
    );
    await act(async () => {
      await result.current.handleImportSource("claude");
    });
    expect(importConversations).not.toHaveBeenCalled();
  });

  it("handles import error (error path)", async () => {
    vi.mocked(importConversations).mockRejectedValue(new Error("import boom"));
    const pushToast = vi.fn();
    const { result } = renderHook(() =>
      useImportState({
        pushToast,
        loadData: vi.fn(async () => {}),
        activeSource: null,
        sourceLabel: (s) => s,
        clearingData: false,
      })
    );
    await act(async () => {
      await result.current.handleImportSource("claude");
    });
    expect(pushToast).toHaveBeenCalledWith("import boom", "error");
    expect(result.current.importError).toBe("import boom");
  });

  it("handleCancelImport aborts controller", async () => {
    const { result } = renderHook(() =>
      useImportState({
        pushToast: vi.fn(),
        loadData: vi.fn(async () => {}),
        activeSource: null,
        sourceLabel: (s) => s,
        clearingData: false,
      })
    );
    // initially no controller
    act(() => result.current.handleCancelImport());
    expect(result.current.importAbortRef.current).toBeNull();
    // simulate ongoing import by setting mock to pending
    let resolveImport!: (v: unknown) => void;
    vi.mocked(importConversations).mockReturnValue(
      new Promise((r) => (resolveImport = r)) as never
    );
    const pushToast = vi.fn();
    const { result: r2 } = renderHook(() =>
      useImportState({
        pushToast,
        loadData: vi.fn(async () => {}),
        activeSource: null,
        sourceLabel: (s) => s,
        clearingData: false,
      })
    );
    const importPromise = r2.current.handleImportSource("claude");
    // now abort
    act(() => r2.current.handleCancelImport());
    expect(r2.current.importAbortRef.current).not.toBeNull();
    // resolve to cleanup
    await act(async () => {
      resolveImport({ conversationCount: 0, messageCount: 0 });
      await importPromise;
    });
  });
});
