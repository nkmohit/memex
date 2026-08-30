import { useRef, useState, useCallback } from "react";
import type { ImportSource } from "../importer";
import { importConversations } from "../importer";
import { markDataChanged } from "../db";
import { logger } from "../lib/logger";

export type ImportWriteProgress = {
  conversationsDone: number;
  conversationsTotal: number;
  messagesDone: number;
  messagesTotal?: number;
};

interface UseImportStateOptions {
  pushToast: (msg: string, variant?: "success" | "error" | "info") => void;
  loadData: (source?: string | null) => Promise<void>;
  activeSource: string | null;
  sourceLabel: (source: string) => string;
  clearingData: boolean;
}

export function useImportState(options?: UseImportStateOptions) {
  const [importing, setImporting] = useState(false);
  const [importingSource, setImportingSource] = useState<ImportSource | null>(null);
  const importAbortRef = useRef<AbortController | null>(null);
  const [importProgress, setImportProgress] = useState<ImportWriteProgress | null>(null);
  const importProgressRef = useRef<ImportWriteProgress>({
    conversationsDone: 0,
    conversationsTotal: 0,
    messagesDone: 0,
    messagesTotal: 0,
  });
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [importRefreshKey, setImportRefreshKey] = useState(0);
  const [, setImportMenuOpen] = useState(false);

  function handleCancelImport() {
    importAbortRef.current?.abort();
  }

  const handleImportSource = useCallback(
    async (source: ImportSource) => {
      if (!options) return;
      const { pushToast, loadData, activeSource, sourceLabel, clearingData } = options;
      if (clearingData) return;
      setImportMenuOpen(false);
      setImporting(true);
      setImportingSource(source);
      setImportProgress(null);
      importProgressRef.current = {
        conversationsDone: 0,
        conversationsTotal: 0,
        messagesDone: 0,
        messagesTotal: 0,
      };
      setImportError(null);
      setImportResult(null);
      const controller = new AbortController();
      importAbortRef.current = controller;
      try {
        const result = await importConversations(source, {
          signal: controller.signal,
          onProgress: (progress) => {
            if (progress.phase === "write") {
              const nextProgress = {
                conversationsDone: progress.conversationsDone,
                conversationsTotal: progress.conversationsTotal,
                messagesDone: progress.messagesDone,
                messagesTotal: progress.messagesTotal,
              };
              importProgressRef.current = nextProgress;
              setImportProgress(nextProgress);
            }
          },
        });
        if (result) {
          await markDataChanged();
          const message = `Import completed: ${result.conversationCount} conversations and ${result.messageCount} messages from ${sourceLabel(source)}.`;
          setImportResult(message);
          pushToast(message, "success");
          setImportRefreshKey((k) => k + 1);
          await loadData(activeSource);
        }
      } catch (err) {
        logger.error("Import failed:", err);
        const message = err instanceof Error ? err.message : "Import failed";
        if (controller.signal.aborted) {
          const conversationsDone = importProgressRef.current.conversationsDone;
          const messagesDone = importProgressRef.current.messagesDone;
          const cancelledMessage = `Import cancelled after ${conversationsDone} conversations and ${messagesDone.toLocaleString()} messages.`;
          await markDataChanged();
          setImportResult(cancelledMessage);
          pushToast(cancelledMessage, "info");
          setImportRefreshKey((k) => k + 1);
          await loadData(activeSource);
        } else {
          setImportError(message);
          pushToast(message, "error");
        }
      } finally {
        setImporting(false);
        setImportingSource(null);
        setImportProgress(null);
        importProgressRef.current = {
          conversationsDone: 0,
          conversationsTotal: 0,
          messagesDone: 0,
          messagesTotal: 0,
        };
        importAbortRef.current = null;
      }
    },
    [options]
  );

  return {
    importing,
    setImporting,
    importingSource,
    setImportingSource,
    importAbortRef,
    importProgress,
    setImportProgress,
    importProgressRef,
    importError,
    setImportError,
    importResult,
    setImportResult,
    importRefreshKey,
    setImportRefreshKey,
    setImportMenuOpen,
    handleCancelImport,
    handleImportSource,
  };
}
