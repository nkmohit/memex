import { useCallback } from "react";
import { getMessages, rebuildSearchIndex } from "../db";
import type { MessageRow } from "../db";
import type { ActiveView } from "../components/Sidebar";
import { logger } from "../lib/logger";

interface Options {
  pushToast: (msg: string, variant?: "success" | "error" | "info") => void;
  loadData: (source?: string | null) => Promise<void>;
  setLoadError: (msg: string | null) => void;
  activeSource: string | null;
  setSelectedConvId: (id: string | null) => void;
  setMessages: (msgs: MessageRow[]) => void;
  setMessagesLoading: (v: boolean) => void;
  setActiveView: (v: ActiveView) => void;
  setActiveSource: (v: string | null) => void;
}

export function useDataActions(opts: Options) {
  const handleRebuildIndex = useCallback(async () => {
    try {
      opts.setLoadError(null);
      await rebuildSearchIndex();
      await opts.loadData(opts.activeSource);
      opts.pushToast("Search index rebuilt.", "success");
    } catch (err) {
      logger.error("Rebuild index failed:", err);
      const m = err instanceof Error ? err.message : "Rebuild index failed";
      opts.setLoadError(m);
      opts.pushToast(m, "error");
    }
  }, [opts]);

  const handleOverviewSelectConversation = useCallback(
    (convId: string) => {
      opts.setActiveView("conversations");
      opts.setActiveSource(null);
      void opts.loadData(null).then(() => {
        opts.setSelectedConvId(convId);
        opts.setMessagesLoading(true);
        getMessages(convId)
          .then((data) => {
            opts.setMessages(data);
            opts.setMessagesLoading(false);
          })
          .catch(() => opts.setMessagesLoading(false));
      });
    },
    [opts]
  );

  return { handleRebuildIndex, handleOverviewSelectConversation };
}
