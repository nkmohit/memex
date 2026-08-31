/* eslint-disable react-refresh/only-export-components */
import type { ActiveView } from "./components/Sidebar";
import ErrorBoundary from "./components/ErrorBoundary";
import { usePrefersReducedMotion } from "./hooks/usePrefersReducedMotion";
import { useThemeMode } from "./hooks/useThemeMode";
import { useToast } from "./hooks/useToast";
import { useCopyClipboard } from "./hooks/useCopyClipboard";
import type { ConversationRow, DbStats, MessageRow, SourceStats } from "./db";
import type { SearchPageSnapshot } from "./SearchPage";
import type { ThemeMode } from "./hooks/useThemeMode";
import type { Toast } from "./hooks/useToast";
import type { ImportSource } from "./importer";
import type { ImportWriteProgress } from "./hooks/useImportState";

// Bundled provider hooks — keeps App.tsx orchestration slim (<300 LOC)
export function useAppProviders() {
  const { theme, setThemeAndPersist } = useThemeMode();
  const prefersReducedMotion = usePrefersReducedMotion();
  const { toasts, pushToast, dismissToast } = useToast();
  const { copyToast, copyMessageToClipboard, copyConversationToClipboard } = useCopyClipboard();
  return {
    theme,
    setThemeAndPersist,
    prefersReducedMotion,
    toasts,
    pushToast,
    dismissToast,
    copyToast,
    copyMessageToClipboard,
    copyConversationToClipboard,
  };
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}

// Helper to build AppShell props — moves 150 LOC of JSX prop literals out of App.tsx
export interface AppShellPropsInput {
  showOnboarding: boolean;
  theme: ThemeMode;
  setThemeAndPersist: (m: ThemeMode) => void;
  toasts: Toast[];
  dismissToast: (id: number) => void;
  shellLayoutClass: string;
  appDataState: string;
  activeView: ActiveView;
  setActiveView: (v: ActiveView) => void;
  setImportMenuOpen: (v: boolean) => void;
  clearingData: boolean;
  importing: boolean;
  loading: boolean;
  onClearAllDataClick: () => void;
  clearDataTriggerRef: React.RefObject<HTMLButtonElement | null>;
  clearConfirmOpen: boolean;
  onCancelClear: () => void;
  onConfirmClear: () => void;
  clearConfirmCancelBtnRef: React.RefObject<HTMLButtonElement | null>;
  clearConfirmDialogRef: React.RefObject<HTMLDivElement | null>;
  // import
  importingSource: ImportSource | null;
  importProgress: ImportWriteProgress | null;
  importError: string | null;
  importResult: string | null;
  importRefreshKey: number;
  handleImportSource: (s: ImportSource) => void;
  handleCancelImport: () => void;
  setImportError: (v: string | null) => void;
  setImportResult: (v: string | null) => void;
  // overview
  handleOverviewSelectConversation: (id: string) => void;
  handleRebuildIndex: () => void;
  setSkipOnboarding: (v: boolean) => void;
  setOnboardingVisible: (v: boolean) => void;
  // search
  searchPageQuery: string;
  setSearchPageQuery: (q: string) => void;
  availableSources: string[];
  sourceLabel: (s: string) => string;
  handleSearchResultSelect: (
    convId: string,
    title: string,
    source: string,
    lastOccurrence: number
  ) => void;
  searchSelectedConvId: string | null;
  searchFocusRequestId: number | null;
  searchPageSnapshot: SearchPageSnapshot;
  setSearchPageSnapshot: (s: SearchPageSnapshot) => void;
  skipSearchOnceRef: React.MutableRefObject<boolean>;
  searchRestoreConversationId: string | null;
  setSearchRestoreConversationId: (v: string | null) => void;
  setSearchSelectedConvId: (v: string | null) => void;
  setSearchSelectedConversation: (v: ConversationRow | null) => void;
  setOpenedConversationFromSearch: (v: boolean) => void;
  setSearchFocusRequestId: (v: number) => void;
  // conversations / viewer
  conversations: ConversationRow[];
  selectedConvId: string | null;
  activeSource: string | null;
  sourceStats: SourceStats[];
  convItemRefs: React.MutableRefObject<Record<string, HTMLButtonElement | null>>;
  setActiveSource: (s: string | null) => void;
  handleConversationClick: (id: string) => void;
  stats: DbStats | null;
  selectedConversation: ConversationRow | null;
  messages: MessageRow[];
  messagesLoading: boolean;
  openedConversationFromSearch: boolean;
  goBackToSearch: () => void;
  viewerMenuOpen: boolean;
  setViewerMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  viewerMenuRef: React.RefObject<HTMLDivElement | null>;
  viewerSearchOpen: boolean;
  setViewerSearchOpen: (v: boolean) => void;
  messageSearchQuery: string;
  setMessageSearchQuery: (q: string) => void;
  viewerSearchInputRef: React.RefObject<HTMLInputElement | null>;
  matchCount: number;
  messageMatchCount: number;
  currentMatchIndex: number;
  goToPrevMatch: () => void;
  goToNextMatch: () => void;
  copyToast: string | null;
  copyMessageToClipboard: (m: MessageRow, label: string) => void;
  copyConversationToClipboard: (msgs: MessageRow[], label: string) => void;
  messageRefs: React.MutableRefObject<Record<string, HTMLElement | null>>;
  highlightedMessageId: string | null;
  highlightText: (text: string, query: string) => React.ReactNode;
  setSelectedConvId: (v: string | null) => void;
}

