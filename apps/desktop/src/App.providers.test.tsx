import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { createAppShellProps, AppProviders, useAppProviders } from "./App.providers";
import { renderHook } from "@testing-library/react";

vi.mock("./hooks/useThemeMode", () => ({
  useThemeMode: () => ({ theme: "light" as const, setThemeAndPersist: vi.fn() }),
}));
vi.mock("./hooks/usePrefersReducedMotion", () => ({
  usePrefersReducedMotion: () => false,
}));
vi.mock("./hooks/useToast", () => ({
  useToast: () => ({ toasts: [], pushToast: vi.fn(), dismissToast: vi.fn() }),
}));
vi.mock("./hooks/useCopyClipboard", () => ({
  useCopyClipboard: () => ({
    copyToast: null,
    copyMessageToClipboard: vi.fn(),
    copyConversationToClipboard: vi.fn(),
  }),
}));

describe("App.providers", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    } as unknown as Storage);
  });

  it("useAppProviders aggregates theme/toast/clipboard", () => {
    const { result } = renderHook(() => useAppProviders());
    expect(result.current.theme).toBe("light");
    expect(result.current.toasts).toEqual([]);
    expect(result.current.copyToast).toBeNull();
    expect(typeof result.current.setThemeAndPersist).toBe("function");
    expect(typeof result.current.pushToast).toBe("function");
  });

  it("AppProviders renders children inside ErrorBoundary", () => {
    render(
      <AppProviders>
        <div data-testid="child">hello</div>
      </AppProviders>
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("createAppShellProps builds onboarding/search/conversations props", () => {
    const props = createAppShellProps({
      showOnboarding: false,
      theme: "light",
      setThemeAndPersist: vi.fn(),
      toasts: [],
      dismissToast: vi.fn(),
      shellLayoutClass: "overview-layout",
      appDataState: "ready-has-data",
      activeView: "overview",
      setActiveView: vi.fn(),
      setImportMenuOpen: vi.fn(),
      clearingData: false,
      importing: false,
      loading: false,
      onClearAllDataClick: vi.fn(),
      clearDataTriggerRef: { current: null },
      clearConfirmOpen: false,
      onCancelClear: vi.fn(),
      onConfirmClear: vi.fn(),
      clearConfirmCancelBtnRef: { current: null },
      clearConfirmDialogRef: { current: null },
      importingSource: null,
      importProgress: null,
      importError: null,
      importResult: null,
      importRefreshKey: 0,
      handleImportSource: vi.fn(),
      handleCancelImport: vi.fn(),
      setImportError: vi.fn(),
      setImportResult: vi.fn(),
      handleOverviewSelectConversation: vi.fn(),
      handleRebuildIndex: vi.fn(),
      setSkipOnboarding: vi.fn(),
      setOnboardingVisible: vi.fn(),
      searchPageQuery: "hello",
      setSearchPageQuery: vi.fn(),
      availableSources: ["claude"],
      sourceLabel: (s: string) => s,
      handleSearchResultSelect: vi.fn(),
      searchSelectedConvId: null,
      searchFocusRequestId: null,
      searchPageSnapshot: {
        source: "",
        dateFrom: "",
        dateTo: "",
        sort: "last_occurrence_desc",
        results: [],
        totalMatches: 0,
        totalOccurrences: 0,
        latencyMs: null,
      } as unknown as import("./SearchPage").SearchPageSnapshot,
      setSearchPageSnapshot: vi.fn(),
      skipSearchOnceRef: { current: false },
      searchRestoreConversationId: null,
      setSearchRestoreConversationId: vi.fn(),
      setSearchSelectedConvId: vi.fn(),
      setSearchSelectedConversation: vi.fn(),
      setOpenedConversationFromSearch: vi.fn(),
      setSearchFocusRequestId: vi.fn(),
      conversations: [],
      selectedConvId: null,
      activeSource: null,
      sourceStats: [],
      convItemRefs: { current: {} },
      setActiveSource: vi.fn(),
      handleConversationClick: vi.fn(),
      stats: null,
      selectedConversation: null,
      messages: [],
      messagesLoading: false,
      openedConversationFromSearch: false,
      goBackToSearch: vi.fn(),
      viewerMenuOpen: false,
      setViewerMenuOpen: vi.fn(),
      viewerMenuRef: { current: null },
      viewerSearchOpen: false,
      setViewerSearchOpen: vi.fn(),
      messageSearchQuery: "",
      setMessageSearchQuery: vi.fn(),
      viewerSearchInputRef: { current: null },
      matchCount: 0,
      messageMatchCount: 0,
      currentMatchIndex: 0,
      goToPrevMatch: vi.fn(),
      goToNextMatch: vi.fn(),
      copyToast: null,
      copyMessageToClipboard: vi.fn(),
      copyConversationToClipboard: vi.fn(),
      messageRefs: { current: {} },
      highlightedMessageId: null,
      highlightText: (t: string) => t,
      setSelectedConvId: vi.fn(),
    });
    expect(props.showOnboarding).toBe(false);
    expect(props.shellLayoutClass).toBe("overview-layout");
    expect(props.searchProps.query).toBe("hello");
    expect(props.conversationsProps.activeSource).toBeNull();
    expect(props.overviewProps.onOpenImport).toBeDefined();
    expect(props.importProps.refreshKey).toBe(0);
    // exercise onSkip and onSelectConversation callbacks
    props.onboardingProps.onSkip();
    expect(props.activeView).toBe("overview");
    props.conversationsProps.onSelectConversation("c1");
    props.searchProps.viewer.onClose();
  });

  it("createAppShellProps search viewer callbacks toggle state", () => {
    const setSearchSelectedConvId = vi.fn();
    const setSearchSelectedConversation = vi.fn();
    const setSelectedConvId = vi.fn();
    const setOpenedConversationFromSearch = vi.fn();
    const props = createAppShellProps({
      showOnboarding: false,
      theme: "dark",
      setThemeAndPersist: vi.fn(),
      toasts: [],
      dismissToast: vi.fn(),
      shellLayoutClass: "search-layout",
      appDataState: "ready-has-data",
      activeView: "search",
      setActiveView: vi.fn(),
      setImportMenuOpen: vi.fn(),
      clearingData: false,
      importing: false,
      loading: false,
      onClearAllDataClick: vi.fn(),
      clearDataTriggerRef: { current: null },
      clearConfirmOpen: false,
      onCancelClear: vi.fn(),
      onConfirmClear: vi.fn(),
      clearConfirmCancelBtnRef: { current: null },
      clearConfirmDialogRef: { current: null },
      importingSource: null,
      importProgress: null,
      importError: null,
      importResult: null,
      importRefreshKey: 1,
      handleImportSource: vi.fn(),
      handleCancelImport: vi.fn(),
      setImportError: vi.fn(),
      setImportResult: vi.fn(),
      handleOverviewSelectConversation: vi.fn(),
      handleRebuildIndex: vi.fn(),
      setSkipOnboarding: vi.fn(),
      setOnboardingVisible: vi.fn(),
      searchPageQuery: "",
      setSearchPageQuery: vi.fn(),
      availableSources: [],
      sourceLabel: (s: string) => s,
      handleSearchResultSelect: vi.fn(),
      searchSelectedConvId: "c1",
      searchFocusRequestId: 123,
      searchPageSnapshot: {
        source: "",
        dateFrom: "",
        dateTo: "",
        sort: "last_occurrence_desc",
        results: [],
        totalMatches: 0,
        totalOccurrences: 0,
        latencyMs: null,
      } as unknown as import("./SearchPage").SearchPageSnapshot,
      setSearchPageSnapshot: vi.fn(),
      skipSearchOnceRef: { current: false },
      searchRestoreConversationId: "c1",
      setSearchRestoreConversationId: vi.fn(),
      setSearchSelectedConvId,
      setSearchSelectedConversation,
      setOpenedConversationFromSearch,
      setSearchFocusRequestId: vi.fn(),
      conversations: [],
      selectedConvId: "c1",
      activeSource: null,
      sourceStats: [],
      convItemRefs: { current: {} },
      setActiveSource: vi.fn(),
      handleConversationClick: vi.fn(),
      stats: null,
      selectedConversation: {
        id: "c1",
        source: "claude",
        title: "T",
        created_at: 0,
        last_message_at: 0,
        message_count: 1,
      } as unknown as import("./db").ConversationRow,
      messages: [],
      messagesLoading: false,
      openedConversationFromSearch: true,
      goBackToSearch: vi.fn(),
      viewerMenuOpen: true,
      setViewerMenuOpen: vi.fn(),
      viewerMenuRef: { current: document.createElement("div") },
      viewerSearchOpen: true,
      setViewerSearchOpen: vi.fn(),
      messageSearchQuery: "hi",
      setMessageSearchQuery: vi.fn(),
      viewerSearchInputRef: { current: null },
      matchCount: 1,
      messageMatchCount: 1,
      currentMatchIndex: 0,
      goToPrevMatch: vi.fn(),
      goToNextMatch: vi.fn(),
      copyToast: "Copied",
      copyMessageToClipboard: vi.fn(),
      copyConversationToClipboard: vi.fn(),
      messageRefs: { current: {} },
      highlightedMessageId: "m1",
      highlightText: (t: string) => t,
      setSelectedConvId,
    });
    expect(props.searchProps.viewer.open).toBe(true);
    props.searchProps.viewer.onClose();
    expect(setSearchSelectedConvId).toHaveBeenCalledWith(null);
    expect(props.searchProps.viewer.copyToast).toBe("Copied");
  });
});
