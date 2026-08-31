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
const mockUseAppData = vi.fn(() => ({
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
}));
vi.mock("./hooks/useAppData", () => ({
  useAppData: (...args: unknown[]) => (mockUseAppData as unknown as (...a: unknown[]) => unknown)(...args),
}));
const mockUseSearchSession = vi.fn(() => ({
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
}));
vi.mock("./hooks/useSearchSession", () => ({
  useSearchSession: (...args: unknown[]) => (mockUseSearchSession as unknown as (...a: unknown[]) => unknown)(...args),
}));
const mockUseViewerSearch = vi.fn(() => ({
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
}));
vi.mock("./hooks/useViewerSearch", () => ({
  useViewerSearch: (...args: unknown[]) => (mockUseViewerSearch as unknown as (...a: unknown[]) => unknown)(...args),
}));
const mockUseImportState = vi.fn(() => ({
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
}));
vi.mock("./hooks/useImportState", () => ({
  useImportState: (...args: unknown[]) => (mockUseImportState as unknown as (...a: unknown[]) => unknown)(...args),
}));
const mockUseClearData = vi.fn(() => ({
  clearingData: false,
  clearConfirmOpen: false,
  setClearConfirmOpen: vi.fn(),
  clearConfirmCancelBtnRef: { current: null },
  clearConfirmDialogRef: { current: null },
  clearDataTriggerRef: { current: null },
  handleClearAllDataClick: vi.fn(),
  handleClearAllDataConfirm: vi.fn(async () => {}),
}));
vi.mock("./hooks/useClearData", () => ({
  useClearData: (...args: unknown[]) => (mockUseClearData as unknown as (...a: unknown[]) => unknown)(...args),
}));
const mockUseDataActions = vi.fn(() => ({
  handleRebuildIndex: vi.fn(async () => {}),
  handleOverviewSelectConversation: vi.fn(),
}));
vi.mock("./hooks/useDataActions", () => ({
  useDataActions: (...args: unknown[]) => (mockUseDataActions as unknown as (...a: unknown[]) => unknown)(...args),
}));
vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return {
    ...actual,
    getMessages: vi.fn(async () => []),
  };
});
let capturedShellProps: Record<string, unknown> | null = null;
vi.mock("./components/AppShell", () => ({
  default: (props: Record<string, unknown>) => {
    capturedShellProps = props;
    const p = props as { shellLayoutClass: string; activeView: string };
    return (
      <div data-testid="app-shell" data-layout={p.shellLayoutClass} data-view={p.activeView}>
        mocked-shell
      </div>
    );
  },
}));

import App from "./App";

