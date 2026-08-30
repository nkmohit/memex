import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AppShell from "./AppShell";
import type { SearchPageSnapshot } from "../SearchPage";

vi.mock("../OverviewPage", () => ({
  default: (props: { onOpenImport: () => void; onOpenSearch: () => void }) => (
    <div data-testid="overview-page">
      <button onClick={props.onOpenImport}>overview-import</button>
      <button onClick={props.onOpenSearch}>overview-search</button>
    </div>
  ),
}));
vi.mock("../ImportPage", () => ({
  default: () => <div data-testid="import-page">import</div>,
}));
vi.mock("../OnboardingPage", () => ({
  default: ({ onSkip }: { onSkip: () => void }) => (
    <div data-testid="onboarding">
      <button onClick={onSkip}>skip</button>
    </div>
  ),
}));
vi.mock("./Sidebar", () => ({
  default: ({ activeView, onSelectView }: { activeView: string; onSelectView: (v: string) => void }) => (
    <nav data-testid="sidebar" data-active={activeView}>
      <button onClick={() => onSelectView("overview")}>go-overview</button>
      <button onClick={() => onSelectView("search")}>go-search</button>
    </nav>
  ),
}));
vi.mock("../panels/SearchPanel", () => ({
  default: () => <div data-testid="search-panel">search</div>,
}));
vi.mock("../panels/ConversationListPanel", () => ({
  default: () => <div data-testid="conv-list">list</div>,
}));
vi.mock("../panels/ConversationViewerPanel", () => ({
  default: () => <div data-testid="conv-viewer">viewer</div>,
}));
vi.mock("../panels/SettingsPanel", () => ({
  default: () => <div data-testid="settings">settings</div>,
}));
vi.mock("../panels/ClearDataConfirmDialog", () => ({
  default: ({ open }: { open: boolean }) => (open ? <div data-testid="clear-dialog">clear</div> : null),
}));

function makeProps(overrides: Partial<React.ComponentProps<typeof AppShell>> = {}) {
  const base: React.ComponentProps<typeof AppShell> = {
    showOnboarding: false,
    onboardingProps: {
      onImport: vi.fn(),
      importing: false,
      importingSource: null,
      onCancelImport: vi.fn(),
      importProgress: null,
      onSkip: vi.fn(),
    },
    toasts: [],
    dismissToast: vi.fn(),
    shellLayoutClass: "overview-layout",
    appDataState: "ready-has-data",
    activeView: "overview",
    setActiveView: vi.fn(),
    setImportMenuOpen: vi.fn(),
    theme: "system",
    setThemeAndPersist: vi.fn(),
    clearingData: false,
    importing: false,
    loading: false,
    onClearAllDataClick: vi.fn(),
    clearDataTriggerRef: { current: null },
    clearConfirmOpen: false,
    clearingDataConfirm: false,
    onCancelClear: vi.fn(),
    onConfirmClear: vi.fn(),
    clearConfirmCancelBtnRef: { current: null },
    clearConfirmDialogRef: { current: null },
    overviewProps: {
      onOpenImport: vi.fn(),
      onOpenSearch: vi.fn(),
      onSelectConversation: vi.fn(),
      onRebuildIndex: vi.fn(),
    },
    importProps: {
      onImport: vi.fn(),
      importing: false,
      importingSource: null,
      onCancelImport: vi.fn(),
      importProgress: null,
      importError: null,
      importResult: null,
      onDismissImportError: vi.fn(),
      onDismissImportResult: vi.fn(),
      refreshKey: 0,
    },
    searchProps: {
      query: "",
      onQueryChange: vi.fn(),
      availableSources: [],
      sourceLabel: (s: string) => s,
      onSelectResult: vi.fn(),
      selectedConversationId: null,
      focusRequestId: null,
      snapshot: {
        source: "",
        dateFrom: "",
        dateTo: "",
        sort: "last_occurrence_desc",
        results: [],
        totalMatches: 0,
        totalOccurrences: 0,
        latencyMs: null,
      } as SearchPageSnapshot,
      onSnapshotChange: vi.fn(),
      skipSearchOnceRef: { current: false },
      restoreSelectedConversationId: null,
      onRestoreSelectionDone: vi.fn(),
      viewer: {
        open: false,
        onClose: vi.fn(),
        selectedConversation: null,
        messages: [],
        messagesLoading: false,
        viewerSearchOpen: false,
        onOpenViewerSearch: vi.fn(),
        onCloseViewerSearch: vi.fn(),
        messageSearchQuery: "",
        onMessageSearchQueryChange: vi.fn(),
        viewerSearchInputRef: { current: null },
        matchCount: 0,
        messageMatchCount: 0,
        currentMatchIndex: 0,
        onPrevMatch: vi.fn(),
        onNextMatch: vi.fn(),
        copyToast: null,
        onCopyMessage: vi.fn(),
        messageRefs: { current: {} },
        highlightedMessageId: null,
        highlightText: (t: string) => t,
      },
    },
    conversationsProps: {
      conversations: [],
      loading: false,
      selectedConvId: null,
      activeSource: null,
      availableSources: [],
      sourceStats: [],
      convItemRefs: { current: {} },
      onSelectSource: vi.fn(),
      onSelectConversation: vi.fn(),
      sourceLabel: (s: string) => s,
      viewer: {
        stats: null,
        selectedConversation: null,
        messages: [],
        messagesLoading: false,
        openedConversationFromSearch: false,
        onBackToSearch: vi.fn(),
        viewerMenuOpen: false,
        onToggleViewerMenu: vi.fn(),
        onCloseViewerMenu: vi.fn(),
        viewerMenuRef: { current: null },
        viewerSearchOpen: false,
        onOpenViewerSearch: vi.fn(),
        onCloseViewerSearch: vi.fn(),
        messageSearchQuery: "",
        onMessageSearchQueryChange: vi.fn(),
        viewerSearchInputRef: { current: null },
        matchCount: 0,
        messageMatchCount: 0,
        currentMatchIndex: 0,
        onPrevMatch: vi.fn(),
        onNextMatch: vi.fn(),
        copyToast: null,
        onCopyConversation: vi.fn(),
        onCopyMessage: vi.fn(),
        messageRefs: { current: {} },
        highlightedMessageId: null,
        highlightText: (t: string) => t,
        sourceLabel: (s: string) => s,
      },
    },
  };
  return { ...base, ...overrides } as React.ComponentProps<typeof AppShell>;
}

