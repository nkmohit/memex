import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useClearData } from "./useClearData";

vi.mock("../db", () => ({
  clearAllData: vi.fn(),
}));
import { clearAllData } from "../db";

function makeOpts(overrides: Partial<Parameters<typeof useClearData>[0]> = {}) {
  return {
    pushToast: vi.fn(),
    loadData: vi.fn(async () => {}),
    clearPersistedSearchState: vi.fn(),
    setSelectedConvId: vi.fn(),
    setMessages: vi.fn(),
    setSkipOnboarding: vi.fn(),
    setOnboardingVisible: vi.fn(),
    activeSource: null,
    importing: false,
    loading: false,
    ...overrides,
  };
}

describe("useClearData", () => {
  beforeEach(() => vi.clearAllMocks());

  it("opens confirm dialog when not busy", () => {
    const { result } = renderHook(() => useClearData(makeOpts()));
    act(() => result.current.handleClearAllDataClick());
    expect(result.current.clearConfirmOpen).toBe(true);
  });

  it("does not open when importing", () => {
    const { result } = renderHook(() => useClearData(makeOpts({ importing: true })));
    act(() => result.current.handleClearAllDataClick());
    expect(result.current.clearConfirmOpen).toBe(false);
  });

  it("confirm flow calls clearAllData and toasts success", async () => {
    vi.mocked(clearAllData).mockResolvedValue(undefined);
    const opts = makeOpts();
    const { result } = renderHook(() => useClearData(opts));
    await act(async () => {
      await result.current.handleClearAllDataConfirm();
    });
    expect(clearAllData).toHaveBeenCalled();
    expect(opts.clearPersistedSearchState).toHaveBeenCalled();
    expect(opts.pushToast).toHaveBeenCalledWith("All imported data was removed.", "success");
    expect(result.current.clearingData).toBe(false);
  });

  it("reports error toast when clear fails", async () => {
    vi.mocked(clearAllData).mockRejectedValue(new Error("db locked"));
    const opts = makeOpts();
    const { result } = renderHook(() => useClearData(opts));
    await act(async () => {
      await result.current.handleClearAllDataConfirm();
    });
    expect(opts.pushToast).toHaveBeenCalledWith("db locked", "error");
    expect(result.current.clearingData).toBe(false);
  });
});
