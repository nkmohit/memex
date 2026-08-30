import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SearchPanel from "./SearchPanel";
import type { SearchPageSnapshot } from "../SearchPage";

// Mock SearchPage to avoid real DB + complex logic
vi.mock("../SearchPage", () => ({
  default: ({
    query,
    onQueryChange,
  }: {
    query: string;
    onQueryChange: (q: string) => void;
  }) => (
    <div data-testid="search-page">
      <input
        aria-label="mock-query"
        value={query}
        onChange={(e) => onQueryChange((e.target as HTMLInputElement).value)}
      />
    </div>
  ),
}));

function makeSnapshot(): SearchPageSnapshot {
  return {
    source: "",
    dateFrom: "",
    dateTo: "",
    sort: "last_occurrence_desc",
    results: [],
    totalMatches: 0,
    totalOccurrences: 0,
    latencyMs: null,
  };
}

function makeViewer(overrides: Partial<React.ComponentProps<typeof SearchPanel>["viewer"]> = {}) {
  return {
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
    viewerSearchInputRef: { current: null } as React.RefObject<HTMLInputElement | null>,
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
    ...overrides,
  };
}

describe("SearchPanel", () => {
  it("renders SearchPage and handles query change (happy path)", () => {
    const onQueryChange = vi.fn();
    const onSelectResult = vi.fn();
    render(
      <SearchPanel
        query="hello"
        onQueryChange={onQueryChange}
        availableSources={["claude", "chatgpt"]}
        sourceLabel={(s) => s}
        onSelectResult={onSelectResult}
        selectedConversationId={null}
        focusRequestId={null}
        snapshot={makeSnapshot()}
        onSnapshotChange={vi.fn()}
        skipSearchOnceRef={{ current: false }}
        restoreSelectedConversationId={null}
        onRestoreSelectionDone={vi.fn()}
        viewer={makeViewer()}
      />
    );
    expect(screen.getByTestId("search-page")).toBeInTheDocument();
    const input = screen.getByLabelText("mock-query");
    expect(input).toHaveValue("hello");
    fireEvent.change(input, { target: { value: "world" } });
    expect(onQueryChange).toHaveBeenCalledWith("world");
  });

  it("renders viewer when open with selected conversation", () => {
    const viewer = makeViewer({
      open: true,
      selectedConversation: {
        id: "c1",
        source: "claude",
        title: "Test",
        created_at: Date.now(),
        last_message_at: Date.now(),
        message_count: 2,
      },
      messages: [
        { id: "m1", sender: "human", content: "hello", created_at: Date.now() },
        { id: "m2", sender: "assistant", content: "world", created_at: Date.now() },
      ],
    });
    render(
      <SearchPanel
        query="hello"
        onQueryChange={vi.fn()}
        availableSources={[]}
        sourceLabel={(s) => s}
        onSelectResult={vi.fn()}
        selectedConversationId="c1"
        focusRequestId={null}
        snapshot={makeSnapshot()}
        onSnapshotChange={vi.fn()}
        skipSearchOnceRef={{ current: false }}
        restoreSelectedConversationId={null}
        onRestoreSelectionDone={vi.fn()}
        viewer={viewer}
      />
    );
    expect(screen.getByText("Test")).toBeInTheDocument();
    expect(screen.getByText("2 messages")).toBeInTheDocument();
  });

  it("shows empty viewer when no conversation selected (error/empty path)", () => {
    const viewer = makeViewer({ open: true, selectedConversation: null });
    render(
      <SearchPanel
        query=""
        onQueryChange={vi.fn()}
        availableSources={[]}
        sourceLabel={(s) => s}
        onSelectResult={vi.fn()}
        selectedConversationId={null}
        focusRequestId={null}
        snapshot={makeSnapshot()}
        onSnapshotChange={vi.fn()}
        skipSearchOnceRef={{ current: false }}
        restoreSelectedConversationId={null}
        onRestoreSelectionDone={vi.fn()}
        viewer={viewer}
      />
    );
    expect(screen.getByText("Select a conversation to view messages.")).toBeInTheDocument();
  });

  it("shows loading when messagesLoading", () => {
    const viewer = makeViewer({
      open: true,
      selectedConversation: { id: "c1", source: "claude", title: "T", created_at: 1, last_message_at: 1, message_count: 1 },
      messagesLoading: true,
    });
    render(
      <SearchPanel query="" onQueryChange={vi.fn()} availableSources={[]} sourceLabel={(s) => s} onSelectResult={vi.fn()} selectedConversationId="c1" focusRequestId={null} snapshot={makeSnapshot()} onSnapshotChange={vi.fn()} skipSearchOnceRef={{ current: false }} restoreSelectedConversationId={null} onRestoreSelectionDone={vi.fn()} viewer={viewer} />
    );
    expect(screen.getByText("Loading messages...")).toBeInTheDocument();
  });

  it("viewer search open shows input and nav", () => {
    const onCloseViewerSearch = vi.fn();
    const onPrev = vi.fn();
    const onNext = vi.fn();
    const onQuery = vi.fn();
    const viewer = makeViewer({
      open: true,
      selectedConversation: { id: "c1", source: "claude", title: "T", created_at: Date.now(), last_message_at: Date.now(), message_count: 2 },
      messages: [{ id: "m1", sender: "human", content: "hello world hello", created_at: 1 }],
      viewerSearchOpen: true,
      messageSearchQuery: "hello",
      matchCount: 2,
      messageMatchCount: 1,
      currentMatchIndex: 0,
      onCloseViewerSearch,
      onPrevMatch: onPrev,
      onNextMatch: onNext,
      onMessageSearchQueryChange: onQuery,
      highlightText: (t: string) => t,
      copyToast: "copied!",
    });
    render(
      <SearchPanel query="" onQueryChange={vi.fn()} availableSources={[]} sourceLabel={(s) => s} onSelectResult={vi.fn()} selectedConversationId="c1" focusRequestId={null} snapshot={makeSnapshot()} onSnapshotChange={vi.fn()} skipSearchOnceRef={{ current: false }} restoreSelectedConversationId={null} onRestoreSelectionDone={vi.fn()} viewer={viewer} />
    );
    expect(screen.getByPlaceholderText("Search in conversation...")).toBeInTheDocument();
    expect(screen.getByText("1 of 2")).toBeInTheDocument();
    expect(screen.getByText("copied!")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Previous match"));
    expect(onPrev).toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText("Next match"));
    expect(onNext).toHaveBeenCalled();
    fireEvent.change(screen.getByPlaceholderText("Search in conversation..."), { target: { value: "new" } });
    expect(onQuery).toHaveBeenCalledWith("new");
    fireEvent.click(screen.getByLabelText("Close in-conversation search"));
    expect(onCloseViewerSearch).toHaveBeenCalled();
  });

  it("viewer search no results", () => {
    const viewer = makeViewer({
      open: true,
      selectedConversation: { id: "c1", source: "claude", title: "T", created_at: 1, last_message_at: 1, message_count: 1 },
      messages: [{ id: "m1", sender: "human", content: "hello", created_at: 1 }],
      viewerSearchOpen: true,
      messageSearchQuery: "zzz",
      matchCount: 0,
    });
    render(
      <SearchPanel query="" onQueryChange={vi.fn()} availableSources={[]} sourceLabel={(s) => s} onSelectResult={vi.fn()} selectedConversationId="c1" focusRequestId={null} snapshot={makeSnapshot()} onSnapshotChange={vi.fn()} skipSearchOnceRef={{ current: false }} restoreSelectedConversationId={null} onRestoreSelectionDone={vi.fn()} viewer={viewer} />
    );
    expect(screen.getByText("No results")).toBeInTheDocument();
  });

  it("copy message button calls onCopyMessage and highlights", () => {
    const onCopy = vi.fn();
    const viewer = makeViewer({
      open: true,
      selectedConversation: { id: "c1", source: "chatgpt", title: "Chat", created_at: 1, last_message_at: 1, message_count: 1 },
      messages: [{ id: "m1", sender: "assistant", content: "answer", created_at: 1 }],
      highlightedMessageId: "m1",
      onCopyMessage: onCopy,
    });
    render(
      <SearchPanel query="" onQueryChange={vi.fn()} availableSources={[]} sourceLabel={(s) => s} onSelectResult={vi.fn()} selectedConversationId="c1" focusRequestId={null} snapshot={makeSnapshot()} onSnapshotChange={vi.fn()} skipSearchOnceRef={{ current: false }} restoreSelectedConversationId={null} onRestoreSelectionDone={vi.fn()} viewer={viewer} />
    );
    fireEvent.click(screen.getByLabelText("Copy message"));
    expect(onCopy).toHaveBeenCalled();
    expect(document.querySelector(".highlighted")).toBeInTheDocument();
  });

  it("opens viewer search via icon button", () => {
    const onOpen = vi.fn();
    const viewer = makeViewer({
      open: true,
      selectedConversation: { id: "c1", source: "claude", title: "T", created_at: 1, last_message_at: 1, message_count: 1 },
      messages: [{ id: "m1", sender: "human", content: "hi", created_at: 1 }],
      viewerSearchOpen: false,
      onOpenViewerSearch: onOpen,
    });
    render(
      <SearchPanel query="" onQueryChange={vi.fn()} availableSources={[]} sourceLabel={(s) => s} onSelectResult={vi.fn()} selectedConversationId="c1" focusRequestId={null} snapshot={makeSnapshot()} onSnapshotChange={vi.fn()} skipSearchOnceRef={{ current: false }} restoreSelectedConversationId={null} onRestoreSelectionDone={vi.fn()} viewer={viewer} />
    );
    fireEvent.click(screen.getByLabelText("Search in conversation"));
    expect(onOpen).toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText("Close panel"));
    expect(viewer.onClose).toHaveBeenCalled();
  });
});