describe("AppShell", () => {
  it("renders onboarding when showOnboarding (happy path)", () => {
    render(<AppShell {...makeProps({ showOnboarding: true })} />);
    expect(screen.getByTestId("onboarding")).toBeInTheDocument();
    expect(screen.queryByTestId("sidebar")).not.toBeInTheDocument();
  });

  it("renders overview when activeView=overview (happy path)", () => {
    render(<AppShell {...makeProps({ activeView: "overview" })} />);
    expect(screen.getByTestId("overview-page")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar")).toBeInTheDocument();
  });

  it("renders search panel when activeView=search", () => {
    render(<AppShell {...makeProps({ activeView: "search" })} />);
    expect(screen.getByTestId("search-panel")).toBeInTheDocument();
  });

  it("renders import page when activeView=import", () => {
    render(<AppShell {...makeProps({ activeView: "import" })} />);
    expect(screen.getByTestId("import-page")).toBeInTheDocument();
  });

  it("renders toasts and dismisses (error/empty path)", () => {
    const dismiss = vi.fn();
    render(
      <AppShell
        {...makeProps({
          toasts: [{ id: 1, message: "hello toast", variant: "info" }],
          dismissToast: dismiss,
        })}
      />
    );
    expect(screen.getByText("hello toast")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Dismiss"));
    expect(dismiss).toHaveBeenCalledWith(1);
  });

  it("shows clear dialog when open", () => {
    render(<AppShell {...makeProps({ clearConfirmOpen: true })} />);
    expect(screen.getByTestId("clear-dialog")).toBeInTheDocument();
  });

  it("renders settings when activeView=settings", () => {
    render(<AppShell {...makeProps({ activeView: "settings" })} />);
    expect(screen.getByTestId("settings")).toBeInTheDocument();
  });

  it("renders conversations list+viewer when activeView=conversations", () => {
    render(<AppShell {...makeProps({ activeView: "conversations" })} />);
    expect(screen.getByTestId("conv-list")).toBeInTheDocument();
    expect(screen.getByTestId("conv-viewer")).toBeInTheDocument();
  });

  it("onboarding dismiss via skip", () => {
    const onSkip = vi.fn();
    render(<AppShell {...makeProps({ showOnboarding: true, onboardingProps: { onImport: vi.fn(), importing: false, importingSource: null, onCancelImport: vi.fn(), importProgress: null, onSkip } })} />);
    fireEvent.click(screen.getByText("skip"));
    expect(onSkip).toHaveBeenCalled();
  });

  it("sidebar onSelectView triggers setActiveView", () => {
    const setActiveView = vi.fn();
    render(<AppShell {...makeProps({ setActiveView })} />);
    fireEvent.click(screen.getByText("go-search"));
    expect(setActiveView).toHaveBeenCalledWith("search");
  });

  it("shows multiple toasts", () => {
    render(
      <AppShell
        {...makeProps({
          toasts: [
            { id: 1, message: "one", variant: "info" },
            { id: 2, message: "two", variant: "error" },
          ],
        })}
      />
    );
    expect(screen.getByText("one")).toBeInTheDocument();
    expect(screen.getByText("two")).toBeInTheDocument();
  });
});
