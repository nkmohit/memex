import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getMessages } from "./db";
import "./App.css";
import { type ActiveView } from "./components/Sidebar";
import AppShell from "./components/AppShell";
import { usePrefersReducedMotion } from "./hooks/usePrefersReducedMotion";
import { useThemeMode } from "./hooks/useThemeMode";
import { useToast } from "./hooks/useToast";
import { useCopyClipboard } from "./hooks/useCopyClipboard";
import { useImportState } from "./hooks/useImportState";
import { useAppData } from "./hooks/useAppData";
import { useSearchSession } from "./hooks/useSearchSession";
import { useViewerSearch } from "./hooks/useViewerSearch";
import { useClearData } from "./hooks/useClearData";
import { logger } from "./lib/logger";
import { getAvailableSources, sourceLabel } from "./lib/sources";
import { useDataActions } from "./hooks/useDataActions";

type AppDataState =
  "bootstrapping" | "ready-empty" | "ready-has-data" | "importing" | "clearing" | "error";

export default function App() {
  const { theme, setThemeAndPersist } = useThemeMode();
  const prefersReducedMotion = usePrefersReducedMotion();
  const { toasts, pushToast, dismissToast } = useToast();
  const { copyToast, copyMessageToClipboard, copyConversationToClipboard } = useCopyClipboard();
  const [activeSource, setActiveSource] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>("overview");
  const {
    loading,
    stats,
    sourceStats,
    conversations,
    selectedConvId,
    setSelectedConvId,
    messages,
    setMessages,
    messagesLoading,
    setMessagesLoading,
    loadError,
    setLoadError,
    loadData,
  } = useAppData(pushToast);
  const {
    searchPageQuery,
    setSearchPageQuery,
    searchPageSnapshot,
    setSearchPageSnapshot,
    clearPersistedSearchState,
    searchFocusRequestId,
    setSearchFocusRequestId,
    openedConversationFromSearch,
    setOpenedConversationFromSearch,
    searchRestoreConversationId,
    setSearchRestoreConversationId,
    searchSelectedConvId,
    setSearchSelectedConvId,
    searchSelectedConversation,
    setSearchSelectedConversation,
    skipSearchOnceRef,
  } = useSearchSession(activeView);
  const messageRefs = useRef<Record<string, HTMLElement | null>>({});
  const {
    messageSearchQuery,
    setMessageSearchQuery,
    viewerSearchOpen,
    setViewerSearchOpen,
    viewerMenuOpen,
    setViewerMenuOpen,
    viewerSearchInputRef,
    viewerMenuRef,
    highlightedMessageId,
    setHighlightedMessageId,
    highlightText,
    matchCount,
    messageMatchCount,
    currentMatchIndex,
    goToPrevMatch,
    goToNextMatch,
  } = useViewerSearch(messages, prefersReducedMotion, messageRefs);
  const {
    importing,
    importingSource,
    importProgress,
    importError,
    setImportError,
    importResult,
    setImportResult,
    importRefreshKey,
    setImportMenuOpen,
    handleCancelImport,
    handleImportSource,
  } = useImportState({ pushToast, loadData, activeSource, sourceLabel, clearingData: false });
  // temporary clearingData placeholder before hook instantiation — will be overridden
  const [skipOnboarding, setSkipOnboarding] = useState(false);
  const [onboardingVisible, setOnboardingVisible] = useState(false);
  const convItemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const clearDataHook = useClearData({
    pushToast,
    loadData,
    clearPersistedSearchState,
    setSelectedConvId,
    setMessages,
    setSkipOnboarding,
    setOnboardingVisible,
    activeSource,
    importing,
    loading,
  });
  const {
    clearingData,
    clearConfirmOpen,
    setClearConfirmOpen,
    clearConfirmCancelBtnRef,
    clearConfirmDialogRef,
    clearDataTriggerRef,
    handleClearAllDataClick,
    handleClearAllDataConfirm,
  } = clearDataHook;
  const selectedConversation = useMemo(() => {
    if (activeView === "search" && searchSelectedConvId)
      return conversations.find((c) => c.id === searchSelectedConvId) ?? searchSelectedConversation;
    return conversations.find((c) => c.id === selectedConvId) ?? null;
  }, [activeView, conversations, searchSelectedConvId, searchSelectedConversation, selectedConvId]);
  useEffect(() => {
    void loadData(activeSource);
  }, [activeSource, loadData]);
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
    ]
  );
  useEffect(() => {
    if (activeView !== "conversations" || !selectedConvId) return;
    convItemRefs.current[selectedConvId]?.scrollIntoView({
      block: "nearest",
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  }, [activeView, selectedConvId, prefersReducedMotion]);
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
    setSearchFocusRequestId,
    viewerSearchInputRef,
    setViewerSearchOpen,
  ]);
  const { handleRebuildIndex, handleOverviewSelectConversation } = useDataActions({
    pushToast,
    loadData,
    setLoadError,
    activeSource,
    setSelectedConvId,
    setMessages,
    setMessagesLoading,
    setActiveView,
    setActiveSource,
  });
  const availableSources = useMemo(() => getAvailableSources(sourceStats), [sourceStats]);
  async function handleSearchResultSelect(
    convId: string,
    title: string,
    source: string,
    lastOccurrence: number
  ) {
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
  }
  const searchPanelClosed = activeView === "search" && !searchSelectedConvId;
  const shellLayoutClass =
    activeView === "search"
      ? searchPanelClosed
        ? "search-layout search-panel-closed"
        : "search-layout"
      : activeView === "overview"
        ? "overview-layout"
        : activeView === "settings"
          ? "settings-layout"
          : activeView === "import"
            ? "import-layout"
            : "conversations-layout";
  const isEmpty = !loading && stats?.conversationCount === 0;
  const showOnboarding = onboardingVisible && !skipOnboarding;
  const appDataState: AppDataState = loadError
    ? "error"
    : clearingData
      ? "clearing"
      : importing
        ? "importing"
        : loading
          ? "bootstrapping"
          : isEmpty
            ? "ready-empty"
            : "ready-has-data";
  useEffect(() => {
    if (!loading && isEmpty && !skipOnboarding) setOnboardingVisible(true);
  }, [isEmpty, loading, skipOnboarding]);
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
  return (
    <AppShell
      showOnboarding={showOnboarding}
      onboardingProps={{
        onImport: (s) => void handleImportSource(s),
        importing,
        importingSource,
        onCancelImport: handleCancelImport,
        importProgress,
        onSkip: () => {
          setSkipOnboarding(true);
          setOnboardingVisible(false);
          setActiveView("overview");
          setImportError(null);
          setImportResult(null);
        },
      }}
      toasts={toasts}
      dismissToast={dismissToast}
      shellLayoutClass={shellLayoutClass}
      appDataState={appDataState}
      activeView={activeView}
      setActiveView={setActiveView}
      setImportMenuOpen={setImportMenuOpen}
      theme={theme}
      setThemeAndPersist={setThemeAndPersist}
      clearingData={clearingData}
      importing={importing}
      loading={loading}
      onClearAllDataClick={handleClearAllDataClick}
      clearDataTriggerRef={clearDataTriggerRef}
      clearConfirmOpen={clearConfirmOpen}
      clearingDataConfirm={clearingData}
      onCancelClear={() => setClearConfirmOpen(false)}
      onConfirmClear={() => void handleClearAllDataConfirm()}
      clearConfirmCancelBtnRef={clearConfirmCancelBtnRef}
      clearConfirmDialogRef={clearConfirmDialogRef}
      overviewProps={{
        onOpenImport: () => setActiveView("import"),
        onOpenSearch: () => {
          setOpenedConversationFromSearch(false);
          setActiveView("search");
          setSearchFocusRequestId(Date.now());
        },
        onSelectConversation: handleOverviewSelectConversation,
        onRebuildIndex: handleRebuildIndex,
      }}
      importProps={{
        onImport: (s) => void handleImportSource(s),
        importing,
        importingSource,
        onCancelImport: handleCancelImport,
        importProgress,
        importError,
        importResult,
        onDismissImportError: () => setImportError(null),
        onDismissImportResult: () => setImportResult(null),
        refreshKey: importRefreshKey,
      }}
      searchProps={{
        query: searchPageQuery,
        onQueryChange: setSearchPageQuery,
        availableSources,
        sourceLabel,
        onSelectResult: (c, t, s, l) => void handleSearchResultSelect(c, t, s, l),
        selectedConversationId: searchSelectedConvId,
        focusRequestId: searchFocusRequestId,
        snapshot: searchPageSnapshot,
        onSnapshotChange: setSearchPageSnapshot,
        skipSearchOnceRef,
        restoreSelectedConversationId: searchRestoreConversationId,
        onRestoreSelectionDone: () => setSearchRestoreConversationId(null),
        viewer: {
          open: Boolean(searchSelectedConvId),
          onClose: () => {
            setSearchSelectedConvId(null);
            setSearchSelectedConversation(null);
            setSelectedConvId(null);
            setOpenedConversationFromSearch(false);
          },
          selectedConversation,
          messages,
          messagesLoading,
          viewerSearchOpen,
          onOpenViewerSearch: () => setViewerSearchOpen(true),
          onCloseViewerSearch: () => setViewerSearchOpen(false),
          messageSearchQuery,
          onMessageSearchQueryChange: setMessageSearchQuery,
          viewerSearchInputRef,
          matchCount,
          messageMatchCount,
          currentMatchIndex,
          onPrevMatch: goToPrevMatch,
          onNextMatch: goToNextMatch,
          copyToast,
          onCopyMessage: (m) =>
            copyMessageToClipboard(m, sourceLabel(selectedConversation?.source ?? "")),
          messageRefs,
          highlightedMessageId,
          highlightText,
        },
      }}
      conversationsProps={{
        conversations,
        loading,
        selectedConvId,
        activeSource,
        availableSources,
        sourceStats,
        convItemRefs,
        onSelectSource: setActiveSource,
        onSelectConversation: (id) => {
          setOpenedConversationFromSearch(false);
          void handleConversationClick(id);
        },
        sourceLabel,
        viewer: {
          stats,
          selectedConversation,
          messages,
          messagesLoading,
          openedConversationFromSearch,
          onBackToSearch: goBackToSearch,
          viewerMenuOpen,
          onToggleViewerMenu: () => setViewerMenuOpen((o) => !o),
          onCloseViewerMenu: () => setViewerMenuOpen(false),
          viewerMenuRef,
          viewerSearchOpen,
          onOpenViewerSearch: () => setViewerSearchOpen(true),
          onCloseViewerSearch: () => setViewerSearchOpen(false),
          messageSearchQuery,
          onMessageSearchQueryChange: setMessageSearchQuery,
          viewerSearchInputRef,
          matchCount,
          messageMatchCount,
          currentMatchIndex,
          onPrevMatch: goToPrevMatch,
          onNextMatch: goToNextMatch,
          copyToast,
          onCopyConversation: () =>
            copyConversationToClipboard(messages, sourceLabel(selectedConversation?.source ?? "")),
          onCopyMessage: (m) =>
            copyMessageToClipboard(m, sourceLabel(selectedConversation?.source ?? "")),
          messageRefs,
          highlightedMessageId,
          highlightText,
          sourceLabel,
        },
      }}
    />
  );
}
