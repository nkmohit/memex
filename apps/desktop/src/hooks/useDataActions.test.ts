import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDataActions } from "./useDataActions";

vi.mock("../db", () => ({
  rebuildSearchIndex: vi.fn(),
  getMessages: vi.fn(),
}));
import { rebuildSearchIndex, getMessages } from "../db";

function makeOpts(overrides: Partial<Parameters<typeof useDataActions>[0]> = {}) {
  return {
    pushToast: vi.fn(),
    loadData: vi.fn(async () => {}),
    setLoadError: vi.fn(),
    activeSource: null,
    setSelectedConvId: vi.fn(),
    setMessages: vi.fn(),
    setMessagesLoading: vi.fn(),
    setActiveView: vi.fn(),
    setActiveSource: vi.fn(),
    ...overrides,
  };
}

describe("useDataActions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("handleRebuildIndex success toasts", async () => {
    vi.mocked(rebuildSearchIndex).mockResolvedValue(undefined);
    const opts = makeOpts();
    const { result } = renderHook(() => useDataActions(opts));
    await act(async () => {
      await result.current.handleRebuildIndex();
    });
    expect(rebuildSearchIndex).toHaveBeenCalled();
    expect(opts.loadData).toHaveBeenCalledWith(null);
    expect(opts.pushToast).toHaveBeenCalledWith("Search index rebuilt.", "success");
  });

  it("handleRebuildIndex failure sets error", async () => {
    vi.mocked(rebuildSearchIndex).mockRejectedValue(new Error("fail rebuild"));
    const opts = makeOpts();
    const { result } = renderHook(() => useDataActions(opts));
    await act(async () => {
      await result.current.handleRebuildIndex();
    });
    expect(opts.setLoadError).toHaveBeenCalledWith("fail rebuild");
    expect(opts.pushToast).toHaveBeenCalledWith("fail rebuild", "error");
  });

  it("handleOverviewSelectConversation navigates and loads messages", async () => {
    vi.mocked(getMessages).mockResolvedValue([
      { id: "m1", sender: "human", content: "hi", created_at: Date.now() } as never,
    ]);
    const opts = makeOpts({ loadData: vi.fn(async () => {}) });
    const { result } = renderHook(() => useDataActions(opts));
    await act(async () => {
      result.current.handleOverviewSelectConversation("c1");
      // allow loadData.then
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(opts.setActiveView).toHaveBeenCalledWith("conversations");
    expect(opts.setSelectedConvId).toHaveBeenCalledWith("c1");
  });
});
