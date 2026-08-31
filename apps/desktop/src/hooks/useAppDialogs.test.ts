import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useAppDialogs } from "./useAppDialogs";

describe("useAppDialogs", () => {
  it("sets onboarding visible when empty and not loading", () => {
    const setOnboardingVisible = vi.fn();
    const clearCancelRef = { current: null as HTMLButtonElement | null };
    const clearDialogRef = { current: null as HTMLDivElement | null };
    const clearTriggerRef = { current: null as HTMLButtonElement | null };
    const setClearConfirmOpen = vi.fn();
    renderHook(() =>
      useAppDialogs({
        loading: false,
        isEmpty: true,
        skipOnboarding: false,
        setOnboardingVisible,
        clearConfirmOpen: false,
        clearConfirmCancelBtnRef: clearCancelRef,
        clearConfirmDialogRef: clearDialogRef,
        clearDataTriggerRef: clearTriggerRef,
        setClearConfirmOpen,
      })
    );
    expect(setOnboardingVisible).toHaveBeenCalledWith(true);
  });

  it("does not set onboarding when loading", () => {
    const setOnboardingVisible = vi.fn();
    const clearCancelRef = { current: null as HTMLButtonElement | null };
    const clearDialogRef = { current: null as HTMLDivElement | null };
    const clearTriggerRef = { current: null as HTMLButtonElement | null };
    const setClearConfirmOpen = vi.fn();
    renderHook(() =>
      useAppDialogs({
        loading: true,
        isEmpty: true,
        skipOnboarding: false,
        setOnboardingVisible,
        clearConfirmOpen: false,
        clearConfirmCancelBtnRef: clearCancelRef,
        clearConfirmDialogRef: clearDialogRef,
        clearDataTriggerRef: clearTriggerRef,
        setClearConfirmOpen,
      })
    );
    expect(setOnboardingVisible).not.toHaveBeenCalled();
  });

  it("focuses cancel button when dialog opens", async () => {
    const setOnboardingVisible = vi.fn();
    const focus = vi.fn();
    const clearCancelRef = { current: { focus } as unknown as HTMLButtonElement };
    const clearDialogRef = { current: null as HTMLDivElement | null };
    const clearTriggerRef = { current: null as HTMLButtonElement | null };
    const setClearConfirmOpen = vi.fn();
    renderHook(() =>
      useAppDialogs({
        loading: false,
        isEmpty: false,
        skipOnboarding: true,
        setOnboardingVisible,
        clearConfirmOpen: true,
        clearConfirmCancelBtnRef: clearCancelRef,
        clearConfirmDialogRef: clearDialogRef,
        clearDataTriggerRef: clearTriggerRef,
        setClearConfirmOpen,
      })
    );
    await new Promise((r) => setTimeout(r, 10));
    expect(focus).toHaveBeenCalled();
  });
});
