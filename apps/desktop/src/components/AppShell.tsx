import { Bell } from "lucide-react";
import { ConversationRow, DbStats, MessageRow, SourceStats } from "../db";
import { ImportSource } from "../importer";
import OverviewPage from "../OverviewPage";
import ImportPage from "../ImportPage";
import OnboardingPage from "../OnboardingPage";
import Sidebar, { type ActiveView } from "./Sidebar";
import ClearDataConfirmDialog from "../panels/ClearDataConfirmDialog";
import ConversationListPanel from "../panels/ConversationListPanel";
import ConversationViewerPanel from "../panels/ConversationViewerPanel";
import SearchPanel from "../panels/SearchPanel";
import SettingsPanel from "../panels/SettingsPanel";
import type { SearchPageSnapshot } from "../SearchPage";
import type { ThemeMode } from "../hooks/useThemeMode";
import type { ImportWriteProgress } from "../hooks/useImportState";
import type { Toast } from "../hooks/useToast";

type AppDataState =
  "bootstrapping" | "ready-empty" | "ready-has-data" | "importing" | "clearing" | "error";

interface AppShellProps {
  showOnboarding: boolean;
  onboardingProps: {
    onImport: (source: ImportSource) => void;
    importing: boolean;
    importingSource: ImportSource | null;
    onCancelImport: () => void;
    importProgress: ImportWriteProgress | null;
    onSkip: () => void;
  };
  toasts: Toast[];
  dismissToast: (id: number) => void;
  shellLayoutClass: string;
  appDataState: AppDataState;
  activeView: ActiveView;
  setActiveView: (v: ActiveView) => void;
  setImportMenuOpen: (v: boolean) => void;
  theme: ThemeMode;
  setThemeAndPersist: (m: ThemeMode) => void;
  clearingData: boolean;
  importing: boolean;
  loading: boolean;
  onClearAllDataClick: () => void;
  clearDataTriggerRef: React.RefObject<HTMLButtonElement | null>;
  clearConfirmOpen: boolean;
  clearingDataConfirm: boolean;
  onCancelClear: () => void;
  onConfirmClear: () => void;
  clearConfirmCancelBtnRef: React.RefObject<HTMLButtonElement | null>;
  clearConfirmDialogRef: React.RefObject<HTMLDivElement | null>;
  // overview
  overviewProps: {
    onOpenImport: () => void;
    onOpenSearch: () => void;
    onSelectConversation: (id: string) => void;
    onRebuildIndex: () => void;
  };
  // import
  importProps: {
    onImport: (s: ImportSource) => void;
    importing: boolean;
    importingSource: ImportSource | null;
    onCancelImport: () => void;
    importProgress: ImportWriteProgress | null;
    importError: string | null;
    importResult: string | null;
    onDismissImportError: () => void;
    onDismissImportResult: () => void;
    refreshKey: number;
  };
  // search
  searchProps: {
    query: string;
    onQueryChange: (q: string) => void;
    availableSources: string[];
    sourceLabel: (s: string) => string;
    onSelectResult: (convId: string, title: string, source: string, lastOccurrence: number) => void;
    selectedConversationId: string | null;
    focusRequestId: number | null;
    snapshot: SearchPageSnapshot;
    onSnapshotChange: (s: SearchPageSnapshot) => void;
    skipSearchOnceRef: React.MutableRefObject<boolean>;
    restoreSelectedConversationId: string | null;
    onRestoreSelectionDone: () => void;
    viewer: {
      open: boolean;
      onClose: () => void;
      selectedConversation: ConversationRow | null;
      messages: MessageRow[];
      messagesLoading: boolean;
      viewerSearchOpen: boolean;
      onOpenViewerSearch: () => void;
      onCloseViewerSearch: () => void;
      messageSearchQuery: string;
      onMessageSearchQueryChange: (q: string) => void;
      viewerSearchInputRef: React.RefObject<HTMLInputElement | null>;
      matchCount: number;
      messageMatchCount: number;
      currentMatchIndex: number;
      onPrevMatch: () => void;
      onNextMatch: () => void;
      copyToast: string | null;
      onCopyMessage: (m: MessageRow) => void;
      messageRefs: React.MutableRefObject<Record<string, HTMLElement | null>>;
      highlightedMessageId: string | null;
      highlightText: (text: string, query: string) => React.ReactNode;
    };
  };
  // conversations
  conversationsProps: {
    conversations: ConversationRow[];
    loading: boolean;
    selectedConvId: string | null;
    activeSource: string | null;
    availableSources: string[];
    sourceStats: SourceStats[];
    convItemRefs: React.MutableRefObject<Record<string, HTMLButtonElement | null>>;
    onSelectSource: (s: string | null) => void;
    onSelectConversation: (id: string) => void;
    sourceLabel: (s: string) => string;
    viewer: {
      stats: DbStats | null;
      selectedConversation: ConversationRow | null;
      messages: MessageRow[];
      messagesLoading: boolean;
      openedConversationFromSearch: boolean;
      onBackToSearch: () => void;
      viewerMenuOpen: boolean;
      onToggleViewerMenu: () => void;
      onCloseViewerMenu: () => void;
      viewerMenuRef: React.RefObject<HTMLDivElement | null>;
      viewerSearchOpen: boolean;
      onOpenViewerSearch: () => void;
      onCloseViewerSearch: () => void;
      messageSearchQuery: string;
      onMessageSearchQueryChange: (q: string) => void;
      viewerSearchInputRef: React.RefObject<HTMLInputElement | null>;
      matchCount: number;
      messageMatchCount: number;
      currentMatchIndex: number;
      onPrevMatch: () => void;
      onNextMatch: () => void;
      copyToast: string | null;
      onCopyConversation: () => void;
      onCopyMessage: (m: MessageRow) => void;
      messageRefs: React.MutableRefObject<Record<string, HTMLElement | null>>;
      highlightedMessageId: string | null;
      highlightText: (text: string, query: string) => React.ReactNode;
      sourceLabel: (s: string) => string;
    };
  };
}

