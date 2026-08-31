import { useCallback, useEffect, useMemo } from "react";
import type { MutableRefObject } from "react";
import { getMessages } from "../db";
import { logger } from "../lib/logger";
import type { ConversationRow, MessageRow } from "../db";
import type { ActiveView } from "../components/Sidebar";

interface UseAppNavigationOptions {
  activeView: ActiveView;
  setActiveView: (v: ActiveView) => void;
  selectedConvId: string | null;
  setSelectedConvId: (id: string | null) => void;
  conversations: ConversationRow[];
  searchSelectedConvId: string | null;
  searchSelectedConversation: ConversationRow | null;
  setSearchSelectedConvId: (id: string | null) => void;
  setSearchSelectedConversation: (c: ConversationRow | null) => void;
  setOpenedConversationFromSearch: (v: boolean) => void;
  openedConversationFromSearch: boolean;
  setSearchRestoreConversationId: (id: string | null) => void;
  skipSearchOnceRef: MutableRefObject<boolean>;
  messages: MessageRow[];
  setMessages: (m: MessageRow[]) => void;
  setMessagesLoading: (v: boolean) => void;
  setHighlightedMessageId: (id: string | null) => void;
  messageRefs: MutableRefObject<Record<string, HTMLElement | null>>;
  convItemRefs: MutableRefObject<Record<string, HTMLButtonElement | null>>;
  prefersReducedMotion: boolean;
  viewerSearchInputRef: MutableRefObject<HTMLInputElement | null>;
  viewerSearchOpen: boolean;
  setViewerSearchOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
  viewerMenuRef: MutableRefObject<HTMLDivElement | null>;
  setViewerMenuOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
  searchPageQuery: string;
  setMessageSearchQuery: (q: string) => void;
  setSearchFocusRequestId: (id: number) => void;
}

export function useAppNavigation(opts: UseAppNavigationOptions) {
  const {
    activeView,
    setActiveView,
    selectedConvId,
    setSelectedConvId,
    conversations,
    searchSelectedConvId,
    searchSelectedConversation,
    setSearchSelectedConvId,
    setSearchSelectedConversation,
    setOpenedConversationFromSearch,
    openedConversationFromSearch,
    setSearchRestoreConversationId,
    skipSearchOnceRef,
    setMessages,
    setMessagesLoading,
    setHighlightedMessageId,
    messageRefs,
    convItemRefs,
    prefersReducedMotion,
    viewerSearchInputRef,
    viewerSearchOpen,
    setViewerSearchOpen,
    searchPageQuery,
    setMessageSearchQuery,
    setSearchFocusRequestId,
  } = opts;

  const selectedConversation = useMemo(() => {
    if (activeView === "search" && searchSelectedConvId)
      return conversations.find((c) => c.id === searchSelectedConvId) ?? searchSelectedConversation;
    return conversations.find((c) => c.id === selectedConvId) ?? null;
  }, [activeView, conversations, searchSelectedConvId, searchSelectedConversation, selectedConvId]);

  const handleConversationClick = useCallback(
    async (convId: string, scrollToMessageId?: string | null) => {
      setSelectedConvId(convId);
      setMessagesLoading(true);
      setHighlightedMessageId(null);
      try {
        const data = await getMessages(convId);
        setMessages(data);
        if (scrollToMessageId) {
          setTimeout(() => {
            const el = messageRefs.current[scrollToMessageId];
            if (el) {
              const mark = el.querySelector("mark");
              (mark || el).scrollIntoView({
                behavior: prefersReducedMotion ? "auto" : "smooth",
                block: "center",
              });
              setHighlightedMessageId(scrollToMessageId);
              setTimeout(() => setHighlightedMessageId(null), 2000);
            }
          }, 100);
        }
      } catch (err) {
        logger.error("Failed to load messages:", err);
        setMessages([]);
      } finally {
        setMessagesLoading(false);
      }
    },
    [
      prefersReducedMotion,
      setHighlightedMessageId,
      setMessages,
      setMessagesLoading,
      setSelectedConvId,
      messageRefs,
    ]
  );

  useEffect(() => {
    if (activeView !== "conversations" || !selectedConvId) return;
    convItemRefs.current[selectedConvId]?.scrollIntoView({
      block: "nearest",
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  }, [activeView, selectedConvId, prefersReducedMotion, convItemRefs]);

  const goBackToSearch = useCallback(() => {
    if (selectedConvId) setSearchRestoreConversationId(selectedConvId);
    setOpenedConversationFromSearch(false);
    skipSearchOnceRef.current = true;
    setActiveView("search");
  }, [
    selectedConvId,
    setOpenedConversationFromSearch,
    setSearchRestoreConversationId,
    skipSearchOnceRef,
    setActiveView,
  ]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (
        event.key === "Backspace" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !(event.target instanceof HTMLInputElement) &&
        !(event.target instanceof HTMLTextAreaElement)
      ) {
        if (activeView === "conversations" && selectedConvId && openedConversationFromSearch) {
          event.preventDefault();
          goBackToSearch();
        }
      }
      if (!(event.metaKey || event.ctrlKey)) return;
      const key = event.key.toLowerCase();
      if (key === "k") {
        event.preventDefault();
        setOpenedConversationFromSearch(false);
        setActiveView("search");
        setSearchFocusRequestId(Date.now());
      }
      if (key === "f") {
        event.preventDefault();
        if (activeView === "conversations" && selectedConvId) {
          const input = viewerSearchInputRef.current;
          const focused = input && document.activeElement === input;
          if (!viewerSearchOpen) setViewerSearchOpen(true);
          else if (focused) setViewerSearchOpen(false);
          else {
            input?.focus();
            input?.select();
          }
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    activeView,
    selectedConvId,
    openedConversationFromSearch,
    goBackToSearch,
    viewerSearchOpen,
    setOpenedConversationFromSearch,
    setActiveView,
    setSearchFocusRequestId,
    viewerSearchInputRef,
    setViewerSearchOpen,
  ]);

  const handleSearchResultSelect = useCallback(
    async (convId: string, title: string, source: string, lastOccurrence: number) => {
      setSearchSelectedConvId(convId);
      setSelectedConvId(convId);
      setSearchSelectedConversation({
        id: convId,
        source,
        title,
        created_at: 0,
        last_message_at: lastOccurrence,
        message_count: 0,
      });
      setOpenedConversationFromSearch(true);
      setViewerSearchOpen(true);
      setMessageSearchQuery(searchPageQuery);
      await handleConversationClick(convId, null);
      window.setTimeout(() => {
        viewerSearchInputRef.current?.focus();
        viewerSearchInputRef.current?.select();
      }, 0);
    },
    [
      setSearchSelectedConvId,
      setSelectedConvId,
      setSearchSelectedConversation,
      setOpenedConversationFromSearch,
      setViewerSearchOpen,
      setMessageSearchQuery,
      searchPageQuery,
      handleConversationClick,
      viewerSearchInputRef,
    ]
  );

  return {
    selectedConversation,
    handleConversationClick,
    goBackToSearch,
    handleSearchResultSelect,
  };
}
