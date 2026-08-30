import { useRef, useState } from "react";
import { clearAllData } from "../db";
import type { MessageRow } from "../db";
import { logger } from "../lib/logger";

interface UseClearDataOptions {
  pushToast: (msg: string, variant?: "success" | "error" | "info") => void;
  loadData: (source?: string | null) => Promise<void>;
  clearPersistedSearchState: () => void;
  setSelectedConvId: (id: string | null) => void;
  setMessages: (msgs: MessageRow[]) => void;
  setSkipOnboarding: (v: boolean) => void;
  setOnboardingVisible: (v: boolean) => void;
  activeSource: string | null;
  importing: boolean;
  loading: boolean;
}

export function useClearData(options: UseClearDataOptions) {
  const [clearingData, setClearingData] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const clearConfirmCancelBtnRef = useRef<HTMLButtonElement>(null);
  const clearConfirmDialogRef = useRef<HTMLDivElement>(null);
  const clearDataTriggerRef = useRef<HTMLButtonElement>(null);

  function handleClearAllDataClick() {
    if (options.importing || clearingData || options.loading) return;
    setClearConfirmOpen(true);
  }

  async function handleClearAllDataConfirm() {
    if (options.importing || clearingData) return;
    setClearConfirmOpen(false);
    setClearingData(true);
    try {
      await clearAllData();
      options.clearPersistedSearchState();
      options.setSelectedConvId(null);
      options.setMessages([]);
      options.pushToast("All imported data was removed.", "success");
      options.setSkipOnboarding(false);
      options.setOnboardingVisible(true);
      await options.loadData(options.activeSource);
    } catch (err) {
      logger.error("Clear data failed:", err);
      const message = err instanceof Error ? err.message : "Clear data failed";
      options.pushToast(message, "error");
    } finally {
      setClearingData(false);
    }
  }

  return {
    clearingData,
    clearConfirmOpen,
    setClearConfirmOpen,
    clearConfirmCancelBtnRef,
    clearConfirmDialogRef,
    clearDataTriggerRef,
    handleClearAllDataClick,
    handleClearAllDataConfirm,
  };
}
