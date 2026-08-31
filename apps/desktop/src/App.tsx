import { useEffect, useMemo, useRef, useState } from "react";
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
import { getAvailableSources, sourceLabel } from "./lib/sources";
import { useDataActions } from "./hooks/useDataActions";
import { useAppShellState } from "./hooks/useAppShellState";
import { useAppNavigation } from "./hooks/useAppNavigation";
import { useAppDialogs } from "./hooks/useAppDialogs";
import ErrorBoundary from "./components/ErrorBoundary";

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
  useEffect(() => {
    void loadData(activeSource);
  }, [activeSource, loadData]);
  const {
    selectedConversation,
    handleConversationClick,
    goBackToSearch,
    handleSearchResultSelect,
  } = useAppNavigation({
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
    messages,
    setMessages,
    setMessagesLoading,
    setHighlightedMessageId,
    messageRefs,
    convItemRefs,
    prefersReducedMotion,
    viewerSearchInputRef,
    viewerSearchOpen,
    setViewerSearchOpen,
    viewerMenuRef,
    setViewerMenuOpen,
    searchPageQuery,
    setMessageSearchQuery,
    setSearchFocusRequestId,
  });
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
  const { shellLayoutClass, appDataState, isEmpty } = useAppShellState({
    activeView,
    searchSelectedConvId,
    loading,
    stats,
    loadError,
    clearingData,
    importing,
  });
  const showOnboarding = onboardingVisible && !skipOnboarding;
  useAppDialogs({
    loading,
    isEmpty,
    skipOnboarding,
    setOnboardingVisible,
    clearConfirmOpen,
    clearConfirmCancelBtnRef,
    clearConfirmDialogRef,
    clearDataTriggerRef,
    setClearConfirmOpen,
  });
  return (
    <ErrorBoundary>
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
              copyConversationToClipboard(
                messages,
                sourceLabel(selectedConversation?.source ?? "")
              ),
            onCopyMessage: (m) =>
              copyMessageToClipboard(m, sourceLabel(selectedConversation?.source ?? "")),
            messageRefs,
            highlightedMessageId,
            highlightText,
            sourceLabel,
          },
        }}
      />
    </ErrorBoundary>
  );
}
