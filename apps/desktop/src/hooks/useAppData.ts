import { useCallback, useState } from "react";
import {
  ConversationRow,
  DbStats,
  MessageRow,
  SourceStats,
  getCachedDashboardSnapshot,
  getConversations,
  getSourceStats,
  getStats,
} from "../db";
import { logger } from "../lib/logger";

export function useAppData(
  pushToast: (msg: string, variant?: "success" | "error" | "info") => void
) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DbStats | null>(null);
  const [sourceStats, setSourceStats] = useState<SourceStats[]>([]);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = useCallback(
    async (source?: string | null) => {
      setLoading(true);
      setLoadError(null);
      try {
        const cached = await getCachedDashboardSnapshot();
        if (cached && !source) {
          setStats(cached.stats);
          setSourceStats(cached.sourceStats);
          setConversations(cached.recentConversations);
        }
        const statsData = await getStats();
        const srcStats = await getSourceStats();
        const convData = await getConversations(200, source ?? undefined);
        setStats(statsData);
        setSourceStats(srcStats);
        setConversations(convData);
      } catch (err) {
        logger.error("Failed to load data:", err);
        const message = err instanceof Error ? err.message : "Failed to load data";
        setLoadError(message);
        pushToast(message, "error");
      } finally {
        setLoading(false);
      }
    },
    [pushToast]
  );

  return {
    loading,
    setLoading,
    stats,
    setStats,
    sourceStats,
    setSourceStats,
    conversations,
    setConversations,
    selectedConvId,
    setSelectedConvId,
    messages,
    setMessages,
    messagesLoading,
    setMessagesLoading,
    loadError,
    setLoadError,
    loadData,
  };
}