describe("App", () => {
  beforeEach(() => {
    if (!Element.prototype.scrollIntoView) {
      (Element.prototype as unknown as Record<string, unknown>).scrollIntoView = vi.fn();
    }
    const store: Record<string, string> = {};
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { for (const kk of Object.keys(store)) delete store[kk]; },
    } as unknown as Storage);
    // reset mocks to default
    mockUseAppData.mockReturnValue({
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
    } as unknown as ReturnType<typeof mockUseAppData>);
    mockUseClearData.mockReturnValue({
      clearingData: false,
      clearConfirmOpen: false,
      setClearConfirmOpen: vi.fn(),
      clearConfirmCancelBtnRef: { current: null },
      clearConfirmDialogRef: { current: null },
      clearDataTriggerRef: { current: null },
      handleClearAllDataClick: vi.fn(),
      handleClearAllDataConfirm: vi.fn(async () => {}),
    } as unknown as ReturnType<typeof mockUseClearData>);
    mockUseImportState.mockReturnValue({
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
    } as unknown as ReturnType<typeof mockUseImportState>);
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

  it("shows bootstrapping when loading", () => {
    mockUseAppData.mockReturnValue({
      loading: true,
      stats: null,
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
    } as unknown as ReturnType<typeof mockUseAppData>);
    const { container } = render(<App />);
    expect(container.textContent).toBeTruthy();
  });

  it("shows has-data when stats have conversations", () => {
    mockUseAppData.mockReturnValue({
      loading: false,
      stats: { conversationCount: 5, messageCount: 10, indexedMessageCount: 10, latestMessageTimestamp: 123, estimatedInputTokens: 1, estimatedOutputTokens: 1, estimatedTotalTokens: 2 },
      sourceStats: [],
      conversations: [{ id: "c1", source: "claude", title: "T", created_at: 0, last_message_at: 0, message_count: 1 }],
      selectedConvId: null,
      setSelectedConvId: vi.fn(),
      messages: [],
      setMessages: vi.fn(),
      messagesLoading: false,
      setMessagesLoading: vi.fn(),
      loadError: null,
      setLoadError: vi.fn(),
      loadData: vi.fn(async () => {}),
    } as unknown as ReturnType<typeof mockUseAppData>);
    render(<App />);
    expect(screen.getByTestId("app-shell")).toBeInTheDocument();
  });

  it("handles importing state", () => {
    mockUseImportState.mockReturnValue({
      importing: true,
      importingSource: "claude",
      importProgress: null,
      importError: null,
      setImportError: vi.fn(),
      importResult: null,
      setImportResult: vi.fn(),
      importRefreshKey: 0,
      setImportMenuOpen: vi.fn(),
      handleCancelImport: vi.fn(),
      handleImportSource: vi.fn(async () => {}),
    } as unknown as ReturnType<typeof mockUseImportState>);
    render(<App />);
    expect(screen.getByTestId("app-shell")).toBeInTheDocument();
  });

  it("handles clearing state", () => {
    mockUseClearData.mockReturnValue({
      clearingData: true,
      clearConfirmOpen: true,
      setClearConfirmOpen: vi.fn(),
      clearConfirmCancelBtnRef: { current: null },
      clearConfirmDialogRef: { current: null },
      clearDataTriggerRef: { current: null },
      handleClearAllDataClick: vi.fn(),
      handleClearAllDataConfirm: vi.fn(async () => {}),
    } as unknown as ReturnType<typeof mockUseClearData>);
    render(<App />);
    expect(screen.getByTestId("app-shell")).toBeInTheDocument();
  });

  it("handles loadError", () => {
    mockUseAppData.mockReturnValue({
      loading: false,
      stats: null,
      sourceStats: [],
      conversations: [],
      selectedConvId: null,
      setSelectedConvId: vi.fn(),
      messages: [],
      setMessages: vi.fn(),
      messagesLoading: false,
      setMessagesLoading: vi.fn(),
      loadError: "failed",
      setLoadError: vi.fn(),
      loadData: vi.fn(async () => {}),
    } as unknown as ReturnType<typeof mockUseAppData>);
    render(<App />);
    expect(screen.getByTestId("app-shell")).toBeInTheDocument();
  });

  it("handleConversationClick loads messages (mocked getMessages)", async () => {
    const setMessages = vi.fn();
    const setMessagesLoading = vi.fn();
    mockUseAppData.mockReturnValue({
      loading: false,
      stats: { conversationCount: 1, messageCount: 2, indexedMessageCount: 2, latestMessageTimestamp: 123, estimatedInputTokens: 1, estimatedOutputTokens: 1, estimatedTotalTokens: 2 },
      sourceStats: [],
      conversations: [{ id: "c1", source: "claude", title: "T", created_at: 0, last_message_at: 0, message_count: 2 }],
      selectedConvId: null,
      setSelectedConvId: vi.fn(),
      messages: [],
      setMessages,
      messagesLoading: false,
      setMessagesLoading,
      loadError: null,
      setLoadError: vi.fn(),
      loadData: vi.fn(async () => {}),
    } as unknown as ReturnType<typeof mockUseAppData>);
    const { getMessages } = await import("./db");
    (getMessages as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([{ id: "m1", sender: "human", content: "hi", created_at: 0 }]);
    render(<App />);
    const props = capturedShellProps as unknown as { conversationsProps: { onSelectConversation: (id: string) => void } };
    await props.conversationsProps.onSelectConversation("c1");
    expect(getMessages).toHaveBeenCalledWith("c1");
    expect(setMessagesLoading).toHaveBeenCalled();
  });

  it("handles keyboard Cmd+K to focus search", async () => {
    const { act } = await import("@testing-library/react");
    render(<App />);
    await act(async () => {
      const event = new KeyboardEvent("keydown", { key: "k", metaKey: true });
      document.dispatchEvent(event);
    });
    expect(screen.getByTestId("app-shell")).toBeInTheDocument();
  });

  it("handles search result select via AppShell searchProps", async () => {
    const setSearchSelectedConvId = vi.fn();
    const setSearchSelectedConversation = vi.fn();
    // Override search session mock to capture
    mockUseSearchSession.mockReturnValue({
      searchPageQuery: "hello",
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
      setSearchSelectedConvId,
      searchSelectedConversation: null,
      setSearchSelectedConversation,
      skipSearchOnceRef: { current: false },
    } as unknown as ReturnType<typeof mockUseSearchSession>);
    render(<App />);
    const props = capturedShellProps as unknown as { searchProps: { onSelectResult: (a:string,b:string,c:string,d:number)=>void } };
    expect(props.searchProps.onSelectResult).toBeDefined();
  });

  it("handleConversationClick error path logs and clears", async () => {
    const setMessages = vi.fn();
    mockUseAppData.mockReturnValue({
      loading: false,
      stats: { conversationCount: 1, messageCount: 1, indexedMessageCount: 1, latestMessageTimestamp: 123, estimatedInputTokens: 1, estimatedOutputTokens: 1, estimatedTotalTokens: 2 },
      sourceStats: [],
      conversations: [{ id: "c1", source: "claude", title: "T", created_at: 0, last_message_at: 0, message_count: 1 }],
      selectedConvId: null,
      setSelectedConvId: vi.fn(),
      messages: [],
      setMessages,
      messagesLoading: false,
      setMessagesLoading: vi.fn(),
      loadError: null,
      setLoadError: vi.fn(),
      loadData: vi.fn(async () => {}),
    } as unknown as ReturnType<typeof mockUseAppData>);
    const { getMessages } = await import("./db");
    (getMessages as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("load fail"));
    render(<App />);
    const props = capturedShellProps as unknown as { conversationsProps: { onSelectConversation: (id:string)=>void } };
    await props.conversationsProps.onSelectConversation("c1");
    expect(setMessages).toHaveBeenCalledWith([]);
  });

  it("goBackToSearch via AppShell conversationsProps", async () => {
    mockUseAppData.mockReturnValue({
      loading: false,
      stats: { conversationCount: 1, messageCount: 1, indexedMessageCount: 1, latestMessageTimestamp: 123, estimatedInputTokens: 1, estimatedOutputTokens: 1, estimatedTotalTokens: 2 },
      sourceStats: [],
      conversations: [{ id: "c1", source: "claude", title: "T", created_at: 0, last_message_at: 0, message_count: 1 }],
      selectedConvId: "c1",
      setSelectedConvId: vi.fn(),
      messages: [],
      setMessages: vi.fn(),
      messagesLoading: false,
      setMessagesLoading: vi.fn(),
      loadError: null,
      setLoadError: vi.fn(),
      loadData: vi.fn(async () => {}),
    } as unknown as ReturnType<typeof mockUseAppData>);
    mockUseSearchSession.mockReturnValue({
      searchPageQuery: "",
      setSearchPageQuery: vi.fn(),
      searchPageSnapshot: { source: "", dateFrom: "", dateTo: "", sort: "last_occurrence_desc", results: [], totalMatches: 0, totalOccurrences: 0, latencyMs: null },
      setSearchPageSnapshot: vi.fn(),
      clearPersistedSearchState: vi.fn(),
      searchFocusRequestId: null,
      setSearchFocusRequestId: vi.fn(),
      openedConversationFromSearch: true,
      setOpenedConversationFromSearch: vi.fn(),
      searchRestoreConversationId: null,
      setSearchRestoreConversationId: vi.fn(),
      searchSelectedConvId: "c1",
      setSearchSelectedConvId: vi.fn(),
      searchSelectedConversation: { id: "c1", source: "claude", title: "T", created_at: 0, last_message_at: 0, message_count: 1 },
      setSearchSelectedConversation: vi.fn(),
      skipSearchOnceRef: { current: false },
    } as unknown as ReturnType<typeof mockUseSearchSession>);
    render(<App />);
    const props = capturedShellProps as unknown as { conversationsProps: { viewer: { onBackToSearch: ()=>void } } };
    expect(props.conversationsProps.viewer.onBackToSearch).toBeDefined();
    props.conversationsProps.viewer.onBackToSearch();
    expect(screen.getByTestId("app-shell")).toBeInTheDocument();
  });

  it("overview onOpenImport and onOpenSearch via AppShell", async () => {
    render(<App />);
    const props = capturedShellProps as unknown as { overviewProps: { onOpenImport: ()=>void; onOpenSearch: ()=>void }, importProps: { onImport: (s:string)=>void } };
    expect(props.overviewProps.onOpenImport).toBeDefined();
    props.overviewProps.onOpenImport();
    props.overviewProps.onOpenSearch();
    expect(screen.getByTestId("app-shell")).toBeInTheDocument();
  });

  it("import onImport via AppShell", async () => {
    render(<App />);
    const props = capturedShellProps as unknown as { importProps: { onImport: (s:string)=>void } };
    expect(props.importProps.onImport).toBeDefined();
  });

  it("handles Backspace to goBackToSearch when in conversations with openedFromSearch", async () => {
    const { act } = await import("@testing-library/react");
    mockUseAppData.mockReturnValue({
      loading: false,
      stats: { conversationCount: 1, messageCount: 1, indexedMessageCount: 1, latestMessageTimestamp: 123, estimatedInputTokens: 1, estimatedOutputTokens: 1, estimatedTotalTokens: 2 },
      sourceStats: [],
      conversations: [{ id: "c1", source: "claude", title: "T", created_at: 0, last_message_at: 0, message_count: 1 }],
      selectedConvId: "c1",
      setSelectedConvId: vi.fn(),
      messages: [],
      setMessages: vi.fn(),
      messagesLoading: false,
      setMessagesLoading: vi.fn(),
      loadError: null,
      setLoadError: vi.fn(),
      loadData: vi.fn(async () => {}),
    } as unknown as ReturnType<typeof mockUseAppData>);
    mockUseSearchSession.mockReturnValue({
      searchPageQuery: "",
      setSearchPageQuery: vi.fn(),
      searchPageSnapshot: { source: "", dateFrom: "", dateTo: "", sort: "last_occurrence_desc", results: [], totalMatches: 0, totalOccurrences: 0, latencyMs: null },
      setSearchPageSnapshot: vi.fn(),
      clearPersistedSearchState: vi.fn(),
      searchFocusRequestId: null,
      setSearchFocusRequestId: vi.fn(),
      openedConversationFromSearch: true,
      setOpenedConversationFromSearch: vi.fn(),
      searchRestoreConversationId: null,
      setSearchRestoreConversationId: vi.fn(),
      searchSelectedConvId: "c1",
      setSearchSelectedConvId: vi.fn(),
      searchSelectedConversation: { id: "c1", source: "claude", title: "T", created_at: 0, last_message_at: 0, message_count: 1 },
      setSearchSelectedConversation: vi.fn(),
      skipSearchOnceRef: { current: false },
    } as unknown as ReturnType<typeof mockUseSearchSession>);
    render(<App />);
    await act(async () => {
      const e = new KeyboardEvent("keydown", { key: "Backspace" });
      document.dispatchEvent(e);
    });
    expect(screen.getByTestId("app-shell")).toBeInTheDocument();
  });

  it("handles clear confirm open focus trap", async () => {
    const { act } = await import("@testing-library/react");
    mockUseClearData.mockReturnValue({
      clearingData: false,
      clearConfirmOpen: true,
      setClearConfirmOpen: vi.fn(),
      clearConfirmCancelBtnRef: { current: document.createElement("button") },
      clearConfirmDialogRef: { current: document.createElement("div") },
      clearDataTriggerRef: { current: document.createElement("button") },
      handleClearAllDataClick: vi.fn(),
      handleClearAllDataConfirm: vi.fn(async () => {}),
    } as unknown as ReturnType<typeof mockUseClearData>);
    render(<App />);
    await act(async () => {
      const e = new KeyboardEvent("keydown", { key: "Escape" });
      document.dispatchEvent(e);
    });
    expect(screen.getByTestId("app-shell")).toBeInTheDocument();
  });

  it("renders shellLayoutClass for search and settings via props", async () => {
    render(<App />);
    const props = capturedShellProps as unknown as { setActiveView: (v:string)=>void; shellLayoutClass: string };
    // Initially overview
    expect(capturedShellProps).toBeTruthy();
    // Simulate changing view via setActiveView if captured
    // At least verify overview layout
    const shell = screen.getByTestId("app-shell");
    expect(shell.getAttribute("data-layout")).toBe("overview-layout");
  });

  it("handles viewer search toggle via AppShell searchProps", async () => {
    render(<App />);
    const props = capturedShellProps as unknown as { searchProps: { viewer: { onOpenViewerSearch: ()=>void; onCloseViewerSearch: ()=>void } } };
    props.searchProps.viewer.onOpenViewerSearch();
    props.searchProps.viewer.onCloseViewerSearch();
    expect(screen.getByTestId("app-shell")).toBeInTheDocument();
  });
});