export function createAppShellProps(input: AppShellPropsInput) {
  const {
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
    onClearAllDataClick,
    clearDataTriggerRef,
    clearConfirmOpen,
    onCancelClear,
    onConfirmClear,
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
  } = input;

  return {
    showOnboarding,
    onboardingProps: {
      onImport: (s: ImportSource) => void handleImportSource(s),
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
    },
    toasts,
    dismissToast,
    shellLayoutClass,
    appDataState: appDataState as
      "bootstrapping" | "ready-empty" | "ready-has-data" | "importing" | "clearing" | "error",
    activeView,
    setActiveView,
    setImportMenuOpen,
    theme,
    setThemeAndPersist,
    clearingData,
    importing,
    loading,
    onClearAllDataClick,
    clearDataTriggerRef,
    clearConfirmOpen,
    clearingDataConfirm: clearingData,
    onCancelClear,
    onConfirmClear,
    clearConfirmCancelBtnRef,
    clearConfirmDialogRef,
    overviewProps: {
      onOpenImport: () => setActiveView("import"),
      onOpenSearch: () => {
        setOpenedConversationFromSearch(false);
        setActiveView("search");
        setSearchFocusRequestId(Date.now());
      },
      onSelectConversation: handleOverviewSelectConversation,
      onRebuildIndex: handleRebuildIndex,
    },
    importProps: {
      onImport: (s: ImportSource) => void handleImportSource(s),
      importing,
      importingSource,
      onCancelImport: handleCancelImport,
      importProgress,
      importError,
      importResult,
      onDismissImportError: () => setImportError(null),
      onDismissImportResult: () => setImportResult(null),
      refreshKey: importRefreshKey,
    },
    searchProps: {
      query: searchPageQuery,
      onQueryChange: setSearchPageQuery,
      availableSources,
      sourceLabel,
      onSelectResult: (c: string, t: string, s: string, l: number) =>
        void handleSearchResultSelect(c, t, s, l),
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
        onCopyMessage: (m: MessageRow) =>
          copyMessageToClipboard(m, sourceLabel(selectedConversation?.source ?? "")),
        messageRefs,
        highlightedMessageId,
        highlightText,
      },
    },
    conversationsProps: {
      conversations,
      loading,
      selectedConvId,
      activeSource,
      availableSources,
      sourceStats,
      convItemRefs,
      onSelectSource: setActiveSource,
      onSelectConversation: (id: string) => {
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
        onCopyMessage: (m: MessageRow) =>
          copyMessageToClipboard(m, sourceLabel(selectedConversation?.source ?? "")),
        messageRefs,
        highlightedMessageId,
        highlightText,
        sourceLabel,
      },
    },
  };
}
