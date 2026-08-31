import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { type ActiveView } from "./components/Sidebar";
import AppShell from "./components/AppShell";
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
import { AppProviders, createAppShellProps, useAppProviders } from "./App.providers";

export default function App() {
  const {
    theme,
    setThemeAndPersist,
    prefersReducedMotion,
    toasts,
    pushToast,
    dismissToast,
    copyToast,
    copyMessageToClipboard,
    copyConversationToClipboard,
  } = useAppProviders();
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
  const shellProps = createAppShellProps({
    showOnboarding,
    theme,
    setThemeAndPersist,
    toasts,
    dismissToast,
    shellLayoutClass,
    appDataState,
    activeView,
    setActiveView,
    setImportMenuOpen,
    clearingData,
    importing,
    loading,
    onClearAllDataClick: handleClearAllDataClick,
    clearDataTriggerRef,
    clearConfirmOpen,
    onCancelClear: () => setClearConfirmOpen(false),
    onConfirmClear: () => void handleClearAllDataConfirm(),
    clearConfirmCancelBtnRef,
    clearConfirmDialogRef,
    importingSource,
    importProgress,
    importError,
    importResult,
    importRefreshKey,
    handleImportSource,
    handleCancelImport,
    setImportError,
    setImportResult,
    handleOverviewSelectConversation,
    handleRebuildIndex,
    setSkipOnboarding,
    setOnboardingVisible,
    searchPageQuery,
    setSearchPageQuery,
    availableSources,
    sourceLabel,
    handleSearchResultSelect,
    searchSelectedConvId,
    searchFocusRequestId,
    searchPageSnapshot,
    setSearchPageSnapshot,
    skipSearchOnceRef,
    searchRestoreConversationId,
    setSearchRestoreConversationId,
    setSearchSelectedConvId,
    setSearchSelectedConversation,
    setOpenedConversationFromSearch,
    setSearchFocusRequestId,
    conversations,
    selectedConvId,
    activeSource,
    sourceStats,
    convItemRefs,
    setActiveSource,
    handleConversationClick,
    stats,
    selectedConversation,
    messages,
    messagesLoading,
    openedConversationFromSearch,
    goBackToSearch,
    viewerMenuOpen,
    setViewerMenuOpen,
    viewerMenuRef,
    viewerSearchOpen,
    setViewerSearchOpen,
    messageSearchQuery,
    setMessageSearchQuery,
    viewerSearchInputRef,
    matchCount,
    messageMatchCount,
    currentMatchIndex,
    goToPrevMatch,
    goToNextMatch,
    copyToast,
    copyMessageToClipboard,
    copyConversationToClipboard,
    messageRefs,
    highlightedMessageId,
    highlightText,
    setSelectedConvId,
  });
  return (
    <AppProviders>
      <AppShell {...shellProps} />
    </AppProviders>
  );
}
