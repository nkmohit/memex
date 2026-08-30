import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock all heavy hooks before importing App
vi.mock("./hooks/useThemeMode", () => ({
  useThemeMode: () => ({ theme: "light", setThemeAndPersist: vi.fn() }),
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
vi.mock("./hooks/useAppData", () => ({
  useAppData: () => ({
    loading: false,
    stats: { conversationCount: 0, messageCount: 0, indexedMessageCount: 0, latestMessageTimestamp: null, estimatedInputTokens: 0, estimatedOutputTokens: 0, estimatedTotalTokens: 0 },
    sourceStats: [],
    conversations: [],
    selectedConvId: null,
    setSelectedConvId: vi.fn(),
    messages: [],
    setMessages: vi.fn(),
    messagesLoading: false,
    setMessagesLoading: vi.fn(),
    loadError: null,
    setLoadError: vi.fn(),
    loadData: vi.fn(async () => {}),
  }),
}));
vi.mock("./hooks/useSearchSession", () => ({
  useSearchSession: () => ({
    searchPageQuery: "",
    setSearchPageQuery: vi.fn(),
    searchPageSnapshot: { source: "", dateFrom: "", dateTo: "", sort: "last_occurrence_desc", results: [], totalMatches: 0, totalOccurrences: 0, latencyMs: null },
    setSearchPageSnapshot: vi.fn(),
    clearPersistedSearchState: vi.fn(),
    searchFocusRequestId: null,
    setSearchFocusRequestId: vi.fn(),
    openedConversationFromSearch: false,
    setOpenedConversationFromSearch: vi.fn(),
    searchRestoreConversationId: null,
    setSearchRestoreConversationId: vi.fn(),
    searchSelectedConvId: null,
    setSearchSelectedConvId: vi.fn(),
    searchSelectedConversation: null,
    setSearchSelectedConversation: vi.fn(),
    skipSearchOnceRef: { current: false },
  }),
}));
vi.mock("./hooks/useViewerSearch", () => ({
  useViewerSearch: () => ({
    messageSearchQuery: "",
    setMessageSearchQuery: vi.fn(),
    viewerSearchOpen: false,
    setViewerSearchOpen: vi.fn(),
    viewerMenuOpen: false,
    setViewerMenuOpen: vi.fn(),
    viewerSearchInputRef: { current: null },
    viewerMenuRef: { current: null },
    highlightedMessageId: null,
    setHighlightedMessageId: vi.fn(),
    highlightText: (t: string) => t,
    matchCount: 0,
    messageMatchCount: 0,
    currentMatchIndex: 0,
    goToPrevMatch: vi.fn(),
    goToNextMatch: vi.fn(),
  }),
}));
vi.mock("./hooks/useImportState", () => ({
  useImportState: () => ({
    importing: false,
    importingSource: null,
    importProgress: null,
    importError: null,
    setImportError: vi.fn(),
    importResult: null,
    setImportResult: vi.fn(),
    importRefreshKey: 0,
    setImportMenuOpen: vi.fn(),
    handleCancelImport: vi.fn(),
    handleImportSource: vi.fn(async () => {}),
  }),
}));
vi.mock("./hooks/useClearData", () => ({
  useClearData: () => ({
    clearingData: false,
    clearConfirmOpen: false,
    setClearConfirmOpen: vi.fn(),
    clearConfirmCancelBtnRef: { current: null },
    clearConfirmDialogRef: { current: null },
    clearDataTriggerRef: { current: null },
    handleClearAllDataClick: vi.fn(),
    handleClearAllDataConfirm: vi.fn(async () => {}),
  }),
}));
vi.mock("./hooks/useDataActions", () => ({
  useDataActions: () => ({
    handleRebuildIndex: vi.fn(async () => {}),
    handleOverviewSelectConversation: vi.fn(),
  }),
}));
vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return {
    ...actual,
    getMessages: vi.fn(async () => []),
  };
});
vi.mock("./components/AppShell", () => ({
  default: (props: { shellLayoutClass: string; activeView: string }) => (
    <div data-testid="app-shell" data-layout={props.shellLayoutClass} data-view={props.activeView}>
      mocked-shell
    </div>
  ),
}));

import App from "./App";

describe("App", () => {
  beforeEach(() => {
    if (!Element.prototype.scrollIntoView) {
      // @ts-expect-error
      Element.prototype.scrollIntoView = vi.fn();
    }
    const store: Record<string, string> = {};
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { for (const kk of Object.keys(store)) delete store[kk]; },
    } as unknown as Storage);
  });

  it("renders without crashing (smoke)", () => {
    render(<App />);
    expect(screen.getByTestId("app-shell")).toBeInTheDocument();
  });

  it("passes shell layout and active view to AppShell", () => {
    render(<App />);
    const shell = screen.getByTestId("app-shell");
    expect(shell.getAttribute("data-view")).toBe("overview");
    expect(shell.getAttribute("data-layout")).toBe("overview-layout");
  });
});
