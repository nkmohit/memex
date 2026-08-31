import { useEffect } from "react";
import type { MutableRefObject } from "react";

interface UseAppDialogsOptions {
  loading: boolean;
  isEmpty: boolean;
  skipOnboarding: boolean;
  setOnboardingVisible: (v: boolean) => void;
  clearConfirmOpen: boolean;
  clearConfirmCancelBtnRef: MutableRefObject<HTMLButtonElement | null>;
  clearConfirmDialogRef: MutableRefObject<HTMLDivElement | null>;
  clearDataTriggerRef: MutableRefObject<HTMLButtonElement | null>;
  setClearConfirmOpen: (v: boolean) => void;
}

export function useAppDialogs(opts: UseAppDialogsOptions) {
  const {
    loading,
    isEmpty,
    skipOnboarding,
    setOnboardingVisible,
    clearConfirmOpen,
    clearConfirmCancelBtnRef,
    clearConfirmDialogRef,
    clearDataTriggerRef,
    setClearConfirmOpen,
  } = opts;

  useEffect(() => {
    if (!loading && isEmpty && !skipOnboarding) setOnboardingVisible(true);
  }, [isEmpty, loading, skipOnboarding, setOnboardingVisible]);

  useEffect(() => {
    if (!clearConfirmOpen) return;
    const id = setTimeout(() => clearConfirmCancelBtnRef.current?.focus(), 0);
    return () => clearTimeout(id);
  }, [clearConfirmOpen, clearConfirmCancelBtnRef]);

  useEffect(() => {
    if (!clearConfirmOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setClearConfirmOpen(false);
        clearDataTriggerRef.current?.focus();
        return;
      }
      if (e.key !== "Tab" || !clearConfirmDialogRef.current) return;
      const dialog = clearConfirmDialogRef.current;
      const focusable = Array.from(dialog.querySelectorAll<HTMLButtonElement>("button"));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (active === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [clearConfirmOpen, clearConfirmDialogRef, clearDataTriggerRef, setClearConfirmOpen]);
}