export default function AppShell(props: AppShellProps) {
  const {
    showOnboarding,
    onboardingProps,
    toasts,
    dismissToast,
    shellLayoutClass,
    appDataState,
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
    onCancelClear,
    onConfirmClear,
    clearConfirmCancelBtnRef,
    clearConfirmDialogRef,
    overviewProps,
    importProps,
    searchProps,
    conversationsProps,
  } = props;

  if (showOnboarding) {
    return (
      <>
        <OnboardingPage
          onImport={onboardingProps.onImport}
          importing={onboardingProps.importing}
          importingSource={onboardingProps.importingSource}
          onCancelImport={onboardingProps.onCancelImport}
          importProgress={onboardingProps.importProgress}
          onSkip={onboardingProps.onSkip}
        />
        <div className="toast-stack" aria-live="polite">
          {toasts.map((toast) => (
            <div key={toast.id} className={`toast ${toast.variant}`}>
              <Bell size={14} className="toast-icon" />
              <span>{toast.message}</span>
              <button
                type="button"
                className="toast-dismiss"
                onClick={() => dismissToast(toast.id)}
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </>
    );
  }

  return (
    <div className={`app-shell ${shellLayoutClass}`} data-app-state={appDataState}>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <Sidebar
        activeView={activeView}
        onSelectView={setActiveView}
        onOpenImport={() => {
          setActiveView("import");
          setImportMenuOpen(false);
        }}
      />
      {activeView === "overview" && <OverviewPage {...overviewProps} />}
      {activeView === "import" && (
        <ImportPage
          onImport={importProps.onImport}
          importing={importProps.importing}
          importingSource={importProps.importingSource}
          onCancelImport={importProps.onCancelImport}
          importProgress={importProps.importProgress}
          importError={importProps.importError}
          importResult={importProps.importResult}
          onDismissImportError={importProps.onDismissImportError}
          onDismissImportResult={importProps.onDismissImportResult}
          refreshKey={importProps.refreshKey}
        />
      )}
      {activeView === "settings" && (
        <SettingsPanel
          theme={theme}
          onSetTheme={setThemeAndPersist}
          clearingData={clearingData}
          importing={importing}
          loading={loading}
          onClearAllDataClick={onClearAllDataClick}
          clearDataTriggerRef={clearDataTriggerRef}
        />
      )}
      {activeView === "search" && (
        <SearchPanel
          query={searchProps.query}
          onQueryChange={searchProps.onQueryChange}
          availableSources={searchProps.availableSources}
          sourceLabel={searchProps.sourceLabel}
          onSelectResult={searchProps.onSelectResult}
          selectedConversationId={searchProps.selectedConversationId}
          focusRequestId={searchProps.focusRequestId}
          snapshot={searchProps.snapshot}
          onSnapshotChange={searchProps.onSnapshotChange}
          skipSearchOnceRef={searchProps.skipSearchOnceRef}
          restoreSelectedConversationId={searchProps.restoreSelectedConversationId}
          onRestoreSelectionDone={searchProps.onRestoreSelectionDone}
          viewer={searchProps.viewer}
        />
      )}
      {activeView === "conversations" && (
        <>
          <ConversationListPanel
            conversations={conversationsProps.conversations}
            loading={conversationsProps.loading}
            selectedConvId={conversationsProps.selectedConvId}
            activeSource={conversationsProps.activeSource}
            availableSources={conversationsProps.availableSources}
            sourceStats={conversationsProps.sourceStats}
            convItemRefs={conversationsProps.convItemRefs}
            onSelectSource={conversationsProps.onSelectSource}
            onSelectConversation={conversationsProps.onSelectConversation}
            sourceLabel={conversationsProps.sourceLabel}
          />
          <ConversationViewerPanel
            stats={conversationsProps.viewer.stats}
            selectedConversation={conversationsProps.viewer.selectedConversation}
            messages={conversationsProps.viewer.messages}
            messagesLoading={conversationsProps.viewer.messagesLoading}
            openedConversationFromSearch={conversationsProps.viewer.openedConversationFromSearch}
            onBackToSearch={conversationsProps.viewer.onBackToSearch}
            viewerMenuOpen={conversationsProps.viewer.viewerMenuOpen}
            onToggleViewerMenu={conversationsProps.viewer.onToggleViewerMenu}
            onCloseViewerMenu={conversationsProps.viewer.onCloseViewerMenu}
            viewerMenuRef={conversationsProps.viewer.viewerMenuRef}
            viewerSearchOpen={conversationsProps.viewer.viewerSearchOpen}
            onOpenViewerSearch={conversationsProps.viewer.onOpenViewerSearch}
            onCloseViewerSearch={conversationsProps.viewer.onCloseViewerSearch}
            messageSearchQuery={conversationsProps.viewer.messageSearchQuery}
            onMessageSearchQueryChange={conversationsProps.viewer.onMessageSearchQueryChange}
            viewerSearchInputRef={conversationsProps.viewer.viewerSearchInputRef}
            matchCount={conversationsProps.viewer.matchCount}
            messageMatchCount={conversationsProps.viewer.messageMatchCount}
            currentMatchIndex={conversationsProps.viewer.currentMatchIndex}
            onPrevMatch={conversationsProps.viewer.onPrevMatch}
            onNextMatch={conversationsProps.viewer.onNextMatch}
            copyToast={conversationsProps.viewer.copyToast}
            onCopyConversation={conversationsProps.viewer.onCopyConversation}
            onCopyMessage={conversationsProps.viewer.onCopyMessage}
            messageRefs={conversationsProps.viewer.messageRefs}
            highlightedMessageId={conversationsProps.viewer.highlightedMessageId}
            highlightText={conversationsProps.viewer.highlightText}
            sourceLabel={conversationsProps.viewer.sourceLabel}
          />
        </>
      )}
      <ClearDataConfirmDialog
        open={clearConfirmOpen}
        clearingData={clearingData}
        onCancel={onCancelClear}
        onConfirm={onConfirmClear}
        cancelBtnRef={clearConfirmCancelBtnRef}
        dialogRef={clearConfirmDialogRef}
      />
      <div className="toast-stack" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.variant}`}>
            <Bell size={14} className="toast-icon" />
            <span>{toast.message}</span>
            <button
              type="button"
              className="toast-dismiss"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
